'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { RateLimitInfo } from '@/lib/services/dataService';

// Internal state interface with Date object for easier manipulation
export interface RateLimitState extends Omit<RateLimitInfo, 'resetTime'> {
    resetTime?: Date;
}

interface RateLimitContextType {
    rateLimitInfo: RateLimitState | null;
    updateRateLimitInfo: (info: RateLimitInfo) => void;
    clearRateLimit: () => void;
}

const RateLimitContext = createContext<RateLimitContextType | undefined>(undefined);

interface RateLimitProviderProps {
    children: ReactNode;
}

export const RateLimitProvider: React.FC<RateLimitProviderProps> = ({ children }) => {
    const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitState | null>(null);

    const updateRateLimitInfo = useCallback((info: RateLimitInfo) => {
        // Ensure resetTime is a Date object
        const processedInfo: RateLimitState = {
            ...info,
            resetTime: info.resetTime ? new Date(info.resetTime) : undefined
        };

        setRateLimitInfo(processedInfo);

        // Store in localStorage for persistence across page reloads
        if (processedInfo.isRateLimited && processedInfo.resetTime) {
            localStorage.setItem('rateLimitInfo', JSON.stringify({
                ...processedInfo,
                resetTime: processedInfo.resetTime.toISOString() // Store as ISO string
            }));
        } else if (!processedInfo.isRateLimited) {
            localStorage.removeItem('rateLimitInfo');
        }
    }, []);

    const clearRateLimit = useCallback(() => {
        setRateLimitInfo(null);
        localStorage.removeItem('rateLimitInfo');
    }, []);

    // Check for stored rate limit info on mount
    useEffect(() => {
        const stored = localStorage.getItem('rateLimitInfo');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                const resetTime = new Date(parsed.resetTime);

                // Only restore if the reset time is still in the future
                if (resetTime.getTime() > Date.now()) {
                    setRateLimitInfo({
                        ...parsed,
                        resetTime: resetTime // Convert back to Date object
                    });
                } else {
                    // Clear expired rate limit
                    localStorage.removeItem('rateLimitInfo');
                }
            } catch (error) {
                console.error('Error parsing stored rate limit info:', error);
                localStorage.removeItem('rateLimitInfo');
            }
        }
    }, []);

    // Auto-clear rate limit when reset time passes
    useEffect(() => {
        if (rateLimitInfo?.isRateLimited && rateLimitInfo.resetTime) {
            const resetDate = rateLimitInfo.resetTime; // Already a Date object
            const timeout = setTimeout(() => {
                clearRateLimit();
            }, resetDate.getTime() - Date.now());

            return () => clearTimeout(timeout);
        }
    }, [rateLimitInfo, clearRateLimit]);

    return (
        <RateLimitContext.Provider value={{
            rateLimitInfo,
            updateRateLimitInfo,
            clearRateLimit
        }}>
            {children}
        </RateLimitContext.Provider>
    );
};

export const useRateLimit = (): RateLimitContextType => {
    const context = useContext(RateLimitContext);
    if (context === undefined) {
        throw new Error('useRateLimit must be used within a RateLimitProvider');
    }
    return context;
};