import React from 'react';
import { Tooltip } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { formatDateTime } from '../utils';

const colHelp = {
    index: { vi: 'Số thứ tự dòng trong danh sách.', en: 'Row number in the list.' },
    sessionId: { vi: 'Mã phiên sử dụng (mỗi dòng là 1 phiên/chuyến).', en: 'Usage session ID.' },
    vehicleId: { vi: 'Mã xe / định danh xe của phiên này.', en: 'Vehicle ID.' },
    batteryId: { vi: 'Mã pin sử dụng trong phiên này.', en: 'Battery ID.' },
    usageCode: { vi: 'Mã phiên (dùng tra cứu).', en: 'Session code.' },
    durationMinutes: { vi: 'Tổng thời gian phiên (phút).', en: 'Duration (minutes).' },
    soh: { vi: 'Sức khỏe pin (SOH).', en: 'Battery health (SOH).' },
    socStart: { vi: 'SOC lúc bắt đầu (%).', en: 'SOC at start (%).' },
    socEnd: { vi: 'SOC lúc kết thúc (%).', en: 'SOC at end (%).' },
    tempMax: { vi: 'Nhiệt độ pin cao nhất (°C).', en: 'Max temp (°C).' },
    tempMin: { vi: 'Nhiệt độ pin thấp nhất (°C).', en: 'Min temp (°C).' },
    tempAvg: { vi: 'Nhiệt độ pin trung bình (°C).', en: 'Avg temp (°C).' },
    distanceKm: { vi: 'Quãng đường (km).', en: 'Distance (km).' },
    speedMax: { vi: 'Vận tốc cao nhất (km/h).', en: 'Max speed (km/h).' },
    speedAvg: { vi: 'Vận tốc trung bình (km/h).', en: 'Avg speed (km/h).' },
    consumedPercent: { vi: 'Pin tiêu hao (%).', en: 'Consumed (%).' },
    consumedKwh: { vi: 'Năng lượng tiêu thụ (kWh).', en: 'Consumed (kWh).' },
    startTime: { vi: 'Thời điểm bắt đầu.', en: 'Start time.' },
    endTime: { vi: 'Thời điểm kết thúc.', en: 'End time.' },
    startLat: { vi: 'Vĩ độ điểm bắt đầu.', en: 'Start latitude.' },
    startLng: { vi: 'Kinh độ điểm bắt đầu.', en: 'Start longitude.' },
    endLat: { vi: 'Vĩ độ điểm kết thúc.', en: 'End latitude.' },
    endLng: { vi: 'Kinh độ điểm kết thúc.', en: 'End longitude.' },
};

const ColTitle = ({ label, tip, isEn, isMobile }) => {
    const tipText = tip && typeof tip === 'object' ? (isEn ? tip.en : tip.vi) : tip;
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
            <span>{label}</span>
            <Tooltip
                title={tipText}
                placement="top"
                trigger={isMobile ? ['click'] : ['hover']}
                mouseEnterDelay={0.1}
                mouseLeaveDelay={0.1}
            >
                <span
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    }}
                    onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    }}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 16,
                        height: 16,
                        cursor: 'help',
                    }}
                >
                    <QuestionCircleOutlined style={{ fontSize: 12, color: '#94a3b8' }} />
                </span>
            </Tooltip>
        </span>
    );
};

