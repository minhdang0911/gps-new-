'use client';

import React from 'react';
import { Tag } from 'antd';
import { formatDateFromDevice } from '../../util/FormatDate';

export default function CruiseInfoPanel({ currentPoint, currentAddr, currentAddrKeyRef, isEn }) {
    if (!currentPoint) return null;

    const timeText = currentPoint.dateTime ? formatDateFromDevice(currentPoint.dateTime) : '--';
    const speedText = currentPoint.velocity != null ? currentPoint.velocity : '--';

    return (
        <div className="iky-cruise__infobox">
            <div className="iky-cruise__infobox-title">
                {isEn ? 'Current point' : 'Điểm hiện tại'}
            </div>

            <div className="iky-cruise__infobox-row">
                <span className="iky-cruise__infobox-k">{isEn ? 'Time' : 'Thời gian'}</span>
                <span className="iky-cruise__infobox-v">{timeText}</span>
            </div>

            <div className="iky-cruise__infobox-row">
                <span className="iky-cruise__infobox-k">{isEn ? 'Speed' : 'Tốc độ'}</span>
                <span className="iky-cruise__infobox-v">{speedText}</span>
            </div>

            <div className="iky-cruise__infobox-row">
                <span className="iky-cruise__infobox-k">{isEn ? 'Engine' : 'Trạng thái máy'}</span>
                <span className="iky-cruise__infobox-v">
                    <Tag color={Number(currentPoint.acc) === 1 ? 'default' : 'green'}>
                        {Number(currentPoint.acc) === 1
                            ? isEn ? 'Off' : 'Tắt máy'
                            : isEn ? 'On' : 'Mở máy'}
                    </Tag>
                </span>
            </div>

            <div className="iky-cruise__infobox-row">
                <span className="iky-cruise__infobox-k">{isEn ? 'Coord' : 'Tọa độ'}</span>
                <span className="iky-cruise__infobox-v">
                    {typeof currentPoint.lat === 'number'
                        ? `${currentPoint.lat.toFixed(6)}, ${currentPoint.lon.toFixed(6)}`
                        : '--'}
                </span>
            </div>

            <div className="iky-cruise__infobox-row">
                <span className="iky-cruise__infobox-k">{isEn ? 'Address' : 'Địa chỉ'}</span>
                <span className="iky-cruise__infobox-v">
                    {currentAddrKeyRef?.current && !currentAddr ? (
                        <i>{isEn ? 'Loading…' : 'Đang tải…'}</i>
                    ) : currentAddr ? (
                        currentAddr
                    ) : (
                        '--'
                    )}
                </span>
            </div>
        </div>
    );
}
