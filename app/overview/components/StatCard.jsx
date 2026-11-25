/**
 * @file StatCard.jsx
 * @description Card hiển thị chỉ số KPI tổng quan (Tổng xe, Online, Offline, Sắp hết hạn, Đại lý).
 */

'use client';

import React from 'react';
import { Skeleton } from 'antd';

export default function StatCard({
    icon,
    label,
    value,
    sub,
    accentColor = '#1d4ed8',
    loading: cardLoading,
    onClick,
    active,
    badgeText,
    pulseDot,
    percentage,
    progressColor,
    isEn,
}) {
    return (
        <div
            className={`ov-stat-card ${active ? 'ov-stat-card--active' : ''}`}
            onClick={onClick}
            style={{
                '--card-accent': accentColor,
                cursor: onClick ? 'pointer' : 'default',
            }}
        >
            <div className="ov-stat-card-top">
                <div
                    className="ov-stat-icon-box"
                    style={{
                        background: accentColor + '10',
                        borderColor: accentColor + '22',
                    }}
                >
                    {icon}
                </div>
                {badgeText && (
                    <span
                        className="ov-stat-badge"
                        style={{
                            background: accentColor + '10',
                            color: accentColor,
                            border: `1px solid ${accentColor}26`,
                        }}
                    >
                        {pulseDot && <span className="ov-stat-pulse-dot" style={{ background: accentColor }} />}
                        {badgeText}
                    </span>
                )}
            </div>

            <div className="ov-stat-main">
                <div className="ov-stat-value-row">
                    {cardLoading ? (
                        <Skeleton active paragraph={false} title={{ width: 60 }} />
                    ) : (
                        <span className="ov-stat-value">{value}</span>
                    )}
                </div>
                <div className="ov-stat-label">{label}</div>
            </div>

            <div className="ov-stat-footer">
                <div style={{ flex: 1, minWidth: 0 }}>
                    {typeof percentage === 'number' && (
                        <div className="ov-stat-bar-track">
                            <div
                                className="ov-stat-bar-fill"
                                style={{
                                    width: `${Math.min(100, Math.max(0, percentage))}%`,
                                    background: progressColor || accentColor,
                                }}
                            />
                        </div>
                    )}
                    {sub && (
                        <div style={{ marginTop: typeof percentage === 'number' ? 4 : 0, fontSize: 11, color: '#64748b' }}>
                            {sub}
                        </div>
                    )}
                </div>
                {onClick && !cardLoading && (
                    <span className="ov-stat-action-hint" style={{ color: accentColor }}>
                        {active
                            ? (isEn ? '✕ Clear' : '✕ Bỏ lọc')
                            : (isEn ? 'Map →' : 'Bản đồ →')
                        }
                    </span>
                )}
            </div>
        </div>
    );
}
