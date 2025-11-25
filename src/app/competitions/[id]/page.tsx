// src/app/competitions/[id]/page.tsx
import Link from 'next/link';
import { fetchUpcomingMatches, fetchTeamHistory, fetchHeadToHead, Match } from '@/lib/services/dataService';
import { generateEnhancedPrediction } from '@/lib/services/predictionService';
import { IconArrowRight, IconStar } from '@/components/Icons';
import { EnhancedPrediction } from '@/lib/services/predictionService';

interface Props {
    params: Promise<{ id: string }>;
}

import RateLimitUpdater from '@/components/RateLimitUpdater';

// ... (imports)

export default async function CompetitionPage({ params, searchParams }: { params: Promise<{ id: string }>, searchParams: Promise<{ page?: string }> }) {
    const { id } = await params;
    const { page } = await searchParams;
    const competitionId = parseInt(id);
    const currentPage = parseInt(page || '1');
    const pageSize = 3; // Reduced to manage rate limits better

    const matchesResult = await fetchUpcomingMatches(competitionId);
    const matches = matchesResult.matches;

    // Calculate pagination
    const totalMatches = matches.length;
    const totalPages = Math.ceil(totalMatches / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;

    // Slice matches for current page
    const currentMatches = matches.slice(startIndex, endIndex);

    const predictions: (EnhancedPrediction | null)[] = [];
    const loopRateLimits: any[] = [];

    for (const match of currentMatches) {
        try {
            // Fetch team histories with rate limit handling
            const homeHistoryResult = await fetchTeamHistory(match.homeTeamId);

            // Check if we hit rate limits
            if (homeHistoryResult.rateLimitInfo.isRateLimited) {
                loopRateLimits.push(homeHistoryResult.rateLimitInfo);
                predictions.push(null);
                continue;
            }

            // Small delay to be nice to the API
            await new Promise(resolve => setTimeout(resolve, 1000));

            const awayHistoryResult = await fetchTeamHistory(match.awayTeamId);

            if (awayHistoryResult.rateLimitInfo.isRateLimited) {
                loopRateLimits.push(awayHistoryResult.rateLimitInfo);
                predictions.push(null);
                continue;
            }

            await new Promise(resolve => setTimeout(resolve, 1000));

            // Try to fetch head-to-head data
            let h2hMatches: Match[] = [];
            try {
                const h2hResult = await fetchHeadToHead(match.homeTeamId, match.awayTeamId);
                if (!h2hResult.rateLimitInfo.isRateLimited) {
                    h2hMatches = h2hResult.matches;
                } else {
                    loopRateLimits.push(h2hResult.rateLimitInfo);
                }
            } catch (error) {
                // Continue without H2H data
            }

            // Generate enhanced prediction
            const prediction = generateEnhancedPrediction(
                match,
                homeHistoryResult.matches,
                awayHistoryResult.matches,
                h2hMatches
            );

            predictions.push(prediction);

        } catch (error) {
            predictions.push(null);
        }
    }

    // Determine active rate limit info
    const activeRateLimit = [matchesResult.rateLimitInfo, ...loopRateLimits].find(r => r.isRateLimited) || matchesResult.rateLimitInfo;

    return (
        <main className="min-h-screen p-4 md:p-8 max-w-4xl mx-auto bg-[var(--neo-bg)]">
            <RateLimitUpdater rateLimitInfo={activeRateLimit} />
            <header className="mb-12 relative z-10">
                <Link href="/" className="inline-flex items-center gap-2 mb-8 neo-button group">
                    <IconArrowRight className="w-6 h-6 transform rotate-180 group-hover:-translate-x-1 transition-transform" />
                    BACK TO LEAGUES
                </Link>

                <div className="border-4 border-black bg-white p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--neo-yellow)] rounded-full blur-3xl opacity-50 -translate-y-1/2 translate-x-1/2"></div>
                    <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter mb-2 relative z-10">
                        PREDICTIONS
                    </h1>
                    <div className="inline-block bg-black text-white px-3 py-1 font-mono text-sm font-bold transform -rotate-1">
                        COMPETITION ID: {competitionId}
                    </div>
                </div>
            </header>

            {/* Rate Limit Warning */}
            {loopRateLimits.some(info => info.isRateLimited) && (
                <div className="mb-8 p-4 bg-red-500 text-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-black text-lg mb-1">⚠️ RATE LIMIT WARNING</h3>
                            <p className="font-mono text-sm">Some predictions may be incomplete due to API rate limits. Please wait before refreshing.</p>
                        </div>
                        <div className="text-2xl font-bold">🚫</div>
                    </div>
                </div>
            )}

            <div className="grid gap-8 relative z-10 mb-12">
                {predictions.map((p, index) => {
                    const match = currentMatches[index];
                    if (!p && match) {
                        return (
                            <div key={match.id} className={`neo-box p-8 relative bg-gray-200 ${index % 2 === 0 ? 'rotate-1' : '-rotate-1'} opacity-75`}>

                                {/* Header / Matchup */}
                                <div className="flex flex-col md:flex-row justify-between items-center gap-8 mb-8 border-b-4 border-black pb-8">
                                    <div className="text-3xl font-black text-center md:text-left w-full flex flex-col md:flex-row items-center gap-4">
                                        <div className="bg-gray-400 text-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transform -rotate-2 w-full md:w-auto text-center">
                                            {match.homeTeam}
                                        </div>
                                        <div className="font-mono text-xl font-bold italic">VS</div>
                                        <div className="bg-gray-400 text-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transform rotate-2 w-full md:w-auto text-center">
                                            {match.awayTeam}
                                        </div>
                                    </div>

                                    {/* Prediction Result */}
                                    <div className="flex flex-col items-center justify-center min-w-[140px]">
                                        <div className="text-2xl font-black px-4 py-2 uppercase border-4 border-black bg-gray-300">
                                            UNAVAILABLE
                                        </div>
                                        <span className="font-mono text-xs mt-3 font-bold border-2 border-black px-2 py-1 bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                            RATE LIMITED
                                        </span>
                                    </div>
                                </div>

                                <div className="bg-red-100 border-2 border-black p-6 font-mono text-sm text-center">
                                    <span className="text-red-700 font-bold">⚠️ Prediction unavailable due to API rate limits</span>
                                </div>

                                <div className="absolute -top-4 -right-4 bg-gray-600 text-white px-3 py-1 font-mono text-sm font-bold border-2 border-white shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] transform rotate-6">
                                    #{match.id}
                                </div>
                            </div>
                        );
                    }

                    if (!p) return null;

                    const riskColors = {
                        LOW: 'bg-green-500',
                        MEDIUM: 'bg-yellow-500',
                        HIGH: 'bg-red-500'
                    };

                    const confidenceColors = {
                        HIGH: 'bg-green-100 border-green-400',
                        MEDIUM: 'bg-yellow-100 border-yellow-400',
                        LOW: 'bg-red-100 border-red-400'
                    };

                    return (
                        <div key={p.matchId} className={`neo-box p-4 md:p-8 relative bg-white ${index % 2 === 0 ? 'rotate-1' : '-rotate-1'} hover:rotate-0 transition-transform`}>

                            {/* Header / Matchup */}
                            <div className="flex flex-col md:flex-row justify-between items-center gap-6 md:gap-8 mb-6 border-b-4 border-black pb-6">
                                <div className="text-2xl md:text-3xl font-black text-center md:text-left w-full flex flex-col md:flex-row items-center gap-3">
                                    <div className="bg-[var(--neo-blue)] text-white border-2 border-black p-3 md:p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transform -rotate-2 w-full md:w-auto text-center">
                                        {p.homeTeam}
                                    </div>
                                    <div className="font-mono text-lg md:text-xl font-bold italic">VS</div>
                                    <div className="bg-[var(--neo-pink)] text-white border-2 border-black p-3 md:p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transform rotate-2 w-full md:w-auto text-center">
                                        {p.awayTeam}
                                    </div>
                                </div>

                                {/* Enhanced Prediction Result */}
                                <div className="flex flex-col items-center justify-center min-w-[160px] w-full md:w-auto">
                                    <div className={`text-3xl md:text-4xl font-black px-4 py-2 uppercase border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] w-full md:w-auto text-center ${p.prediction === 'YES' ? 'bg-[var(--neo-green)]' : 'bg-[var(--neo-orange)]'
                                        }`}>
                                        {p.prediction}
                                    </div>
                                    <div className="flex flex-wrap justify-center items-center gap-2 mt-3 w-full">
                                        <span className="font-mono text-xs font-bold border-2 border-black px-2 py-1 bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                            {p.bttsProbability.toFixed(0)}% PROB
                                        </span>
                                        <div className={`flex items-center gap-1 px-2 py-1 text-black border-2 border-black text-xs font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${riskColors[p.riskLevel]}`}>
                                            RISK: {p.riskLevel}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Confidence Interval */}
                            <div className="mb-6">
                                <div className="flex justify-between items-end mb-1">
                                    <span className="font-black text-sm uppercase bg-black text-white px-2 py-0.5 transform -rotate-1 inline-block">Confidence</span>
                                    <span className="font-mono text-xs font-bold bg-white border-2 border-black px-1">
                                        {p.confidenceInterval.lower.toFixed(0)}% - {p.confidenceInterval.upper.toFixed(0)}%
                                    </span>
                                </div>
                                <div className="w-full h-6 border-4 border-black bg-white relative shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                    <div
                                        className={`h-full border-r-4 border-black ${p.confidenceInterval.confidence === 'HIGH' ? 'bg-[var(--neo-green)]' : p.confidenceInterval.confidence === 'MEDIUM' ? 'bg-[var(--neo-yellow)]' : 'bg-[var(--neo-orange)]'}`}
                                        style={{
                                            marginLeft: `${p.confidenceInterval.lower}%`,
                                            width: `${p.confidenceInterval.upper - p.confidenceInterval.lower}%`
                                        }}
                                    />
                                </div>
                                <div className="text-right mt-1">
                                    <span className="font-mono text-[10px] font-bold uppercase text-gray-500">Level: {p.confidenceInterval.confidence}</span>
                                </div>
                            </div>

                            {/* Key Factors */}
                            {p.keyFactors.length > 0 && (
                                <div className="mb-6">
                                    <h4 className="font-black text-sm uppercase mb-3 transform rotate-1 inline-block bg-[var(--neo-purple)] text-white px-2 py-1 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                        Key Factors
                                    </h4>
                                    <div className="flex flex-wrap gap-3">
                                        {p.keyFactors.map((factor, idx) => (
                                            <span key={idx} className={`font-mono text-xs font-bold px-3 py-1.5 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] ${idx % 2 === 0 ? 'bg-white -rotate-1' : 'bg-[var(--neo-yellow)] rotate-1'}`}>
                                                {factor}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Analysis / Footer */}
                            <div className="bg-gray-100 border-4 border-black p-4 font-mono text-sm relative shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                <IconStar className="absolute -top-4 -left-4 w-10 h-10 text-[var(--neo-yellow)] fill-current stroke-black stroke-2 animate-pulse" />
                                <div className="mb-2">
                                    <span className="bg-black text-white px-2 py-0.5 font-bold mr-2 text-base uppercase">Analysis</span>
                                </div>
                                <p className="leading-relaxed font-medium">{p.reasoning}</p>

                                {/* Data Quality Warning */}
                                {p.dataQuality.warning && (
                                    <div className="mt-4 p-2 bg-[var(--neo-orange)] border-2 border-black flex items-start gap-2">
                                        <span className="text-xl">⚠️</span>
                                        <span className="font-bold text-xs">{p.dataQuality.warning}</span>
                                    </div>
                                )}

                                {/* H2H Info */}
                                {p.h2hBTTS !== undefined && (
                                    <div className="mt-4 pt-4 border-t-2 border-black border-dashed flex justify-between items-center">
                                        <span className="font-bold text-xs uppercase">Head-to-Head BTTS</span>
                                        <span className="font-black text-lg">{p.h2hBTTS.toFixed(0)}%</span>
                                    </div>
                                )}
                            </div>

                            <div className="absolute -top-4 -right-4 bg-black text-white px-3 py-1 font-mono text-sm font-bold border-2 border-white shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] transform rotate-6 z-20">
                                #{p.matchId}
                            </div>
                        </div>
                    );
                })}

                {predictions.length === 0 && (
                    <div className="neo-box p-16 text-center bg-gray-100 rotate-1">
                        <h3 className="text-3xl font-black uppercase mb-4">NO MATCHES SCHEDULED</h3>
                        <p className="font-mono text-lg">Check back later for upcoming games.</p>
                    </div>
                )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex justify-between items-center font-mono font-bold bg-white border-4 border-black p-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                    {currentPage > 1 ? (
                        <Link href={`/competitions/${competitionId}?page=${currentPage - 1}`} className="neo-button flex items-center gap-2">
                            <IconArrowRight className="w-5 h-5 rotate-180" /> PREVIOUS
                        </Link>
                    ) : (
                        <div className="opacity-50 cursor-not-allowed flex items-center gap-2 px-6 py-3 border-2 border-black bg-gray-200">
                            <IconArrowRight className="w-5 h-5 rotate-180" /> PREVIOUS
                        </div>
                    )}

                    <span className="text-lg">PAGE {currentPage} OF {totalPages}</span>

                    {currentPage < totalPages ? (
                        <Link href={`/competitions/${competitionId}?page=${currentPage + 1}`} className="neo-button flex items-center gap-2">
                            NEXT <IconArrowRight className="w-5 h-5" />
                        </Link>
                    ) : (
                        <div className="opacity-50 cursor-not-allowed flex items-center gap-2 px-6 py-3 border-2 border-black bg-gray-200">
                            NEXT <IconArrowRight className="w-5 h-5" />
                        </div>
                    )}
                </div>
            )}

            <footer className="mt-24 text-center font-mono text-sm border-t-4 border-black pt-8 pb-8 bg-[var(--neo-bg)]">
                <p className="font-bold">SPORTYKOKO © 2025</p>
                <p className="text-xs mt-2">POWERED BY KOKO LABS</p>
            </footer>
        </main>
    );
}
