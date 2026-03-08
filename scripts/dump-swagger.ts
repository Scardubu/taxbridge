import { mkdirSync, writeFileSync } from 'fs';

const SWAGGER_ENV_DEFAULTS: Record<string, string> = {
  DATABASE_URL: 'postgresql://taxbridge:taxbridge@localhost:5432/taxbridge',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'swagger-docs-jwt-secret',
  NRS_API_KEY: 'swagger-docs-nrs-key',
  CLOUDFLARE_R2_BUCKET: 'swagger-docs-bucket',
  CLOUDFLARE_R2_ENDPOINT: 'https://example-account.r2.cloudflarestorage.com',
  CORS_ORIGIN: 'http://localhost:3000',
  PORT: '3000',
  YOUVERIFY_API_KEY: 'swagger-docs-youverify-key',
  FLUTTERWAVE_SECRET: 'swagger-docs-flutterwave-secret',
  PAYSTACK_SECRET: 'swagger-docs-paystack-secret',
  AFRICA_TALKING_API_KEY: 'swagger-docs-at-key',
};

process.env.TAXBRIDGE_SKIP_REDIS_CONNECT = '1';
process.env.TAXBRIDGE_DOCS_MODE = '1';

for (const [key, value] of Object.entries(SWAGGER_ENV_DEFAULTS)) {
  if (!process.env[key]) {
    process.env[key] = value;
  }
}

async function main(): Promise<void> {
  const { buildApp } = await import('../backend/src/app');
  const app = await buildApp();
  await app.ready();
  mkdirSync('docs/api', { recursive: true });
  writeFileSync('docs/api/openapi.json', JSON.stringify(app.swagger(), null, 2));
  await app.close();
  process.stdout.write('✅ OpenAPI spec written to docs/api/openapi.json\n');
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});
