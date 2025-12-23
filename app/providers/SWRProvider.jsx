'use client';

import React, { useMemo } from 'react';
import { SWRConfig } from 'swr';
import { useAuthStore } from '../stores/authStore';

export default function SWRProvider({ children }) {
    const userId = useAuthStore((s) => s.user?._id) || 'guest';

    // ✅ mỗi userId => 1 cache Map mới
    const swrValue = useMemo(
        () => ({
            provider: () => new Map(),
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
            revalidateIfStale: false,
            keepPreviousData: true,
            dedupingInterval: 5 * 60 * 1000,
            shouldRetryOnError: false,
        }),
        [],
    );

    return (
        <SWRConfig value={swrValue} key={userId}>
            {children}
        </SWRConfig>
    );
}
