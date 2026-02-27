import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '../../');

const MODULE_STUBS: Record<string, { header: string; sections: string[] }> = {
  'prompts/core/M00-identity-rules.md': {
    header: '# M00 — Identity & Global Rules',
    sections: ['## Role', '## Hard Rules', '## Session Protocol', '## Incident History'],
  },
  'prompts/backend/M01-backend-architecture.md': {
    header: '# M01 — Backend Architecture',
    sections: ['## Stack', '## API Routes', '## Prisma Models', '## Queue Workers', '## Error Handling'],
  },
  'prompts/mobile/M02-mobile-ux.md': {
    header: '# M02 — Mobile UX Patterns',
    sections: ['## Navigation', '## Offline Strategy', '## i18n', '## Screen Inventory', '## Component Library'],
  },
  'prompts/ai/M03-ai-intelligence.md': {
    header: '# M03 — AI & Intelligence',
    sections: ['## OCR Pipeline', '## Anomaly Engine (Signals 1–9)', '## Health Score Algorithm', '## Cron Jobs'],
  },
  'prompts/payments/M04-payments-compliance.md': {
    header: '# M04 — Payments & NRS Compliance',
    sections: ['## NRS e-Invoice Flow', '## Circuit Breaker', '## USSD Channel', '## WHT Remittance'],
  },
  'prompts/data/M05-data-tax-engine.md': {
    header: '# M05 — Data & Tax Engine',
    sections: ['## NTA 2025 Rate Tables', '## contracts/ API', '## Prisma Schema', '## Migration Notes'],
  },
  'prompts/devops/M06-deployment-devops.md': {
    header: '# M06 — DevOps & Deployment',
    sections: ['## EAS Build Config', '## Render Deploy', '## CI/CD Pipeline', '## Sentry Config', '## Environment Variables'],
  },
  'prompts/monetization/M07-monetization-analytics.md': {
    header: '# M07 — Monetization & Analytics',
    sections: ['## Billing Plans', '## Referral Engine', '## Analytics Events', '## Growth Metrics'],
  },
  'prompts/mobile/M08-dashboard-ux-patterns.md': {
    header: '# M08 — Dashboard UX Patterns ★ V10.3',
    sections: [
      '## Zone Layout Contract (apex/signal/action/context/ambient)',
      '## DashboardZone Component',
      '## DashboardSkeleton Geometry',
      '## Animation Vocabulary (animation.ts)',
      '## SectionState Machine',
      '## TaxHealthGauge SVG Spec',
      '## Progressive Disclosure Rules',
      '## Gauge Mode Logic (compact/expanded)',
      '## Gesture Response Budget',
    ],
  },
  'prompts/mobile/M09-enhancement-integration.md': {
    header: '# M09 — Enhancement Integration ★ V10.3',
    sections: [
      '## F1 — Engagement Ring',
      '## F2 — Streak Tracker',
      '## F3 — Donut Chart',
      '## F4 — AI Chat Assistant',
      '## F5 — Milestone Badges',
      '## F6 — Smart Notifications',
      '## F7 — Guided Onboarding',
      '## Integration Points with Dashboard Zones',
    ],
  },
};

function createStub(filePath: string, header: string, sections: string[]): void {
  const absPath = path.join(REPO_ROOT, filePath);
  if (fs.existsSync(absPath)) {
    console.log(`  ⏭  Exists: ${filePath}`);
    return;
  }
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  const body = sections.map((section) => `${section}\n\n> TODO: Fill this section.\n`).join('\n---\n\n');
  fs.writeFileSync(absPath, `${header}\n\n${body}`, 'utf-8');
  console.log(`  ✅ Created: ${filePath}`);
}

console.log('🚀 TaxBridge prompts/ bootstrap\n');
for (const [filePath, { header, sections }] of Object.entries(MODULE_STUBS)) {
  createStub(filePath, header, sections);
}
console.log('\n✅ Bootstrap complete. Fill TODO sections before first Copilot session.');
