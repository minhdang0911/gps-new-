import React from 'react';
import { Tooltip } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { formatDateTime, formatStatus } from '../utils';

const colHelp = {
    index: { vi: 'Số thứ tự của dòng trong bảng.', en: 'Order number of the row.' },
    date: { vi: 'Ngày ghi nhận dữ liệu tổng hợp của xe.', en: 'Date of the daily summary record.' },
    imei: { vi: 'Mã thiết bị gắn trên xe.', en: 'Device code installed on the vehicle.' },
    licensePlate: { vi: 'Biển số xe (có thể trống nếu chưa liên kết).', en: 'License plate (may be empty).' },
    motorcycleId: { vi: 'Mã xe trong hệ thống.', en: 'Motorcycle ID in the system.' },
    mileageToday: { vi: 'Quãng đường xe chạy trong ngày (km).', en: 'Distance traveled today (km).' },
    numberOfTrips: { vi: 'Tổng số chuyến trong ngày.', en: 'Total number of trips today.' },
    ridingHours: { vi: 'Tổng thời gian chạy (giờ).', en: 'Total riding time (hours).' },
    speedMaxToday: { vi: 'Tốc độ cao nhất trong ngày.', en: 'Highest speed recorded today.' },
    batteryConsumedToday: { vi: 'Pin tiêu hao trong ngày.', en: 'Battery consumed today.' },
    wattageConsumedToday: { vi: 'Điện tiêu thụ trong ngày (kWh).', en: 'Energy consumed today (kWh).' },
    connectionStatus: { vi: 'Online/Offline.', en: 'Online/Offline.' },
    movementStatus: { vi: 'Đang chạy hay dừng.', en: 'Running or stopped.' },
    lockStatus: { vi: 'Khoá/Mở khoá.', en: 'Locked/Unlocked.' },
    realtime_lat: { vi: 'Vĩ độ vị trí gần nhất.', en: 'Latest latitude.' },
    realtime_lon: { vi: 'Kinh độ vị trí gần nhất.', en: 'Latest longitude.' },
    distributor_id: { vi: 'Đại lý/đơn vị quản lý xe.', en: 'Distributor / managing unit.' },
    createdAt: { vi: 'Thời điểm bản ghi được tạo.', en: 'Record created time.' },
    last_update: { vi: 'Thiết bị gửi dữ liệu gần nhất.', en: 'Last device update time.' },
};

