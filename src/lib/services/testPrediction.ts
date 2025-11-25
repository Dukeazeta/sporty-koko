
import { generatePrediction, generateEnhancedPrediction } from './predictionService';
import { Match } from './dataService';

const mockMatch: Match = {
    id: 1,
    homeTeam: 'Team A',
    homeTeamId: 1,
    awayTeam: 'Team B',
    awayTeamId: 2,
    date: '2023-01-01',
    status: 'SCHEDULED',
    score: { home: null, away: null }
};

const createHistory = (btts: boolean[]): Match[] => {
    return btts.map((isBtts, i) => ({
        id: i,
        homeTeam: 'Team X',
        homeTeamId: 1,
        awayTeam: 'Team Y',
        awayTeamId: 2,
        date: '2023-01-01',
        status: 'FINISHED',
        score: { home: isBtts ? 1 : 1, away: isBtts ? 1 : 0 }
    }));
};

// Scenario: 
// Team A: Last 5 games all BTTS (100%), previous 5 games no BTTS (0%). Overall 50%.
// Team B: Last 5 games no BTTS (0%), previous 5 games all BTTS (100%). Overall 50%.

const homeHistory = createHistory([true, true, true, true, true, false, false, false, false, false]);
const awayHistory = createHistory([false, false, false, false, false, true, true, true, true, true]);

const prediction = generatePrediction(mockMatch, homeHistory, awayHistory);
console.log('Basic Prediction:', prediction);

// Test enhanced prediction (without H2H)
const enhancedPrediction = generateEnhancedPrediction(mockMatch, homeHistory, awayHistory);
console.log('Enhanced Prediction:', enhancedPrediction);

// Test with H2H data
const h2hHistory = createHistory([true, true, false, true, false]); // 60% BTTS in H2H
const enhancedWithH2H = generateEnhancedPrediction(mockMatch, homeHistory, awayHistory, h2hHistory);
console.log('Enhanced with H2H:', enhancedWithH2H);

// Expected:
// Home Form: 100%, Overall: 50% -> Weighted: (100*0.6) + (50*0.4) = 60 + 20 = 80%
// Away Form: 0%, Overall: 50% -> Weighted: (0*0.6) + (50*0.4) = 0 + 20 = 20%
// Total Probability: (80 + 20) / 2 = 50%
