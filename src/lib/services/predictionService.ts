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

export interface EnhancedPrediction extends Prediction {
    confidenceInterval: {
        lower: number;
        upper: number;
        confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    };
    h2hBTTS?: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    keyFactors: string[];
    dataQuality: {
        sufficientData: boolean;
        warning?: string;
    };
}

export interface AdvancedBTTSStats {
    basicBTTS: number;
    bothTeamsScoreRate: number;
    averageTotalGoals: number;
    cleanSheets: number;
    highScoringGames: number;
    scoringConsistency: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface ScoringTrend {
    current: number;
    previous: number;
    trend: 'IMPROVING' | 'DECLINING' | 'STABLE';
    trendMagnitude: number;
}

export interface MatchContext {
    homeTeamBTTSAtHome: number;
    awayTeamBTTSAway: number;
    daysSinceLastMatch: number;
    competitionType: string;
}

export interface DynamicWeights {
    recentForm: number;
    overallPerformance: number;
    homeAdvantage: number;
    dataQuality: number;
}

export const analyzeBTTS = (matches: Match[]): number => {
    if (matches.length === 0) return 0;
    const bttsCount = matches.filter(m =>
        m.score.home !== null && m.score.away !== null && m.score.home > 0 && m.score.away > 0
    ).length;
    return (bttsCount / matches.length) * 100;
};

export const analyzeAdvancedBTTS = (matches: Match[]): AdvancedBTTSStats => {
    const finishedMatches = matches.filter(m => m.status === 'FINISHED');

    if (finishedMatches.length === 0) {
        return {
            basicBTTS: 0,
            bothTeamsScoreRate: 0,
            averageTotalGoals: 0,
            cleanSheets: 0,
            highScoringGames: 0,
            scoringConsistency: 'LOW'
        };
    }

    const scoringAnalysis = finishedMatches.map(m => ({
        homeScored: (m.score.home || 0) > 0,
        awayScored: (m.score.away || 0) > 0,
        totalGoals: (m.score.home || 0) + (m.score.away || 0),
        goalDifference: Math.abs((m.score.home || 0) - (m.score.away || 0)),
        highScoring: ((m.score.home || 0) + (m.score.away || 0)) >= 3,
        cleanSheet: (m.score.home === 0 || m.score.away === 0)
    }));

    const basicBTTS = analyzeBTTS(matches);
    const bothTeamsScoreRate = scoringAnalysis.filter(s => s.homeScored && s.awayScored).length;
    const averageTotalGoals = scoringAnalysis.reduce((sum, s) => sum + s.totalGoals, 0) / scoringAnalysis.length;
    const cleanSheets = scoringAnalysis.filter(s => s.cleanSheet).length;
    const highScoringGames = scoringAnalysis.filter(s => s.highScoring).length;

    // Calculate scoring consistency based on variance
    const goalVariance = scoringAnalysis.reduce((sum, s) => {
        const diff = s.totalGoals - averageTotalGoals;
        return sum + (diff * diff);
    }, 0) / scoringAnalysis.length;

    const scoringConsistency = goalVariance < 1 ? 'HIGH' : goalVariance < 2 ? 'MEDIUM' : 'LOW';

    return {
        basicBTTS,
        bothTeamsScoreRate: (bothTeamsScoreRate / scoringAnalysis.length) * 100,
        averageTotalGoals,
        cleanSheets,
        highScoringGames,
        scoringConsistency
    };
};

export const calculateConfidenceInterval = (bttsPercentage: number, sampleSize: number): { lower: number; upper: number; confidence: 'HIGH' | 'MEDIUM' | 'LOW' } => {
    if (sampleSize === 0) {
        return { lower: 0, upper: 0, confidence: 'LOW' };
    }

    // Wilson score interval for better confidence with small samples
    const z = 1.96; // 95% confidence
    const n = Math.max(1, sampleSize);
    const p = bttsPercentage / 100;

    const denominator = 1 + z * z / n;
    const center = (p + z * z / (2 * n)) / denominator;
    const margin = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / denominator;

    const lower = Math.max(0, (center - margin) * 100);
    const upper = Math.min(100, (center + margin) * 100);
    const confidence = sampleSize >= 5 ? 'HIGH' : sampleSize >= 3 ? 'MEDIUM' : 'LOW';

    return { lower, upper, confidence };
};

export const analyzeScoringTrends = (matches: Match[]): ScoringTrend => {
    const recent5 = matches.slice(0, 5).filter(m => m.status === 'FINISHED');
    const previous5 = matches.slice(5, 10).filter(m => m.status === 'FINISHED');

    const recentBTTS = analyzeBTTS(recent5);
    const previousBTTS = analyzeBTTS(previous5);

    const trend = recentBTTS - previousBTTS;

    return {
        current: recentBTTS,
        previous: previousBTTS,
        trend: trend > 10 ? 'IMPROVING' : trend < -10 ? 'DECLINING' : 'STABLE',
        trendMagnitude: Math.abs(trend)
    };
};

export const calculateDynamicWeights = (homeHistory: Match[], awayHistory: Match[]): DynamicWeights => {
    const homeGames = homeHistory.filter(m => m.status === 'FINISHED').length;
    const awayGames = awayHistory.filter(m => m.status === 'FINISHED').length;
    const totalGames = homeGames + awayGames;

    // Adjust weights based on available data
    const recentFormWeight = Math.max(0.5, Math.min(0.8, totalGames / 20));
    const overallWeight = 1 - recentFormWeight;

    // Small boost for home teams and data quality penalty for insufficient data
    return {
        recentForm: recentFormWeight,
        overallPerformance: overallWeight,
        homeAdvantage: 0.05, // Small boost for home teams
        dataQuality: Math.min(1, totalGames / 10) // Penalty for insufficient data
    };
};

export const analyzeMatchContext = (match: Match, history: Match[]): MatchContext => {
    const isHomeAdvantage = history.filter(m =>
        m.homeTeamId === match.homeTeamId && m.status === 'FINISHED'
    );

    const isAwayDisadvantage = history.filter(m =>
        m.awayTeamId === match.awayTeamId && m.status === 'FINISHED'
    );

    // Calculate days since last match (simplified)
    const lastMatch = history.find(m => m.status === 'FINISHED');
    const daysSinceLastMatch = lastMatch ?
        Math.max(0, Math.floor((new Date(match.date).getTime() - new Date(lastMatch.date).getTime()) / (1000 * 60 * 60 * 24))) :
        7; // Default assumption

    return {
        homeTeamBTTSAtHome: analyzeBTTS(isHomeAdvantage),
        awayTeamBTTSAway: analyzeBTTS(isAwayDisadvantage),
        daysSinceLastMatch,
        competitionType: 'LEAGUE' // Default, can be enhanced
    };
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

    // Dynamic weighting
    const weights = calculateDynamicWeights(homeHistory, awayHistory);

    // Weighted Probability with dynamic weights
    const homeWeighted = (homeFormBTTS * weights.recentForm) + (homeOverallBTTS * weights.overallPerformance) + (weights.homeAdvantage * 100);
    const awayWeighted = (awayFormBTTS * weights.recentForm) + (awayOverallBTTS * weights.overallPerformance);

    const probability = Math.min(100, Math.max(0, ((homeWeighted + awayWeighted) / 2) * weights.dataQuality));

    return {
        matchId: match.id,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        bttsProbability: probability,
        prediction: probability > 60 ? 'YES' : 'NO',
        reasoning: `Form (Last 5): Home ${homeFormBTTS.toFixed(0)}%, Away ${awayFormBTTS.toFixed(0)}%. Overall: Home ${homeOverallBTTS.toFixed(0)}%, Away ${awayOverallBTTS.toFixed(0)}%.`
    };
};

export const generateEnhancedPrediction = (
    match: Match,
    homeHistory: Match[],
    awayHistory: Match[],
    headToHead: Match[] = []
): EnhancedPrediction => {

    const basePrediction = generatePrediction(match, homeHistory, awayHistory);
    const homeAdvancedStats = analyzeAdvancedBTTS(homeHistory);
    const awayAdvancedStats = analyzeAdvancedBTTS(awayHistory);
    const homeTrend = analyzeScoringTrends(homeHistory);
    const awayTrend = analyzeScoringTrends(awayHistory);
    const h2hBTTS = analyzeBTTS(headToHead);
    const matchContext = analyzeMatchContext(match, [...homeHistory, ...awayHistory]);

    // Enhanced probability calculation
    const h2hWeight = headToHead.length > 0 ? 0.2 : 0;
    const trendWeight = 0.1;

    let enhancedProbability = basePrediction.bttsProbability;

    // Add H2H influence
    if (headToHead.length > 0) {
        enhancedProbability = (enhancedProbability * (1 - h2hWeight)) + (h2hBTTS * h2hWeight);
    }

    // Add trend influence
    if (homeTrend.trend === 'IMPROVING' && awayTrend.trend === 'IMPROVING') {
        enhancedProbability += trendWeight * 10;
    } else if (homeTrend.trend === 'DECLINING' && awayTrend.trend === 'DECLINING') {
        enhancedProbability -= trendWeight * 10;
    }

    enhancedProbability = Math.min(100, Math.max(0, enhancedProbability));

    // Calculate confidence interval
    const totalSampleSize = homeHistory.length + awayHistory.length + headToHead.length;
    const confidenceInterval = calculateConfidenceInterval(enhancedProbability, totalSampleSize);

    // Determine risk level
    const confidence = confidenceInterval.upper - confidenceInterval.lower;
    const riskLevel = confidence < 20 ? 'LOW' : confidence < 35 ? 'MEDIUM' : 'HIGH';

    // Generate key factors
    const keyFactors: string[] = [];
    if (homeAdvancedStats.scoringConsistency === 'HIGH') keyFactors.push('Home team consistent scoring');
    if (awayAdvancedStats.scoringConsistency === 'HIGH') keyFactors.push('Away team consistent scoring');
    if (headToHead.length > 0) keyFactors.push(`H2H: ${h2hBTTS.toFixed(0)}% BTTS`);
    if (homeTrend.trend === 'IMPROVING') keyFactors.push('Home team improving attack');
    if (awayTrend.trend === 'IMPROVING') keyFactors.push('Away team improving attack');

    // Data quality assessment
    const sufficientData = totalSampleSize >= 5;
    const warning = !sufficientData ? 'Limited historical data available' : undefined;

    return {
        ...basePrediction,
        bttsProbability: enhancedProbability,
        prediction: enhancedProbability > 60 ? 'YES' : 'NO',
        confidenceInterval,
        h2hBTTS: headToHead.length > 0 ? h2hBTTS : undefined,
        riskLevel,
        keyFactors,
        dataQuality: { sufficientData, warning },
        reasoning: `${basePrediction.reasoning} H2H: ${h2hBTTS.toFixed(0)}% (${headToHead.length} games). Confidence: ${confidenceInterval.confidence}.`
    };
};
