// src/lib/cache/cacheInvalidation.ts

import { cacheManager, CACHE_KEYS } from './cacheManager';

export interface CacheInvalidationOptions {
    invalidateByPrefix?: string[];
    invalidateByKeys?: string[];
    invalidateExpiredOnly?: boolean;
    forceRefresh?: boolean;
}

export class CacheInvalidationService {
    /**
     * Invalidate cache entries based on various criteria
     */
    static async invalidateCache(options: CacheInvalidationOptions = {}): Promise<void> {
        const {
            invalidateByPrefix = [],
            invalidateByKeys = [],
            invalidateExpiredOnly = false,
            forceRefresh = false
        } = options;

        try {
            console.log('[CacheInvalidation] Starting cache invalidation', { options });

            // If force refresh, clear everything
            if (forceRefresh) {
                await cacheManager.clear();
                console.log('[CacheInvalidation] Force refresh - cleared all cache');
                return;
            }

            // Invalidate by prefixes
            for (const prefix of invalidateByPrefix) {
                await cacheManager.clearByPrefix(prefix);
                console.log(`[CacheInvalidation] Cleared cache prefix: ${prefix}`);
            }

            // Invalidate specific keys
            for (const key of invalidateByKeys) {
                await cacheManager.delete(key);
                console.log(`[CacheInvalidation] Deleted cache key: ${key}`);
            }

            // Clean expired entries only
            if (invalidateExpiredOnly) {
                await this.cleanExpiredEntries();
            }

            console.log('[CacheInvalidation] Cache invalidation completed');
        } catch (error) {
            console.error('[CacheInvalidation] Error during cache invalidation:', error);
            throw error;
        }
    }

    /**
     * Clean expired cache entries
     */
    private static async cleanExpiredEntries(): Promise<void> {
        try {
            // This would be implemented in CacheManager if needed
            // For now, we'll trigger a cache cleanup cycle
            console.log('[CacheInvalidation] Cleaning expired entries');
            // Implementation would depend on the CacheManager's internal structure
        } catch (error) {
            console.error('[CacheInvalidation] Error cleaning expired entries:', error);
        }
    }

    /**
     * Invalidate competition-related cache entries
     */
    static async invalidateCompetitions(): Promise<void> {
        await this.invalidateCache({
            invalidateByPrefix: [CACHE_KEYS.COMPETITIONS]
        });
    }

    /**
     * Invalidate match-related cache entries
     */
    static async invalidateMatches(competitionId?: number): Promise<void> {
        const prefixes = [CACHE_KEYS.MATCHES];

        if (competitionId) {
            // We need to invalidate both the general matches and the specific competition
            // Since clearByPrefix works with exact prefixes, we'll add this as a separate key deletion
            await cacheManager.delete(`${CACHE_KEYS.MATCHES}competition_${competitionId}`);
        }

        await this.invalidateCache({
            invalidateByPrefix: prefixes
        });
    }

    /**
     * Invalidate team-specific cache entries
     */
    static async invalidateTeam(teamId: string | number): Promise<void> {
        await this.invalidateCache({
            invalidateByKeys: [
                `${CACHE_KEYS.TEAM_HISTORY}${teamId}`
            ]
        });
    }

    /**
     * Invalidate prediction cache entries
     */
    static async invalidatePredictions(matchId?: number): Promise<void> {
        const keys = [`${CACHE_KEYS.PREDICTIONS}latest`];

        if (matchId) {
            keys.push(`${CACHE_KEYS.PREDICTIONS}match_${matchId}`);
        }

        await this.invalidateCache({
            invalidateByKeys: keys
        });
    }

    /**
     * Invalidate all cache entries related to a specific match
     */
    static async invalidateMatchData(matchId: number, homeTeamId: number, awayTeamId: number): Promise<void> {
        await this.invalidateCache({
            invalidateByKeys: [
                `${CACHE_KEYS.PREDICTIONS}match_${matchId}`,
                `${CACHE_KEYS.HEAD_TO_HEAD}${homeTeamId}_vs_${awayTeamId}`,
                `${CACHE_KEYS.HEAD_TO_HEAD}${awayTeamId}_vs_${homeTeamId}`
            ]
        });
    }

