/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const metricsPath = path.join(__dirname, 'health-metrics.json');

const defaultMetrics = {
  crashRate: 0,
  errorRate: 0,
  avgLoadTime: 0,
  apiResponseTime: 0,
  userSatisfaction: 0,
};

const metrics = fs.existsSync(metricsPath)
  ? JSON.parse(fs.readFileSync(metricsPath, 'utf-8'))
  : defaultMetrics;

const checks = [
  { name: 'Crash Rate', value: metrics.crashRate, threshold: 0.1 },
  { name: 'Error Rate', value: metrics.errorRate, threshold: 1.0 },
  { name: 'Load Time', value: metrics.avgLoadTime, threshold: 2000 },
  { name: 'API Response', value: metrics.apiResponseTime, threshold: 1000 },
];

console.log('Post-deployment health check');
checks.forEach((check) => {
  const passed = check.value < check.threshold;
  console.log(`${passed ? '✅' : '❌'} ${check.name}: ${check.value} < ${check.threshold}`);
});

if (!fs.existsSync(metricsPath)) {
  console.log('\nℹ️  Provide scripts/health-metrics.json to supply real metrics.');
}
