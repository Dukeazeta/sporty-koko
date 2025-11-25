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

const API_KEY = process.env.FOOTBALL_DATA_API_KEY;
const BASE_URL = 'https://api.football-data.org/v4';

if (!API_KEY) {
    console.error("FOOTBALL_DATA_API_KEY is not set in environment variables.");
}

const headers = {
    'X-Auth-Token': API_KEY || '',
};

export const fetchUpcomingMatches = async (): Promise<Match[]> => {
    try {
        // Fetch matches scheduled for the next 7 days to ensure we get some data
        // const dateFrom = new Date().toISOString().split('T')[0];
        // const dateTo = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        // const url = `${BASE_URL}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`;

        // Using the default matches endpoint for now which returns current matchday
        const url = `${BASE_URL}/matches`;

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
        if (!res.ok) throw new Error(`Failed to fetch team history: ${res.statusText}`);

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
