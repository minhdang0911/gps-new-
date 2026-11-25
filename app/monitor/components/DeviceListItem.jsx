'use client';

import React from 'react';
import { message } from 'antd';
import BatteryBadge from './BatteryBadge';
import { getDriverName } from '../util/monitorHelpers';

const highlightText = (text, keyword) => {
    if (!text || !keyword || !keyword.trim()) return text;
    const kw = keyword.trim().toLowerCase();
    const str = String(text);
    const idx = str.toLowerCase().indexOf(kw);
    if (idx === -1) {
        const clean = (s) => s.replace(/[\s.\-_/]/g, '').toLowerCase();
        const sClean = clean(str);
        const kwClean = clean(kw);
        const cIdx = sClean.indexOf(kwClean);
        if (cIdx === -1) return text;
        return (
            <>
                {str.slice(0, cIdx)}
                <span className="iky-search-highlight">{str.slice(cIdx, cIdx + kw.length)}</span>
                {str.slice(cIdx + kw.length)}
            </>
        );
    }
    return (
        <>
            {str.slice(0, idx)}
            <span className="iky-search-highlight">{str.slice(idx, idx + kw.length)}</span>
            {str.slice(idx + kw.length)}
        </>
    );
};

const DeviceListItem = React.memo(({ d, idx, isActive, socForItem, isEn, unknownPlateText, phoneLabel, onSelectDevice, searchText }) => {
    const driverName = getDriverName(d);
    const NA_TEXT = isEn ? 'N/A' : 'Chưa rõ';

    return (
        <div
            className={'iky-monitor__device-item' + (isActive ? ' iky-monitor__device-item--active' : '')}
            onClick={() => onSelectDevice(d)}
        >
            <div className="iky-monitor__device-row">
                <span className="iky-monitor__stt-badge">{idx + 1}</span>

                <div className="iky-monitor__device-main">
                    <div className="iky-monitor__plate-row">
                        <div
                            className="plate"
                            title={isEn ? 'Click to copy plate' : 'Click để copy biển số'}
                            style={{ cursor: 'pointer' }}
                            onClick={(e) => {
                                e.stopPropagation();
                                const txt = d.license_plate || '';
                                if (!txt) return;
                                navigator.clipboard.writeText(txt).then(() => {
                                    message.success({ content: isEn ? `Copied: ${txt}` : `Đã copy: ${txt}`, duration: 1.5 });
                                }).catch(() => {
                                    message.error(isEn ? 'Copy failed' : 'Copy thất bại');
                                });
                            }}
                        >
                            {highlightText(d.license_plate || unknownPlateText, searchText)}
                        </div>

                        <BatteryBadge
                            soc={socForItem}
                            showText
                            compact
                            title={
                                socForItem == null
                                    ? isEn
                                        ? 'No battery data yet'
                                        : 'Chưa có dữ liệu pin'
                                    : isEn
                                      ? `Battery: ${socForItem}%`
                                      : `Pin: ${socForItem}%`
                            }
                        />
                    </div>

                    <div className="iky-monitor__meta" style={{ marginTop: 2 }}>
                        <span
                            className="imei"
                            title={isEn ? 'Click to copy IMEI' : 'Click để copy IMEI'}
                            style={{ cursor: 'pointer' }}
                            onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(d.imei || '').then(() => {
                                    message.success({ content: isEn ? `Copied IMEI: ${d.imei}` : `Đã copy IMEI: ${d.imei}`, duration: 1.5 });
                                }).catch(() => {
                                    message.error(isEn ? 'Copy failed' : 'Copy thất bại');
                                });
                            }}
                        >IMEI: {highlightText(d.imei, searchText)}</span>
                        <span className="dot">•</span>
                        <span className="phone">
                            {phoneLabel}{' '}
                            {highlightText(d.phone_number || 'Chưa gán', searchText)}
                        </span>
                        <span className="dot">•</span>
                        <span className="driver">
                            {isEn ? 'Driver' : 'Lái xe'}:{' '}
                            {highlightText(driverName || NA_TEXT, searchText)}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
});

DeviceListItem.displayName = 'DeviceListItem';

export default DeviceListItem;
