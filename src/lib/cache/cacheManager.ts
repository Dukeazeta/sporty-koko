interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  metadata?: Record<string, any>;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  evictions: number;
}

interface CacheOptions {
  ttl?: number;
  persistToStorage?: boolean;
  storageKey?: string;
  metadata?: Record<string, any>;
}

export class CacheManager {
  private memoryCache = new Map<string, CacheEntry<any>>();
  private storageCache: Storage | null = null;
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    sets: 0,
    evictions: 0
  };
  private maxMemoryEntries = 1000;
  private storagePrefix = 'sportykoko_cache_';

  constructor(options?: { maxMemoryEntries?: number; storagePrefix?: string }) {
    if (options?.maxMemoryEntries) {
      this.maxMemoryEntries = options.maxMemoryEntries;
    }
    if (options?.storagePrefix) {
      this.storagePrefix = options.storagePrefix;
    }

    // Initialize storage cache (localStorage for browser, fallback for server)
    if (typeof window !== 'undefined' && window.localStorage) {
      this.storageCache = window.localStorage;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const fullKey = this.storagePrefix + key;

    // Try memory cache first
    const memoryEntry = this.memoryCache.get(fullKey);
    if (memoryEntry && !this.isExpired(memoryEntry)) {
      this.metrics.hits++;
      return memoryEntry.data;
    }

    // Try localStorage fallback
    if (this.storageCache) {
      try {
        const stored = this.storageCache.getItem(fullKey);
        if (stored) {
          const entry: CacheEntry<T> = JSON.parse(stored);
          if (!this.isExpired(entry)) {
            // Rehydrate memory cache
            this.memoryCache.set(fullKey, entry);
            this.metrics.hits++;
            return entry.data;
          } else {
            // Remove expired entry from storage
            this.storageCache.removeItem(fullKey);
          }
        }
      } catch (error) {
        console.warn(`Error reading from storage cache for key ${key}:`, error);
      }
    }

    this.metrics.misses++;
    return null;
  }

  async set<T>(
    key: string,
    data: T,
    options: CacheOptions = {}
  ): Promise<void> {
    const {
      ttl = 60 * 60 * 1000, // Default 1 hour
      persistToStorage = true,
      storageKey,
      metadata
    } = options;

    const fullKey = this.storagePrefix + (storageKey || key);
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      metadata
    };

    // Set in memory cache
    this.memoryCache.set(fullKey, entry);
    this.metrics.sets++;

    // Enforce memory limit
    if (this.memoryCache.size > this.maxMemoryEntries) {
      this.evictOldestEntries();
    }

    // Persist to localStorage if requested and available
    if (persistToStorage && this.storageCache) {
      try {
        this.storageCache.setItem(fullKey, JSON.stringify(entry));
      } catch (error) {
        console.warn(`Error writing to storage cache for key ${key}:`, error);
        // If storage is full, try to clear some space
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
          this.clearStorageSpace();
          try {
            this.storageCache.setItem(fullKey, JSON.stringify(entry));
          } catch (retryError) {
            console.warn(`Retry failed for storage cache key ${key}:`, retryError);
          }
        }
      }
    }
  }

  async delete(key: string): Promise<boolean> {
    const fullKey = this.storagePrefix + key;
    const memoryDeleted = this.memoryCache.delete(fullKey);
    let storageDeleted = false;

    if (this.storageCache) {
      try {
        const item = this.storageCache.getItem(fullKey);
        if (item !== null) {
          this.storageCache.removeItem(fullKey);
          storageDeleted = true;
        }
      } catch (error) {
        console.warn(`Error deleting from storage cache for key ${key}:`, error);
      }
    }

    return memoryDeleted || storageDeleted;
  }

  async clear(): Promise<void> {
    // Clear memory cache
    this.memoryCache.clear();

    // Clear storage cache
    if (this.storageCache) {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < this.storageCache.length; i++) {
          const key = this.storageCache.key(i);
          if (key && key.startsWith(this.storagePrefix)) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => this.storageCache!.removeItem(key));
      } catch (error) {
        console.warn('Error clearing storage cache:', error);
      }
    }
  }

  async clearByPrefix(prefix: string): Promise<void> {
    const fullPrefix = this.storagePrefix + prefix;

    // Clear from memory
    this.memoryCache.forEach((entry, key) => {
      if (key.startsWith(fullPrefix)) {
        this.memoryCache.delete(key);
      }
    });

    // Clear from storage
    if (this.storageCache) {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < this.storageCache.length; i++) {
          const key = this.storageCache.key(i);
          if (key && key.startsWith(fullPrefix)) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => this.storageCache!.removeItem(key));
      } catch (error) {
        console.warn(`Error clearing storage cache for prefix ${prefix}:`, error);
      }
    }
  }

  getMetrics(): CacheMetrics & { hitRate: string } {
    const total = this.metrics.hits + this.metrics.misses;
    return {
      ...this.metrics,
      hitRate: total > 0 ? ((this.metrics.hits / total) * 100).toFixed(2) + '%' : '0%'
    };
  }

  resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0
    };
  }

  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private evictOldestEntries(): void {
    const entries = Array.from(this.memoryCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

    const toEvict = entries.slice(0, Math.floor(this.maxMemoryEntries * 0.2)); // Evict 20%
    toEvict.forEach(([key]) => {
      this.memoryCache.delete(key);
      this.metrics.evictions++;
    });
  }

  private clearStorageSpace(): void {
    if (!this.storageCache) return;

    try {
      // Remove expired entries first
      const expiredKeys: string[] = [];
      for (let i = 0; i < this.storageCache.length; i++) {
        const key = this.storageCache.key(i);
        if (key && key.startsWith(this.storagePrefix)) {
          try {
            const entry = JSON.parse(this.storageCache.getItem(key) || '{}');
            if (this.isExpired(entry)) {
              expiredKeys.push(key);
            }
          } catch {
            // Remove corrupted entries
            expiredKeys.push(key);
          }
        }
      }
      expiredKeys.forEach(key => this.storageCache!.removeItem(key));

      // If still need space, remove oldest entries
      if (expiredKeys.length === 0) {
        const entries: { key: string; timestamp: number }[] = [];
        for (let i = 0; i < this.storageCache.length; i++) {
          const key = this.storageCache.key(i);
          if (key && key.startsWith(this.storagePrefix)) {
            try {
              const entry = JSON.parse(this.storageCache.getItem(key) || '{}');
              entries.push({ key, timestamp: entry.timestamp || 0 });
            } catch {
              // Skip corrupted entries
            }
          }
        }
        entries.sort((a, b) => a.timestamp - b.timestamp);
        const toRemove = entries.slice(0, Math.floor(entries.length * 0.1)); // Remove 10%
        toRemove.forEach(({ key }) => this.storageCache!.removeItem(key));
      }
    } catch (error) {
      console.warn('Error clearing storage space:', error);
    }
  }

  // Utility methods for specific caching patterns
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const data = await fetcher();
    await this.set(key, data, options);
    return data;
  }

  async invalidate(key: string): Promise<void> {
    await this.delete(key);
  }

  async touch(key: string, newTtl?: number): Promise<boolean> {
    const entry = this.memoryCache.get(this.storagePrefix + key);
    if (entry && !this.isExpired(entry)) {
      entry.timestamp = Date.now();
      if (newTtl) {
        entry.ttl = newTtl;
      }
      return true;
    }
    return false;
  }
}

// Create a singleton instance for the application
export const cacheManager = new CacheManager({
  maxMemoryEntries: 1000,
  storagePrefix: 'sportykoko_cache_'
});

// Cache configuration constants
export const CACHE_KEYS = {
  COMPETITIONS: 'competitions',
  TEAM_HISTORY: 'team_history_',
  HEAD_TO_HEAD: 'head_to_head_',
  MATCHES: 'matches_',
  PREDICTIONS: 'predictions_',
  ANALYTICS: 'analytics_'
} as const;

export const CACHE_TTL = {
  COMPETITIONS: 24 * 60 * 60 * 1000, // 24 hours
  TEAM_HISTORY: 6 * 60 * 60 * 1000,   // 6 hours
  HEAD_TO_HEAD: 12 * 60 * 60 * 1000,  // 12 hours
  MATCHES: 5 * 60 * 1000,             // 5 minutes
  PREDICTIONS: 2 * 60 * 60 * 1000,    // 2 hours
  ANALYTICS: 1 * 60 * 60 * 1000       // 1 hour
} as const;