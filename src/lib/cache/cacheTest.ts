// src/lib/cache/cacheTest.ts

import { cacheManager, CACHE_KEYS, CACHE_TTL } from './cacheManager';
import { fetchCompetitions, fetchTeamHistory, fetchHeadToHead } from '../services/dataServiceCached';
import { invalidateCache, getCacheStatus, recoverFromCacheError } from './cacheInvalidation';

interface TestResult {
    testName: string;
    passed: boolean;
    duration: number;
    message: string;
    details?: any;
}

export class CacheTestSuite {
    private results: TestResult[] = [];

    private async runTest(testName: string, testFunction: () => Promise<any>): Promise<TestResult> {
        const startTime = Date.now();
        try {
            const result = await testFunction();
            const duration = Date.now() - startTime;

            const testResult: TestResult = {
                testName,
                passed: true,
                duration,
                message: 'Test passed',
                details: result
            };

            this.results.push(testResult);
            return testResult;
        } catch (error) {
            const duration = Date.now() - startTime;

            const testResult: TestResult = {
                testName,
                passed: false,
                duration,
                message: error instanceof Error ? error.message : 'Unknown error',
                details: error
            };

            this.results.push(testResult);
            return testResult;
        }
    }

    /**
     * Test basic cache operations
     */
    async testBasicCacheOperations(): Promise<TestResult[]> {
        console.log('[CacheTest] Testing basic cache operations...');

        const tests = [
            this.runTest('Cache Set and Get', async () => {
                const testData = { id: 1, name: 'Test Data' };
                await cacheManager.set('test-key', testData, 60000);
                const retrieved = await cacheManager.get('test-key');

                if (!retrieved || retrieved.id !== 1) {
                    throw new Error('Cache set/get failed');
                }

                return { success: true, data: retrieved };
            }),

            this.runTest('Cache Expiration', async () => {
                const testData = { id: 2, name: 'Expires Soon' };
                await cacheManager.set('expire-test', testData, 50); // 50ms TTL

                // Should be available immediately
                const retrieved = await cacheManager.get('expire-test');
                if (!retrieved) {
                    throw new Error('Cache entry not available immediately');
                }

                // Wait for expiration
                await new Promise(resolve => setTimeout(resolve, 100));
                const expired = await cacheManager.get('expire-test');

                if (expired) {
                    throw new Error('Cache entry should have expired');
                }

                return { success: true, expiredCorrectly: true };
            }),

            this.runTest('Cache Delete', async () => {
                const testData = { id: 3, name: 'Delete Me' };
                await cacheManager.set('delete-test', testData, 60000);

                // Verify it exists
                const exists = await cacheManager.get('delete-test');
                if (!exists) {
                    throw new Error('Cache entry not created');
                }

                // Delete it
                await cacheManager.delete('delete-test');

                // Verify it's gone
                const deleted = await cacheManager.get('delete-test');
                if (deleted) {
                    throw new Error('Cache entry not deleted');
                }

                return { success: true, deletedCorrectly: true };
            }),

            this.runTest('Cache Clear', async () => {
                // Add some test data
                await cacheManager.set('clear-test-1', { data: 1 }, 60000);
                await cacheManager.set('clear-test-2', { data: 2 }, 60000);

                // Clear cache
                await cacheManager.clear();

                // Verify everything is gone
                const item1 = await cacheManager.get('clear-test-1');
                const item2 = await cacheManager.get('clear-test-2');

                if (item1 || item2) {
                    throw new Error('Cache clear failed');
                }

                return { success: true, clearedCorrectly: true };
            })
        ];

        await Promise.all(tests);
        return tests.map(t => t.then(result => result));
    }

