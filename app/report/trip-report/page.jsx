// app/report/trip-report/page.jsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
    Card,
    Form,
    Input,
    Button,
    Row,
    Col,
    Table,
    DatePicker,
    Space,
    Typography,
    Select,
    message,
    Tooltip,
    Grid,
} from 'antd';
import { SearchOutlined, ReloadOutlined, DownloadOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { usePathname } from 'next/navigation';

import { getTripReport } from '../../lib/api/report';
import { getUserList } from '../../lib/api/user';

import vi from '../../locales/vi.json';
import en from '../../locales/en.json';
import * as XLSX from 'xlsx';

import '../usage-session/usageSession.css';

// ✅ helper
import { buildImeiToLicensePlateMap, attachLicensePlate } from '../../util/deviceMap';

const { RangePicker } = DatePicker;
const { useBreakpoint } = Grid;
const { Title, Text } = Typography;
const { Option } = Select;

const locales = { vi, en };

// ===== Helpers =====
const formatDateTime = (value, isEn = false) => {
    if (!value) return '--';
    const d = new Date(value);
    return d.toLocaleString(isEn ? 'en-US' : 'vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });
};

const formatStatus = (value, type, isEn) => {
    if (!value) return '--';
    if (isEn) return value;

    const v = String(value).toLowerCase();

    switch (type) {
        case 'connection': {
            if (v === 'online') return 'Online';
            if (v === 'offline') return 'Offline';
            return value;
        }
        case 'movement': {
            if (v === 'running') return 'Đang chạy';
            if (v === 'stop') return 'Dừng';
            return value;
        }
        case 'lock': {
            if (v === 'lock') return 'Khoá';
            if (v === 'unlock') return 'Mở khoá';
            return value;
        }
        default:
            return value;
    }
};

const TripReportPage = () => {
    const [form] = Form.useForm();
    const [distributorMap, setDistributorMap] = useState({});

    const [rawData, setRawData] = useState([]); // raw từ api, đã attach biển số
    const [data, setData] = useState([]);

    const [loading, setLoading] = useState(false);
    const [pagination, setPagination] = useState({
        current: 1,
        pageSize: 10,
    });

    // ✅ device maps
    const [imeiToPlate, setImeiToPlate] = useState(new Map());
    const [plateToImeis, setPlateToImeis] = useState(new Map());
    const [loadingDeviceMap, setLoadingDeviceMap] = useState(false);

    const pathname = usePathname() || '/';
    const [isEn, setIsEn] = useState(false);

    // detect /en ở cuối URL
    const isEnFromPath = useMemo(() => {
        const segments = pathname.split('/').filter(Boolean);
        const last = segments[segments.length - 1];
        return last === 'en';
    }, [pathname]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        if (isEnFromPath) {
            setIsEn(true);
            localStorage.setItem('iky_lang', 'en');
        } else {
            const saved = localStorage.getItem('iky_lang');
            setIsEn(saved === 'en');
        }
    }, [isEnFromPath]);

    const rawLocale = isEn ? locales.en : locales.vi;

    const defaultT = {
        title: 'Báo cáo chuyến (Trip report)',
        subtitle: 'Tổng quan số chuyến, quãng đường, trạng thái thiết bị theo ngày',
        filter: {
            title: 'Bộ lọc',
            imei: 'IMEI',
            imeiPlaceholder: 'Nhập IMEI',
            licensePlate: 'Biển số',
            licensePlatePlaceholder: 'Nhập biển số',
            motorcycleId: 'Mã xe (Motorcycle ID)',
            motorcycleIdPlaceholder: 'Nhập mã xe',
            connectionStatus: 'Trạng thái kết nối',
            connectionStatusPlaceholder: 'Chọn trạng thái',
            movementStatus: 'Trạng thái di chuyển',
            movementStatusPlaceholder: 'Chọn trạng thái',
            lockStatus: 'Trạng thái khoá',
            lockStatusPlaceholder: 'Chọn trạng thái',
            timeRange: 'Khoảng ngày',
            search: 'Tìm kiếm',
            reset: 'Làm mới',
        },
        table: {
            title: 'Danh sách trip report',
            total: 'Tổng: {total} bản ghi',
            index: 'STT',
            date: 'Ngày',
            imei: 'IMEI',
            licensePlate: 'Biển số',
            motorcycleId: 'Motorcycle ID',
            mileageToday: 'Quãng đường hôm nay (km)',
            numberOfTrips: 'Số chuyến',
            ridingHours: 'Giờ chạy (h)',
            speedMaxToday: 'Tốc độ tối đa hôm nay',
            batteryConsumedToday: 'Năng lượng pin tiêu thụ',
            wattageConsumedToday: 'Công suất tiêu thụ (kWh)',
            connectionStatus: 'Kết nối',
            movementStatus: 'Trạng thái di chuyển',
            lockStatus: 'Trạng thái khoá',
            realtime_lat: 'Lat realtime',
            realtime_lon: 'Lon realtime',
            distributor_id: 'Distributor',
            createdAt: 'Tạo lúc',
            updatedAt: 'Cập nhật DB',
            last_update: 'Cập nhật thiết bị',
            showTotal: 'Tổng {total} bản ghi',
        },
    };

    const t = rawLocale.tripReport || defaultT;

    const getAuthToken = () => {
        if (typeof window === 'undefined') return '';
        return localStorage.getItem('token') || localStorage.getItem('accessToken') || '';
    };

    const normalize = (s) =>
        String(s || '')
            .trim()
            .toLowerCase();

    // ===== Distributor helpers =====
    const getDistributorLabel = (id) => {
        if (!id) return '';
        return distributorMap[id] || id;
    };

    const fetchDistributors = async () => {
        try {
            const res = await getUserList({ position: 'distributor' });
            const items = res?.items || res?.data || [];

            const map = {};
            items.forEach((item) => {
                const label = (item.name && item.name.trim()) || item.email || item.username;
                map[item._id] = label;
            });

            setDistributorMap(map);
        } catch (err) {
            console.error('Lỗi lấy danh sách đại lý: ', err);
        }
    };

    // ✅ load device maps 1 lần
    useEffect(() => {
        const loadMaps = async () => {
            try {
                setLoadingDeviceMap(true);
                const token = getAuthToken();
                if (!token) {
                    setImeiToPlate(new Map());
                    setPlateToImeis(new Map());
                    return;
                }

                const { imeiToPlate, plateToImeis } = await buildImeiToLicensePlateMap(token);
                setImeiToPlate(imeiToPlate);
                setPlateToImeis(plateToImeis);
            } catch (e) {
                console.error('Load device map failed:', e);
                setImeiToPlate(new Map());
                setPlateToImeis(new Map());
            } finally {
                setLoadingDeviceMap(false);
            }
        };

        loadMaps();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ===== FETCH trip report (1 lần) =====
    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await getTripReport({});
            const list = res?.data || res?.items || [];

            // ✅ attach biển số
            const enriched = attachLicensePlate(list, imeiToPlate);

            setRawData(enriched);
            setData(enriched);
            setPagination((prev) => ({
                ...prev,
                current: 1,
            }));
        } catch (err) {
            console.error('Lỗi lấy trip report: ', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDistributors();
    }, []);

    // ✅ fetch lại khi imeiToPlate sẵn sàng (để attach biển số đúng)
    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [imeiToPlate]);

    // ===== FILTER FE =====
    const applyFilter = () => {
        const values = form.getFieldsValue();
        const { imei, license_plate, motorcycleId, connectionStatus, movementStatus, lockStatus, timeRange } = values;

        let filtered = [...rawData];

        if (license_plate) {
            const key = normalize(license_plate);
            filtered = filtered.filter((item) => normalize(item.license_plate).includes(key));
        }

        if (imei) {
            const key = normalize(imei);
            filtered = filtered.filter((item) => normalize(item.imei).includes(key));
        }

        if (motorcycleId) {
            const key = normalize(motorcycleId);
            filtered = filtered.filter((item) => normalize(item.Motorcycle_id).includes(key));
        }

        if (connectionStatus) {
            filtered = filtered.filter((item) => item.connectionStatus === connectionStatus);
        }

        if (movementStatus) {
            filtered = filtered.filter((item) => item.movementStatus === movementStatus);
        }

        if (lockStatus) {
            filtered = filtered.filter((item) => item.lockStatus === lockStatus);
        }

        if (timeRange && timeRange.length === 2) {
            const start = timeRange[0].startOf('day');
            const end = timeRange[1].endOf('day');

            filtered = filtered.filter((item) => {
                if (!item.date) return false;
                const d = new Date(item.date).getTime();
                return d >= start.valueOf() && d <= end.valueOf();
            });
        }

        setData(filtered);
        setPagination((prev) => ({
            ...prev,
            current: 1,
        }));
    };

    const onFinish = () => applyFilter();

    const onReset = () => {
        form.resetFields();
        setData(rawData);
        setPagination((prev) => ({
            ...prev,
            current: 1,
        }));
    };

    const handleTableChange = (pager) => {
        setPagination({
            current: pager.current,
            pageSize: pager.pageSize,
        });
    };

    // ===== EXPORT EXCEL =====
    const handleExportExcel = () => {
        if (!data || data.length === 0) {
            message.warning(isEn ? 'No data to export' : 'Không có dữ liệu để xuất');
            return;
        }

        const rows = data.map((item, index) => ({
            [t.table.index]: index + 1,
            [t.table.date]: formatDateTime(item.date, isEn),
            [t.table.imei]: item.imei || '',
            [t.table.licensePlate]: item.license_plate || '',
            [t.table.motorcycleId]: item.Motorcycle_id ?? '',

            [t.table.mileageToday]: item.mileageToday ?? '',
            [t.table.numberOfTrips]: item.numberOfTrips ?? '',
            [t.table.ridingHours]: item.ridingHours ?? '',
            [t.table.speedMaxToday]: item.speedMaxToday ?? '',

            [t.table.batteryConsumedToday]: item.batteryConsumedToday ?? '',
            [t.table.wattageConsumedToday]: item.wattageConsumedToday ?? '',

            [t.table.connectionStatus]: formatStatus(item.connectionStatus, 'connection', isEn),
            [t.table.movementStatus]: formatStatus(item.movementStatus, 'movement', isEn),
            [t.table.lockStatus]: formatStatus(item.lockStatus, 'lock', isEn),

            [t.table.realtime_lat]: item.realtime_lat ?? '',
            [t.table.realtime_lon]: item.realtime_lon ?? '',

            [t.table.distributor_id]: getDistributorLabel(item.distributor_id),
            [t.table.createdAt]: formatDateTime(item.createdAt, isEn),
            [t.table.last_update]: formatDateTime(item.last_update, isEn),
        }));

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'TripReport');

        const fileName = isEn ? 'trip_report.xlsx' : 'bao_cao_chuyen.xlsx';
        XLSX.writeFile(wb, fileName);
    };

    const customLocale = {
        emptyText: isEn ? 'No data' : 'Không tìm thấy dữ liệu ',
    };

    const screens = useBreakpoint();
    const isMobile = !screens.lg;

    // ✅ Tooltip giải thích cho người dùng (dễ hiểu)
    const colHelp = {
        index: {
            vi: 'Số thứ tự của dòng trong bảng.',
            en: 'Order number of the row.',
        },

        date: {
            vi: 'Ngày ghi nhận dữ liệu tổng hợp của xe.',
            en: 'Date of the daily summary record.',
        },

        imei: {
            vi: 'Mã thiết bị gắn trên xe. Hệ thống dùng mã này để nhận diện xe.',
            en: 'Device code installed on the vehicle (used to identify the vehicle).',
        },

        licensePlate: {
            vi: 'Biển số xe. Có thể trống nếu hệ thống chưa liên kết được biển số.',
            en: 'License plate. May be empty if not linked yet.',
        },

        motorcycleId: {
            vi: 'Mã xe trong hệ thống (định danh xe nội bộ).',
            en: 'Motorcycle ID in the system (internal identifier).',
        },

        mileageToday: {
            vi: 'Quãng đường xe chạy trong ngày này (km). Đây là số km trong ngày',
            en: 'Distance traveled on this day (km). This is the distance for the day',
        },

        numberOfTrips: {
            vi: 'Tổng số chuyến xe chạy trong ngày.',
            en: 'Total number of trips in the day.',
        },

        ridingHours: {
            vi: 'Tổng thời gian xe chạy trong ngày (giờ).',
            en: 'Total riding time in the day (hours).',
        },

        speedMaxToday: {
            vi: 'Tốc độ cao nhất ghi nhận trong ngày.',
            en: 'Highest speed recorded today.',
        },

        batteryConsumedToday: {
            vi: 'Lượng pin tiêu hao trong ngày (thường tính theo %).',
            en: 'Battery consumed today (usually in %).',
        },

        wattageConsumedToday: {
            vi: 'Lượng điện tiêu thụ trong ngày (kWh).',
            en: 'Energy consumed today (kWh).',
        },

        connectionStatus: {
            vi: 'Trạng thái kết nối: xe đang kết nối (Online) hay mất kết nối (Offline).',
            en: 'Connection status: Online (connected) or Offline (disconnected).',
        },

        movementStatus: {
            vi: 'Trạng thái di chuyển: xe đang chạy hay đang dừng.',
            en: 'Movement status: running or stopped.',
        },

        lockStatus: {
            vi: 'Trạng thái khóa xe: đang khóa hay đang mở khóa.',
            en: 'Lock status: locked or unlocked.',
        },

        realtime_lat: {
            vi: 'Vĩ độ vị trí gần nhất của xe (tọa độ bản đồ).',
            en: 'Latest latitude location (map coordinate).',
        },

        realtime_lon: {
            vi: 'Kinh độ vị trí gần nhất của xe (tọa độ bản đồ).',
            en: 'Latest longitude location (map coordinate).',
        },

        distributor_id: {
            vi: 'Đại lý/đơn vị quản lý xe (theo tài khoản được gán).',
            en: 'Distributor / managing unit assigned to the vehicle.',
        },

        createdAt: {
            vi: 'Thời điểm bản ghi được tạo trên hệ thống.',
            en: 'Time when this record was created in the system.',
        },

        last_update: {
            vi: 'Thời điểm thiết bị gửi dữ liệu gần nhất.',
            en: 'Last time the device sent data.',
        },
    };

    // ✅ Tiêu đề cột có dấu “?” để xem giải thích
    const ColTitle = ({ label, tip }) => (
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

    // ===== COLUMNS =====
    const columns = [
        {
            title: <ColTitle label={t.table.index} tip={isEn ? colHelp.index.en : colHelp.index.vi} />,
            dataIndex: 'index',
            width: 70,
            fixed: 'left',
            render: (_, __, index) => (pagination.current - 1) * pagination.pageSize + index + 1,
        },
        {
            title: <ColTitle label={t.table.date} tip={isEn ? colHelp.date.en : colHelp.date.vi} />,
            dataIndex: 'date',
            width: 160,
            render: (value) => formatDateTime(value, isEn),
        },
        {
            title: <ColTitle label={t.table.imei} tip={isEn ? colHelp.imei.en : colHelp.imei.vi} />,
            dataIndex: 'imei',
            width: 150,
            ellipsis: true,
        },

        {
            title: (
                <ColTitle
                    label={isEn ? 'License plate' : 'Biển số'}
                    tip={isEn ? colHelp.licensePlate.en : colHelp.licensePlate.vi}
                />
            ),
            dataIndex: 'license_plate',
            width: 140,
            ellipsis: true,
        },

        {
            title: (
                <ColTitle label={t.table.motorcycleId} tip={isEn ? colHelp.motorcycleId.en : colHelp.motorcycleId.vi} />
            ),
            dataIndex: 'Motorcycle_id',
            width: 150,
            ellipsis: true,
        },

        // ✅ đổi label sang ODO
        {
            title: (
                <ColTitle label={t.table.mileageToday} tip={isEn ? colHelp.mileageToday.en : colHelp.mileageToday.vi} />
            ),
            dataIndex: 'mileageToday',
            width: 220,
        },

        {
            title: (
                <ColTitle
                    label={t.table.numberOfTrips}
                    tip={isEn ? colHelp.numberOfTrips.en : colHelp.numberOfTrips.vi}
                />
            ),
            dataIndex: 'numberOfTrips',
            width: 130,
        },
        {
            title: (
                <ColTitle label={t.table.ridingHours} tip={isEn ? colHelp.ridingHours.en : colHelp.ridingHours.vi} />
            ),
            dataIndex: 'ridingHours',
            width: 130,
        },
        {
            title: (
                <ColTitle
                    label={t.table.speedMaxToday}
                    tip={isEn ? colHelp.speedMaxToday.en : colHelp.speedMaxToday.vi}
                />
            ),
            dataIndex: 'speedMaxToday',
            width: 180,
        },

        {
            title: (
                <ColTitle
                    label={t.table.batteryConsumedToday}
                    tip={isEn ? colHelp.batteryConsumedToday.en : colHelp.batteryConsumedToday.vi}
                />
            ),
            dataIndex: 'batteryConsumedToday',
            width: 250,
        },
        {
            title: (
                <ColTitle
                    label={t.table.wattageConsumedToday}
                    tip={isEn ? colHelp.wattageConsumedToday.en : colHelp.wattageConsumedToday.vi}
                />
            ),
            dataIndex: 'wattageConsumedToday',
            width: 260,
        },

        {
            title: (
                <ColTitle
                    label={t.table.connectionStatus}
                    tip={isEn ? colHelp.connectionStatus.en : colHelp.connectionStatus.vi}
                />
            ),
            dataIndex: 'connectionStatus',
            width: 100,
            render: (value) => formatStatus(value, 'connection', isEn),
        },
        {
            title: (
                <ColTitle
                    label={t.table.movementStatus}
                    tip={isEn ? colHelp.movementStatus.en : colHelp.movementStatus.vi}
                />
            ),
            dataIndex: 'movementStatus',
            width: 170,
            render: (value) => formatStatus(value, 'movement', isEn),
        },
        {
            title: <ColTitle label={t.table.lockStatus} tip={isEn ? colHelp.lockStatus.en : colHelp.lockStatus.vi} />,
            dataIndex: 'lockStatus',
            width: 140,
            render: (value) => formatStatus(value, 'lock', isEn),
        },

        {
            title: (
                <ColTitle label={t.table.realtime_lat} tip={isEn ? colHelp.realtime_lat.en : colHelp.realtime_lat.vi} />
            ),
            dataIndex: 'realtime_lat',
            width: 150,
        },
        {
            title: (
                <ColTitle label={t.table.realtime_lon} tip={isEn ? colHelp.realtime_lon.en : colHelp.realtime_lon.vi} />
            ),
            dataIndex: 'realtime_lon',
            width: 150,
        },

        {
            title: (
                <ColTitle
                    label={t.table.distributor_id}
                    tip={isEn ? colHelp.distributor_id.en : colHelp.distributor_id.vi}
                />
            ),
            dataIndex: 'distributor_id',
            width: 200,
            render: (value) => getDistributorLabel(value),
        },
        {
            title: <ColTitle label={t.table.createdAt} tip={isEn ? colHelp.createdAt.en : colHelp.createdAt.vi} />,
            dataIndex: 'createdAt',
            width: 180,
            render: (v) => formatDateTime(v, isEn),
        },
        {
            title: (
                <ColTitle label={t.table.last_update} tip={isEn ? colHelp.last_update.en : colHelp.last_update.vi} />
            ),
            dataIndex: 'last_update',
            width: 180,
            render: (v) => formatDateTime(v, isEn),
        },
    ];

    const totalRecords = data.length;

    return (
        <div className="usage-report-page">
            <div className="usage-report-header">
                <Title level={4} style={{ margin: 0 }}>
                    {t.title}
                </Title>
                <Text type="secondary">{t.subtitle}</Text>
            </div>

            <Row gutter={[16, 16]} className="usage-report-row">
                {/* FILTER */}
                <Col xs={24} lg={7}>
                    <Card className="usage-filter-card" title={t.filter.title} size="small">
                        <Form form={form} layout="vertical" onFinish={onFinish}>
                            {/* ✅ thêm biển số */}
                            <Form.Item label={t.filter.licensePlate} name="license_plate">
                                <Input placeholder={t.filter.licensePlatePlaceholder} allowClear />
                            </Form.Item>

                            <Form.Item label={t.filter.imei} name="imei">
                                <Input placeholder={t.filter.imeiPlaceholder} allowClear />
                            </Form.Item>

                            <Form.Item label={t.filter.motorcycleId} name="motorcycleId">
                                <Input placeholder={t.filter.motorcycleIdPlaceholder} allowClear />
                            </Form.Item>

                            <Form.Item label={t.filter.connectionStatus} name="connectionStatus">
                                <Select allowClear placeholder={t.filter.connectionStatusPlaceholder}>
                                    <Option value="online">Online</Option>
                                    <Option value="offline">Offline</Option>
                                </Select>
                            </Form.Item>

                            <Form.Item label={t.filter.movementStatus} name="movementStatus">
                                <Select allowClear placeholder={t.filter.movementStatusPlaceholder}>
                                    <Option value="RUNNING">RUNNING</Option>
                                    <Option value="STOP">STOP</Option>
                                </Select>
                            </Form.Item>

                            <Form.Item label={t.filter.lockStatus} name="lockStatus">
                                <Select allowClear placeholder={t.filter.lockStatusPlaceholder}>
                                    <Option value="LOCK">LOCK</Option>
                                    <Option value="UNLOCK">UNLOCK</Option>
                                </Select>
                            </Form.Item>

                            <Form.Item label={t.filter.timeRange} name="timeRange">
                                <RangePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
                            </Form.Item>

                            <Form.Item>
                                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                    <Button
                                        type="primary"
                                        htmlType="submit"
                                        icon={<SearchOutlined />}
                                        loading={loading}
                                    >
                                        {t.filter.search}
                                    </Button>
                                    <Button icon={<ReloadOutlined />} onClick={onReset} disabled={loading}>
                                        {t.filter.reset}
                                    </Button>
                                </Space>
                            </Form.Item>

                            {/* <Text type="secondary" style={{ fontSize: 12 }}>
                                {loadingDeviceMap
                                    ? isEn
                                        ? 'Loading devices…'
                                        : 'Đang tải danh sách xe…'
                                    : isEn
                                    ? 'Devices loaded'
                                    : 'Đã tải danh sách xe'}
                            </Text> */}
                        </Form>
                    </Card>
                </Col>

                {/* TABLE */}
                <Col xs={24} lg={17}>
                    <Card
                        className="usage-table-card"
                        size="small"
                        title={t.table.title}
                        extra={
                            <Space size="middle">
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                    {t.table.total.replace('{total}', String(totalRecords))}
                                </Text>
                                <Button size="small" icon={<DownloadOutlined />} onClick={handleExportExcel}>
                                    {isEn ? 'Export Excel' : 'Xuất Excel'}
                                </Button>
                            </Space>
                        }
                    >
                        <Table
                            rowKey={(record) => record._id || `${record.imei}-${record.date}`}
                            columns={columns}
                            locale={customLocale}
                            dataSource={data}
                            loading={loading}
                            pagination={{
                                current: pagination.current,
                                pageSize: pagination.pageSize,
                                total: totalRecords,
                                showSizeChanger: true,
                                pageSizeOptions: ['10', '20', '50', '100'],
                                showTotal: (total) => t.table.showTotal.replace('{total}', String(total)),
                            }}
                            onChange={handleTableChange}
                            scroll={{ x: 2350, y: 600 }}
                        />
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default TripReportPage;