export function buildAllColsMeta({ t, isEn, isMobile, vehicleFilterOptions, batteryFilterOptions, tableFilters }) {
    return [
        {
            key: 'index',
            label: t.table.index,
            column: {
                title: <ColTitle label={t.table.index} tip={colHelp.index} isEn={isEn} isMobile={isMobile} />,
                dataIndex: '__rowNo',
                width: 60,
                fixed: 'left',
                render: (_, record) => (record?.__group ? '' : record.__rowNo),
            },
        },
        {
            key: 'usageCode',
            label: t.table.usageCode,
            column: {
                title: <ColTitle label={t.table.usageCode} tip={colHelp.usageCode} isEn={isEn} isMobile={isMobile} />,
                dataIndex: 'usageCode',
                ellipsis: true,
                width: 210,
                render: (v, r) => (r?.__group ? <b>{v}</b> : v),
            },
        },
        {
            key: 'vehicleId',
            label: t.table.vehicleId,
            column: {
                title: <ColTitle label={t.table.vehicleId} tip={colHelp.vehicleId} isEn={isEn} isMobile={isMobile} />,
                dataIndex: 'vehicleId',
                ellipsis: true,
                width: 90,
                filters: vehicleFilterOptions,
                filteredValue: tableFilters.vehicleId || null,
            },
        },
        {
            key: 'batteryId',
            label: t.table.batteryId,
            column: {
                title: <ColTitle label={t.table.batteryId} tip={colHelp.batteryId} isEn={isEn} isMobile={isMobile} />,
                dataIndex: 'batteryId',
                ellipsis: true,
                width: 100,
                filters: batteryFilterOptions,
                filteredValue: tableFilters.batteryId || null,
            },
        },

        {
            key: 'durationMinutes',
            label: t.table.durationMinutes,
            column: {
                title: (
                    <ColTitle
                        label={t.table.durationMinutes}
                        tip={colHelp.durationMinutes}
                        isEn={isEn}
                        isMobile={isMobile}
                    />
                ),
                dataIndex: 'durationMinutes',
                width: 150,
                render: (v, r) => (r?.__group ? <b>{v}</b> : v),
            },
        },
        {
            key: 'soh',
            label: t.table.soh,
            column: {
                title: <ColTitle label={t.table.soh} tip={colHelp.soh} isEn={isEn} isMobile={isMobile} />,
                dataIndex: 'soh',
                width: 90,
                render: (v, r) => (r?.__group ? <b>{v}</b> : v),
            },
        },
        {
            key: 'socStart',
            label: t.table.socStart,
            column: {
                title: <ColTitle label={t.table.socStart} tip={colHelp.socStart} isEn={isEn} isMobile={isMobile} />,
                dataIndex: 'socStart',
                width: 130,
                render: (v, r) => (r?.__group ? <b>{v}</b> : v),
            },
        },
        {
            key: 'socEnd',
            label: t.table.socEnd,
            column: {
                title: <ColTitle label={t.table.socEnd} tip={colHelp.socEnd} isEn={isEn} isMobile={isMobile} />,
                dataIndex: 'socEnd',
                width: 130,
                render: (v, r) => (r?.__group ? <b>{v}</b> : v),
            },
        },
        {
            key: 'tempMax',
            label: t.table.tempMax,
            column: {
                title: <ColTitle label={t.table.tempMax} tip={colHelp.tempMax} isEn={isEn} isMobile={isMobile} />,
                dataIndex: 'tempMax',
                width: 130,
            },
        },
        {
            key: 'tempMin',
            label: t.table.tempMin,
            column: {
                title: <ColTitle label={t.table.tempMin} tip={colHelp.tempMin} isEn={isEn} isMobile={isMobile} />,
                dataIndex: 'tempMin',
                width: 130,
            },
        },
        {
            key: 'tempAvg',
            label: t.table.tempAvg,
            column: {
                title: <ColTitle label={t.table.tempAvg} tip={colHelp.tempAvg} isEn={isEn} isMobile={isMobile} />,
                dataIndex: 'tempAvg',
                width: 170,
            },
        },
        {
            key: 'distanceKm',
            label: t.table.distanceKm,
            column: {
                title: <ColTitle label={t.table.distanceKm} tip={colHelp.distanceKm} isEn={isEn} isMobile={isMobile} />,
                dataIndex: 'distanceKm',
                width: 170,
                render: (v, r) => (r?.__group ? <b>{v}</b> : v),
            },
        },
        {
            key: 'speedMax',
            label: t.table.speedMax,
            column: {
                title: <ColTitle label={t.table.speedMax} tip={colHelp.speedMax} isEn={isEn} isMobile={isMobile} />,
                dataIndex: 'speedMax',
                width: 120,
            },
        },
        {
            key: 'speedAvg',
            label: t.table.speedAvg,
            column: {
                title: <ColTitle label={t.table.speedAvg} tip={colHelp.speedAvg} isEn={isEn} isMobile={isMobile} />,
                dataIndex: 'speedAvg',
                width: 160,
            },
        },
        {
            key: 'consumedPercent',
            label: t.table.consumedPercent,
            column: {
                title: (
                    <ColTitle
                        label={t.table.consumedPercent}
                        tip={colHelp.consumedPercent}
                        isEn={isEn}
                        isMobile={isMobile}
                    />
                ),
                dataIndex: 'consumedPercent',
                width: 140,
                render: (v, r) => (r?.__group ? <b>{v}</b> : v),
            },
        },
        {
            key: 'consumedKwh',
            label: t.table.consumedKwh,
            column: {
                title: (
                    <ColTitle label={t.table.consumedKwh} tip={colHelp.consumedKwh} isEn={isEn} isMobile={isMobile} />
                ),
                dataIndex: 'consumedKwh',
                width: 130,
                render: (v, r) => (r?.__group ? <b>{v}</b> : v),
            },
        },
        {
            key: 'startTime',
            label: t.table.startTime,
            column: {
                title: <ColTitle label={t.table.startTime} tip={colHelp.startTime} isEn={isEn} isMobile={isMobile} />,
                dataIndex: 'startTime',
                ellipsis: true,
                render: (v) => formatDateTime(v),
                width: 170,
            },
        },
        {
            key: 'endTime',
            label: t.table.endTime,
            column: {
                title: <ColTitle label={t.table.endTime} tip={colHelp.endTime} isEn={isEn} isMobile={isMobile} />,
                dataIndex: 'endTime',
                ellipsis: true,
                render: (v) => formatDateTime(v),
                width: 170,
            },
        },
        {
            key: 'startLat',
            label: t.table.startLat,
            column: {
                title: <ColTitle label={t.table.startLat} tip={colHelp.startLat} isEn={isEn} isMobile={isMobile} />,
                dataIndex: 'startLat',
                width: 130,
            },
        },
        {
            key: 'startLng',
            label: t.table.startLng,
            column: {
                title: <ColTitle label={t.table.startLng} tip={colHelp.startLng} isEn={isEn} isMobile={isMobile} />,
                dataIndex: 'startLng',
                width: 150,
            },
        },
        {
            key: 'endLat',
            label: t.table.endLat,
            column: {
                title: <ColTitle label={t.table.endLat} tip={colHelp.endLat} isEn={isEn} isMobile={isMobile} />,
                dataIndex: 'endLat',
                width: 130,
            },
        },
        {
            key: 'endLng',
            label: t.table.endLng,
            column: {
                title: <ColTitle label={t.table.endLng} tip={colHelp.endLng} isEn={isEn} isMobile={isMobile} />,
                dataIndex: 'endLng',
                width: 110,
            },
        },
    ];
}
