const Redis = require('ioredis');

const redisUrl = 'rediss://default:CBytrUUreAY0Wn1RmnV54sIPGlXWtz3b@redis-15968.crce199.us-west-2-2.ec2.cloud.redislabs.com:15968';

console.log('Testing Redis Cloud connection...');
console.log('URL:', redisUrl.replace(/:[^:@]+@/, ':****@'));

// Test 1: With TLS
console.log('\n--- Test 1: rediss:// with TLS ---');
const redis1 = new Redis(redisUrl, {
  tls: {
    rejectUnauthorized: false
  },
  lazyConnect: true
});

redis1.connect()
  .then(() => {
    console.log('✅ Connected successfully with TLS!');
    return redis1.ping();
  })
  .then((result) => {
    console.log('✅ PING response:', result);
    return redis1.quit();
  })
  .catch((err) => {
    console.error('❌ Test 1 failed:', err.message);
    
    // Test 2: Without explicit TLS config (let ioredis handle it)
    console.log('\n--- Test 2: rediss:// without explicit TLS config ---');
    const redis2 = new Redis(redisUrl, {
      lazyConnect: true
    });
    
    return redis2.connect()
      .then(() => {
        console.log('✅ Connected successfully without explicit TLS!');
        return redis2.ping();
      })
      .then((result) => {
        console.log('✅ PING response:', result);
        return redis2.quit();
      })
      .catch((err2) => {
        console.error('❌ Test 2 failed:', err2.message);
        
        // Test 3: Try without TLS (redis:// instead of rediss://)
        console.log('\n--- Test 3: redis:// without TLS ---');
        const plainUrl = redisUrl.replace('rediss://', 'redis://');
        const redis3 = new Redis(plainUrl, {
          lazyConnect: true
        });
        
        return redis3.connect()
          .then(() => {
            console.log('✅ Connected successfully without TLS!');
            return redis3.ping();
          })
          .then((result) => {
            console.log('✅ PING response:', result);
            return redis3.quit();
          })
          .catch((err3) => {
            console.error('❌ Test 3 failed:', err3.message);
            console.log('\n❌ All connection tests failed');
            process.exit(1);
          });
      });
  })
  .finally(() => {
    console.log('\nTest completed');
    process.exit(0);
  });
