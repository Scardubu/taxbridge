/**
 * authenticate plugin — TaxBridge V13 Sovereign
 *
 * Fastify decorator: fastify.authenticate
 * JWT RS256 (production) / HS256 (dev)
 * role_version check: stale tokens rejected
 *
 * C-47: No Express imports
 */
import fp                                  from 'fastify-plugin';
import { FastifyRequest, FastifyReply }    from 'fastify';
import { jwtVerify, importSPKI }          from 'jose';
import { readFileSync }                    from 'fs';
import { redis }                           from '../lib/redis';

// RS256 public key — cached after first import
let _publicKey: Awaited<ReturnType<typeof importSPKI>> | null = null;

async function getPublicKey() {
  if (_publicKey) return _publicKey;
  const pem = process.env.JWT_PUBLIC_KEY
    ? Buffer.from(process.env.JWT_PUBLIC_KEY, 'base64').toString('utf8')
    : readFileSync('/run/secrets/jwt_public_key', 'utf8').trim();
  _publicKey = await importSPKI(pem, 'RS256');
  return _publicKey;
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, rep: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    user: {
      userId:      string;
      orgId:       string;
      role:        string;
      roleVersion: number;
    };
  }
}

export default fp(async function authenticatePlugin(fastify) {
  fastify.decorate('authenticate', async function authenticate(
    request: FastifyRequest, reply: FastifyReply,
  ) {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.code(401).send({ error: 'UNAUTHORIZED' });

    try {
      const secret = process.env.NODE_ENV === 'production'
        ? await getPublicKey()
        : new TextEncoder().encode(process.env.JWT_SECRET!);

      const { payload } = await jwtVerify(token, secret);

      // role_version check: explicit null check — version 0 is a valid value
      const storedVersion = await redis.get(`role_version:${payload.sub}`);
      if (
        storedVersion !== null &&
        Number(storedVersion) !== (payload as any).role_version
      ) {
        return reply.code(401).send({
          error:   'TOKEN_EXPIRED',
          message: 'Session invalidated — please log in again',
        });
      }

      request.user = {
        userId:      payload.sub!,
        orgId:       (payload as any).orgId,
        role:        (payload as any).role,
        roleVersion: (payload as any).role_version,
      };
    } catch {
      return reply.code(401).send({ error: 'UNAUTHORIZED' });
    }
  });
});