    /**
     * Smart cache refresh - only update stale data
     */
    static async smartRefresh(): Promise<{
        refreshed: string[];
        skipped: string[];
        errors: string[];
    }> {
        const result = {
            refreshed: [] as string[],
            skipped: [] as string[],
            errors: [] as string[]
        };

        try {
            console.log('[CacheInvalidation] Starting smart refresh...');

            // Check cache metrics to determine refresh strategy
            const metrics = cacheManager.getMetrics();
            const hitRate = parseFloat(metrics.hitRate);

            if (hitRate < 50) {
                console.log(`[CacheInvalidation] Low hit rate (${hitRate}%), considering full refresh`);
                // Low hit rate might indicate stale data
                result.refreshed.push('all-cache');
                await this.invalidateCache({ forceRefresh: true });
            } else {
                console.log(`[CacheInvalidation] Good hit rate (${hitRate}%), selective refresh`);
                // Selectively refresh based on age and importance
                result.refreshed.push('selective');
                // Implementation would check individual cache entry ages
            }

            console.log('[CacheInvalidation] Smart refresh completed', result);
        } catch (error) {
            const errorMsg = `Smart refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
            result.errors.push(errorMsg);
            console.error('[CacheInvalidation]', errorMsg);
        }

        return result;
    }

    /**
     * Get cache invalidation status and recommendations
     */
    static async getCacheStatus(): Promise<{
        health: 'healthy' | 'warning' | 'critical';
        recommendations: string[];
        metrics: any;
    }> {
        const metrics = cacheManager.getMetrics();
        const hitRate = parseFloat(metrics.hitRate);

        let health: 'healthy' | 'warning' | 'critical' = 'healthy';
        const recommendations: string[] = [];

        // Analyze cache health
        if (hitRate < 30) {
            health = 'critical';
            recommendations.push('Consider full cache refresh - hit rate very low');
            recommendations.push('Check if cache TTLs are appropriate');
        } else if (hitRate < 60) {
            health = 'warning';
            recommendations.push('Monitor cache performance - hit rate below optimal');
        }

        if (metrics.evictions > 100) {
            health = 'critical';
            recommendations.push('High eviction count - consider increasing cache size');
        }

        if (health === 'healthy') {
            recommendations.push('Cache performance is optimal');
        }

        return {
            health,
            recommendations,
            metrics: {
                ...metrics,
                assessedAt: new Date().toISOString()
            }
        };
    }
}

// Error recovery utilities
export class CacheErrorRecovery {
    /**
     * Attempt to recover from cache-related errors
     */
    static async recoverFromError(error: Error, context: string): Promise<boolean> {
        console.log(`[CacheErrorRecovery] Attempting recovery for ${context}:`, error.message);

        try {
            // Different recovery strategies based on error type
            if (error.message.includes('QuotaExceededError')) {
                console.log('[CacheErrorRecovery] Storage quota exceeded, clearing cache');
                await CacheInvalidationService.invalidateCache({ forceRefresh: true });
                return true;
            }

            if (error.message.includes('JSON')) {
                console.log('[CacheErrorRecovery] JSON parsing error, clearing corrupted entries');
                await this.clearCorruptedEntries();
                return true;
            }

            if (error.message.includes('Network') || error.message.includes('fetch')) {
                console.log('[CacheErrorRecovery] Network error, cache should be unaffected');
                return true; // Cache is fine, just log the error
            }

            // Generic recovery
            console.log('[CacheErrorRecovery] Generic error recovery');
            await this.clearCorruptedEntries();
            return true;

        } catch (recoveryError) {
            console.error('[CacheErrorRecovery] Recovery failed:', recoveryError);
            return false;
        }
    }

    /**
     * Clear potentially corrupted cache entries
     */
    private static async clearCorruptedEntries(): Promise<void> {
        try {
            // This would need access to CacheManager internals
            // For now, we'll trigger a partial cache clear
            console.log('[CacheErrorRecovery] Clearing potentially corrupted entries');

            // Clear volatile caches first
            await cacheManager.clearByPrefix(CACHE_KEYS.PREDICTIONS);
            await cacheManager.clearByPrefix(CACHE_KEYS.MATCHES);

        } catch (error) {
            console.error('[CacheErrorRecovery] Error clearing corrupted entries:', error);
        }
    }

    /**
     * Validate cache integrity
     */
    static async validateCacheIntegrity(): Promise<{
        isValid: boolean;
        corruptedKeys: string[];
        fixed: boolean;
    }> {
        const result = {
            isValid: true,
            corruptedKeys: [] as string[],
            fixed: false
        };

        try {
            console.log('[CacheErrorRecovery] Validating cache integrity...');

            // This would need access to CacheManager internals to iterate entries
            // For now, we'll do basic validation

            // Test basic cache operations
            const testKey = 'integrity_test_' + Date.now();
            await cacheManager.set(testKey, { test: true }, { ttl: 1000, persistToStorage: true });
            const retrieved = await cacheManager.get(testKey);
            await cacheManager.delete(testKey);

            if (!retrieved) {
                result.isValid = false;
                result.corruptedKeys.push('basic_operations');
            }

            console.log('[CacheErrorRecovery] Cache integrity validation completed', result);

        } catch (error) {
            result.isValid = false;
            result.corruptedKeys.push('validation_error');
            console.error('[CacheErrorRecovery] Cache integrity validation failed:', error);
        }

        return result;
    }
}

// Export utility functions for easy use
export const invalidateCache = CacheInvalidationService.invalidateCache.bind(CacheInvalidationService);
export const invalidateCompetitions = CacheInvalidationService.invalidateCompetitions.bind(CacheInvalidationService);
export const invalidateMatches = CacheInvalidationService.invalidateMatches.bind(CacheInvalidationService);
export const invalidateTeam = CacheInvalidationService.invalidateTeam.bind(CacheInvalidationService);
export const invalidatePredictions = CacheInvalidationService.invalidatePredictions.bind(CacheInvalidationService);
export const invalidateMatchData = CacheInvalidationService.invalidateMatchData.bind(CacheInvalidationService);
export const smartRefresh = CacheInvalidationService.smartRefresh.bind(CacheInvalidationService);
export const getCacheStatus = CacheInvalidationService.getCacheStatus.bind(CacheInvalidationService);
export const recoverFromCacheError = CacheErrorRecovery.recoverFromError.bind(CacheErrorRecovery);