// src/app/api/predictions/routeCached.ts
import { NextResponse } from 'next/server';
import { fetchUpcomingMatches, fetchTeamHistory, fetchHeadToHead, RateLimitInfo } from '@/lib/services/dataServiceCached';
import { generateEnhancedPrediction } from '@/lib/services/predictionService';
import { cacheManager, CACHE_KEYS, CACHE_TTL } from '@/lib/cache/cacheManager';

interface CachedPredictionResponse {
    predictions: any[];
    total: number;
    requested: number;
    cachedAt: number;
    rateLimitInfo?: RateLimitInfo;
}

export async function GET() {
    console.log("API /api/predictions-cached hit");

    const cacheKey = `${CACHE_KEYS.PREDICTIONS}latest`;

    try {
        // Check cache first for existing predictions
        const cached = await cacheManager.get<CachedPredictionResponse>(cacheKey);

        if (cached) {
            const cacheAge = Date.now() - cached.cachedAt;
            const cacheMaxAge = 10 * 60 * 1000; // 10 minutes

            if (cacheAge < cacheMaxAge) {
                console.log(`[Predictions API] Cache hit (${Math.round(cacheAge / 1000)}s old)`);
                return NextResponse.json({
                    ...cached,
                    fromCache: true,
                    cacheAge: Math.round(cacheAge / 1000)
                });
            } else {
                console.log(`[Predictions API] Cache expired (${Math.round(cacheAge / 1000)}s old)`);
                await cacheManager.delete(cacheKey);
            }
        } else {
            console.log('[Predictions API] Cache miss, generating fresh predictions');
        }

        // 1. Fetch upcoming matches
        const matchesResult = await fetchUpcomingMatches();

        if (matchesResult.rateLimitInfo.isRateLimited) {
            return NextResponse.json({
                error: 'Rate limit exceeded',
                rateLimitInfo: matchesResult.rateLimitInfo,
                predictions: []
            }, { status: 429 });
        }

        const matches = matchesResult.matches;

        // Limit predictions to avoid excessive API calls
        const maxPredictions = Math.min(matches.length, 10);
        const limitedMatches = matches.slice(0, maxPredictions);

        console.log(`Generating predictions for ${limitedMatches.length} matches (limited from ${matches.length})`);

        // 2. For each match, fetch history and H2H data, then generate prediction
        const predictions = await Promise.allSettled(
            limitedMatches.map(async (match) => {
                const matchCacheKey = `${CACHE_KEYS.PREDICTIONS}match_${match.id}`;

                // Check if we have a recent cached prediction for this specific match
                const cachedMatchPrediction = await cacheManager.get<any>(matchCacheKey);
                if (cachedMatchPrediction) {
                    const predictionAge = Date.now() - cachedMatchPrediction.cachedAt;
                    const matchCacheMaxAge = 2 * 60 * 60 * 1000; // 2 hours for individual predictions

                    if (predictionAge < matchCacheMaxAge) {
                        console.log(`[Match ${match.id}] Using cached prediction`);
                        return cachedMatchPrediction;
                    } else {
                        await cacheManager.delete(matchCacheKey);
                    }
                }

                try {
                    // Fetch team histories
                    const homeHistoryResult = await fetchTeamHistory(match.homeTeamId);
                    const awayHistoryResult = await fetchTeamHistory(match.awayTeamId);

                    // If either team history fetch hits rate limit, stop and return basic prediction
                    if (homeHistoryResult.rateLimitInfo.isRateLimited || awayHistoryResult.rateLimitInfo.isRateLimited) {
                        console.log(`Rate limit hit while fetching team history for match ${match.id}`);
                        const errorResult = {
                            match,
                            prediction: null,
                            rateLimitInfo: homeHistoryResult.rateLimitInfo.isRateLimited
                                ? homeHistoryResult.rateLimitInfo
                                : awayHistoryResult.rateLimitInfo,
                            error: 'Rate limit exceeded during team history fetch',
                            cachedAt: Date.now()
                        };

                        // Cache the error result for a shorter time
                        await cacheManager.set(matchCacheKey, errorResult, 5 * 60 * 1000); // 5 minutes
                        return errorResult;
                    }

                    // Fetch head-to-head data (with rate limit check)
                    let h2hResult = { matches: [], rateLimitInfo: { isRateLimited: false } as RateLimitInfo };
                    try {
                        h2hResult = await fetchHeadToHead(match.homeTeamId, match.awayTeamId);
                    } catch (error) {
                        console.log(`Failed to fetch H2H for match ${match.id}:`, error);
                        // Continue without H2H data
                    }

                    // Generate enhanced prediction
                    const prediction = generateEnhancedPrediction(
                        match,
                        homeHistoryResult.matches,
                        awayHistoryResult.matches,
                        h2hResult.matches
                    );

                    const successResult = {
                        match,
                        prediction,
                        rateLimitInfo: {
                            isRateLimited: false,
                            remainingRequests: Math.min(
                                homeHistoryResult.rateLimitInfo.remainingRequests || 0,
                                awayHistoryResult.rateLimitInfo.remainingRequests || 0,
                                h2hResult.rateLimitInfo.remainingRequests || 0
                            )
                        } as RateLimitInfo,
                        cachedAt: Date.now()
                    };

                    // Cache the successful prediction
                    await cacheManager.set(matchCacheKey, successResult, CACHE_TTL.PREDICTIONS);
                    return successResult;

                } catch (error) {
                    console.error(`Error generating prediction for match ${match.id}:`, error);
                    const errorResult = {
                        match,
                        prediction: null,
                        error: error instanceof Error ? error.message : 'Unknown error',
                        rateLimitInfo: { isRateLimited: false } as RateLimitInfo,
                        cachedAt: Date.now()
                    };

                    // Cache errors for a short time
                    await cacheManager.set(matchCacheKey, errorResult, 5 * 60 * 1000); // 5 minutes
                    return errorResult;
                }
            })
        );

        // Process results and handle rate limits
        const successfulPredictions: any[] = [];
        let hasRateLimit = false;
        let latestRateLimitInfo: RateLimitInfo = { isRateLimited: false };

        predictions.forEach((result) => {
            if (result.status === 'fulfilled') {
                const { prediction, rateLimitInfo, error } = result.value;

                if (rateLimitInfo.isRateLimited) {
                    hasRateLimit = true;
                    latestRateLimitInfo = rateLimitInfo;
                }

                if (prediction && !error) {
                    successfulPredictions.push(prediction);
                }
            }
        });

        // Prepare response data
        const responseData: CachedPredictionResponse = {
            predictions: successfulPredictions,
            total: successfulPredictions.length,
            requested: limitedMatches.length,
            cachedAt: Date.now()
        };

        // Cache the complete response
        await cacheManager.set(cacheKey, responseData, 10 * 60 * 1000); // 10 minutes

        // Add cache metrics to response
        const metrics = cacheManager.getMetrics();

        if (hasRateLimit) {
            responseData.rateLimitInfo = latestRateLimitInfo;
            return NextResponse.json({
                ...responseData,
                cacheMetrics: metrics,
                fromCache: false
            }, { status: 207 }); // Multi-status (some success, some rate limited)
        }

        return NextResponse.json({
            ...responseData,
            cacheMetrics: metrics,
            fromCache: false
        });

    } catch (error) {
        console.error("Error generating predictions:", error);
        return NextResponse.json({
            error: 'Failed to generate predictions',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}

// Add a POST endpoint for manual cache clear (development only)
export async function POST(request: Request) {
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
    }

    try {
        const body = await request.json().catch(() => ({}));
        const { clearType = 'all' } = body;

        switch (clearType) {
            case 'predictions':
                await cacheManager.clearByPrefix(CACHE_KEYS.PREDICTIONS);
                console.log('[Predictions API] Cleared prediction cache');
                break;
            case 'matches':
                await cacheManager.clearByPrefix(CACHE_KEYS.MATCHES);
                console.log('[Predictions API] Cleared match cache');
                break;
            case 'teams':
                await cacheManager.clearByPrefix(CACHE_KEYS.TEAM_HISTORY);
                console.log('[Predictions API] Cleared team history cache');
                break;
            case 'all':
                await cacheManager.clear();
                console.log('[Predictions API] Cleared all caches');
                break;
            default:
                return NextResponse.json({ error: 'Invalid clearType' }, { status: 400 });
        }

        const metrics = cacheManager.getMetrics();

        return NextResponse.json({
            message: `Cache cleared successfully (${clearType})`,
            cacheMetrics: metrics
        });
    } catch (error) {
        console.error("Error clearing cache:", error);
        return NextResponse.json({
            error: 'Failed to clear cache',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}

// Add a PUT endpoint for cache warming
export async function PUT() {
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
    }

    try {
        console.log('[Predictions API] Starting cache warming...');

        // Trigger a fresh prediction generation to warm the cache
        const response = await GET();
        const responseData = await response.json();

        return NextResponse.json({
            message: 'Cache warming completed',
            cacheMetrics: responseData.cacheMetrics || {},
            predictionsGenerated: responseData.total || 0
        });
    } catch (error) {
        console.error("Error warming cache:", error);
        return NextResponse.json({
            error: 'Failed to warm cache',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}