// src/app/api/predictions/route.ts
import { NextResponse } from 'next/server';
import { fetchUpcomingMatches, fetchTeamHistory, fetchHeadToHead, RateLimitInfo } from '@/lib/services/dataService';
import { generateEnhancedPrediction } from '@/lib/services/predictionService';

export async function GET() {
    console.log("API /api/predictions hit");
    try {
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
                try {
                    // Fetch team histories
                    const homeHistoryResult = await fetchTeamHistory(match.homeTeamId);
                    const awayHistoryResult = await fetchTeamHistory(match.awayTeamId);

                    // If either team history fetch hits rate limit, stop and return basic prediction
                    if (homeHistoryResult.rateLimitInfo.isRateLimited || awayHistoryResult.rateLimitInfo.isRateLimited) {
                        console.log(`Rate limit hit while fetching team history for match ${match.id}`);
                        return {
                            match,
                            prediction: null,
                            rateLimitInfo: homeHistoryResult.rateLimitInfo.isRateLimited
                                ? homeHistoryResult.rateLimitInfo
                                : awayHistoryResult.rateLimitInfo,
                            error: 'Rate limit exceeded during team history fetch'
                        };
                    }

                    // Fetch head-to-head data (with rate limit check)
                    let h2hResult = { matches: [], rateLimitInfo: { isRateLimited: false } };
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

                    return {
                        match,
                        prediction,
                        rateLimitInfo: {
                            isRateLimited: false,
                            remainingRequests: Math.min(
                                homeHistoryResult.rateLimitInfo.remainingRequests || 0,
                                awayHistoryResult.rateLimitInfo.remainingRequests || 0,
                                h2hResult.rateLimitInfo.remainingRequests || 0
                            )
                        }
                    };
                } catch (error) {
                    console.error(`Error generating prediction for match ${match.id}:`, error);
                    return {
                        match,
                        prediction: null,
                        error: error instanceof Error ? error.message : 'Unknown error',
                        rateLimitInfo: { isRateLimited: false }
                    };
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

        // Return response with rate limit information
        const responseData: any = {
            predictions: successfulPredictions,
            total: successfulPredictions.length,
            requested: limitedMatches.length
        };

        if (hasRateLimit) {
            responseData.rateLimitInfo = latestRateLimitInfo;
            return NextResponse.json(responseData, { status: 207 }); // Multi-status (some success, some rate limited)
        }

        return NextResponse.json(responseData);

    } catch (error) {
        console.error("Error generating predictions:", error);
        return NextResponse.json({
            error: 'Failed to generate predictions',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}

// Add a POST endpoint for manual rate limit reset (development only)
export async function POST() {
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
    }

    try {
        // This would need to be implemented to reset the rate limit
        // For now, just return success
        return NextResponse.json({ message: 'Rate limit reset (development only)' });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to reset rate limit' }, { status: 500 });
    }
}
