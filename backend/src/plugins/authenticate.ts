import fp from 'fastify-plugin';
import { FastifyRequest, FastifyReply } from 'fastify';
import { jwtVerify, importSPKI } from 'jose';
import { prisma } from '../lib/prisma';

const JWT_ISSUER = 'taxbridge-api';
const JWT_AUDIENCE = 'taxbridge-client';

let publicKeyPromise: ReturnType<typeof importSPKI> | undefined;

async function getPublicKey() {
  if (!publicKeyPromise) {
    const encoded = process.env.JWT_PUBLIC_KEY;
    if (!encoded) throw new Error('JWT_PUBLIC_KEY is required');
    const pem = Buffer.from(encoded, 'base64').toString('utf8');
    if (!pem.includes('BEGIN PUBLIC KEY')) throw new Error('JWT_PUBLIC_KEY must be base64-encoded PEM SPKI');
    publicKeyPromise = importSPKI(pem, 'RS256');
  }
  return publicKeyPromise;
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, rep: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    user: {
      userId: string;
      orgId: string;
      role: string;
      roleVersion: number;
      jti?: string;
    };
  }
}

export default fp(async function authenticatePlugin(fastify) {
  fastify.decorate('authenticate', async function authenticate(
    request: FastifyRequest, reply: FastifyReply,
  ) {
    const authorization = request.headers.authorization;
    const match = authorization?.match(/^Bearer\s+(.+)$/i);
    if (!match) return reply.code(401).send({ error: 'UNAUTHORIZED' });

    const production = process.env.NODE_ENV === 'production';
    const key = production
      ? await getPublicKey()
      : new TextEncoder().encode(process.env.JWT_SECRET ?? '');

    let payload: Awaited<ReturnType<typeof jwtVerify>>['payload'];
    try {
      const verified = await jwtVerify(match[1], key, {
        algorithms: production ? ['RS256'] : ['HS256'],
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        requiredClaims: ['sub', 'exp', 'iat', 'iss', 'aud'],
      });
      payload = verified.payload;
    } catch (error) {
      request.log.warn({ err: error }, 'Authentication token rejected');
      return reply.code(401).send({ error: 'UNAUTHORIZED' });
    }

    const userId = payload.sub;
    const orgId = typeof payload.orgId === 'string' ? payload.orgId : '';
    const role = typeof payload.role === 'string' ? payload.role : '';
    const roleVersion = payload.role_version;
    if (
      typeof userId !== 'string' ||
      !orgId ||
      !role ||
      (payload.type === 'refresh' || payload.type === 'mfa_challenge') ||
      typeof roleVersion !== 'number' ||
      !Number.isSafeInteger(roleVersion) ||
      roleVersion < 0
    ) {
      return reply.code(401).send({ error: 'INVALID_TOKEN_CLAIMS' });
    }

    let sessionUser;
    try {
      sessionUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { authVersion: true, deleted: true },
      });
    } catch (error) {
      request.log.error({ err: error }, 'Authentication database lookup failed');
      return reply.code(503).send({ error: 'AUTHENTICATION_DEPENDENCY_UNAVAILABLE' });
    }

    if (!sessionUser || sessionUser.deleted) return reply.code(401).send({ error: 'UNAUTHORIZED' });
    if (sessionUser.authVersion !== roleVersion) {
      return reply.code(401).send({
        error: 'TOKEN_EXPIRED',
        message: 'Session invalidated — please log in again',
      });
    }

    const jti = typeof payload.jti === 'string' && payload.jti.length <= 128
      ? payload.jti
      : undefined;

    request.user = { userId, orgId, role, roleVersion, jti };
  });
});
