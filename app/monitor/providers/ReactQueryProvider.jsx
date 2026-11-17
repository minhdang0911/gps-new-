'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function makeQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 5 * 60_000, // 5 phút cache trong RAM
                gcTime: 10 * 60_000, // 10 phút dọn dẹp memory

                refetchOnWindowFocus: false, // không lag khi alt-tab
                refetchOnReconnect: false,
                refetchOnMount: false, // dùng dữ liệu cache RAM tức thì, không block UI
                retry: 0,
            },
        },
    });
}

export default function ReactQueryProvider({ children }) {
    // ✅ In-memory QueryClient: Cực nhanh, 0ms lag, không block Main Thread bằng synchronous localStorage
    const [queryClient] = useState(() => makeQueryClient());

    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
