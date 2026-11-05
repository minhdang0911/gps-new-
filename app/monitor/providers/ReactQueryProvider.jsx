'use client';

import React, { useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

function makeQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 5 * 60_000, // 5 phút
                gcTime: 24 * 60 * 60_000, // 24h

                refetchOnWindowFocus: false,
                refetchOnReconnect: false,
                refetchOnMount: false, // mount/F5 không tự gọi lại
                retry: 0,
            },
        },
    });
}

export default function ReactQueryProvider({ children }) {
    const [queryClient] = useState(() => makeQueryClient());
    const [restored, setRestored] = useState(false);

    const persister = useMemo(() => {
        if (typeof window === 'undefined') return null;
        return createSyncStoragePersister({
            storage: window.localStorage,
            key: 'iky_monitor_rq_cache',
        });
    }, []);

    // ✅ SSR (không có window): vẫn phải có QueryClientProvider
    if (!persister) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    }

    return (
        <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{
                persister,
                maxAge: 24 * 60 * 60 * 1000, // 24h
                buster: 'monitor-v7',
            }}
            onSuccess={() => setRestored(true)}
        >
            {/* ✅ Chặn render đến khi restore xong để tránh query gọi API */}
            {children}
        </PersistQueryClientProvider>
    );
}