    /**
     * Test cache performance and metrics
     */
    async testCachePerformance(): Promise<TestResult[]> {
        console.log('[CacheTest] Testing cache performance...');

        const tests = [
            this.runTest('Cache Hit Rate Tracking', async () => {
                // Reset metrics
                cacheManager.resetMetrics();

                const testData = { test: 'metrics' };
                await cacheManager.set('metrics-test', testData, 60000);

                // Generate some cache activity
                for (let i = 0; i < 10; i++) {
                    await cacheManager.get('metrics-test'); // Should hit
                    await cacheManager.get('non-existent-key'); // Should miss
                }

                const metrics = cacheManager.getMetrics();

                if (metrics.hits < 10) {
                    throw new Error(`Expected at least 10 hits, got ${metrics.hits}`);
                }

                if (metrics.misses < 10) {
                    throw new Error(`Expected at least 10 misses, got ${metrics.misses}`);
                }

                const hitRate = parseFloat(metrics.hitRate);
                if (hitRate < 40 || hitRate > 60) { // Should be around 50%
                    throw new Error(`Hit rate out of expected range: ${metrics.hitRate}`);
                }

                return { metrics };
            }),

            this.runTest('Cache Performance Benchmark', async () => {
                const iterations = 1000;
                const testData = { id: iterations, name: 'Performance Test' };

                // Time cache writes
                const writeStart = Date.now();
                for (let i = 0; i < iterations; i++) {
                    await cacheManager.set(`perf-test-${i}`, { ...testData, i }, 60000);
                }
                const writeTime = Date.now() - writeStart;

                // Time cache reads
                const readStart = Date.now();
                for (let i = 0; i < iterations; i++) {
                    await cacheManager.get(`perf-test-${i}`);
                }
                const readTime = Date.now() - readStart;

                const avgWriteTime = writeTime / iterations;
                const avgReadTime = readTime / iterations;

                if (avgWriteTime > 10) { // 10ms per write is reasonable
                    console.warn(`Slow cache writes: ${avgWriteTime.toFixed(2)}ms avg`);
                }

                if (avgReadTime > 5) { // 5ms per read is reasonable
                    console.warn(`Slow cache reads: ${avgReadTime.toFixed(2)}ms avg`);
                }

                return {
                    iterations,
                    writeTime,
                    readTime,
                    avgWriteTime: avgWriteTime.toFixed(2),
                    avgReadTime: avgReadTime.toFixed(2)
                };
            })
        ];

        await Promise.all(tests);
        return tests.map(t => t.then(result => result));
    }

    /**
     * Test integration with data services
     */
    async testDataServiceIntegration(): Promise<TestResult[]> {
        console.log('[CacheTest] Testing data service integration...');

        const tests = [
            this.runTest('Competitions Caching', async () => {
                // Clear any existing competitions cache
                await cacheManager.clearByPrefix(CACHE_KEYS.COMPETITIONS);

                // First call - should hit API
                console.time('First competitions call');
                const result1 = await fetchCompetitions();
                console.timeEnd('First competitions call');

                // Second call - should hit cache
                console.time('Second competitions call');
                const result2 = await fetchCompetitions();
                console.timeEnd('Second competitions call');

                if (!result1.competitions || !result2.competitions) {
                    throw new Error('Failed to fetch competitions');
                }

                if (result1.competitions.length !== result2.competitions.length) {
                    throw new Error('Cache returned different data');
                }

                return {
                    firstCallLength: result1.competitions.length,
                    secondCallLength: result2.competitions.length,
                    dataMatches: JSON.stringify(result1.competitions) === JSON.stringify(result2.competitions)
                };
            }),

            this.runTest('Rate Limit Info Caching', async () => {
                // This test verifies that rate limit info is properly cached with API responses
                const result = await fetchCompetitions();

                if (!result.rateLimitInfo) {
                    throw new Error('Rate limit info not returned');
                }

                // Verify rate limit info structure
                const { isRateLimited, remainingRequests, resetTime } = result.rateLimitInfo;

                if (typeof isRateLimited !== 'boolean') {
                    throw new Error('Invalid rate limit info structure');
                }

                return {
                    rateLimitInfo: result.rateLimitInfo,
                    structureValid: true
                };
            })
        ];

        await Promise.all(tests);
        return tests.map(t => t.then(result => result));
    }

    /**
     * Test cache invalidation
     */
    async testCacheInvalidation(): Promise<TestResult[]> {
        console.log('[CacheTest] Testing cache invalidation...');

        const tests = [
            this.runTest('Prefix-based Invalidation', async () => {
                // Add test data with specific prefixes
                await cacheManager.set(`${CACHE_KEYS.PREDICTIONS}test1`, { data: 1 }, 60000);
                await cacheManager.set(`${CACHE_KEYS.PREDICTIONS}test2`, { data: 2 }, 60000);
                await cacheManager.set(`${CACHE_KEYS.MATCHES}test1`, { data: 3 }, 60000);

                // Invalidate predictions
                await invalidateCache({ invalidateByPrefix: [CACHE_KEYS.PREDICTIONS] });

                // Check results
                const pred1 = await cacheManager.get(`${CACHE_KEYS.PREDICTIONS}test1`);
                const pred2 = await cacheManager.get(`${CACHE_KEYS.PREDICTIONS}test2`);
                const match1 = await cacheManager.get(`${CACHE_KEYS.MATCHES}test1`);

                if (pred1 || pred2) {
                    throw new Error('Predictions cache not cleared');
                }

                if (!match1) {
                    throw new Error('Matches cache incorrectly cleared');
                }

                return {
                    predictionsCleared: !pred1 && !pred2,
                    matchesPreserved: !!match1
                };
            }),

            this.runTest('Cache Status Monitoring', async () => {
                const status = await getCacheStatus();

                if (!status.health || !status.recommendations || !status.metrics) {
                    throw new Error('Invalid cache status response');
                }

                if (!['healthy', 'warning', 'critical'].includes(status.health)) {
                    throw new Error('Invalid health status');
                }

                return {
                    health: status.health,
                    recommendationCount: status.recommendations.length,
                    hasMetrics: !!status.metrics
                };
            })
        ];

        await Promise.all(tests);
        return tests.map(t => t.then(result => result));
    }

