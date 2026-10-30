import fp from 'fastify-plugin';
import { FastifyRequest, FastifyReply } from 'fastify';
import { jwtVerify, importSPKI } from 'jose';
import { redis } from '../lib/redis';

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

    try {
      const production = process.env.NODE_ENV === 'production';
      const key = production
        ? await getPublicKey()
        : new TextEncoder().encode(process.env.JWT_SECRET ?? '');

      const { payload } = await jwtVerify(match[1], key, {
        algorithms: production ? ['RS256'] : ['HS256'],
        requiredClaims: ['sub', 'exp', 'iat'],
      });

      const userId = payload.sub;
      const orgId = typeof payload.orgId === 'string' ? payload.orgId : '';
      const role = typeof payload.role === 'string' ? payload.role : '';
      const roleVersion = payload.role_version;

      if (!userId || !orgId || !role || !Number.isInteger(roleVersion)) {
        return reply.code(401).send({ error: 'INVALID_TOKEN_CLAIMS' });
      }

      // Redis is a mandatory authentication dependency. A Redis failure must
      // never be interpreted as absence of a revocation record.
      const storedVersion = await redis.get(`role_version:${userId}`);
      if (storedVersion !== null && Number(storedVersion) !== roleVersion) {
        return reply.code(401).send({
          error: 'TOKEN_EXPIRED',
          message: 'Session invalidated — please log in again',
        });
      }

      request.user = { userId, orgId, role, roleVersion };
    } catch (error) {
      request.log.warn({ err: error }, 'Authentication rejected');
      if ((error as Error).message?.includes('ECONN') ||
          (error as Error).message?.includes('Redis')) {
        return reply.code(503).send({ error: 'AUTHENTICATION_DEPENDENCY_UNAVAILABLE' });
      }
      return reply.code(401).send({ error: 'UNAUTHORIZED' });
    }
  });
});
