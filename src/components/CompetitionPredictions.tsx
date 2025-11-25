'use client';

import React, { useEffect } from 'react';
import { EnhancedPrediction } from '@/lib/services/predictionService';
import { useRateLimit } from '@/contexts/RateLimitContext';
import { RateLimitInfo } from '@/lib/services/dataService';

interface CompetitionPredictionsProps {
    competitionId: number;
    predictions: (EnhancedPrediction | null)[];
    rateLimitInfo: RateLimitInfo[];
}

export const CompetitionPredictions: React.FC<CompetitionPredictionsProps> = ({
    competitionId,
    predictions,
    rateLimitInfo
}) => {
    const { updateRateLimitInfo } = useRateLimit();

    // Update rate limit context when component receives new rate limit info
    useEffect(() => {
        if (rateLimitInfo.length > 0) {
            const latestRateLimit = rateLimitInfo.find(info => info.isRateLimited);
            if (latestRateLimit) {
                updateRateLimitInfo(latestRateLimit);
            }
        }
    }, [rateLimitInfo, updateRateLimitInfo]);

    return null; // This is just a wrapper component
};

export default CompetitionPredictions;