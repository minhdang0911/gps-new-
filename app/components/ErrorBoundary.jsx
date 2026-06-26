'use client';

import React from 'react';

/**
 * ErrorBoundary — bat loi render cua toan app
 * React chi ho tro class component cho error boundary
 */
export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        console.error('💥 [ErrorBoundary] Uncaught render error:', error, info.componentStack);
    }

    handleReload = () => {
        this.setState({ hasError: false, error: null });
        window.location.reload();
    };

    render() {
        if (!this.state.hasError) return this.props.children;

        return (
            <div
                style={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#f8fafc',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    padding: 20,
                }}
            >
                <div
                    style={{
                        maxWidth: 480,
                        width: '100%',
                        background: '#fff',
                        borderRadius: 16,
                        padding: '40px 36px',
                        boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
                        border: '1px solid #e2e8f0',
                        textAlign: 'center',
                    }}
                >
                    <div
                        style={{
                            width: 60,
                            height: 60,
                            borderRadius: '50%',
                            background: '#fee2e2',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 20px',
                            fontSize: 28,
                        }}
                    >
                        ⚠️
                    </div>

                    <h2
                        style={{
                            fontSize: 20,
                            fontWeight: 700,
                            color: '#0f172a',
                            margin: '0 0 8px',
                        }}
                    >
                        Đã xảy ra lỗi
                    </h2>

                    <p
                        style={{
                            fontSize: 14,
                            color: '#64748b',
                            margin: '0 0 24px',
                            lineHeight: 1.6,
                        }}
                    >
                        Ứng dụng gặp sự cố không mong muốn.
                        Vui lòng tải lại trang để tiếp tục.
                    </p>

                    {process.env.NODE_ENV === 'development' && this.state.error && (
                        <pre
                            style={{
                                background: '#f1f5f9',
                                borderRadius: 8,
                                padding: '10px 14px',
                                fontSize: 11,
                                color: '#dc2626',
                                textAlign: 'left',
                                overflowX: 'auto',
                                marginBottom: 20,
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-all',
                            }}
                        >
                            {this.state.error.message}
                        </pre>
                    )}

                    <button
                        onClick={this.handleReload}
                        style={{
                            background: 'linear-gradient(135deg, #1677ff, #4096ff)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 10,
                            padding: '11px 28px',
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: '0 4px 12px rgba(22,119,255,0.3)',
                        }}
                    >
                        Tai lai trang
                    </button>
                </div>
            </div>
        );
    }
}
