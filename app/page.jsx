'use client';

import React from 'react';
import ReactQueryProvider from './monitor/providers/ReactQueryProvider';
import MonitorPage from './MonitorPage';

export default function Page() {
    return (
        <ReactQueryProvider>
            <MonitorPage />
        </ReactQueryProvider>
    );
}
