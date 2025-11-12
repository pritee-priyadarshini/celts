// config/redis.js
const Redis = require('ioredis');

let redisClient = null;
if (process.env.REDIS_URL) {
  redisClient = new Redis(process.env.REDIS_URL);
  redisClient.on('error', (err) => {
    console.warn('Redis connection error:', err.message);
  });
} else {
  console.warn('REDIS_URL not set; queue will fallback to inline processing.');
}

module.exports = redisClient;
