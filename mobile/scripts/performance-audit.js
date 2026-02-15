#!/usr/bin/env node
/**
 * Mobile App Performance Audit Script
 * 
 * Analyzes bundle size, dependencies, and provides optimization recommendations
 * Run: node scripts/performance-audit.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BUNDLE_SIZE_LIMITS = {
  critical: 5 * 1024 * 1024,  // 5MB - acceptable for Nigerian networks
  warning: 3 * 1024 * 1024,   // 3MB - ideal target
};

const HEAVY_DEPS = [
  'react-native-reanimated',
  '@react-navigation/native',
  'expo-sqlite',
  'lottie-react-native',
  'i18next',
];

console.log('🔍 TaxBridge Mobile Performance Audit\n');
console.log('=' .repeat(60));

// 1. Analyze package.json dependencies
function analyzeDependencies() {
  console.log('\n📦 Dependency Analysis');
  console.log('-'.repeat(60));
  
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8')
  );
  
  const deps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };
  
  const totalDeps = Object.keys(deps).length;
  console.log(`Total dependencies: ${totalDeps}`);
  
  // Check for heavy dependencies
  const heavyDepsFound = HEAVY_DEPS.filter(dep => deps[dep]);
  console.log(`\nHeavy dependencies (expected):`);
  heavyDepsFound.forEach(dep => {
    console.log(`  ✓ ${dep} - ${deps[dep]}`);
  });
  
  return { totalDeps, heavyDepsFound };
}

// 2. Check for duplicate dependencies
function checkDuplicates() {
  console.log('\n🔄 Duplicate Dependency Check');
  console.log('-'.repeat(60));
  
  try {
    const output = execSync('npm ls --all --json', {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'], // Ignore stderr warnings
    });
    
    const tree = JSON.parse(output);
    const allDeps = new Map();
    
    function traverse(node, depth = 0) {
      if (!node.dependencies) return;
      
      Object.entries(node.dependencies).forEach(([name, info]) => {
        const version = info.version || 'unknown';
        if (!allDeps.has(name)) {
          allDeps.set(name, new Set());
        }
        allDeps.get(name).add(version);
        traverse(info, depth + 1);
      });
    }
    
    traverse(tree);
    
    const duplicates = Array.from(allDeps.entries())
      .filter(([_, versions]) => versions.size > 1)
      .map(([name, versions]) => ({ name, versions: Array.from(versions) }));
    
    if (duplicates.length > 0) {
      console.log(`⚠️  Found ${duplicates.length} packages with multiple versions:\n`);
      duplicates.slice(0, 10).forEach(({ name, versions }) => {
        console.log(`  ${name}: ${versions.join(', ')}`);
      });
      if (duplicates.length > 10) {
        console.log(`  ... and ${duplicates.length - 10} more`);
      }
    } else {
      console.log('✅ No duplicate dependencies found');
    }
    
    return duplicates;
  } catch (error) {
    console.log('⚠️  Could not check for duplicates (npm ls failed)');
    return [];
  }
}

// 3. Estimate bundle size (rough calculation)
function estimateBundleSize() {
  console.log('\n📊 Bundle Size Estimation');
  console.log('-'.repeat(60));
  
  const nodeModulesPath = path.join(__dirname, '../node_modules');
  
  if (!fs.existsSync(nodeModulesPath)) {
    console.log('⚠️  node_modules not found. Run `npm install` first.');
    return 0;
  }
  
  let totalSize = 0;
  
  function getDirectorySize(dirPath) {
    let size = 0;
    try {
      const files = fs.readdirSync(dirPath);
      files.forEach(file => {
        const filePath = path.join(dirPath, file);
        try {
          const stats = fs.statSync(filePath);
          if (stats.isDirectory()) {
            // Skip common non-bundled directories
            if (!['__tests__', 'test', 'tests', 'docs', 'example'].includes(file)) {
              size += getDirectorySize(filePath);
            }
          } else if (stats.isFile()) {
            // Only count JS/TS files and assets
            if (/\.(js|jsx|ts|tsx|json|png|jpg|jpeg|svg)$/.test(file)) {
              size += stats.size;
            }
          }
        } catch (err) {
          // Skip files we can't read
        }
      });
    } catch (err) {
      // Skip directories we can't read
    }
    return size;
  }
  
  console.log('Calculating (this may take 30-60 seconds)...');
  totalSize = getDirectorySize(nodeModulesPath);
  
  // Add src directory
  const srcPath = path.join(__dirname, '../src');
  if (fs.existsSync(srcPath)) {
    totalSize += getDirectorySize(srcPath);
  }
  
  const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);
  console.log(`\nEstimated raw size: ${sizeMB} MB`);
  
  // Metro bundler typically reduces this by 60-70% with minification and tree-shaking
  const bundledSizeMB = (totalSize * 0.35 / (1024 * 1024)).toFixed(2);
  console.log(`Estimated bundled size: ${bundledSizeMB} MB (after minification)`);
  
  if (totalSize > BUNDLE_SIZE_LIMITS.critical) {
    console.log('\n⚠️  Bundle size exceeds 5MB - consider optimization');
  } else if (totalSize > BUNDLE_SIZE_LIMITS.warning) {
    console.log('\n✅ Bundle size is acceptable but could be optimized');
  } else {
    console.log('\n✅ Bundle size is excellent');
  }
  
  return totalSize;
}

// 4. Provide optimization recommendations
function provideRecommendations(data) {
  console.log('\n💡 Optimization Recommendations');
  console.log('-'.repeat(60));
  
  const recommendations = [];
  
  // Check for heavy deps that could be lazy-loaded
  if (data.totalDeps > 50) {
    recommendations.push({
      priority: 'medium',
      title: 'Lazy Load Screens',
      description: `You have ${data.totalDeps} dependencies. Consider lazy loading non-critical screens with React.lazy()`,
      example: "const SettingsScreen = React.lazy(() => import('./screens/SettingsScreen'));",
    });
  }
  
  // Duplicate dependencies
  if (data.duplicates && data.duplicates.length > 5) {
    recommendations.push({
      priority: 'high',
      title: 'Resolve Duplicate Dependencies',
      description: `Found ${data.duplicates.length} packages with multiple versions. Use 'npm dedupe' or update package versions to match.`,
      example: 'npm dedupe',
    });
  }
  
  // Bundle size recommendations
  if (data.bundleSize > BUNDLE_SIZE_LIMITS.warning) {
    recommendations.push({
      priority: 'medium',
      title: 'Optimize Bundle Size',
      description: 'Consider code splitting, removing unused dependencies, and optimizing images.',
      actions: [
        'Run `npx depcheck` to find unused dependencies',
        'Use expo-optimize to compress images',
        'Enable Hermes engine (already enabled in app.json)',
      ],
    });
  }
  
  // Always recommend these best practices
  recommendations.push(
    {
      priority: 'low',
      title: 'Enable Production Mode',
      description: 'Ensure NODE_ENV=production for all production builds',
      check: 'Verify eas.json production profile has NODE_ENV=production',
    },
    {
      priority: 'low',
      title: 'Optimize Images',
      description: 'Compress all images with expo-optimize',
      example: 'npx expo-optimize',
    },
    {
      priority: 'low',
      title: 'Monitor Bundle Size',
      description: 'Track bundle size changes in CI/CD',
      example: 'eas build:inspect --platform android --profile production',
    }
  );
  
  // Print recommendations by priority
  ['high', 'medium', 'low'].forEach(priority => {
    const recs = recommendations.filter(r => r.priority === priority);
    if (recs.length === 0) return;
    
    const icon = priority === 'high' ? '🔴' : priority === 'medium' ? '🟡' : '🟢';
    console.log(`\n${icon} ${priority.toUpperCase()} PRIORITY:`);
    
    recs.forEach((rec, i) => {
      console.log(`\n${i + 1}. ${rec.title}`);
      console.log(`   ${rec.description}`);
      if (rec.example) {
        console.log(`   Example: ${rec.example}`);
      }
      if (rec.actions) {
        rec.actions.forEach(action => {
          console.log(`   • ${action}`);
        });
      }
      if (rec.check) {
        console.log(`   Check: ${rec.check}`);
      }
    });
  });
}

// 5. Performance targets
function printPerformanceTargets() {
  console.log('\n🎯 Performance Targets');
  console.log('-'.repeat(60));
  
  const targets = [
    { metric: 'Cold Start Time', target: '< 3 seconds', status: 'measure' },
    { metric: 'Hot Start Time', target: '< 1 second', status: 'measure' },
    { metric: 'Bundle Size (minified)', target: '< 3 MB', status: 'measure' },
    { metric: 'Memory Usage (idle)', target: '< 150 MB', status: 'measure' },
    { metric: 'Frame Rate', target: '60 fps', status: 'measure' },
    { metric: 'OCR Processing', target: '< 2 seconds', status: 'measure' },
    { metric: 'Sync Queue Processing', target: '< 5 seconds per 50 items', status: 'measure' },
  ];
  
  console.log('\nTo measure these metrics:');
  console.log('1. Build production APK: `eas build --platform android --profile production-apk`');
  console.log('2. Install on device: `adb install app.apk`');
  console.log('3. Use React DevTools Profiler for render performance');
  console.log('4. Use Android Studio Profiler for memory and CPU');
  console.log('5. Use `adb logcat` to measure cold start time\n');
  
  targets.forEach(({ metric, target, status }) => {
    console.log(`  ${metric.padEnd(30)} ${target.padEnd(20)} [${status}]`);
  });
}

// Run audit
async function runAudit() {
  const startTime = Date.now();
  
  const data = {};
  
  try {
    Object.assign(data, analyzeDependencies());
    data.duplicates = checkDuplicates();
    data.bundleSize = estimateBundleSize();
    
    provideRecommendations(data);
    printPerformanceTargets();
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('\n' + '='.repeat(60));
    console.log(`✅ Audit completed in ${duration}s`);
    console.log('='.repeat(60));
    
    // Save report
    const reportPath = path.join(__dirname, '../performance-audit-report.json');
    fs.writeFileSync(
      reportPath,
      JSON.stringify({
        timestamp: new Date().toISOString(),
        data,
        targets: 'See console output',
      }, null, 2)
    );
    console.log(`\n📄 Report saved to: ${reportPath}`);
    
  } catch (error) {
    console.error('\n❌ Audit failed:', error.message);
    process.exit(1);
  }
}

runAudit();
