import * as fs from 'fs';
import * as path from 'path';
import { TASK_PROFILES, type TaskProfile } from '../index';

export const MODULE_PATHS: Record<string, string> = {
  M00: 'prompts/core/M00-identity-rules.md',
  M01: 'prompts/backend/M01-backend-architecture.md',
  M02: 'prompts/mobile/M02-mobile-ux.md',
  M03: 'prompts/ai/M03-ai-intelligence.md',
  M04: 'prompts/payments/M04-payments-compliance.md',
  M05: 'prompts/data/M05-data-tax-engine.md',
  M06: 'prompts/devops/M06-deployment-devops.md',
  M07: 'prompts/monetization/M07-monetization-analytics.md',
  M08: 'prompts/mobile/M08-dashboard-ux-patterns.md',
  M09: 'prompts/mobile/M09-enhancement-integration.md',
};

const REPO_ROOT = path.resolve(__dirname, '../../');

function resolveModulePath(moduleId: string): string {
  const relativePath = MODULE_PATHS[moduleId];
  if (!relativePath) {
    throw new Error(`Unknown module ID: ${moduleId}`);
  }
  return path.join(REPO_ROOT, relativePath);
}

export async function loadContext(moduleIds: string[]): Promise<string> {
  const sections = await Promise.all(
    [...new Set(moduleIds)].map(async (id) => {
      const filePath = resolveModulePath(id);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Module file missing: ${filePath}\nRun: npm run prompts:bootstrap`);
      }
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return `<!-- MODULE: ${id} | ${MODULE_PATHS[id]} -->\n${content}`;
    }),
  );

  return sections.join('\n\n---\n\n');
}

export async function loadContextForTask(taskProfile: string): Promise<string> {
  const moduleIds = TASK_PROFILES[taskProfile as TaskProfile];
  if (!moduleIds) {
    throw new Error(
      `Unknown task profile: "${taskProfile}". ` +
        `Valid profiles: ${Object.keys(TASK_PROFILES).join(', ')}`,
    );
  }

  return loadContext(moduleIds);
}

export async function loadModule(moduleId: string): Promise<string> {
  const filePath = resolveModulePath(moduleId);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Module file missing: ${filePath}`);
  }
  return fs.promises.readFile(filePath, 'utf-8');
}

export function verifyAllModules(): void {
  const missing: string[] = [];

  for (const [id, relativePath] of Object.entries(MODULE_PATHS)) {
    const absolutePath = path.join(REPO_ROOT, relativePath);
    if (!fs.existsSync(absolutePath)) {
      missing.push(`${id}: ${relativePath}`);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing prompt modules:\n${missing.join('\n')}\nRun: npm run prompts:bootstrap`);
  }

  console.log(`✅ All ${Object.keys(MODULE_PATHS).length} prompt modules verified.`);
}

if (require.main === module) {
  const taskProfile = (process.argv[2] as TaskProfile | undefined) ?? 'full-audit';

  loadContextForTask(taskProfile)
    .then((context) => {
      const moduleCount = (context.match(/<!-- MODULE:/g) || []).length;
      console.log(`Loaded profile: ${taskProfile}`);
      console.log(`Modules present: ${moduleCount}`);
      console.log(`Estimated tokens (approx): ${Math.round(context.length / 4)}`);
      console.log(context);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
