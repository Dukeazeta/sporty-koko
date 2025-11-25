'use client';

import React from 'react';
import { useRateLimit } from '@/contexts/RateLimitContext';

export const RateLimitTester: React.FC = () => {
    const { rateLimitInfo, updateRateLimitInfo, clearRateLimit } = useRateLimit();

    const triggerRateLimit = () => {
        const resetTime = new Date(Date.now() + 60000); // 1 minute from now
        updateRateLimitInfo({
            isRateLimited: true,
            resetTime,
            remainingRequests: 0,
            cooldownMinutes: 1
        });
        console.log('Rate limit triggered manually');
    };

    const clear = () => {
        clearRateLimit();
        console.log('Rate limit cleared manually');
    };

    return (
        <div className="fixed bottom-4 right-4 z-50 bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-4 font-mono text-sm">
            <h3 className="font-bold mb-2">Rate Limit Debug</h3>
            <div className="space-y-2 text-xs">
                <div>Status: {rateLimitInfo?.isRateLimited ? 'RATE LIMITED' : 'OK'}</div>
                <div>Remaining: {rateLimitInfo?.remainingRequests ?? 'N/A'}</div>
                <div>Reset: {rateLimitInfo?.resetTime ? new Date(rateLimitInfo.resetTime).toLocaleTimeString() : 'N/A'}</div>
            </div>
            <div className="flex gap-2 mt-3">
                <button
                    onClick={triggerRateLimit}
                    className="bg-[var(--neo-orange)] text-white px-2 py-1 border-2 border-black text-xs"
                >
                    Test Rate Limit
                </button>
                <button
                    onClick={clear}
                    className="bg-[var(--neo-green)] text-white px-2 py-1 border-2 border-black text-xs"
                >
                    Clear
                </button>
            </div>
        </div>
    );
};

export default RateLimitTester;