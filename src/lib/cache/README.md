# Caching System for SportyKoko

This comprehensive caching system has been implemented to significantly improve the performance and reliability of the SportyKoko football prediction application.

## Overview

The caching system provides:

- **Multi-layer caching**: In-memory and localStorage for optimal performance
- **Smart cache invalidation**: Automatic and manual cache management
- **Error recovery**: Robust handling of cache failures and data corruption
- **Performance monitoring**: Detailed metrics and health checks
- **Rate limit optimization**: Reduced API calls to Football Data API

## Architecture

### Core Components

1. **CacheManager** (`cacheManager.ts`)
   - Main caching interface with in-memory and localStorage support
   - Automatic TTL (time-to-live) management
   - Cache eviction policies and storage quota management

2. **Cached Data Service** (`dataServiceCached.ts`)
   - Enhanced data service with integrated caching
   - Cache-first strategy for all API calls
   - Preserves existing API interface

3. **Cache Invalidation** (`cacheInvalidation.ts`)
   - Smart cache invalidation strategies
   - Error recovery and corruption handling
   - Cache health monitoring

4. **Test Suite** (`cacheTest.ts`)
   - Comprehensive testing framework
   - Performance benchmarks
   - Health check utilities

## Configuration

### Cache Keys and TTLs

```typescript
export const CACHE_KEYS = {
    COMPETITIONS: 'competitions',
    TEAM_HISTORY: 'team_history_',
    HEAD_TO_HEAD: 'head_to_head_',
    MATCHES: 'matches_',
    PREDICTIONS: 'predictions_',
    ANALYTICS: 'analytics_'
} as const;

export const CACHE_TTL = {
    COMPETITIONS: 24 * 60 * 60 * 1000,    // 24 hours
    TEAM_HISTORY: 6 * 60 * 60 * 1000,      // 6 hours
    HEAD_TO_HEAD: 12 * 60 * 60 * 1000,     // 12 hours
    MATCHES: 5 * 60 * 1000,                // 5 minutes
    PREDICTIONS: 2 * 60 * 60 * 1000,       // 2 hours
    ANALYTICS: 1 * 60 * 60 * 1000          // 1 hour
} as const;
```

## Usage

### Basic Operations

```typescript
import { cacheManager } from '@/lib/cache/cacheManager';

// Set cache
await cacheManager.set('key', data, 60000); // 1 minute TTL

// Get cache
const data = await cacheManager.get('key');

// Delete cache
await cacheManager.delete('key');

// Clear all cache
await cacheManager.clear();
```

### Using Cached Data Service

```typescript
import {
    fetchCompetitions,
    fetchTeamHistory,
    fetchUpcomingMatches
} from '@/lib/services/dataServiceCached';

// Automatic caching - no code changes needed
const competitions = await fetchCompetitions();
const teamHistory = await fetchTeamHistory(123);
const matches = await fetchUpcomingMatches(456);
```

### Cache Management

```typescript
import {
    invalidatePredictions,
    invalidateTeam,
    getCacheStatus,
    smartRefresh
} from '@/lib/cache/cacheInvalidation';

// Invalidate specific cache types
await invalidatePredictions();
await invalidateTeam(123);

// Get cache health status
const status = await getCacheStatus();

// Smart cache refresh
const refreshResult = await smartRefresh();
```

## API Endpoints

### Cached Predictions API

**Endpoint**: `GET /api/predictions-cached`

Returns cached predictions with improved performance:

```json
{
    "predictions": [...],
    "total": 10,
    "requested": 10,
    "cachedAt": 1640995200000,
    "fromCache": true,
    "cacheAge": 45,
    "cacheMetrics": {
        "hits": 45,
        "misses": 12,
        "hitRate": "78.95%",
        "sets": 23,
        "evictions": 0
    }
}
```

**Cache Management**:

- `POST /api/predictions-cached` - Clear cache
- `PUT /api/predictions-cached` - Warm cache

```bash
# Clear all prediction cache
curl -X POST http://localhost:3000/api/predictions-cached \
  -H "Content-Type: application/json" \
  -d '{"clearType": "predictions"}'

# Warm cache
curl -X PUT http://localhost:3000/api/predictions-cached
```

## Testing

### Run All Tests

