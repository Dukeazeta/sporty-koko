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

export const analyzeBTTS = (homeHistory: Match[], awayHistory: Match[]): number => {
    // Calculate BTTS percentage for home team
    const homeBTTSCount = homeHistory.filter(m =>
        m.score.home !== null && m.score.away !== null && m.score.home > 0 && m.score.away > 0
    ).length;
    const homeBTTSPercent = homeHistory.length > 0 ? (homeBTTSCount / homeHistory.length) * 100 : 0;

    // Calculate BTTS percentage for away team
    const awayBTTSCount = awayHistory.filter(m =>
        m.score.home !== null && m.score.away !== null && m.score.home > 0 && m.score.away > 0
    ).length;
    const awayBTTSPercent = awayHistory.length > 0 ? (awayBTTSCount / awayHistory.length) * 100 : 0;

    // Average probability
    return (homeBTTSPercent + awayBTTSPercent) / 2;
};

export const generatePrediction = (match: Match, homeHistory: Match[], awayHistory: Match[]): Prediction => {
    const probability = analyzeBTTS(homeHistory, awayHistory);

    return {
        matchId: match.id,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        bttsProbability: probability,
        prediction: probability > 60 ? 'YES' : 'NO', // Threshold can be adjusted
        reasoning: `Home BTTS: ${analyzeBTTS(homeHistory, []).toFixed(1)}%, Away BTTS: ${analyzeBTTS([], awayHistory).toFixed(1)}%`
    };
};
