'use client';

import React from 'react';
import { Tooltip } from 'antd';
import { formatDuration } from '../../util/cruiseUtils';
import { formatDateFromDevice } from '../../util/FormatDate';

export default function CruiseRouteDetail({ routeTimeline = [], isEn, goToRawIndex }) {
    const labelType = (tp) => {
        if (tp === 'RUN') return isEn ? 'Moving' : 'Di chuyển';
        if (tp === 'PARK') return isEn ? 'Parking' : 'Đỗ';
        return isEn ? 'Stop' : 'Dừng';
    };

    return (
        <div className="iky-cruise__events">
            <div className="iky-cruise__events-header">
                <div className="iky-cruise__events-title">{isEn ? 'Route details' : 'Lộ trình chi tiết'}</div>
                <div className="iky-cruise__events-sub">
                    {isEn ? 'Blocks' : 'Số đoạn'}: <b>{routeTimeline.length}</b>
                </div>
            </div>

            <div className="iky-cruise__events-table">
                <div className="iky-cruise__events-head iky-cruise__route-head">
                    <div className="iky-cruise__events-cell iky-cruise__events-cell--stt">#</div>
                    <div className="iky-cruise__events-cell">{isEn ? 'Type' : 'Loại'}</div>
                    <div className="iky-cruise__events-cell">{isEn ? 'Duration' : 'Thời gian'}</div>
                    <div className="iky-cruise__events-cell">{isEn ? 'Time range' : 'Khoảng thời gian'}</div>
                    <div className="iky-cruise__events-cell">{isEn ? 'Start coord' : 'Tọa độ bắt đầu'}</div>
                    <div className="iky-cruise__events-cell">{isEn ? 'End coord' : 'Tọa độ kết thúc'}</div>
                    <div className="iky-cruise__events-cell">{isEn ? 'Distance' : 'Quãng đường'}</div>
                </div>

                <div className="iky-cruise__events-body">
                    {routeTimeline.length === 0 ? (
                        <div className="iky-cruise__empty">{isEn ? 'No data' : 'Không có dữ liệu'}</div>
                    ) : (
                        routeTimeline.map((b, idx) => (
                            <div
                                key={`${b.type}-${b.startIdx}-${b.endIdx}`}
                                className="iky-cruise__events-row iky-cruise__route-row"
                                style={{ cursor: 'pointer' }}
                                onClick={() => goToRawIndex(b.startIdx)}
                            >
                                <div className="iky-cruise__events-cell iky-cruise__events-cell--stt">{idx + 1}</div>
                                <div className="iky-cruise__events-cell">{labelType(b.type)}</div>
                                <div className="iky-cruise__events-cell">{formatDuration(b.durationSec)}</div>
                                <Tooltip title={`${formatDateFromDevice(b.startTime)} → ${formatDateFromDevice(b.endTime)}`}>
                                    <div className="iky-cruise__events-cell iky-cruise__events-cell--truncate">
                                        {formatDateFromDevice(b.startTime)}
                                    </div>
                                </Tooltip>
                                <div className="iky-cruise__events-cell">
                                    {b.startLat != null ? `${b.startLat.toFixed(5)}, ${b.startLon.toFixed(5)}` : '--'}
                                </div>
                                <div className="iky-cruise__events-cell">
                                    {b.endLat != null ? `${b.endLat.toFixed(5)}, ${b.endLon.toFixed(5)}` : '--'}
                                </div>
                                <div className="iky-cruise__events-cell">
                                    {b.type === 'RUN' ? `${b.distKm.toFixed(2)} km` : '--'}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
