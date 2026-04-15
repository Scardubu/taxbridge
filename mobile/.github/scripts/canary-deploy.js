const percent = process.argv[2] || 10;
console.log(`Deploying to ${percent}% of users`);

// Hook into your release system (EAS / Play Store staged rollout)
