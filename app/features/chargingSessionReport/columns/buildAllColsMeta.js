import React from 'react';
import { Tooltip } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { formatDateTime } from '../utils';

const colHelp = {
    index: { vi: 'Số thứ tự của dòng trong bảng báo cáo.', en: 'Order number of the row in the report.' },
    imei: {
        vi: 'Mã thiết bị gắn trên xe. Hệ thống dùng mã này để xác định xe và biển số.',
        en: 'Device code installed on the vehicle. Used to identify the vehicle and license plate.',
    },
    license_plate: {
        vi: 'Biển số xe tương ứng với thiết bị. Có thể trống nếu hệ thống chưa liên kết.',
        en: 'Vehicle license plate linked to the device. May be empty if not yet linked.',
    },
    chargeCode: {
        vi: 'Mã nhận diện của phiên sạc. Mỗi lần sạc pin sẽ có một mã riêng.',
        en: 'Charging session ID. Each charging session has its own unique code.',
    },
    socStart: { vi: 'Phần trăm pin còn lại tại thời điểm bắt đầu sạc.', en: 'Battery % at start of charging.' },
    socEnd: { vi: 'Phần trăm pin tại thời điểm kết thúc sạc.', en: 'Battery % at end of charging.' },
    soh: { vi: 'Tình trạng sức khỏe của pin.', en: 'Battery health status.' },
    tempMax: { vi: 'Nhiệt độ pin cao nhất trong quá trình sạc.', en: 'Highest battery temperature.' },
    tempMin: { vi: 'Nhiệt độ pin thấp nhất trong quá trình sạc.', en: 'Lowest battery temperature.' },
    tempAvg: { vi: 'Nhiệt độ pin trung bình trong phiên sạc.', en: 'Average battery temperature.' },
    voltageMax: { vi: 'Điện áp cao nhất của pin trong quá trình sạc.', en: 'Highest voltage during charging.' },
    voltageMin: { vi: 'Điện áp thấp nhất của pin trong quá trình sạc.', en: 'Lowest voltage during charging.' },
    voltageAvg: { vi: 'Điện áp trung bình của pin trong phiên sạc.', en: 'Average voltage during charging.' },
    chargeLat: { vi: 'Vị trí sạc – vĩ độ.', en: 'Charging location latitude.' },
    chargeLng: { vi: 'Vị trí sạc – kinh độ.', en: 'Charging location longitude.' },
    startTime: { vi: 'Thời điểm bắt đầu sạc.', en: 'Charging start time.' },
    endTime: { vi: 'Thời điểm kết thúc sạc.', en: 'Charging end time.' },
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
                width: 80,
                fixed: 'left',
                render: (_, record) => record.__rowNo ?? '',
            },
        },
        {
            key: 'imei',
            label: 'IMEI',
            column: {
                title: <ColTitle label="IMEI" tip={colHelp.imei} isEn={isEn} isMobile={isMobile} />,
                dataIndex: 'imei',
                ellipsis: true,
                width: 150,
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
            key: 'chargeCode',
            label: t.table.chargeCode,
            column: {
                title: <ColTitle label={t.table.chargeCode} tip={colHelp.chargeCode} isEn={isEn} isMobile={isMobile} />,
                dataIndex: 'chargeCode',
                ellipsis: true,
                width: 260,
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
            key: 'socStart',
            label: t.table.socStart,
            column: {
                title: <ColTitle label={t.table.socStart} tip={colHelp.socStart} isEn={isEn} isMobile={isMobile} />,
                dataIndex: 'socStart',
                width: 120,
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
            key: 'tempMax',
            label: t.table.tempMax,
            column: {
                title: <ColTitle label={t.table.tempMax} tip={colHelp.tempMax} isEn={isEn} isMobile={isMobile} />,
                dataIndex: 'tempMax',
                width: 150,
            },
        },
        {
            key: 'tempMin',
            label: t.table.tempMin,
            column: {
                title: <ColTitle label={t.table.tempMin} tip={colHelp.tempMin} isEn={isEn} isMobile={isMobile} />,
                dataIndex: 'tempMin',
                width: 150,
            },
        },
        {
            key: 'tempAvg',
            label: t.table.tempAvg,
            column: {
                title: <ColTitle label={t.table.tempAvg} tip={colHelp.tempAvg} isEn={isEn} isMobile={isMobile} />,
                dataIndex: 'tempAvg',
                width: 165,
            },
        },
        {
            key: 'voltageMax',
            label: t.table.voltageMax,
            column: {
                title: <ColTitle label={t.table.voltageMax} tip={colHelp.voltageMax} isEn={isEn} isMobile={isMobile} />,
                dataIndex: 'voltageMax',
                width: 120,
            },
        },
        {
            key: 'voltageMin',
            label: t.table.voltageMin,
            column: {
                title: <ColTitle label={t.table.voltageMin} tip={colHelp.voltageMin} isEn={isEn} isMobile={isMobile} />,
                dataIndex: 'voltageMin',
                width: 120,
            },
        },
        {
            key: 'voltageAvg',
            label: t.table.voltageAvg,
            column: {
                title: <ColTitle label={t.table.voltageAvg} tip={colHelp.voltageAvg} isEn={isEn} isMobile={isMobile} />,
                dataIndex: 'voltageAvg',
                width: 160,
            },
        },
        {
            key: 'chargeLat',
            label: t.table.chargeLat,
            column: {
                title: <ColTitle label={t.table.chargeLat} tip={colHelp.chargeLat} isEn={isEn} isMobile={isMobile} />,
                dataIndex: 'chargeLat',
                width: 120,
            },
        },
        {
            key: 'chargeLng',
            label: t.table.chargeLng,
            column: {
                title: <ColTitle label={t.table.chargeLng} tip={colHelp.chargeLng} isEn={isEn} isMobile={isMobile} />,
                dataIndex: 'chargeLng',
                width: 120,
            },
        },
        {
            key: 'startTime',
            label: t.table.startTime,
            column: {
                title: <ColTitle label={t.table.startTime} tip={colHelp.startTime} isEn={isEn} isMobile={isMobile} />,
                dataIndex: 'startTime',
                ellipsis: true,
                width: 170,
                render: (_, r) => formatDateTime(r.start || r.startTime),
            },
        },
        {
            key: 'endTime',
            label: t.table.endTime,
            column: {
                title: <ColTitle label={t.table.endTime} tip={colHelp.endTime} isEn={isEn} isMobile={isMobile} />,
                dataIndex: 'endTime',
                ellipsis: true,
                width: 170,
                render: (_, r) => formatDateTime(r.end || r.endTime),
            },
        },
    ];
}
