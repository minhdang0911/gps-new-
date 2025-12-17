import React from 'react';
import { Tooltip } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';

export function buildAllColsMeta({
    t,
    isEn,
    isMobile,
    distributorMap,
    getDistributorLabel,
    formatDateTime,
    formatStatus,
}) {
    const colHelp = {
        index: { vi: 'Số thứ tự của dòng trong bảng.', en: 'Order number of the row.' },
        imei: { vi: 'Mã thiết bị gắn trên xe.', en: 'Device IMEI.' },
        license_plate: { vi: 'Biển số xe tương ứng.', en: 'License plate.' },
        batteryId: { vi: 'Mã pin.', en: 'Battery ID.' },
        date: { vi: 'Ngày tổng hợp theo ngày.', en: 'Daily summary date.' },
        connectionStatus: { vi: 'Online/Offline.', en: 'Online/Offline.' },
        utilization: { vi: 'RUNNING/STOP.', en: 'RUNNING/STOP.' },
        distributor_id: { vi: 'Đại lý quản lý.', en: 'Distributor.' },
        last_update: { vi: 'Cập nhật thiết bị gần nhất.', en: 'Last device update.' },
    };

    const ColTitle = ({ label, tip }) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
            <span>{label}</span>
            <Tooltip
                title={tip}
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

    const tip = (k) => (isEn ? colHelp[k]?.en : colHelp[k]?.vi) || '';

    const longCols = [
        'chargingDurationToday',
        'consumedKwToday',
        'consumedPercentToday',
        'mileageToday',
        'numberOfChargingToday',
        'socToday',
        'sohToday',
        'speedMaxToday',
        'tempAvgToday',
        'tempMaxToday',
        'tempMinToday',
        'usageDurationToday',
        'voltageAvgToday',
        'voltageMaxToday',
        'voltageMinToday',
        'connectionStatus',
        'utilization',
        'realtime_soc',
        'realtime_soh',
        'realtime_voltage',
        'realtime_temperature',
        'realtime_status',
        'realtime_lat',
        'realtime_lon',
        'distributor_id',
        'createdAt',
        'last_update',
    ];

    return [
        {
            key: 'index',
            label: t.table.index,
            column: {
                title: <ColTitle label={t.table.index} tip={tip('index')} />,
                dataIndex: '__rowNo',
                width: 65,
                fixed: 'left',
                render: (_, r) => (r?.__rowNo ? r.__rowNo : ''),
            },
        },
        {
            key: 'imei',
            label: t.table.imei,
            column: {
                title: <ColTitle label={t.table.imei} tip={tip('imei')} />,
                dataIndex: 'imei',
                width: 150,
                ellipsis: true,
            },
        },
        {
            key: 'licensePlate',
            label: t.table.licensePlate || (isEn ? 'License plate' : 'Biển số'),
            column: {
                title: (
                    <ColTitle
                        label={t.table.licensePlate || (isEn ? 'License plate' : 'Biển số')}
                        tip={tip('license_plate')}
                    />
                ),
                dataIndex: 'license_plate',
                width: 140,
                ellipsis: true,
            },
        },
        {
            key: 'batteryId',
            label: t.table.batteryId,
            column: {
                title: <ColTitle label={t.table.batteryId} tip={tip('batteryId')} />,
                dataIndex: 'batteryId',
                width: 140,
                ellipsis: true,
            },
        },
        {
            key: 'date',
            label: t.table.date,
            column: {
                title: <ColTitle label={t.table.date} tip={tip('date')} />,
                dataIndex: 'date',
                width: 160,
                render: (v) => formatDateTime(v, isEn),
            },
        },

        ...longCols.map((k) => {
            const label = t.table[k] || k;

            const baseWidth = k.includes('temp')
                ? 200
                : k.includes('voltage')
                ? 200
                : k.includes('consumed')
                ? 220
                : k.includes('Duration')
                ? 210
                : k.includes('realtime_')
                ? 190
                : 180;

            const render =
                k === 'connectionStatus'
                    ? (v) => formatStatus(v, 'connection', isEn)
                    : k === 'utilization'
                    ? (v) => formatStatus(v, 'utilization', isEn)
                    : k === 'realtime_status'
                    ? (v) => formatStatus(v, 'realtime', isEn)
                    : k === 'distributor_id'
                    ? (v) => getDistributorLabel(v)
                    : k === 'createdAt' || k === 'last_update'
                    ? (v) => formatDateTime(v, isEn)
                    : undefined;

            return {
                key: k,
                label,
                column: {
                    title: <ColTitle label={label} tip={tip(k)} />,
                    dataIndex: k === 'distributor_id' ? 'distributor_id' : k,
                    width: baseWidth,
                    ellipsis: true,
                    render,
                },
            };
        }),
    ];
}
