'use client';

import React from 'react';
import { Modal } from 'antd';
import { formatDuration } from '../../util/cruiseUtils';
import { formatDateFromDevice } from '../../util/FormatDate';

export default function CruiseStatsModal({
    statsOpen,
    setStatsOpen,
    stats,
    isEn,
    activeTab,
    setActiveTab,
    goToRawIndex,
}) {
    return (
        <Modal
            open={statsOpen}
            title={isEn ? 'Statistics' : 'Thống kê'}
            onCancel={() => {
                setStatsOpen(false);
                if (activeTab === 'stats') setActiveTab('route');
            }}
            footer={null}
            width={720}
        >
            <div className="iky-cruise__stats">
                <div className="iky-cruise__stats-row">
                    <div className="iky-cruise__stats-k">{isEn ? 'Total distance' : 'Tổng quãng đường'}</div>
                    <div className="iky-cruise__stats-v">
                        <b>{stats.totalDistanceKm.toFixed(3)} km</b>
                    </div>
                </div>

                <div className="iky-cruise__stats-row">
                    <div className="iky-cruise__stats-k">{isEn ? 'Stop count' : 'Tổng số lần dừng'}</div>
                    <div className="iky-cruise__stats-v">
                        <b>{stats.stopCount}</b>
                    </div>
                </div>

                <div className="iky-cruise__stats-row">
                    <div className="iky-cruise__stats-k">{isEn ? 'Total stop time' : 'Tổng thời gian dừng'}</div>
                    <div className="iky-cruise__stats-v">
                        <b>{formatDuration(stats.totalStopSec)}</b>
                    </div>
                </div>

                <div className="iky-cruise__stats-row">
                    <div className="iky-cruise__stats-k">{isEn ? 'Parking count' : 'Tổng số lần đỗ'}</div>
                    <div className="iky-cruise__stats-v">
                        <b>{stats.parkCount}</b>
                    </div>
                </div>

                <div className="iky-cruise__stats-row">
                    <div className="iky-cruise__stats-k">{isEn ? 'Total parking time' : 'Tổng thời gian đỗ'}</div>
                    <div className="iky-cruise__stats-v">
                        <b>{formatDuration(stats.totalParkSec)}</b>
                    </div>
                </div>

                <div className="iky-cruise__stats-row">
                    <div className="iky-cruise__stats-k">{isEn ? 'Max speed' : 'Tốc độ lớn nhất'}</div>
                    <div className="iky-cruise__stats-v">
                        <b>{stats.maxSpeed} km/h</b>{' '}
                        {stats.maxSpeedTime ? (
                            <span>
                                ({isEn ? 'at' : 'lúc'} {formatDateFromDevice(stats.maxSpeedTime)})
                            </span>
                        ) : null}
                    </div>
                </div>

                <div className="iky-cruise__stats-actions">
                    <button
                        type="button"
                        className="iky-cruise__mini-btn"
                        onClick={() => goToRawIndex(stats.maxSpeedRawIndex)}
                    >
                        {isEn ? 'Go to max-speed point' : 'Tới điểm tốc độ lớn nhất'}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
