// services/queue.js
const Queue = require('bull');
const redisClient = require('../config/redis');

let submissionQueue = null;
let usingRedis = false;

if (process.env.REDIS_URL && redisClient) {
  // Create Bull queue using REDIS
  submissionQueue = new Queue('submissionQueue', process.env.REDIS_URL);
  usingRedis = true;
  submissionQueue.on('error', (err) => console.error('Queue error:', err));
} else {
  console.warn('Redis not configured. Queue will fallback to inline processing.');
  submissionQueue = {
    add: async (job) => {
      // simple inline handler; worker will process synchronously later
      const { processSubmissionInline } = require('../workers/aiWorker');
      return processSubmissionInline(job.data);
    }
  };
}

module.exports = { submissionQueue, usingRedis };
