// src/lib/services/predictionService.ts
import { Match } from './dataService';

export interface Prediction {
    matchId: number;
    homeTeam: string;
    awayTeam: string;
    bttsProbability: number; // 0 to 100
    prediction: 'YES' | 'NO';
    reasoning: string;
}

export const analyzeBTTS = (matches: Match[]): number => {
    if (matches.length === 0) return 0;
    const bttsCount = matches.filter(m =>
        m.score.home !== null && m.score.away !== null && m.score.home > 0 && m.score.away > 0
    ).length;
    return (bttsCount / matches.length) * 100;
};

export const generatePrediction = (match: Match, homeHistory: Match[], awayHistory: Match[]): Prediction => {
    // Overall History (Last 10)
    const homeOverallBTTS = analyzeBTTS(homeHistory);
    const awayOverallBTTS = analyzeBTTS(awayHistory);

    // Recent Form (Last 5)
    const homeRecentHistory = homeHistory.slice(0, 5);
    const awayRecentHistory = awayHistory.slice(0, 5);

    const homeFormBTTS = analyzeBTTS(homeRecentHistory);
    const awayFormBTTS = analyzeBTTS(awayRecentHistory);

    // Weighted Probability: 60% Form, 40% Overall
    const homeWeighted = (homeFormBTTS * 0.6) + (homeOverallBTTS * 0.4);
    const awayWeighted = (awayFormBTTS * 0.6) + (awayOverallBTTS * 0.4);

    const probability = (homeWeighted + awayWeighted) / 2;

    return {
        matchId: match.id,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        bttsProbability: probability,
        prediction: probability > 60 ? 'YES' : 'NO',
        reasoning: `Form (Last 5): Home ${homeFormBTTS.toFixed(0)}%, Away ${awayFormBTTS.toFixed(0)}%. Overall: Home ${homeOverallBTTS.toFixed(0)}%, Away ${awayOverallBTTS.toFixed(0)}%.`
    };
};
