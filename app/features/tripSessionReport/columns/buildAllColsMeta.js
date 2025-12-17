import React from 'react';
import { Tooltip } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { formatDateTime, formatDuration } from '../utils';

const colHelp = {
    index: { vi: 'Số thứ tự của dòng trong bảng.', en: 'Order number of the row.' },
    tripCode: { vi: 'Mã của chuyến đi (mỗi chuyến sẽ có một mã riêng).', en: 'Trip ID.' },
    imei: {
        vi: 'Mã thiết bị gắn trên xe. Hệ thống dùng mã này để xác định xe/biển số.',
        en: 'Device code installed on the vehicle.',
    },
    license_plate: {
        vi: 'Biển số xe. Có thể trống nếu hệ thống chưa liên kết được biển số với thiết bị.',
        en: 'License plate. May be empty if not linked yet.',
    },
    batteryId: { vi: 'Mã pin đang được sử dụng trong chuyến đi này.', en: 'Battery ID used in this trip.' },
    soh: { vi: 'Sức khỏe pin (%).', en: 'Battery health (%).' },
    startTime: { vi: 'Thời điểm bắt đầu chuyến đi.', en: 'Trip start time.' },
    endTime: { vi: 'Thời điểm kết thúc chuyến đi.', en: 'Trip end time.' },
    duration: { vi: 'Tổng thời gian của chuyến đi.', en: 'Total trip duration.' },
    distanceKm: { vi: 'Quãng đường di chuyển trong chuyến đi (km).', en: 'Distance traveled (km).' },
    consumedKw: { vi: 'Lượng điện tiêu thụ trong chuyến đi.', en: 'Energy consumed.' },
    socEnd: { vi: 'Phần trăm pin còn lại khi kết thúc chuyến đi.', en: 'Battery remaining at end.' },
    endLat: { vi: 'Vị trí kết thúc – vĩ độ.', en: 'End latitude.' },
    endLng: { vi: 'Vị trí kết thúc – kinh độ.', en: 'End longitude.' },
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
                classNames={{ root: 'table-col-tooltip' }}
                styles={{ root: { maxWidth: 260 }, container: { maxWidth: 260 } }}
                mouseEnterDelay={0.1}
                mouseLeaveDelay={0.1}
            >
                <span
                    className="table-col-help"
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
                        pointerEvents: 'auto',
                    }}
                >
                    <QuestionCircleOutlined style={{ fontSize: 12, color: '#94a3b8' }} />
                </span>
            </Tooltip>
        </span>
    );
};

export function buildAllColsMeta({ t, isEn, isMobile }) {
    return [
        {
            key: 'index',
            label: t.table.index,
            column: {
                title: <ColTitle label={t.table.index} tip={colHelp.index} isEn={isEn} isMobile={isMobile} />,
                dataIndex: '__rowNo',
                width: 60,
                fixed: 'left',
                render: (_, record) => record.__rowNo ?? '',
            },
        },
        {
            key: 'tripCode',
            label: t.table.tripCode,
            column: {
                title: <ColTitle label={t.table.tripCode} tip={colHelp.tripCode} isEn={isEn} isMobile={isMobile} />,
                dataIndex: 'tripCode',
                ellipsis: true,
                width: 260,
            },
        },
        {
            key: 'imei',
            label: t.table.imei,
            column: {
                title: <ColTitle label={t.table.imei} tip={colHelp.imei} isEn={isEn} isMobile={isMobile} />,
                dataIndex: 'imei',
                ellipsis: true,
                width: 180,
            },
        },
        {
            key: 'license_plate',
            label: isEn ? 'License plate' : 'Biển số',
            column: {
                title: (
                    <ColTitle
                        label={isEn ? 'License plate' : 'Biển số'}
                        tip={colHelp.license_plate}
                        isEn={isEn}
                        isMobile={isMobile}
                    />
                ),
                dataIndex: 'license_plate',
                ellipsis: true,
                width: 140,
            },
        },
        {
            key: 'batteryId',
            label: t.table.batteryId,
            column: {
                title: <ColTitle label={t.table.batteryId} tip={colHelp.batteryId} isEn={isEn} isMobile={isMobile} />,
                dataIndex: 'batteryId',
                ellipsis: true,
                width: 150,
            },
        },
        {
            key: 'soh',
            label: t.table.soh,
            column: {
                title: <ColTitle label={t.table.soh} tip={colHelp.soh} isEn={isEn} isMobile={isMobile} />,
                dataIndex: 'soh',
                width: 80,
            },
        },
        {
            key: 'startTime',
            label: isEn ? 'Start time' : 'Thời gian bắt đầu',
            column: {
                title: (
                    <ColTitle
                        label={isEn ? 'Start time' : 'Thời gian bắt đầu'}
                        tip={colHelp.startTime}
                        isEn={isEn}
                        isMobile={isMobile}
                    />
                ),
                dataIndex: 'startTime',
                ellipsis: true,
                width: 190,
                render: (v) => formatDateTime(v),
            },
        },
        {
            key: 'endTime',
            label: isEn ? 'End time' : 'Thời gian kết thúc',
            column: {
                title: (
                    <ColTitle
                        label={isEn ? 'End time' : 'Thời gian kết thúc'}
                        tip={colHelp.endTime}
                        isEn={isEn}
                        isMobile={isMobile}
                    />
                ),
                dataIndex: 'endTime',
                ellipsis: true,
                width: 190,
                render: (v) => formatDateTime(v),
            },
        },
        {
            key: 'duration',
            label: isEn ? 'Duration' : 'Thời lượng',
            column: {
                title: (
                    <ColTitle
                        label={isEn ? 'Duration' : 'Thời lượng'}
                        tip={colHelp.duration}
                        isEn={isEn}
                        isMobile={isMobile}
                    />
                ),
                key: 'duration',
                width: 110,
                render: (_, record) => formatDuration(record.startTime, record.endTime),
            },
        },
        {
            key: 'distanceKm',
            label: t.table.distanceKm,
            column: {
                title: <ColTitle label={t.table.distanceKm} tip={colHelp.distanceKm} isEn={isEn} isMobile={isMobile} />,
                dataIndex: 'distanceKm',
                width: 160,
            },
        },
        {
            key: 'consumedKw',
            label: t.table.consumedKw,
            column: {
                title: <ColTitle label={t.table.consumedKw} tip={colHelp.consumedKw} isEn={isEn} isMobile={isMobile} />,
                dataIndex: 'consumedKw',
                width: 202,
            },
        },
        {
            key: 'socEnd',
            label: t.table.socEnd,
            column: {
                title: <ColTitle label={t.table.socEnd} tip={colHelp.socEnd} isEn={isEn} isMobile={isMobile} />,
                dataIndex: 'socEnd',
                width: 120,
            },
        },
        {
            key: 'endLat',
            label: t.table.endLat,
            column: {
                title: <ColTitle label={t.table.endLat} tip={colHelp.endLat} isEn={isEn} isMobile={isMobile} />,
                dataIndex: 'endLat',
                width: 150,
            },
        },
        {
            key: 'endLng',
            label: t.table.endLng,
            column: {
                title: <ColTitle label={t.table.endLng} tip={colHelp.endLng} isEn={isEn} isMobile={isMobile} />,
                dataIndex: 'endLng',
                width: 150,
            },
        },
    ];
}
