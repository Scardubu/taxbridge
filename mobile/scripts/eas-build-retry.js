const { exec } = require('child_process');

const profile = process.argv[2] || 'production-apk';
const maxAttempts = Number(process.env.EAS_BUILD_MAX_ATTEMPTS || 3);
const retryableMarkers = ['ECONNRESET', 'ETIMEDOUT', 'socket hang up', 'Failed to upload the project tarball'];

function isRetryable(output) {
  return retryableMarkers.some((marker) => output.includes(marker));
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runBuild(attempt) {
  console.log(`Starting EAS build attempt ${attempt}/${maxAttempts} for profile "${profile}"...`);

  const command = `npx eas build --platform android --profile ${profile} --non-interactive`;

  const child = exec(command, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      CI: process.env.CI || '1',
    },
    maxBuffer: 10 * 1024 * 1024,
  });

  let combinedOutput = '';

  child.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    combinedOutput += text;
    process.stdout.write(text);
  });

  child.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    combinedOutput += text;
    process.stderr.write(text);
  });

  const exitCode = await new Promise((resolve) => {
    child.on('close', resolve);
  });

  if (exitCode === 0) {
    console.log('EAS build command completed successfully.');
    return;
  }

  if (attempt < maxAttempts && isRetryable(combinedOutput)) {
    const backoffMs = attempt * 15000;
    console.log(`Retryable upload failure detected. Waiting ${backoffMs / 1000}s before retry...`);
    await wait(backoffMs);
    return runBuild(attempt + 1);
  }

  process.exit(exitCode || 1);
}

runBuild(1).catch((error) => {
  console.error('Failed to execute EAS build retry wrapper:', error);
  process.exit(1);
});
