'use client';

import React from 'react';

/**
 * SectionErrorBoundary — ErrorBoundary nhẹ cho từng section
 *
 * Khác với ErrorBoundary toàn app:
 *  - Chỉ catch lỗi trong section đó, không crash toàn trang
 *  - Có thể tự recover bằng nút "Thử lại" (reset state)
 *  - Fallback UI nhỏ gọn, không chiếm toàn màn hình
 *
 * Dùng:
 *   <SectionErrorBoundary label="Map">
 *     <LeafletMap />
 *   </SectionErrorBoundary>
 */
export default class SectionErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, info) {
        const label = this.props.label || 'Section';
        console.error(`[SectionErrorBoundary:${label}] render error:`, error, info?.componentStack);
    }

    handleRetry = () => {
        this.setState({ hasError: false });
    };

    get isEn() {
        try {
            return typeof window !== 'undefined' && localStorage.getItem('iky_lang') === 'en';
        } catch { return false; }
    }

    render() {
        if (!this.state.hasError) return this.props.children;

        // Nếu có custom fallback prop → dùng nó
        if (this.props.fallback) return this.props.fallback;

        const label = this.props.label || 'Section';

        return (
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '24px 16px',
                    gap: 10,
                    background: '#fff8f8',
                    border: '1px dashed #fca5a5',
                    borderRadius: 8,
                    color: '#dc2626',
                    fontSize: 13,
                    minHeight: 80,
                }}
            >
                <span>⚠️ {label} {this.isEn ? 'failed to load' : 'tải thất bại'}</span>
                <button
                    onClick={this.handleRetry}
                    style={{
                        fontSize: 12,
                        padding: '4px 12px',
                        border: '1px solid #fca5a5',
                        borderRadius: 6,
                        background: '#fff',
                        color: '#dc2626',
                        cursor: 'pointer',
                    }}
                >
                    {this.isEn ? 'Retry' : 'Thử lại'}
                </button>
            </div>
        );
    }
}
