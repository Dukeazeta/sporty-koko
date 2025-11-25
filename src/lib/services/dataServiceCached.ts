// src/lib/services/dataServiceCached.ts

import { cacheManager, CACHE_KEYS, CACHE_TTL } from '../cache/cacheManager';

export interface Match {
    id: number;
    homeTeam: string;
    homeTeamId: number;
    awayTeam: string;
    awayTeamId: number;
    date: string;
    status: string;
    score: {
        home: number | null;
        away: number | null;
    };
}

export interface Competition {
    id: number;
    name: string;
    emblem: string;
    code: string;
}

const API_KEY = process.env.FOOTBALL_DATA_API_KEY;
const BASE_URL = 'https://api.football-data.org/v4';

if (!API_KEY) {
    console.error("FOOTBALL_DATA_API_KEY is not set in environment variables.");
}

const headers = {
    'X-Auth-Token': API_KEY || '',
};

// Rate limit management
export interface RateLimitInfo {
    isRateLimited: boolean;
    resetTime?: string;
    remainingRequests?: number;
    cooldownMinutes?: number;
}

let rateLimitInfo: RateLimitInfo = {
    isRateLimited: false,
    resetTime: undefined,
    remainingRequests: undefined
};

// Simple in-memory rate limit tracking
const requestCache = new Map<string, { timestamp: number; count: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute in milliseconds
const MAX_REQUESTS_PER_WINDOW = 10; // Conservative limit

const checkRateLimit = (): RateLimitInfo => {
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW;

    // Clean old entries
    requestCache.forEach((entry, key) => {
        if (entry.timestamp < windowStart) {
            requestCache.delete(key);
        }
    });

    let recentRequests = 0;
    requestCache.forEach((entry) => {
        if (entry.timestamp >= windowStart) {
            recentRequests += entry.count;
        }
    });

    if (recentRequests >= MAX_REQUESTS_PER_WINDOW) {
        let oldestRequest = now;
        requestCache.forEach((entry) => {
            if (entry.timestamp < oldestRequest) {
                oldestRequest = entry.timestamp;
            }
        });

        const resetTime = new Date(oldestRequest + RATE_LIMIT_WINDOW);
        const cooldownMinutes = Math.ceil((resetTime.getTime() - now) / (60 * 1000));

        rateLimitInfo = {
            isRateLimited: true,
            resetTime: resetTime.toISOString(),
            remainingRequests: 0,
            cooldownMinutes
        };

        return rateLimitInfo;
    }

    rateLimitInfo = {
        isRateLimited: false,
        remainingRequests: MAX_REQUESTS_PER_WINDOW - recentRequests
    };

    return rateLimitInfo;
};

const recordRequest = (): void => {
    const now = Date.now();
    const key = `${now}`;
    const existing = requestCache.get(key);

    if (existing) {
        existing.count++;
    } else {
        requestCache.set(key, { timestamp: now, count: 1 });
    }
};

const handleRateLimitResponse = (response: Response): void => {
    const remaining = response.headers.get('X-Requests-Available-Minute');
    const resetTime = response.headers.get('X-RequestCounter-Reset');

    if (response.status === 429) {
        const resetDate = resetTime ? new Date(parseInt(resetTime) * 1000) : new Date(Date.now() + 60 * 1000);
        const cooldownMinutes = Math.ceil((resetDate.getTime() - Date.now()) / (60 * 1000));

        rateLimitInfo = {
            isRateLimited: true,
            resetTime: resetDate.toISOString(),
            remainingRequests: 0,
            cooldownMinutes
        };
    } else if (remaining) {
        rateLimitInfo.remainingRequests = parseInt(remaining);
        rateLimitInfo.isRateLimited = false;
        rateLimitInfo.resetTime = undefined;
    }
};

export const getRateLimitInfo = (): RateLimitInfo => ({ ...rateLimitInfo });

export const resetRateLimit = (): void => {
    rateLimitInfo = {
        isRateLimited: false,
        resetTime: undefined,
        remainingRequests: undefined
    };
    requestCache.clear();
};

// Helper function to check cache before making API calls
const checkCache = async <T>(key: string): Promise<T | null> => {
    try {
        return await cacheManager.get<T>(key);
    } catch (error) {
        console.warn(`Cache check failed for key ${key}:`, error);
        return null;
    }
};

// Helper function to set cache with proper structure
const setCache = async <T>(
    key: string,
    data: T,
    ttl: number,
    rateInfo: RateLimitInfo
): Promise<void> => {
    try {
        const dataWithRateInfo = { ...data, rateLimitInfo: rateInfo };
        await cacheManager.set(key, dataWithRateInfo, { ttl, persistToStorage: true });
    } catch (error) {
        console.warn(`Cache set failed for key ${key}:`, error);
    }
};

export const fetchCompetitions = async (): Promise<{ competitions: Competition[], rateLimitInfo: RateLimitInfo }> => {
    const cacheKey = CACHE_KEYS.COMPETITIONS;

    // Check cache first
    const cached = await checkCache<{ competitions: Competition[], rateLimitInfo: RateLimitInfo }>(cacheKey);
    if (cached) {
        console.log('[fetchCompetitions] Cache hit');
        return cached;
    }

    console.log('[fetchCompetitions] Cache miss, fetching from API');

    try {
        const rateStatus = checkRateLimit();
        if (rateStatus.isRateLimited) {
            console.log('[fetchCompetitions] Rate limited');
            return { competitions: [], rateLimitInfo: rateStatus };
        }

        // Fetch available competitions (tier one)
        const url = `${BASE_URL}/competitions?plan=TIER_ONE`;

        recordRequest();
        const res = await fetch(url, { headers, next: { revalidate: 86400 } }); // Cache for 24h

        handleRateLimitResponse(res);
        const currentRateInfo = getRateLimitInfo();

        if (res.status === 429) {
            return { competitions: [], rateLimitInfo: currentRateInfo };
        }

        if (!res.ok) {
            return { competitions: [], rateLimitInfo: currentRateInfo };
        }

        const data = await res.json();

        const competitions = data.competitions?.map((c: any) => ({
            id: c.id,
            name: c.name,
            emblem: c.emblem,
            code: c.code
        })) || [];

        const result = { competitions, rateLimitInfo: currentRateInfo };

        // Cache the successful result
        await setCache(cacheKey, result, CACHE_TTL.COMPETITIONS, currentRateInfo);

        return result;
    } catch (error) {
        console.error("[fetchCompetitions] Error:", error);
        return { competitions: [], rateLimitInfo: getRateLimitInfo() };
    }
};

export const fetchUpcomingMatches = async (competitionId?: number): Promise<{ matches: Match[], rateLimitInfo: RateLimitInfo }> => {
    const cacheKey = competitionId
        ? `${CACHE_KEYS.MATCHES}competition_${competitionId}`
        : `${CACHE_KEYS.MATCHES}all`;

    // Check cache first
    const cached = await checkCache<{ matches: Match[], rateLimitInfo: RateLimitInfo }>(cacheKey);
    if (cached) {
        console.log('[fetchUpcomingMatches] Cache hit');
        return cached;
    }

    console.log('[fetchUpcomingMatches] Cache miss, fetching from API');

    try {
        const rateStatus = checkRateLimit();
        if (rateStatus.isRateLimited) {
            return { matches: [], rateLimitInfo: rateStatus };
        }

        // If competitionId is provided, fetch matches for that competition
        // Otherwise fetch matches for the next 7 days across all subscribed competitions
        let url = `${BASE_URL}/matches`;

        if (competitionId) {
            // Fetch scheduled matches for the specific competition
            // We use a broader date range or just 'SCHEDULED' status
            const dateFrom = new Date().toISOString().split('T')[0];
            const dateTo = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // Next 2 weeks
            url = `${BASE_URL}/competitions/${competitionId}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`;
        }

        recordRequest();
        const res = await fetch(url, { headers, next: { revalidate: 60 } });

        handleRateLimitResponse(res);
        const currentRateInfo = getRateLimitInfo();

        if (res.status === 429) {
            return { matches: [], rateLimitInfo: currentRateInfo };
        }

        if (!res.ok) {
            return { matches: [], rateLimitInfo: currentRateInfo };
        }

        const data = await res.json();

        if (!data.matches) {
            return { matches: [], rateLimitInfo: currentRateInfo };
        }

        const matches = data.matches.map((m: any) => ({
            id: m.id,
            homeTeam: m.homeTeam.name,
            homeTeamId: m.homeTeam.id,
            awayTeam: m.awayTeam.name,
            awayTeamId: m.awayTeam.id,
            date: m.utcDate,
            status: m.status,
            score: {
                home: m.score.fullTime.home,
                away: m.score.fullTime.away,
            }
        }));

        const result = { matches, rateLimitInfo: currentRateInfo };

        // Cache the successful result with shorter TTL for matches
        await setCache(cacheKey, result, CACHE_TTL.MATCHES, currentRateInfo);

        return result;
    } catch (error) {
        console.error("[fetchUpcomingMatches] Error:", error);
        return { matches: [], rateLimitInfo: getRateLimitInfo() };
    }
};

export const fetchTeamHistory = async (teamId: string | number): Promise<{ matches: Match[], rateLimitInfo: RateLimitInfo }> => {
    const cacheKey = `${CACHE_KEYS.TEAM_HISTORY}${teamId}`;

    // Check cache first
    const cached = await checkCache<{ matches: Match[], rateLimitInfo: RateLimitInfo }>(cacheKey);
    if (cached) {
        console.log(`[fetchTeamHistory] Cache hit for team ${teamId}`);
        return cached;
    }

    console.log(`[fetchTeamHistory] Cache miss for team ${teamId}, fetching from API`);

    try {
        const rateStatus = checkRateLimit();
        if (rateStatus.isRateLimited) {
            return { matches: [], rateLimitInfo: rateStatus };
        }

        const url = `${BASE_URL}/teams/${teamId}/matches?status=FINISHED&limit=10`;

        recordRequest();
        const res = await fetch(url, { headers, next: { revalidate: 3600 } });
        handleRateLimitResponse(res);
        const currentRateInfo = getRateLimitInfo();

        if (res.status === 429) {
            return { matches: [], rateLimitInfo: currentRateInfo };
        }

        if (!res.ok) {
            return { matches: [], rateLimitInfo: currentRateInfo };
        }

        const data = await res.json();

        if (!data.matches) return { matches: [], rateLimitInfo: currentRateInfo };

        const matches = data.matches.map((m: any) => ({
            id: m.id,
            homeTeam: m.homeTeam.name,
            homeTeamId: m.homeTeam.id,
            awayTeam: m.awayTeam.name,
            awayTeamId: m.awayTeam.id,
            date: m.utcDate,
            status: m.status,
            score: {
                home: m.score.fullTime.home,
                away: m.score.fullTime.away,
            }
        }));

        const result = { matches, rateLimitInfo: currentRateInfo };

        // Cache the successful result
        await setCache(cacheKey, result, CACHE_TTL.TEAM_HISTORY, currentRateInfo);

        return result;
    } catch (error) {
        console.error(`Error fetching history for team ${teamId}:`, error);
        return { matches: [], rateLimitInfo: getRateLimitInfo() };
    }
};

export const fetchHeadToHead = async (homeTeamId: number, awayTeamId: number): Promise<{ matches: Match[], rateLimitInfo: RateLimitInfo }> => {
    const cacheKey = `${CACHE_KEYS.HEAD_TO_HEAD}${homeTeamId}_vs_${awayTeamId}`;

    // Check cache first
    const cached = await checkCache<{ matches: Match[], rateLimitInfo: RateLimitInfo }>(cacheKey);
    if (cached) {
        console.log(`[fetchHeadToHead] Cache hit for ${homeTeamId} vs ${awayTeamId}`);
        return cached;
    }

    console.log(`[fetchHeadToHead] Cache miss for ${homeTeamId} vs ${awayTeamId}, fetching from API`);

    try {
        const rateStatus = checkRateLimit();
        if (rateStatus.isRateLimited) {
            return { matches: [], rateLimitInfo: rateStatus };
        }

        const url = `${BASE_URL}/teams/${homeTeamId}/matches?opponent=${awayTeamId}&status=FINISHED`;

        recordRequest();
        const res = await fetch(url, { headers, next: { revalidate: 86400 } });
        handleRateLimitResponse(res);
        const currentRateInfo = getRateLimitInfo();

        if (res.status === 429) {
            return { matches: [], rateLimitInfo: currentRateInfo };
        }

        if (!res.ok) {
            return { matches: [], rateLimitInfo: currentRateInfo };
        }

        const data = await res.json();

        if (!data.matches) return { matches: [], rateLimitInfo: currentRateInfo };

        const matches = data.matches.map((m: any) => ({
            id: m.id,
            homeTeam: m.homeTeam.name,
            homeTeamId: m.homeTeam.id,
            awayTeam: m.awayTeam.name,
            awayTeamId: m.awayTeam.id,
            date: m.utcDate,
            status: m.status,
            score: {
                home: m.score.fullTime.home,
                away: m.score.fullTime.away,
            }
        }));

        const result = { matches, rateLimitInfo: currentRateInfo };

        // Cache the successful result
        await setCache(cacheKey, result, CACHE_TTL.HEAD_TO_HEAD, currentRateInfo);

        return result;
    } catch (error) {
        console.error(`Error fetching H2H for ${homeTeamId} vs ${awayTeamId}:`, error);
        return { matches: [], rateLimitInfo: getRateLimitInfo() };
    }
};

// Cache management utilities
export const clearCache = async (): Promise<void> => {
    try {
        await cacheManager.clear();
        console.log('[DataService] All caches cleared');
    } catch (error) {
        console.error('[DataService] Error clearing cache:', error);
    }
};

export const clearCompetitionCache = async (): Promise<void> => {
    try {
        await cacheManager.clearByPrefix(CACHE_KEYS.COMPETITIONS);
        console.log('[DataService] Competition cache cleared');
    } catch (error) {
        console.error('[DataService] Error clearing competition cache:', error);
    }
};

export const clearMatchCache = async (): Promise<void> => {
    try {
        await cacheManager.clearByPrefix(CACHE_KEYS.MATCHES);
        console.log('[DataService] Match cache cleared');
    } catch (error) {
        console.error('[DataService] Error clearing match cache:', error);
    }
};

export const clearTeamCache = async (teamId?: string | number): Promise<void> => {
    try {
        if (teamId) {
            await cacheManager.delete(`${CACHE_KEYS.TEAM_HISTORY}${teamId}`);
            console.log(`[DataService] Team cache cleared for team ${teamId}`);
        } else {
            await cacheManager.clearByPrefix(CACHE_KEYS.TEAM_HISTORY);
            console.log('[DataService] All team cache cleared');
        }
    } catch (error) {
        console.error('[DataService] Error clearing team cache:', error);
    }
};

export const getCacheMetrics = () => {
    return cacheManager.getMetrics();
};