class Memory {
    private static _instance: Memory;
    private _cache: Map<string, { value: string, expiresAt: number | null }> = new Map();
    private readonly _cleanupInterval: NodeJS.Timeout;

    private constructor() {
        this._cleanupInterval = setInterval(() => {
            const now = Date.now();
            for (const [key, entry] of this._cache.entries()) {
                if (entry.expiresAt !== null && entry.expiresAt <= now) {
                    this._cache.delete(key);
                }
            }
        }, 1000);
    }

    public static getInstance(): Memory {
        if (!Memory._instance) {
            Memory._instance = new Memory();
        }

        return Memory._instance;
    }

    public async get<T>(key: string): Promise<T | null> {
        const entry = this._cache.get(key);
        if (!entry) return null;

        if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
            this._cache.delete(key);
            return null;
        }

        const {value} = entry;
        if (value.startsWith('{') || value.startsWith('[')) {
            try {
                return JSON.parse(value);
            } catch {
                return value as unknown as T;
            }
        }

        return value as unknown as T;
    }

    public async set<T>(key: string, value: T, expireInSeconds: Nullable<number> = null): Promise<void> {
        const toStore = typeof value === 'object' ? JSON.stringify(value) : String(value);

        const expiresAt = expireInSeconds ? Date.now() + expireInSeconds * 1000 : null;

        this._cache.set(key, {value: toStore, expiresAt});
    }

    public async delete(key: string): Promise<void> {
        this._cache.delete(key);
    }

    public async deleteMultiple(keys: string[]): Promise<void> {
        keys.forEach(key => this._cache.delete(key));
    }

    public async findMultiple(prefix: string): Promise<(string | null)[]> {
        const keys = [...this._cache.keys()].filter(k => k.startsWith(prefix));
        return this.getMultiple(keys);
    }

    public async getMultiple(keys: string[]): Promise<(string | null)[]> {
        return Promise.all(keys.map((key) => this.get<string>(key)));
    }

    public async size(): Promise<number> {
        return this._cache.size;
    }

    public async close(): Promise<void> {
        clearInterval(this._cleanupInterval);
        this._cache.clear();
    }
}

export default Memory;
