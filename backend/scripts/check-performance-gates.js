#!/usr/bin/env node

/**
 * Performance Quality Gates Checker
 * 
 * This script validates load test results against predefined performance thresholds
 * to ensure TaxBridge meets NRS 2026 requirements and user expectations.
 */

const fs = require('fs');
const path = require('path');

// Performance thresholds based on NRS 2026 requirements
const PERFORMANCE_THRESHOLDS = {
  // Response time thresholds (95th percentile in milliseconds)
  response_time: {
    health_check: 100,
    duplo_submit: 2000,
    duplo_status: 1000,
    remita_rrr: 3000,
    remita_status: 1000,
    invoice_list: 500,
    ocr_process: 5000,
    overall: 300
  },
  
  // Error rate thresholds (percentage)
  error_rate: {
    health_check: 1,
    duplo_submit: 5,
    duplo_status: 2,
    remita_rrr: 5,
    remita_status: 2,
    invoice_list: 1,
    ocr_process: 10,
    overall: 10
  },
  
  // Throughput thresholds (requests per second)
  throughput: {
    minimum: 50, // Minimum RPS for 100 users
    target: 100  // Target RPS for optimal performance
  }
};

function loadTestResults(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Load test results file not found: ${filePath}`);
      process.exit(1);
    }

    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`❌ Error reading load test results: ${error.message}`);
    process.exit(1);
  }
}

function extractMetrics(results) {
  const metrics = {
    response_times: {},
    error_rates: {},
    throughput: 0,
    total_requests: 0,
    total_errors: 0
  };

  // Extract metrics from k6 results
  if (results && results.metrics) {
    // Response times
    Object.keys(results.metrics).forEach(metricName => {
      if (metricName.includes('duration') && results.metrics[metricName].values) {
        const endpoint = extractEndpointFromMetric(metricName);
        if (endpoint) {
          metrics.response_times[endpoint] = results.metrics[metricName].values['p(95)'] || 0;
        }
      }
    });

    // Error rates
    Object.keys(results.metrics).forEach(metricName => {
      if (metricName.includes('rate') && results.metrics[metricName].values) {
        const endpoint = extractEndpointFromMetric(metricName);
        if (endpoint) {
          metrics.error_rates[endpoint] = (results.metrics[metricName].values.rate || 0) * 100;
        }
      }
    });

    // Throughput
    if (results.metrics['http_reqs'] && results.metrics['http_reqs'].values) {
      metrics.throughput = results.metrics['http_reqs'].values.rate || 0;
      metrics.total_requests = results.metrics['http_reqs'].values.count || 0;
    }

    // Total errors
    if (results.metrics['http_req_failed'] && results.metrics['http_req_failed'].values) {
      metrics.total_errors = results.metrics['http_req_failed'].values.count || 0;
    }
  }

  return metrics;
}

function extractEndpointFromMetric(metricName) {
  // Map k6 metric names to our endpoint categories
  if (metricName.includes('health')) return 'health_check';
  if (metricName.includes('duplo') && metricName.includes('submit')) return 'duplo_submit';
  if (metricName.includes('duplo') && metricName.includes('status')) return 'duplo_status';
  if (metricName.includes('remita') && metricName.includes('rrr')) return 'remita_rrr';
  if (metricName.includes('remita') && metricName.includes('status')) return 'remita_status';
  if (metricName.includes('invoice') && metricName.includes('list')) return 'invoice_list';
  if (metricName.includes('ocr')) return 'ocr_process';
  
  return 'overall';
}

function checkResponseTimes(metrics) {
  console.log('\n📊 Checking Response Times...');
  let passed = true;
  let failures = [];

  Object.keys(PERFORMANCE_THRESHOLDS.response_time).forEach(endpoint => {
    const threshold = PERFORMANCE_THRESHOLDS.response_time[endpoint];
    const actual = metrics.response_times[endpoint] || metrics.response_times.overall || 0;

    if (actual > threshold) {
      passed = false;
      failures.push(`${endpoint}: ${actual}ms > ${threshold}ms`);
      console.log(`❌ ${endpoint}: ${actual}ms (threshold: ${threshold}ms)`);
    } else {
      console.log(`✅ ${endpoint}: ${actual}ms (threshold: ${threshold}ms)`);
    }
  });

  return { passed, failures };
}

function checkErrorRates(metrics) {
  console.log('\n🚨 Checking Error Rates...');
  let passed = true;
  let failures = [];

  Object.keys(PERFORMANCE_THRESHOLDS.error_rate).forEach(endpoint => {
    const threshold = PERFORMANCE_THRESHOLDS.error_rate[endpoint];
    const actual = metrics.error_rates[endpoint] || calculateOverallErrorRate(metrics);

    if (actual > threshold) {
      passed = false;
      failures.push(`${endpoint}: ${actual.toFixed(2)}% > ${threshold}%`);
      console.log(`❌ ${endpoint}: ${actual.toFixed(2)}% (threshold: ${threshold}%)`);
    } else {
      console.log(`✅ ${endpoint}: ${actual.toFixed(2)}% (threshold: ${threshold}%)`);
    }
  });

  return { passed, failures };
}

function checkThroughput(metrics) {
  console.log('\n⚡ Checking Throughput...');
  let passed = true;
  let failures = [];

  const { minimum, target } = PERFORMANCE_THRESHOLDS.throughput;
  const actual = metrics.throughput;

  if (actual < minimum) {
    passed = false;
    failures.push(`Throughput: ${actual.toFixed(2)} RPS < ${minimum} RPS`);
    console.log(`❌ Throughput: ${actual.toFixed(2)} RPS (minimum: ${minimum} RPS)`);
  } else if (actual < target) {
    console.log(`⚠️  Throughput: ${actual.toFixed(2)} RPS (target: ${target} RPS)`);
  } else {
    console.log(`✅ Throughput: ${actual.toFixed(2)} RPS (target: ${target} RPS)`);
  }

  return { passed, failures };
}

function calculateOverallErrorRate(metrics) {
  if (metrics.total_requests === 0) return 0;
  return (metrics.total_errors / metrics.total_requests) * 100;
}

function generateReport(results, metrics, checks) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total_requests: metrics.total_requests,
      total_errors: metrics.total_errors,
      overall_error_rate: calculateOverallErrorRate(metrics),
      throughput_rps: metrics.throughput,
      passed: checks.every(check => check.passed)
    },
    performance_checks: {
      response_times: checks[0],
      error_rates: checks[1],
      throughput: checks[2]
    },
    detailed_metrics: metrics,
    thresholds: PERFORMANCE_THRESHOLDS
  };

  // Save report
  const reportPath = 'performance-report.json';
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 Performance report saved to: ${reportPath}`);

  return report;
}

