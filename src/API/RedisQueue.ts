import {Job, Queue, Worker} from 'bullmq';
import type {Redis as RedisClient} from 'ioredis';
import Redis from './RedisCache';

class RedisQueue {
    private static _instance: RedisQueue;
    private readonly _redis: RedisClient;
    private readonly _queues: Map<string, Queue>;

    private constructor(redis: RedisClient) {
        this._redis = redis;
        this._queues = new Map();
    }

    public static getInstance(): RedisQueue {
        if (!RedisQueue._instance) {
            RedisQueue._instance = new RedisQueue(Redis.getInstance().getClient());
        }

        return RedisQueue._instance;
    }

    public async addJob(jobName: string, data: any): Promise<void> {
        if (!this._queues.has(jobName)) {
            this._queues.set(
                jobName,
                new Queue(jobName, {
                    connection: this._redis,
                })
            );
        }
        const queue = this._queues.get(jobName);
        if (queue) {
            await queue.add(jobName, data);
        }
    }

    public listenTo(
        jobName: string,
        callback: (data: any) => Promise<void>,
        maxPerSecond: number = 1,
        maxDuration: number = 1000,
        concurrency: number = 1
    ): void {
        if (!this._queues.has(jobName)) {
            this._queues.set(
                jobName,
                new Queue(jobName, {
                    connection: this._redis,
                })
            );
        }

        new Worker(
            jobName,
            async (job: Job) => {
                if (job && job.data) {
                    await callback(job.data);
                }
            },
            {
                connection: this._redis,
                concurrency: concurrency,
                limiter: {
                    max: maxPerSecond,
                    duration: maxDuration,
                },
            }
        );
    }
}

export default RedisQueue;
