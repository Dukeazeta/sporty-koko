'use client';

import React, { useState, useEffect } from 'react';
import { useRateLimit } from '@/contexts/RateLimitContext';
import RateLimitBanner from '@/components/RateLimitBanner';

export default function TestRateLimitPage() {
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

    const clearRateLimitManually = () => {
        clearRateLimit();
        console.log('Rate limit cleared manually');
    };

    return (
        <div className="min-h-screen p-8">
            <h1 className="text-4xl font-bold mb-8">Rate Limit Test Page</h1>

            <div className="bg-white p-6 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] mb-8">
                <h2 className="text-2xl font-bold mb-4">Current Rate Limit Status</h2>
                <div className="space-y-2 font-mono">
                    <div>Is Rate Limited: <strong>{rateLimitInfo?.isRateLimited ? 'YES' : 'NO'}</strong></div>
                    <div>Remaining Requests: <strong>{rateLimitInfo?.remainingRequests ?? 'N/A'}</strong></div>
                    <div>Reset Time: <strong>{rateLimitInfo?.resetTime ? new Date(rateLimitInfo.resetTime).toLocaleString() : 'N/A'}</strong></div>
                    <div>Cooldown Minutes: <strong>{rateLimitInfo?.cooldownMinutes ?? 'N/A'}</strong></div>
                </div>
            </div>

            <div className="flex gap-4 mb-8">
                <button
                    onClick={triggerRateLimit}
                    className="bg-red-500 text-white px-6 py-3 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-bold hover:bg-red-600 transition-colors"
                >
                    Trigger Rate Limit (1 min)
                </button>
                <button
                    onClick={clearRateLimitManually}
                    className="bg-green-500 text-white px-6 py-3 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-bold hover:bg-green-600 transition-colors"
                >
                    Clear Rate Limit
                </button>
            </div>

            <div className="bg-yellow-100 p-6 border-4 border-black">
                <h3 className="text-xl font-bold mb-2">Instructions</h3>
                <ol className="list-decimal list-inside space-y-2">
                    <li>Click "Trigger Rate Limit" to simulate hitting the API rate limit</li>
                    <li>You should see a yellow banner appear at the top of the page</li>
                    <li>The banner will show a countdown timer</li>
                    <li>Click "Clear Rate Limit" to dismiss the banner immediately</li>
                    <li>Or wait 1 minute for it to auto-dismiss</li>
                </ol>
            </div>

            {/* The banner should appear at the top when rate limited */}
            <RateLimitBanner />
        </div>
    );
}