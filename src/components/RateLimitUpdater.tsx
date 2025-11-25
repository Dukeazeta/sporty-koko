'use client';

import { useEffect } from 'react';
import { useRateLimit } from '@/contexts/RateLimitContext';
import { RateLimitInfo } from '@/lib/services/dataService';

export const RateLimitUpdater = ({ rateLimitInfo }: { rateLimitInfo: RateLimitInfo }) => {
    const { updateRateLimitInfo } = useRateLimit();

    useEffect(() => {
        if (rateLimitInfo) {
            updateRateLimitInfo(rateLimitInfo);
        }
    }, [rateLimitInfo, updateRateLimitInfo]);

    return null;
};

export default RateLimitUpdater;
