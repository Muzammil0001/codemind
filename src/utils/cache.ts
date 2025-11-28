

export interface CacheEntry<T> {
    value: T;
    timestamp: number;
    hits: number;
    size: number;
}

export interface CacheOptions {
    maxSize?: number; 
    maxAge?: number; 
    maxEntries?: number; 
}

export class Cache<T> {
    private cache: Map<string, CacheEntry<T>> = new Map();
    private options: Required<CacheOptions>;
    private currentSize: number = 0;

    constructor(options: CacheOptions = {}) {
        this.options = {
            maxSize: options.maxSize ?? 100 * 1024 * 1024, 
            maxAge: options.maxAge ?? 3600000, 
            maxEntries: options.maxEntries ?? 1000
        };
    }

    set(key: string, value: T): void {
        const size = this.estimateSize(value);

        if (this.cache.has(key)) {
            const oldEntry = this.cache.get(key)!;
            this.currentSize -= oldEntry.size;
        }

        while (
            this.currentSize + size > this.options.maxSize ||
            this.cache.size >= this.options.maxEntries
        ) {
            this.evictLRU();
        }

        this.cache.set(key, {
            value,
            timestamp: Date.now(),
            hits: 0,
            size
        });

        this.currentSize += size;
    }

    get(key: string): T | undefined {
        const entry = this.cache.get(key);

        if (!entry) {
            return undefined;
        }

        if (Date.now() - entry.timestamp > this.options.maxAge) {
            this.delete(key);
            return undefined;
        }

        entry.hits++;

        return entry.value;
    }

    has(key: string): boolean {
        const entry = this.cache.get(key);

        if (!entry) {
            return false;
        }

        if (Date.now() - entry.timestamp > this.options.maxAge) {
            this.delete(key);
            return false;
        }

        return true;
    }

    delete(key: string): boolean {
        const entry = this.cache.get(key);

        if (!entry) {
            return false;
        }

        this.currentSize -= entry.size;
        return this.cache.delete(key);
    }

    clear(): void {
        this.cache.clear();
        this.currentSize = 0;
    }

    size(): number {
        return this.cache.size;
    }

    getStats(): {
        entries: number;
        size: number;
        hitRate: number;
    } {
        let totalHits = 0;
        let totalAccesses = 0;

        for (const entry of this.cache.values()) {
            totalHits += entry.hits;
            totalAccesses += entry.hits + 1; 
        }

        return {
            entries: this.cache.size,
            size: this.currentSize,
            hitRate: totalAccesses > 0 ? totalHits / totalAccesses : 0
        };
    }

    private evictLRU(): void {
        let oldestKey: string | null = null;
        let oldestTime = Infinity;
        let lowestHits = Infinity;

        for (const [key, entry] of this.cache.entries()) {
            if (entry.timestamp < oldestTime ||
                (entry.timestamp === oldestTime && entry.hits < lowestHits)) {
                oldestKey = key;
                oldestTime = entry.timestamp;
                lowestHits = entry.hits;
            }
        }

        if (oldestKey) {
            this.delete(oldestKey);
        }
    }

    private estimateSize(value: T): number {
        const json = JSON.stringify(value);
        return json.length * 2; 
    }
}

export const embeddingCache = new Cache<number[]>({
    maxSize: 50 * 1024 * 1024, 
    maxAge: 3600000 
});

export const analysisCache = new Cache<any>({
    maxSize: 20 * 1024 * 1024, 
    maxAge: 1800000 
});

export const responseCache = new Cache<string>({
    maxSize: 10 * 1024 * 1024, 
    maxAge: 600000 
});
