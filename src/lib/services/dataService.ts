// src/lib/services/dataService.ts

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

export const fetchCompetitions = async (): Promise<Competition[]> => {
    try {
        // Fetch available competitions (tier one)
        const url = `${BASE_URL}/competitions?plan=TIER_ONE`;
        const res = await fetch(url, { headers, next: { revalidate: 86400 } }); // Cache for 24h

        if (!res.ok) {
            console.warn(`Failed to fetch competitions: ${res.status} ${res.statusText}`);
            return [];
        }

        const data = await res.json();
        return data.competitions.map((c: any) => ({
            id: c.id,
            name: c.name,
            emblem: c.emblem,
            code: c.code
        }));
    } catch (error) {
        console.error("Error fetching competitions:", error);
        return [];
    }
};

export const fetchUpcomingMatches = async (competitionId?: number): Promise<Match[]> => {
    try {
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

        const res = await fetch(url, { headers, next: { revalidate: 60 } });
        if (!res.ok) throw new Error(`Failed to fetch matches: ${res.statusText}`);

        const data = await res.json();

        if (!data.matches) return [];

        return data.matches.map((m: any) => ({
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
    } catch (error) {
        console.error("Error fetching upcoming matches:", error);
        return [];
    }
};

export const fetchTeamHistory = async (teamId: string | number): Promise<Match[]> => {
    try {
        const url = `${BASE_URL}/teams/${teamId}/matches?status=FINISHED&limit=10`;
        const res = await fetch(url, { headers, next: { revalidate: 3600 } });

        if (!res.ok) {
            console.warn(`Failed to fetch team history for ${teamId}: ${res.status} ${res.statusText}`);
            return [];
        }

        const data = await res.json();

        if (!data.matches) return [];

        return data.matches.map((m: any) => ({
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
    } catch (error) {
        console.error(`Error fetching history for team ${teamId}:`, error);
        return [];
    }
};
