'use client';

import React from 'react';
import { Tabs } from 'antd';
import { UpOutlined } from '@ant-design/icons';
import { CruiseSpeedChart, CruiseAccChart } from './CruiseCharts';
import CruiseEventTable from './CruiseEventTable';
import CruiseRouteDetail from './CruiseRouteDetail';

export default function CruiseBottomNav({
    navOpen,
    setNavOpen,
    activeTab,
    setActiveTab,
    setStatsOpen,
    isEn,
    routeTimeline,
    segments,
    rawRouteData,
    goToRawIndex,
    ensureAddress,
}) {
    if (!rawRouteData || !rawRouteData.length) return null;

    return (
        <>
            {navOpen ? (
                <div className="iky-cruise__bottomnav">
                    <div className="iky-cruise__bottomnav-top">
                        <div className="iky-cruise__bottomnav-tabs">
                            <Tabs
                                activeKey={activeTab}
                                onChange={(k) => {
                                    setActiveTab(k);
                                    if (k === 'stats') setStatsOpen(true);
                                }}
                                size="small"
                                items={[
                                    { key: 'route', label: isEn ? 'Route detail' : 'Lộ trình chi tiết' },
                                    { key: 'stop', label: isEn ? 'Stop' : 'Dừng' },
                                    { key: 'park', label: isEn ? 'Park' : 'Đỗ' },
                                    { key: 'speed', label: isEn ? 'Speed' : 'Đồ thị vận tốc' },
                                    { key: 'acc', label: 'Bật/tắt máy' },
                                    { key: 'stats', label: isEn ? 'Stats' : 'Thống kê' },
                                ]}
                            />
                        </div>

                        <button
                            type="button"
                            className="iky-cruise__bottomnav-close"
                            onClick={() => setNavOpen(false)}
                            aria-label="Close"
                            title={isEn ? 'Close' : 'Đóng'}
                        >
                            ✕
                        </button>
                    </div>

                    {activeTab !== 'stats' && (
                        <div className="iky-cruise__bottomnav-body">
                            {activeTab === 'route' && (
                                <CruiseRouteDetail
                                    routeTimeline={routeTimeline}
                                    isEn={isEn}
                                    goToRawIndex={goToRawIndex}
                                />
                            )}
                            {activeTab === 'stop' && (
                                <CruiseEventTable
                                    items={segments.stop}
                                    kind="STOP"
                                    isEn={isEn}
                                    goToRawIndex={goToRawIndex}
                                    ensureAddress={ensureAddress}
                                />
                            )}
                            {activeTab === 'park' && (
                                <CruiseEventTable
                                    items={segments.park}
                                    kind="PARK"
                                    isEn={isEn}
                                    goToRawIndex={goToRawIndex}
                                    ensureAddress={ensureAddress}
                                />
                            )}
                            {activeTab === 'speed' && (
                                <CruiseSpeedChart
                                    rawRouteData={rawRouteData}
                                    isEn={isEn}
                                    goToRawIndex={goToRawIndex}
                                />
                            )}
                            {activeTab === 'acc' && (
                                <CruiseAccChart
                                    rawRouteData={rawRouteData}
                                    isEn={isEn}
                                    goToRawIndex={goToRawIndex}
                                />
                            )}
                        </div>
                    )}
                </div>
            ) : (
                <button
                    type="button"
                    className="iky-cruise__bottomnav-open"
                    onClick={() => setNavOpen(true)}
                    title={isEn ? 'View details' : 'Xem thông tin chi tiết'}
                >
                    <span className="iky-cruise__double-up">
                        <UpOutlined />
                        <UpOutlined />
                    </span>
                    <span className="iky-cruise__bottomnav-open-text">
                        {isEn ? 'View details' : 'Xem thông tin chi tiết'}
                    </span>
                </button>
            )}
        </>
    );
}