function main() {
  console.log('🔍 TaxBridge Performance Quality Gates Check');
  console.log('==========================================');

  const resultsPath = process.argv[2] || 'load-test-results.json';
  const results = loadTestResults(resultsPath);
  const metrics = extractMetrics(results);

  console.log(`📈 Load Test Summary:`);
  console.log(`   Total Requests: ${metrics.total_requests.toLocaleString()}`);
  console.log(`   Total Errors: ${metrics.total_errors.toLocaleString()}`);
  console.log(`   Throughput: ${metrics.throughput.toFixed(2)} RPS`);
  console.log(`   Overall Error Rate: ${calculateOverallErrorRate(metrics).toFixed(2)}%`);

  // Run quality gate checks
  const responseTimeCheck = checkResponseTimes(metrics);
  const errorRateCheck = checkErrorRates(metrics);
  const throughputCheck = checkThroughput(metrics);

  const allChecks = [responseTimeCheck, errorRateCheck, throughputCheck];
  const allPassed = allChecks.every(check => check.passed);

  // Generate report
  const report = generateReport(results, metrics, allChecks);

  console.log('\n🎯 Quality Gates Result:');
  if (allPassed) {
    console.log('✅ All performance quality gates PASSED');
    console.log('🚀 TaxBridge is ready for deployment');
  } else {
    console.log('❌ Some performance quality gates FAILED');
    console.log('\n🔧 Required Actions:');
    
    allChecks.forEach(check => {
      if (!check.passed) {
        check.failures.forEach(failure => {
          console.log(`   - Fix: ${failure}`);
        });
      }
    });

    console.log('\n📋 Recommendations:');
    console.log('   1. Review slow endpoints and optimize database queries');
    console.log('   2. Check external API latency (Duplo, Remita)');
    console.log('   3. Consider implementing caching strategies');
    console.log('   4. Scale infrastructure if needed');
    console.log('   5. Re-run load tests after optimizations');
  }

  // Exit with appropriate code
  process.exit(allPassed ? 0 : 1);
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  PERFORMANCE_THRESHOLDS,
  loadTestResults,
  extractMetrics,
  checkResponseTimes,
  checkErrorRates,
  checkThroughput
};
