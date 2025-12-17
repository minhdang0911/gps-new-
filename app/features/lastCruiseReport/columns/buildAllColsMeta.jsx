import React from 'react';
import { Tooltip } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { formatDateTimeFactory, parseTimToDate } from '../utils';

export function buildAllColsMeta({ t, isEn, isMobile }) {
    const formatDateTime = formatDateTimeFactory(isEn);

    const formatGps = (gps) => {
        const lost = Number(gps) === 1;
        return lost ? t.table.gpsLost : t.table.gpsNormal;
    };

    const formatSos = (sos) => {
        const on = Number(sos) === 1;
        return on ? t.table.sosOn : t.table.sosOff;
    };

    const formatAcc = (acc) => {
        const locked = Number(acc) === 1;
        if (isEn) return locked ? 'Vehicle locked' : 'Vehicle unlocked';
        return locked ? 'Khóa xe tắt' : 'Khóa xe mở';
    };

    const colHelp = {
        index: { vi: 'Số thứ tự của dòng trong bảng.', en: 'Order number of the row.' },
        dev: { vi: 'Mã thiết bị trên xe.', en: 'Device ID.' },
        license_plate: { vi: 'Biển số xe tương ứng với thiết bị.', en: 'License plate linked to device.' },
        fwr: { vi: 'Phiên bản firmware của thiết bị.', en: 'Firmware version.' },
        lat: { vi: 'Vĩ độ vị trí gần nhất.', en: 'Latest latitude.' },
        lon: { vi: 'Kinh độ vị trí gần nhất.', en: 'Latest longitude.' },
        sat: { vi: 'Số vệ tinh GPS bắt được.', en: 'GPS satellites count.' },
        gps: { vi: 'Trạng thái GPS.', en: 'GPS status.' },
        sos: { vi: 'Trạng thái SOS.', en: 'SOS status.' },
        acc: { vi: 'Trạng thái khóa/nguồn xe.', en: 'Vehicle lock/ignition status.' },
        vgp: { vi: 'Tốc độ ghi nhận (nếu có).', en: 'Recorded speed (if any).' },
        createdAt: { vi: 'Thời điểm dữ liệu được lưu lên hệ thống.', en: 'Saved time in system.' },
    };

    const ColTitle = ({ label, tip }) => {
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

    return [
        {
            key: 'index',
            label: t.table.index,
            column: {
                title: <ColTitle label={t.table.index} tip={colHelp.index} />,
                dataIndex: '__rowNo',
                width: 60,
                fixed: 'left',
                render: (_, record) => record.__rowNo ?? '',
            },
        },
        {
            key: 'dev',
            label: t.table.dev,
            column: {
                title: <ColTitle label={t.table.dev} tip={colHelp.dev} />,
                dataIndex: 'dev',
                width: 160,
                ellipsis: true,
            },
        },
        {
            key: 'license_plate',
            label: isEn ? 'License plate' : 'Biển số',
            column: {
                title: <ColTitle label={isEn ? 'License plate' : 'Biển số'} tip={colHelp.license_plate} />,
                dataIndex: 'license_plate',
                width: 140,
                ellipsis: true,
            },
        },
        {
            key: 'fwr',
            label: t.table.fwr,
            column: {
                title: <ColTitle label={t.table.fwr} tip={colHelp.fwr} />,
                dataIndex: 'fwr',
                width: 140,
                ellipsis: true,
            },
        },
        {
            key: 'tim',
            label: t.table.tim,
            column: {
                title: (
                    <ColTitle
                        label={t.table.tim}
                        tip={isEn ? 'Device time (YYMMDDhhmmss)' : 'Thời gian thiết bị (YYMMDDhhmmss)'}
                    />
                ),
                dataIndex: 'tim',
                width: 180,
                render: (v) => {
                    const d = parseTimToDate(v);
                    return d ? formatDateTime(d) : v || '--';
                },
            },
        },
        {
            key: 'lat',
            label: t.table.lat,
            column: {
                title: <ColTitle label={t.table.lat} tip={colHelp.lat} />,
                dataIndex: 'lat',
                width: 130,
            },
        },
        {
            key: 'lon',
            label: t.table.lon,
            column: {
                title: <ColTitle label={t.table.lon} tip={colHelp.lon} />,
                dataIndex: 'lon',
                width: 130,
            },
        },
        {
            key: 'sat',
            label: t.table.sat,
            column: {
                title: <ColTitle label={t.table.sat} tip={colHelp.sat} />,
                dataIndex: 'sat',
                width: 100,
            },
        },
        {
            key: 'gps',
            label: t.table.gps,
            column: {
                title: <ColTitle label={t.table.gps} tip={colHelp.gps} />,
                dataIndex: 'gps',
                width: 140,
                render: (v) => formatGps(v),
            },
        },
        {
            key: 'sos',
            label: t.table.sos,
            column: {
                title: <ColTitle label={t.table.sos} tip={colHelp.sos} />,
                dataIndex: 'sos',
                width: 140,
                render: (v) => formatSos(v),
            },
        },
        {
            key: 'acc',
            label: t.table.acc,
            column: {
                title: <ColTitle label={t.table.acc} tip={colHelp.acc} />,
                dataIndex: 'acc',
                width: 120,
                render: (v) => formatAcc(v),
            },
        },
        {
            key: 'vgp',
            label: t.table.vgp,
            column: {
                title: <ColTitle label={t.table.vgp} tip={colHelp.vgp} />,
                dataIndex: 'vgp',
                width: 160,
            },
        },
        {
            key: 'createdAt',
            label: t.table.createdAt,
            column: {
                title: <ColTitle label={t.table.createdAt} tip={colHelp.createdAt} />,
                dataIndex: 'createdAt',
                width: 180,
                render: (v) => formatDateTime(v),
            },
        },
    ];
}
