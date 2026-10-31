import fp from 'fastify-plugin';
import { FastifyRequest, FastifyReply } from 'fastify';
import { importSPKI, jwtVerify } from 'jose';
import { redis } from '../lib/redis';

const JWT_ISSUER = process.env.JWT_ISSUER ?? 'taxbridge-api';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE ?? 'taxbridge-clients';
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
    user: { userId: string; orgId: string; role: string; roleVersion: number };
  }
}

export default fp(async function authenticatePlugin(fastify) {
  fastify.decorate('authenticate', async function authenticate(request: FastifyRequest, reply: FastifyReply) {
    const match = request.headers.authorization?.match(/^Bearer\s+(.+)$/i);
    if (!match) return reply.code(401).send({ error: 'UNAUTHORIZED' });

    let payload;
    try {
      const production = process.env.NODE_ENV === 'production';
      const key = production ? await getPublicKey() : new TextEncoder().encode(process.env.JWT_SECRET ?? '');
      const verified = await jwtVerify(match[1], key, {
        algorithms: production ? ['RS256'] : ['HS256'],
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        requiredClaims: ['sub', 'exp', 'iat', 'iss', 'aud', 'type', 'orgId', 'role', 'role_version'],
      });
      payload = verified.payload;
    } catch (error) {
      request.log.warn({ err: error }, 'Authentication token rejected');
      return reply.code(401).send({ error: 'UNAUTHORIZED' });
    }

    const userId = payload.sub;
    const orgId = payload.orgId;
    const role = payload.role;
    const roleVersion = payload.role_version;
    if (
      typeof userId !== 'string' || userId.length === 0 ||
      typeof orgId !== 'string' || orgId.length === 0 ||
      typeof role !== 'string' || role.length === 0 ||
      payload.type !== 'access' ||
      typeof roleVersion !== 'number' || !Number.isSafeInteger(roleVersion) || roleVersion < 0
    ) return reply.code(401).send({ error: 'INVALID_TOKEN_CLAIMS' });

    let storedVersion: string | null;
    try {
      storedVersion = await redis.get(`role_version:${userId}`);
    } catch (error) {
      request.log.error({ err: error }, 'Role-version dependency unavailable');
      return reply.code(503).send({ error: 'AUTHENTICATION_DEPENDENCY_UNAVAILABLE' });
    }

    const currentVersion = storedVersion === null ? 0 : Number(storedVersion);
    if (!Number.isSafeInteger(currentVersion) || currentVersion !== roleVersion) {
      return reply.code(401).send({ error: 'TOKEN_EXPIRED' });
    }
    request.user = { userId, orgId, role, roleVersion };
  });
});
