'use client';

import React from 'react';
import { ConfigProvider, theme } from 'antd';
import { useDarkModeValue } from '../hooks/useDarkMode';
 
export default function ThemeProvider({ children }) {
    const isDark = useDarkModeValue();

    return (
        <ConfigProvider
            theme={{
                algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
                token: {
                    colorPrimary: '#2196f3',
                    borderRadius: 8,
                    fontFamily: 'system-ui, -apple-system, Arial, sans-serif',
                },
                components: {
                    Table: {
                        // Giữ border radius nhất quán
                        borderRadius: 8,
                    },
                    Card: {
                        borderRadius: 10,
                    },
                    Modal: {
                        borderRadius: 12,
                    },
                },
            }}
        >
            {children}
        </ConfigProvider>
    );
}
