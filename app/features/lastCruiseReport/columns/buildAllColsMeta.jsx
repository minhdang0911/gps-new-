// app/features/lastCruiseReport/columns/buildAllColsMeta.jsx
import React from 'react';
import { formatDateTimeFactory, parseTimToDate } from '../utils';
import {
    LAST_CRUISE_COLUMN_HELP,
    formatGpsStatus,
    formatSosStatus,
    formatVehicleLockStatus,
    ColumnHeaderWithTooltip,
} from './lastCruiseColumnRenderers';

export function buildAllColsMeta({ t, isEn, isMobile }) {
    const formatDateTime = formatDateTimeFactory(isEn);

    const renderColumnTitle = (headerLabel, columnKey) => (
        <ColumnHeaderWithTooltip
            headerLabel={headerLabel}
            tooltipContent={LAST_CRUISE_COLUMN_HELP[columnKey]}
            isEnglish={isEn}
            isMobileScreen={isMobile}
        />
    );

    return [
        {
            key: 'index',
            label: t.table.index,
            column: {
                title: renderColumnTitle(t.table.index, 'index'),
                dataIndex: '__rowNo',
                width: 60,
                fixed: 'left',
                render: (_, record) => record.__rowNo ?? '',
            },
        },
        {
            key: 'lat',
            label: t.table.lat,
            column: {
                title: renderColumnTitle(t.table.lat, 'lat'),
                dataIndex: 'lat',
                width: 105,
                fixed: !isMobile ? 'left' : undefined,
            },
        },
        {
            key: 'lon',
            label: t.table.lon,
            column: {
                title: renderColumnTitle(t.table.lon, 'lon'),
                dataIndex: 'lon',
                width: 110,
                fixed: !isMobile ? 'left' : undefined,
            },
        },
        {
            key: 'sat',
            label: t.table.sat,
            column: {
                title: renderColumnTitle(t.table.sat, 'sat'),
                dataIndex: 'address',
                width: isMobile ? 220 : 260,
                fixed: !isMobile ? 'left' : undefined,
                render: (resolvedAddress, record) => {
                    if (resolvedAddress) {
                        return (
                            <div style={{ whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.4 }}>
                                {resolvedAddress}
                            </div>
                        );
                    }
                    if (record?.__addressLoading) {
                        return (
                            <span style={{ color: '#999', fontStyle: 'italic' }}>
                                {isEn ? 'Resolving...' : 'Đang tải...'}
                            </span>
                        );
                    }
                    return '--';
                },
            },
        },
        {
            key: 'dev',
            label: t.table.dev,
            column: {
                title: renderColumnTitle(t.table.dev, 'dev'),
                dataIndex: 'dev',
                width: 160,
                ellipsis: true,
            },
        },
        {
            key: 'license_plate',
            label: isEn ? 'License plate' : 'Biển số',
            column: {
                title: renderColumnTitle(isEn ? 'License plate' : 'Biển số', 'license_plate'),
                dataIndex: 'license_plate',
                width: 140,
                ellipsis: true,
            },
        },
        {
            key: 'fwr',
            label: t.table.fwr,
            column: {
                title: renderColumnTitle(t.table.fwr, 'fwr'),
                dataIndex: 'fwr',
                width: 140,
                ellipsis: true,
            },
        },
        {
            key: 'tim',
            label: t.table.tim,
            column: {
                title: renderColumnTitle(t.table.tim, 'tim'),
                dataIndex: 'tim',
                width: 180,
                render: (timeValue) => {
                    const parsedDate = parseTimToDate(timeValue);
                    return parsedDate ? formatDateTime(parsedDate) : timeValue || '--';
                },
            },
        },
        {
            key: 'gps',
            label: t.table.gps,
            column: {
                title: renderColumnTitle(t.table.gps, 'gps'),
                dataIndex: 'gps',
                width: 140,
                render: (gpsValue) => formatGpsStatus(gpsValue, t),
            },
        },
        {
            key: 'sos',
            label: t.table.sos,
            column: {
                title: renderColumnTitle(t.table.sos, 'sos'),
                dataIndex: 'sos',
                width: 140,
                render: (sosValue) => formatSosStatus(sosValue, t),
            },
        },
        {
            key: 'acc',
            label: t.table.acc,
            column: {
                title: renderColumnTitle(t.table.acc, 'acc'),
                dataIndex: 'acc',
                width: 120,
                render: (accValue) => formatVehicleLockStatus(accValue, isEn),
            },
        },
        {
            key: 'vgp',
            label: t.table.vgp,
            column: {
                title: renderColumnTitle(t.table.vgp, 'vgp'),
                dataIndex: 'vgp',
                width: 160,
            },
        },
        {
            key: 'mil',
            label: isEn ? 'ODO' : 'ODO',
            column: {
                title: renderColumnTitle(isEn ? 'ODO' : 'ODO', 'mil'),
                dataIndex: 'mil',
                width: 120,
                render: (milValue) => milValue ?? '0',
            },
        },
        {
            key: 'createdAt',
            label: t.table.createdAt,
            column: {
                title: renderColumnTitle(t.table.createdAt, 'createdAt'),
                dataIndex: 'createdAt',
                width: 180,
                render: (dateValue) => formatDateTime(dateValue),
            },
        },
        {
            key: 'updatedAt',
            label: t.table.updatedAt,
            column: {
                title: renderColumnTitle(t.table.updatedAt, 'updatedAt'),
                dataIndex: 'updatedAt',
                width: 180,
                render: (dateValue) => formatDateTime(dateValue),
            },
        },
    ];
}
