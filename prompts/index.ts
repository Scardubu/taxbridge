export const TASK_PROFILES: Record<string, string[]> = {
  'backend-api': ['M00', 'M01'],
  'mobile-ui': ['M00', 'M02', 'M08'],
  'dashboard-ux': ['M00', 'M02', 'M08'],
  'mobile-enhancements': ['M00', 'M02', 'M08', 'M09'],
  'ai-features': ['M00', 'M01', 'M03', 'M05'],
  'nrs-compliance': ['M00', 'M01', 'M04', 'M05'],
  'tax-engine': ['M00', 'M01', 'M05'],
  devops: ['M00', 'M06'],
  growth: ['M00', 'M07'],
  'full-audit': ['M00', 'M01', 'M02', 'M03', 'M04', 'M05', 'M06', 'M07', 'M08', 'M09'],
};

export type TaskProfile = keyof typeof TASK_PROFILES;
