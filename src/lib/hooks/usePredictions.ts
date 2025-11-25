'use client';

import { useState, useCallback } from 'react';
import { useRateLimit } from '@/contexts/RateLimitContext';
import { EnhancedPrediction } from '@/lib/services/predictionService';

interface UsePredictionsResult {
    predictions: EnhancedPrediction[];
    loading: boolean;
    error: string | null;
    rateLimited: boolean;
    fetchPredictions: (competitionId?: number) => Promise<void>;
}

export const usePredictions = (): UsePredictionsResult => {
    const [predictions, setPredictions] = useState<EnhancedPrediction[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { rateLimitInfo, updateRateLimitInfo } = useRateLimit();

    const fetchPredictions = useCallback(async (competitionId?: number) => {
        setLoading(true);
        setError(null);

        try {
            const url = competitionId
                ? `/api/predictions?competitionId=${competitionId}`
                : '/api/predictions';

            const response = await fetch(url);

            // Check for rate limit in response
            if (response.status === 429) {
                const data = await response.json();
                if (data.rateLimitInfo) {
                    updateRateLimitInfo(data.rateLimitInfo);
                }
                setError('Rate limit exceeded');
                return;
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            // Update rate limit info if present
            if (data.rateLimitInfo) {
                updateRateLimitInfo(data.rateLimitInfo);
            }

            setPredictions(data.predictions || []);

        } catch (err) {
            console.error('Error fetching predictions:', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch predictions');
        } finally {
            setLoading(false);
        }
    }, [updateRateLimitInfo]);

    const rateLimited = rateLimitInfo?.isRateLimited || false;

    return {
        predictions,
        loading,
        error,
        rateLimited,
        fetchPredictions
    };
};

export default usePredictions;