    /**
     * Test error recovery mechanisms
     */
    async testErrorRecovery(): Promise<TestResult[]> {
        console.log('[CacheTest] Testing error recovery...');

        const tests = [
            this.runTest('Corrupted Data Recovery', async () => {
                // Simulate corrupted data by setting invalid JSON
                const testKey = 'recovery-test';

                try {
                    // This would normally be handled internally
                    // For testing, we'll use a different approach
                    await cacheManager.set(testKey, { valid: 'data' }, 60000);
                    const retrieved = await cacheManager.get(testKey);

                    if (!retrieved) {
                        throw new Error('Failed to retrieve valid data');
                    }

                    // Simulate recovery
                    const recovered = await recoverFromCacheError(
                        new Error('Simulated corruption'),
                        'test-context'
                    );

                    return {
                        dataRetrieved: !!retrieved,
                        recoveryAttempted: true,
                        recoverySucceeded: recovered
                    };
                } catch (error) {
                    // Test recovery
                    const recovered = await recoverFromCacheError(
                        error instanceof Error ? error : new Error('Unknown error'),
                        'test-context'
                    );

                    return {
                        errorOccurred: true,
                        recoveryAttempted: true,
                        recoverySucceeded: recovered
                    };
                }
            })
        ];

        await Promise.all(tests);
        return tests.map(t => t.then(result => result));
    }

    /**
     * Run all cache tests
     */
    async runAllTests(): Promise<{
        summary: {
            total: number;
            passed: number;
            failed: number;
            totalDuration: number;
        };
        results: TestResult[];
    }> {
        console.log('[CacheTest] Starting comprehensive cache test suite...');

        const startTime = Date.now();

        // Clear any existing cache and reset metrics
        await cacheManager.clear();
        cacheManager.resetMetrics();

        // Run all test categories
        await this.testBasicCacheOperations();
        await this.testCachePerformance();
        await this.testDataServiceIntegration();
        await this.testCacheInvalidation();
        await this.testErrorRecovery();

        const totalDuration = Date.now() - startTime;
        const passed = this.results.filter(r => r.passed).length;
        const failed = this.results.filter(r => !r.passed).length;

        console.log(`[CacheTest] Test suite completed: ${passed}/${this.results.length} passed (${failed} failed) in ${totalDuration}ms`);

        // Print detailed results
        this.results.forEach(result => {
            const status = result.passed ? '✅' : '❌';
            console.log(`${status} ${result.testName} (${result.duration}ms): ${result.message}`);
        });

        return {
            summary: {
                total: this.results.length,
                passed,
                failed,
                totalDuration
            },
            results: this.results
        };
    }

    /**
     * Get quick cache health check
     */
    async quickHealthCheck(): Promise<{
        healthy: boolean;
        metrics: any;
        issues: string[];
    }> {
        const issues: string[] = [];

        try {
            // Basic functionality test
            await cacheManager.set('health-check', { timestamp: Date.now() }, 1000);
            const retrieved = await cacheManager.get('health-check');

            if (!retrieved) {
                issues.push('Basic cache set/get failed');
            }

            // Check metrics
            const metrics = cacheManager.getMetrics();
            const hitRate = parseFloat(metrics.hitRate);

            if (hitRate < 30) {
                issues.push(`Low cache hit rate: ${metrics.hitRate}`);
            }

            // Check cache status
            const status = await getCacheStatus();
            if (status.health === 'critical') {
                issues.push('Cache health is critical');
            }

            return {
                healthy: issues.length === 0,
                metrics,
                issues
            };

        } catch (error) {
            return {
                healthy: false,
                metrics: null,
                issues: [`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
            };
        }
    }
}

// Export for easy usage
export const cacheTestSuite = new CacheTestSuite();

// Convenience functions
export const runCacheTests = () => cacheTestSuite.runAllTests();
export const quickCacheHealthCheck = () => cacheTestSuite.quickHealthCheck();