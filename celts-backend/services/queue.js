const Queue = require('bull');
const redisClient = require('../config/redis');
const Submission = require('../models/Submission');

let submissionQueue = null;
let usingRedis = false;
let healthCheckInterval = null;

async function persistFailedJob(job, error) {
  try {
    const submissionId = job.data?.submissionId;
    if (submissionId) {
      await Submission.findByIdAndUpdate(submissionId, {
        status: 'failed',
        $push: {
          processingErrors: {
            timestamp: new Date(),
            error: error.message,
            jobId: job.id,
            attemptsMade: job.attemptsMade,
          }
        }
      });
      console.error(`[CRITICAL] Job ${job.id} failed permanently for submission ${submissionId}:`, error.message);
    }
  } catch (dbErr) {
    console.error('[CRITICAL] Failed to persist failed job to database:', dbErr.message);
  }
}

if (process.env.REDIS_URL && redisClient) {
  try {
    submissionQueue = new Queue('submissionQueue', process.env.REDIS_URL, {
      defaultJobOptions: {
        removeOnComplete: {
          age: 3600, 
          count: 100, 
        },
        removeOnFail: {
          age: 86400,
          count: 50,
        },
        attempts: 5, 
        backoff: {
          type: 'exponential',
          delay: 3000 
        },
        timeout: 300000,
      },
      settings: {
        
        maxStalledCount: 2,
        stalledInterval: 30000,
        guardInterval: 5000, 
        retryProcessDelay: 5000, 
        drainDelay: 5,
      },

      prefix: 'celts:queue',
    });
    usingRedis = true;
    
    submissionQueue.on('error', (err) => {
      if (err.code === 'ECONNRESET') {
        console.warn('[Queue] Redis connection reset (this is usually normal during Redis restart)');
      } else if (err.code === 'ENOTFOUND' || err.message?.includes('ENOTFOUND')) {

        if (!submissionQueue._dnsErrorLogged) {
          console.error('[Queue] Cannot connect to Redis:', err.message);
          console.warn('[Queue] Using inline processing mode instead');
          submissionQueue._dnsErrorLogged = true;
        }
      } else {
        console.error('[Queue] Error:', err.message);
      }
    });
    
    submissionQueue.on('failed', async (job, err) => {
      console.error(`[Queue] Job ${job.id} failed (attempt ${job.attemptsMade}/${job.opts.attempts}):`, err.message);
      
      if (job.attemptsMade >= job.opts.attempts) {
        await persistFailedJob(job, err);
      }
    });
    
    submissionQueue.on('completed', (job) => {
      console.log(`[Queue] Job ${job.id} completed successfully for submission ${job.data.submissionId}`);
    });
    
    submissionQueue.on('stalled', (job) => {
      console.warn(`[Queue] Job ${job.id} has stalled and will be retried`);
    });
    
    if (healthCheckInterval) clearInterval(healthCheckInterval);
    healthCheckInterval = setInterval(async () => {
      try {
        const counts = await submissionQueue.getJobCounts();
        const total = counts.waiting + counts.active + counts.delayed;
        
        if (total > 1000) {
          console.warn(`[Queue Health] High queue depth: ${total} jobs (waiting: ${counts.waiting}, active: ${counts.active}, delayed: ${counts.delayed})`);
        }
        
        if (counts.failed > 20) {
          console.error(`[Queue Health] High failure rate: ${counts.failed} failed jobs`);
        }
      } catch (err) {
        console.error('[Queue Health] Monitoring error:', err.message);
      }
    }, 60000); 
    
    console.log('[Queue] Bull queue initialized with Redis (optimized for 2K-3K concurrent users)');
  } catch (error) {
    console.error('[Queue] Failed to initialize Bull queue:', error.message);
    console.warn('[Queue] Falling back to inline processing');
    usingRedis = false;
    submissionQueue = createInlineQueue();
  }
} else {
  console.warn('[Queue] Redis not configured. Queue will fallback to inline processing.');
  submissionQueue = createInlineQueue();
}

function createInlineQueue() {
  const inMemoryQueue = [];
  const activeJobs = new Set();
  const MAX_CONCURRENT = 3;
  
  const processJob = async (job) => {
    try {
      const { gradeSubmission } = require('./gradingWorker');
      await gradeSubmission(job.data);
      console.log(`[Inline Queue] Processed job for submission ${job.data.submissionId}`);
      return true;
    } catch (error) {
      console.error(`[Inline Queue] Processing error for submission ${job.data.submissionId}:`, error.message);
      
      job.attempts = (job.attempts || 0) + 1;
      if (job.attempts < 3) {
        console.log(`[Inline Queue] Retrying job (attempt ${job.attempts}/3)`);
        inMemoryQueue.push(job);
      } else {
        await persistFailedJob(job, error);
      }
      return false;
    }
  };
  
  const processQueue = async () => {
    while (inMemoryQueue.length > 0 && activeJobs.size < MAX_CONCURRENT) {
      const job = inMemoryQueue.shift();
      const jobPromise = processJob(job).finally(() => {
        activeJobs.delete(jobPromise);
        if (inMemoryQueue.length > 0) {
          setImmediate(processQueue);
        }
      });
      activeJobs.add(jobPromise);
    }
  };
  
  return {
    add: async (jobData) => {
      const existingJob = inMemoryQueue.find(j => j.data.submissionId === jobData.submissionId);
      if (existingJob) {
        console.log(`[Inline Queue] Job for submission ${jobData.submissionId} already queued, skipping duplicate`);
        return existingJob;
      }
      
      const job = { id: `${jobData.submissionId}-${Date.now()}-${Math.random()}`, data: jobData, attempts: 0 };
      inMemoryQueue.push(job);
      console.warn(`[Inline Queue] Added job to in-memory queue (queue size: ${inMemoryQueue.length})`);
      
      setImmediate(processQueue);
      
      return job;
    },

    process: () => {},
    getJobCounts: async () => ({ waiting: inMemoryQueue.length, active: activeJobs.size }),
    close: async () => Promise.all(Array.from(activeJobs)),
  };
}

async function addSubmissionJob(jobData, priority = 'normal') {
  const priorityMap = {
    high: 1,    
    normal: 5,  
    low: 10,     
  };
  
  const options = {
    priority: priorityMap[priority] || 5,
    jobId: `${jobData.submissionId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    removeOnComplete: true,
  };
  
  if (usingRedis) {
    try {
      await Submission.findByIdAndUpdate(jobData.submissionId, {
        status: 'queued',
        queuedAt: new Date(),
      });
      console.log(`[Queue] ✓ Submission ${jobData.submissionId} status updated to 'queued'`);
    } catch (err) {
      console.error('[Queue] Failed to update submission status:', err.message);
    }
  }
  
  console.log(`[Queue] Adding job to queue - Submission: ${jobData.submissionId}, Skill: ${jobData.skill}`);
  const job = await submissionQueue.add(jobData, options);
  console.log(`[Queue] ✓ Job ${job.id} added to queue successfully`);
  return job;
}

async function closeQueue() {
  console.log('[Queue] Closing queue gracefully...');
  
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
  
  if (submissionQueue && usingRedis) {
    await submissionQueue.close();
    console.log('[Queue] Bull queue closed');
  } else if (submissionQueue && submissionQueue.close) {
    await submissionQueue.close();
    console.log('[Queue] Inline queue closed');
  }
}

module.exports = { 
  submissionQueue, 
  usingRedis,
  addSubmissionJob,
  closeQueue,
};
