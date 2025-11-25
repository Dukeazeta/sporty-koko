'use client';

import React from 'react';
import { RateLimitProvider as ContextProvider } from '@/contexts/RateLimitContext';
import RateLimitBanner from './RateLimitBanner';

interface RateLimitProviderProps {
    children: React.ReactNode;
}

export const RateLimitProvider: React.FC<RateLimitProviderProps> = ({ children }) => {
    return (
        <ContextProvider>
            <RateLimitBanner />
            {children}
        </ContextProvider>
    );
};

export default RateLimitProvider;