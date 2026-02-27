import { TASK_PROFILES } from '../index';
import { loadContext, loadContextForTask, loadModule, verifyAllModules } from './prompt-loader';

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void> | void): Promise<void> {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (error: any) {
    console.error(`  ✗ ${name}`);
    console.error(`    → ${error?.message ?? error}`);
    failed++;
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function run(): Promise<void> {
  console.log('TaxBridge Prompt Loader — V10.3 Tests');
  console.log('═'.repeat(50));

  await test('loads dashboard-ux and returns M00 + M02 + M08', async () => {
    const context = await loadContextForTask('dashboard-ux');
    assert(context.includes('<!-- MODULE: M00'), 'M00 not loaded');
    assert(context.includes('<!-- MODULE: M02'), 'M02 not loaded');
    assert(context.includes('<!-- MODULE: M08'), 'M08 not loaded');
    assert(!context.includes('<!-- MODULE: M01'), 'Unexpected M01 in dashboard-ux');
  });

  await test('always includes M00 in every profile', async () => {
    for (const profile of Object.keys(TASK_PROFILES)) {
      const context = await loadContextForTask(profile);
      assert(context.includes('<!-- MODULE: M00'), `M00 missing for profile ${profile}`);
    }
  });

  await test('throws for unknown task profile', async () => {
    let didThrow = false;
    try {
      await loadContextForTask('nonexistent-profile');
    } catch (error: any) {
      didThrow = true;
      assert(String(error.message).includes('Unknown task profile'), 'Wrong error message');
    }
    assert(didThrow, 'Expected error for unknown profile');
  });

  await test('loads full-audit with all modules M00-M09', async () => {
    const context = await loadContextForTask('full-audit');
    for (const id of ['M00', 'M01', 'M02', 'M03', 'M04', 'M05', 'M06', 'M07', 'M08', 'M09']) {
      assert(context.includes(`<!-- MODULE: ${id}`), `${id} missing from full-audit`);
    }
  });

  await test('separates modules with divider marker', async () => {
    const context = await loadContext(['M00', 'M01']);
    assert(context.includes('\n\n---\n\n'), 'Missing module divider');
  });

  await test('loads mobile-enhancements with M00 + M02 + M08 + M09', async () => {
    const context = await loadContextForTask('mobile-enhancements');
    ['M00', 'M02', 'M08', 'M09'].forEach((id) => {
      assert(context.includes(`<!-- MODULE: ${id}`), `${id} missing`);
    });
    assert(!context.includes('<!-- MODULE: M01'), 'Unexpected M01 in mobile-enhancements');
  });

  await test('loads tax-engine with M00 + M01 + M05', async () => {
    const context = await loadContextForTask('tax-engine');
    ['M00', 'M01', 'M05'].forEach((id) => {
      assert(context.includes(`<!-- MODULE: ${id}`), `${id} missing`);
    });
    assert(!context.includes('<!-- MODULE: M08'), 'Unexpected M08 in tax-engine');
  });

  await test('loadModule returns non-empty content for M00', async () => {
    const content = await loadModule('M00');
    assert(content.length > 100, 'M00 module content unexpectedly short');
  });

  await test('loadModule throws for unknown module ID', async () => {
    let didThrow = false;
    try {
      await loadModule('M99');
    } catch (error: any) {
      didThrow = true;
      assert(String(error.message).includes('Unknown module ID'), 'Wrong unknown module error');
    }
    assert(didThrow, 'Expected loadModule to fail for unknown ID');
  });

  await test('verifyAllModules passes with current module set', async () => {
    verifyAllModules();
  });

  await test('dashboard-ux context has exactly three module headers', async () => {
    const context = await loadContextForTask('dashboard-ux');
    const moduleCount = (context.match(/<!-- MODULE:/g) || []).length;
    assert(moduleCount === 3, `Expected 3 modules, got ${moduleCount}`);
  });

  await test('deduplicates repeated module IDs in loadContext', async () => {
    const context = await loadContext(['M00', 'M00', 'M02']);
    const m00Count = (context.match(/<!-- MODULE: M00/g) || []).length;
    assert(m00Count === 1, `Expected M00 once, got ${m00Count}`);
  });

  await test('profile registry contains all V10.3 required keys', async () => {
    const requiredProfiles = [
      'backend-api',
      'mobile-ui',
      'dashboard-ux',
      'mobile-enhancements',
      'ai-features',
      'nrs-compliance',
      'tax-engine',
      'devops',
      'growth',
      'full-audit',
    ];

    for (const profile of requiredProfiles) {
      assert(profile in TASK_PROFILES, `Missing profile: ${profile}`);
    }
  });

  await test('full-audit context size is non-trivial', async () => {
    const context = await loadContextForTask('full-audit');
    assert(context.length > 3000, 'full-audit context unexpectedly small');
  });

  await test('module headers include source path metadata', async () => {
    const context = await loadContext(['M00']);
    assert(context.includes('prompts/core/M00-identity-rules.md'), 'Missing path metadata in module header');
  });

  console.log('═'.repeat(50));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('═'.repeat(50));

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
