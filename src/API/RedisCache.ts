import RedisClient from 'ioredis';
import Logger from '@Utils/Logger';

class Redis {
    private static _instance: Redis;
    private readonly _client: RedisClient;

    private constructor() {
        this._client = new RedisClient({
            host: process.env.REDIS_HOST,
            port: process.env.REDIS_PORT,
            password: process.env.REDIS_PASSWORD,
            maxRetriesPerRequest: null,
        });

        this._client.on('error', (error) => Logger.error(`Redis error: ${error}`));
        this._client.on('timeout', () => Logger.error('Redis connection timed out'));
    }

    public static getInstance(): Redis {
        if (!Redis._instance) {
            Redis._instance = new Redis();
        }

        return Redis._instance;
    }

    public async get<T>(key: string): Promise<T | null> {
        const value = await this._client.get(key);

        if (!value) {
            return null;
        }

        if (value.startsWith('[') || value.startsWith('{')) {
            try {
                return value ? JSON.parse(value) : null as unknown as T
            } catch {
                return value as unknown as T;
            }
        }

        return value as unknown as T;
    }

    public async getAndDelete<T>(key: string): Promise<T | null> {
        const value = await this._client.eval(
            "local value = redis.call('GET', KEYS[1]); if value then redis.call('DEL', KEYS[1]); end; return value",
            1,
            key,
        );

        if (typeof value !== 'string' || !value) {
            return null;
        }

        if (value.startsWith('[') || value.startsWith('{')) {
            try {
                return JSON.parse(value) as T;
            } catch {
                return value as unknown as T;
            }
        }

        return value as unknown as T;
    }

    public async set<T>(key: string, value: T, expireInSeconds: Nullable<number> = null): Promise<void> {
        const toStore = typeof value === 'object' ? JSON.stringify(value) : value;

        if (expireInSeconds !== null) {
            await this._client.set(key, toStore as string, 'EX', expireInSeconds);

            return;
        }

        await this._client.set(key, toStore as string);
    }

    public async delete(key: string): Promise<void> {
        await this._client.del(key);
    }

    public async deleteMultiple(keys: string[]): Promise<void> {
        if (keys.length > 0) {
            await this._client.del(...keys);
        }
    }

    public async findMultiple(key) {
        const keys = await this._client.keys(key + '*');

        return this.getMultiple(keys);
    }

    public async getMultiple(keys: string[]): Promise<(string | null)[]> {
        const pipeline = this._client.pipeline();

        keys.forEach((key) => pipeline.get(key));

        const results = await pipeline.exec();

        return results
            ? results.map(([error, value]) => {
                if (error) {
                    return null;
                }

                if (!value) {
                    return null;
                }

                const v = value as string;

                if (v.startsWith('[') || v.startsWith('{')) {
                    try {
                        return v ? JSON.parse(v) : null as unknown;
                    } catch {
                        return v as unknown;
                    }
                }

                return v as unknown;
            })
            : [];
    }

    public async size(): Promise<number> {
        return this._client.dbsize();
    }

    public getClient(): RedisClient {
        return this._client;
    }

    public async close(): Promise<void> {
        await this._client.quit();
    }
}

export default Redis;
