'use client';

import React, { useState } from 'react';
import { Tooltip } from 'antd';
import { formatDuration } from '../../util/cruiseUtils';
import { formatDateFromDevice } from '../../util/FormatDate';

export default function CruiseEventTable({ items = [], kind, isEn, goToRawIndex, ensureAddress }) {
    const [rowAddrs, setRowAddrs] = useState({});

    const handleReqAddr = async (idx, lat, lon) => {
        if (rowAddrs[idx] || !ensureAddress) return;
        const addr = await ensureAddress(lat, lon);
        if (addr) setRowAddrs((prev) => ({ ...prev, [idx]: addr }));
    };

    if (!items.length) {
        return <div className="iky-cruise__empty">{isEn ? 'No events recorded' : 'Không có sự kiện'}</div>;
    }

    return (
        <div className="iky-cruise__events-table">
            <div className="iky-cruise__events-head">
                <div className="iky-cruise__events-cell iky-cruise__events-cell--stt">#</div>
                <div className="iky-cruise__events-cell">{isEn ? 'Duration' : 'Thời lượng'}</div>
                <div className="iky-cruise__events-cell">{isEn ? 'Time range' : 'Khoảng thời gian'}</div>
                <div className="iky-cruise__events-cell">{isEn ? 'Coordinates' : 'Tọa độ'}</div>
                <div className="iky-cruise__events-cell">{isEn ? 'Address' : 'Địa chỉ'}</div>
            </div>

            <div className="iky-cruise__events-body">
                {items.map((ev, i) => (
                    <div
                        key={`${kind}-${ev.startIndex}-${i}`}
                        className="iky-cruise__events-row"
                        style={{ cursor: 'pointer' }}
                        onClick={() => goToRawIndex(ev.startIndex)}
                    >
                        <div className="iky-cruise__events-cell iky-cruise__events-cell--stt">{i + 1}</div>
                        <div className="iky-cruise__events-cell">{formatDuration(ev.durationSec)}</div>
                        <Tooltip title={`${formatDateFromDevice(ev.startTime)} → ${formatDateFromDevice(ev.endTime)}`}>
                            <div className="iky-cruise__events-cell iky-cruise__events-cell--truncate">
                                {formatDateFromDevice(ev.startTime)}
                            </div>
                        </Tooltip>
                        <div className="iky-cruise__events-cell">
                            {ev.startLat != null ? `${ev.startLat.toFixed(5)}, ${ev.startLon.toFixed(5)}` : '--'}
                        </div>
                        <div
                            className="iky-cruise__events-cell iky-cruise__events-cell--addr"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {rowAddrs[i] ? (
                                rowAddrs[i]
                            ) : (
                                <button
                                    type="button"
                                    className="iky-cruise__addr-btn"
                                    onClick={() => handleReqAddr(i, ev.startLat, ev.startLon)}
                                >
                                    {isEn ? 'Get address' : 'Lấy địa chỉ'}
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
