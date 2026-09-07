'use client';

import React from 'react';
import { ConfigProvider, theme } from 'antd';
import { useDarkModeValue } from '../hooks/useDarkMode';

/**
 * ThemeProvider — Ant Design ConfigProvider với dark/light mode
 *
 * Đọc dark mode từ useDarkModeValue (reactive với localStorage).
 * Khi user bấm toggle trong Navbar → hook re-render → ConfigProvider đổi algorithm.
 *
 * Chỉ apply cho Ant Design components.
 * Custom CSS (Navbar.css, ManagePage.css...) dùng selector `html.iky-dark` từ globals.css.
 */
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
