// src/app/api/predictions/route.ts
import { NextResponse } from 'next/server';
import { fetchUpcomingMatches, fetchTeamHistory } from '@/lib/services/dataService';
import { generatePrediction } from '@/lib/services/predictionService';

export async function GET() {
    console.log("API /api/predictions hit");
    try {
        // 1. Fetch upcoming matches
        const matches = await fetchUpcomingMatches();

        // 2. For each match, fetch history and generate prediction
        // Note: In a real app, we might want to limit this or cache it to avoid hitting API limits
        const predictions = await Promise.all(matches.map(async (match) => {
            // Use actual team IDs from the match data
            const homeHistory = await fetchTeamHistory(match.homeTeamId);
            const awayHistory = await fetchTeamHistory(match.awayTeamId);

            return generatePrediction(match, homeHistory, awayHistory);
        }));

        return NextResponse.json({ predictions });
    } catch (error) {
        console.error("Error generating predictions:", error);
        return NextResponse.json({ error: 'Failed to generate predictions' }, { status: 500 });
    }
}
