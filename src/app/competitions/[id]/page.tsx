// src/app/competitions/[id]/page.tsx
import Link from 'next/link';
import { fetchUpcomingMatches, fetchTeamHistory } from '@/lib/services/dataService';
import { generatePrediction } from '@/lib/services/predictionService';
import { IconArrowRight, IconStar } from '@/components/Icons';

interface Props {
    params: Promise<{ id: string }>;
}

export default async function CompetitionPage({ params, searchParams }: { params: Promise<{ id: string }>, searchParams: Promise<{ page?: string }> }) {
    const { id } = await params;
    const { page } = await searchParams;
    const competitionId = parseInt(id);
    const currentPage = parseInt(page || '1');
    const pageSize = 5;

    const matches = await fetchUpcomingMatches(competitionId);

    // Calculate pagination
    const totalMatches = matches.length;
    const totalPages = Math.ceil(totalMatches / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;

    // Slice matches for current page
    const currentMatches = matches.slice(startIndex, endIndex);

    const predictions = [];
    for (const match of currentMatches) {
        const homeHistory = await fetchTeamHistory(match.homeTeamId);
        // Add a small delay to be nice to the API
        await new Promise(resolve => setTimeout(resolve, 500));
        const awayHistory = await fetchTeamHistory(match.awayTeamId);
        await new Promise(resolve => setTimeout(resolve, 500));

        predictions.push(generatePrediction(match, homeHistory, awayHistory));
    }

    return (
        <main className="min-h-screen p-4 md:p-8 max-w-4xl mx-auto bg-[var(--neo-bg)]">
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

            <div className="grid gap-8 relative z-10 mb-12">
                {predictions.map((p, index) => (
                    <div key={p.matchId} className={`neo-box p-8 relative bg-white ${index % 2 === 0 ? 'rotate-1' : '-rotate-1'} hover:rotate-0 transition-transform`}>

                        {/* Header / Matchup */}
                        <div className="flex flex-col md:flex-row justify-between items-center gap-8 mb-8 border-b-4 border-black pb-8">
                            <div className="text-3xl font-black text-center md:text-left w-full flex flex-col md:flex-row items-center gap-4">
                                <div className="bg-[var(--neo-blue)] text-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transform -rotate-2 w-full md:w-auto text-center">
                                    {p.homeTeam}
                                </div>
                                <div className="font-mono text-xl font-bold italic">VS</div>
                                <div className="bg-[var(--neo-pink)] text-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transform rotate-2 w-full md:w-auto text-center">
                                    {p.awayTeam}
                                </div>
                            </div>

                            {/* Prediction Result */}
                            <div className="flex flex-col items-center justify-center min-w-[140px]">
                                <div className={`text-4xl font-black px-6 py-2 uppercase border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${p.prediction === 'YES' ? 'bg-[var(--neo-green)]' : 'bg-[var(--neo-orange)]'
                                    }`}>
                                    {p.prediction}
                                </div>
                                <span className="font-mono text-xs mt-3 font-bold border-2 border-black px-2 py-1 bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                    BTTS PROB: {p.bttsProbability.toFixed(0)}%
                                </span>
                            </div>
                        </div>

                        {/* Analysis / Footer */}
                        <div className="bg-gray-100 border-2 border-black p-6 font-mono text-sm relative">
                            <IconStar className="absolute -top-3 -left-3 w-8 h-8 text-[var(--neo-yellow)] fill-current stroke-black stroke-2" />
                            <span className="bg-black text-white px-2 py-0.5 font-bold mr-2 text-base">ANALYSIS:</span>
                            <span className="leading-relaxed">{p.reasoning}</span>
                        </div>

                        <div className="absolute -top-4 -right-4 bg-black text-white px-3 py-1 font-mono text-sm font-bold border-2 border-white shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] transform rotate-6">
                            #{p.matchId}
                        </div>
                    </div>
                ))}

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