```typescript
import { runCacheTests } from '@/lib/cache/cacheTest';

const results = await runCacheTests();
console.log(`Tests: ${results.summary.passed}/${results.summary.total} passed`);
```

### Quick Health Check

```typescript
import { quickCacheHealthCheck } from '@/lib/cache/cacheTest';

const health = await quickCacheHealthCheck();
if (!health.healthy) {
    console.warn('Cache issues detected:', health.issues);
}
```

### Test Results Example

```
✅ Cache Set and Get (2ms): Test passed
✅ Cache Expiration (105ms): Test passed
✅ Cache Delete (3ms): Test passed
✅ Cache Hit Rate Tracking (45ms): Test passed
✅ Competitions Caching (1234ms): Test passed
✅ Rate Limit Info Caching (1234ms): Test passed
✅ Prefix-based Invalidation (12ms): Test passed
✅ Cache Status Monitoring (8ms): Test passed

Test suite completed: 8/8 passed (0 failed) in 1456ms
```

## Performance Improvements

### Expected Gains

- **API Call Reduction**: 70-80% fewer external API calls
- **Page Load Time**: 60-70% faster page loads
- **Rate Limit Issues**: 90% reduction in rate limit errors
- **User Experience**: Instant data loading for cached content

### Cache Hit Rate Targets

- **Good**: >80% hit rate
- **Acceptable**: 60-80% hit rate
- **Needs Improvement**: <60% hit rate

### Monitoring

Monitor cache performance using:

```typescript
const metrics = cacheManager.getMetrics();
console.log(`Cache hit rate: ${metrics.hitRate}`);
console.log(`Total entries: ${metrics.sets}`);
console.log(`Evictions: ${metrics.evictions}`);
```

## Migration Guide

### Step 1: Update Imports

```typescript
// Before
import { fetchCompetitions } from '@/lib/services/dataService';

// After
import { fetchCompetitions } from '@/lib/services/dataServiceCached';
```

### Step 2: Update API Routes

```typescript
// Before: app/api/predictions/route.ts
// After: app/api/predictions/routeCached.ts
```

### Step 3: Add Cache Management UI

```typescript
// Add cache status to admin dashboard
import { getCacheStatus } from '@/lib/cache/cacheInvalidation';

const cacheStatus = await getCacheStatus();
// Display status, hit rate, and recommendations
```

## Troubleshooting

### Common Issues

1. **Low Hit Rate**
   - Check TTL settings
   - Verify cache keys are consistent
   - Monitor cache eviction rates

2. **Storage Quota Exceeded**
   - Automatic cleanup will handle this
   - Consider reducing TTLs
   - Monitor cache size growth

3. **Stale Data**
   - Use `invalidateCache()` for manual refresh
   - Implement `smartRefresh()` for automated cleanup
   - Adjust TTLs based on data freshness requirements

### Recovery

```typescript
import { recoverFromCacheError } from '@/lib/cache/cacheInvalidation';

try {
    // Your cache operation
    await cacheManager.set('key', data, ttl);
} catch (error) {
    const recovered = await recoverFromCacheError(error, 'context');
    if (!recovered) {
        // Fallback to direct API call
        console.warn('Using fallback due to cache failure');
    }
}
```

## Best Practices

### 1. Cache Key Strategy

- Use descriptive, consistent keys
- Include relevant identifiers (team IDs, match IDs)
- Group related data with prefixes

### 2. TTL Management

- Set appropriate TTLs based on data volatility
- Shorter TTLs for frequently changing data (matches)
- Longer TTLs for stable data (competitions)

### 3. Error Handling

- Always include cache error recovery
- Provide fallbacks when cache fails
- Log cache failures for monitoring

### 4. Performance Monitoring

- Regularly check cache hit rates
- Monitor storage usage
- Set up alerts for cache health issues

## Future Enhancements

### Potential Improvements

1. **Redis Integration**: For distributed caching in production
2. **Cache Warming**: Proactive cache population
3. **Advanced Invalidation**: Event-driven cache updates
4. **Compression**: Reduce storage footprint
5. **Cache Analytics**: Detailed usage patterns and optimization

### Implementation Roadmap

- **Phase 1**: Basic caching (✅ Complete)
- **Phase 2**: Performance optimization
- **Phase 3**: Advanced features
- **Phase 4**: Production hardening

This caching system provides a solid foundation for improving SportyKoko's performance while maintaining data integrity and user experience.