const ColTitle = ({ label, tip, isMobile }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
        <span>{label}</span>
        <Tooltip
            title={tip}
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

export function buildAllColsMeta({ t, isEn, isMobile, distributorMap, getDistributorLabel }) {
    const tip = (k) => (isEn ? colHelp[k]?.en : colHelp[k]?.vi);

    return [
        {
            key: 'index',
            label: t.table.index,
            column: {
                title: <ColTitle label={t.table.index} tip={tip('index')} isMobile={isMobile} />,
                dataIndex: '__rowNo',
                width: 70,
                fixed: 'left',
                render: (_, r) => r.__rowNo ?? '',
            },
        },
        {
            key: 'date',
            label: t.table.date,
            column: {
                title: <ColTitle label={t.table.date} tip={tip('date')} isMobile={isMobile} />,
                dataIndex: 'date',
                width: 160,
                render: (v) => formatDateTime(v, isEn),
            },
        },
        {
            key: 'imei',
            label: t.table.imei,
            column: {
                title: <ColTitle label={t.table.imei} tip={tip('imei')} isMobile={isMobile} />,
                dataIndex: 'imei',
                width: 150,
                ellipsis: true,
            },
        },
        {
            key: 'licensePlate',
            label: isEn ? 'License plate' : 'Biển số',
            column: {
                title: (
                    <ColTitle
                        label={isEn ? 'License plate' : 'Biển số'}
                        tip={tip('licensePlate')}
                        isMobile={isMobile}
                    />
                ),
                dataIndex: 'license_plate',
                width: 140,
                ellipsis: true,
            },
        },
        {
            key: 'motorcycleId',
            label: t.table.motorcycleId,
            column: {
                title: <ColTitle label={t.table.motorcycleId} tip={tip('motorcycleId')} isMobile={isMobile} />,
                dataIndex: 'Motorcycle_id',
                width: 150,
                ellipsis: true,
            },
        },
        {
            key: 'mileageToday',
            label: t.table.mileageToday,
            column: {
                title: <ColTitle label={t.table.mileageToday} tip={tip('mileageToday')} isMobile={isMobile} />,
                dataIndex: 'mileageToday',
                width: 220,
            },
        },
        {
            key: 'numberOfTrips',
            label: t.table.numberOfTrips,
            column: {
                title: <ColTitle label={t.table.numberOfTrips} tip={tip('numberOfTrips')} isMobile={isMobile} />,
                dataIndex: 'numberOfTrips',
                width: 130,
            },
        },
        {
            key: 'ridingHours',
            label: t.table.ridingHours,
            column: {
                title: <ColTitle label={t.table.ridingHours} tip={tip('ridingHours')} isMobile={isMobile} />,
                dataIndex: 'ridingHours',
                width: 130,
            },
        },
        {
            key: 'speedMaxToday',
            label: t.table.speedMaxToday,
            column: {
                title: <ColTitle label={t.table.speedMaxToday} tip={tip('speedMaxToday')} isMobile={isMobile} />,
                dataIndex: 'speedMaxToday',
                width: 180,
            },
        },
        {
            key: 'batteryConsumedToday',
            label: t.table.batteryConsumedToday,
            column: {
                title: (
                    <ColTitle
                        label={t.table.batteryConsumedToday}
                        tip={tip('batteryConsumedToday')}
                        isMobile={isMobile}
                    />
                ),
                dataIndex: 'batteryConsumedToday',
                width: 250,
            },
        },
        {
            key: 'wattageConsumedToday',
            label: t.table.wattageConsumedToday,
            column: {
                title: (
                    <ColTitle
                        label={t.table.wattageConsumedToday}
                        tip={tip('wattageConsumedToday')}
                        isMobile={isMobile}
                    />
                ),
                dataIndex: 'wattageConsumedToday',
                width: 260,
            },
        },
        {
            key: 'connectionStatus',
            label: t.table.connectionStatus,
            column: {
                title: <ColTitle label={t.table.connectionStatus} tip={tip('connectionStatus')} isMobile={isMobile} />,
                dataIndex: 'connectionStatus',
                width: 110,
                render: (v) => formatStatus(v, 'connection', isEn),
            },
        },
        {
            key: 'movementStatus',
            label: t.table.movementStatus,
            column: {
                title: <ColTitle label={t.table.movementStatus} tip={tip('movementStatus')} isMobile={isMobile} />,
                dataIndex: 'movementStatus',
                width: 170,
                render: (v) => formatStatus(v, 'movement', isEn),
            },
        },
        {
            key: 'lockStatus',
            label: t.table.lockStatus,
            column: {
                title: <ColTitle label={t.table.lockStatus} tip={tip('lockStatus')} isMobile={isMobile} />,
                dataIndex: 'lockStatus',
                width: 140,
                render: (v) => formatStatus(v, 'lock', isEn),
            },
        },
        {
            key: 'realtime_lat',
            label: t.table.realtime_lat,
            column: {
                title: <ColTitle label={t.table.realtime_lat} tip={tip('realtime_lat')} isMobile={isMobile} />,
                dataIndex: 'realtime_lat',
                width: 150,
            },
        },
        {
            key: 'realtime_lon',
            label: t.table.realtime_lon,
            column: {
                title: <ColTitle label={t.table.realtime_lon} tip={tip('realtime_lon')} isMobile={isMobile} />,
                dataIndex: 'realtime_lon',
                width: 150,
            },
        },
        {
            key: 'distributor_id',
            label: t.table.distributor_id,
            column: {
                title: <ColTitle label={t.table.distributor_id} tip={tip('distributor_id')} isMobile={isMobile} />,
                dataIndex: 'distributor_id',
                width: 200,
                render: (v) => getDistributorLabel(v),
            },
        },
        {
            key: 'createdAt',
            label: t.table.createdAt,
            column: {
                title: <ColTitle label={t.table.createdAt} tip={tip('createdAt')} isMobile={isMobile} />,
                dataIndex: 'createdAt',
                width: 180,
                render: (v) => formatDateTime(v, isEn),
            },
        },
        {
            key: 'last_update',
            label: t.table.last_update,
            column: {
                title: <ColTitle label={t.table.last_update} tip={tip('last_update')} isMobile={isMobile} />,
                dataIndex: 'last_update',
                width: 180,
                render: (v) => formatDateTime(v, isEn),
            },
        },
    ];
}
