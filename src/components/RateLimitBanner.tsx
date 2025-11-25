'use client';

import React, { useState, useEffect } from 'react';
import { useRateLimit } from '@/contexts/RateLimitContext';
import { IconFlame } from '@/components/Icons';

export const RateLimitBanner: React.FC = () => {
    const { rateLimitInfo, clearRateLimit } = useRateLimit();
    const [visible, setVisible] = useState(false);
    const [timeRemaining, setTimeRemaining] = useState<number>(0);

    useEffect(() => {
        if (rateLimitInfo?.isRateLimited) {
            setVisible(true);
            if (rateLimitInfo.resetTime) {
                const updateTimer = () => {
                    const now = new Date().getTime();
                    const resetTime = new Date(rateLimitInfo.resetTime!).getTime();
                    const remaining = Math.max(0, Math.ceil((resetTime - now) / 1000));
                    setTimeRemaining(remaining);

                    if (remaining === 0) {
                        setVisible(false);
                        clearRateLimit();
                    }
                };

                updateTimer();
                const interval = setInterval(updateTimer, 1000);

                return () => clearInterval(interval);
            }
        } else {
            setVisible(false);
            setTimeRemaining(0);
        }
    }, [rateLimitInfo, clearRateLimit]);

    const formatTime = (seconds: number): string => {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    };

    if (!visible || !rateLimitInfo?.isRateLimited) {
        return null;
    }

    return (
        <div className="fixed top-0 left-0 right-0 z-50 p-2 pointer-events-none flex justify-center">
            <div className="pointer-events-auto bg-[var(--neo-yellow)] border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-4 max-w-2xl w-full transform rotate-1 transition-transform hover:rotate-0 flex flex-col md:flex-row items-center justify-between gap-4">

                <div className="flex items-center gap-4">
                    <div className="bg-black text-white p-2 border-2 border-white shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] animate-pulse">
                        <IconFlame className="w-6 h-6 text-[var(--neo-orange)]" />
                    </div>
                    <div>
                        <h3 className="font-black text-lg uppercase leading-none">System Overheat</h3>
                        <p className="font-mono text-sm font-bold">
                            API Rate Limit Reached
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="bg-white border-4 border-black px-4 py-2 font-mono font-bold text-xl min-w-[120px] text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        {timeRemaining > 0 ? formatTime(timeRemaining) : '0:00'}
                    </div>

                    <button
                        onClick={() => setVisible(false)}
                        className="bg-black text-white p-2 font-bold border-2 border-transparent hover:bg-gray-800 hover:border-white transition-colors"
                        aria-label="Dismiss"
                    >
                        ✕
                    </button>
                </div>

                {/* Progress Bar */}
                {timeRemaining > 0 && rateLimitInfo.resetTime && (
                    <div className="absolute bottom-0 left-0 h-2 bg-black transition-all duration-1000 ease-linear w-full"
                        style={{
                            width: `${((timeRemaining * 1000) / (new Date(rateLimitInfo.resetTime).getTime() - new Date().getTime() + timeRemaining * 1000)) * 100}%`
                        }}
                    />
                )}
            </div>
        </div>
    );
};

export default RateLimitBanner;