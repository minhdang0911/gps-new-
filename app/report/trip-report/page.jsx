// app/report/trip-report/page.jsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card, Form, Input, Button, Row, Col, Table, DatePicker, Space, Typography, Select, message } from 'antd';
import { SearchOutlined, ReloadOutlined, DownloadOutlined } from '@ant-design/icons';
import { usePathname } from 'next/navigation';

import { getTripReport } from '../../lib/api/report'; // TODO: tự implement giống getBatteryReport
import { getUserList } from '../../lib/api/user';

import vi from '../../locales/vi.json';
import en from '../../locales/en.json';
import * as XLSX from 'xlsx';

import '../usage-session/usageSession.css';

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;
const { Option } = Select;

const locales = { vi, en };

// ===== Helpers =====
const formatDateTime = (value) => {
    if (!value) return '--';
    const d = new Date(value);
    return d.toLocaleString('vi-VN', {
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
    if (isEn) return value; // EN: giữ nguyên

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
    const [rawData, setRawData] = useState([]);
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [pagination, setPagination] = useState({
        current: 1,
        pageSize: 10,
    });

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

    // locale
    const rawLocale = isEn ? locales.en : locales.vi;
    const defaultT = {
        title: 'Báo cáo chuyến (Trip report)',
        subtitle: 'Tổng quan số chuyến, quãng đường, trạng thái thiết bị theo ngày',
        filter: {
            title: 'Bộ lọc',
            imei: 'IMEI',
            imeiPlaceholder: 'Nhập IMEI',
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

    // ===== FETCH trip report (1 lần) =====
    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await getTripReport({}); // backend {{url}}trip-report
            const list = res?.data || res?.items || [];

            setRawData(list);
            setData(list);
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
        fetchData();
        fetchDistributors();
    }, []);

    // ===== FILTER FE =====
    const applyFilter = () => {
        const values = form.getFieldsValue();
        const { imei, motorcycleId, connectionStatus, movementStatus, lockStatus, timeRange } = values;

        let filtered = [...rawData];

        if (imei) {
            const key = imei.trim().toLowerCase();
            filtered = filtered.filter((item) => (item.imei || '').toLowerCase().includes(key));
        }

        if (motorcycleId) {
            const key = motorcycleId.trim().toLowerCase();
            filtered = filtered.filter((item) => (item.Motorcycle_id || '').toString().toLowerCase().includes(key));
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
            [t.table.date]: formatDateTime(item.date),
            [t.table.imei]: item.imei || '',
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
            [t.table.createdAt]: formatDateTime(item.createdAt),
            [t.table.last_update]: formatDateTime(item.last_update),
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

    // ===== COLUMNS =====
    const columns = [
        {
            title: t.table.index,
            dataIndex: 'index',
            width: 60,
            fixed: 'left',
            render: (text, record, index) => (pagination.current - 1) * pagination.pageSize + index + 1,
        },
        {
            title: t.table.date,
            dataIndex: 'date',
            width: 160,
            render: (value) => formatDateTime(value),
        },
        { title: t.table.imei, dataIndex: 'imei', width: 150, ellipsis: true },
        {
            title: t.table.motorcycleId,
            dataIndex: 'Motorcycle_id',
            width: 150,
            ellipsis: true,
        },

        { title: t.table.mileageToday, dataIndex: 'mileageToday', width: 150 },
        { title: t.table.numberOfTrips, dataIndex: 'numberOfTrips', width: 130 },
        { title: t.table.ridingHours, dataIndex: 'ridingHours', width: 130 },
        { title: t.table.speedMaxToday, dataIndex: 'speedMaxToday', width: 150 },

        { title: t.table.batteryConsumedToday, dataIndex: 'batteryConsumedToday', width: 180 },
        { title: t.table.wattageConsumedToday, dataIndex: 'wattageConsumedToday', width: 200 },

        {
            title: t.table.connectionStatus,
            dataIndex: 'connectionStatus',
            width: 130,
            render: (value) => formatStatus(value, 'connection', isEn),
        },
        {
            title: t.table.movementStatus,
            dataIndex: 'movementStatus',
            width: 150,
            render: (value) => formatStatus(value, 'movement', isEn),
        },
        {
            title: t.table.lockStatus,
            dataIndex: 'lockStatus',
            width: 140,
            render: (value) => formatStatus(value, 'lock', isEn),
        },

        { title: t.table.realtime_lat, dataIndex: 'realtime_lat', width: 150 },
        { title: t.table.realtime_lon, dataIndex: 'realtime_lon', width: 150 },

        {
            title: t.table.distributor_id,
            dataIndex: 'distributor_id',
            width: 200,
            render: (value) => getDistributorLabel(value),
        },
        { title: t.table.createdAt, dataIndex: 'createdAt', width: 180, render: (v) => formatDateTime(v) },
        // { title: t.table.updatedAt, dataIndex: 'updatedAt', width: 180, render: (v) => formatDateTime(v) },
        { title: t.table.last_update, dataIndex: 'last_update', width: 180, render: (v) => formatDateTime(v) },
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
                                <Space
                                    style={{
                                        width: '100%',
                                        justifyContent: 'space-between',
                                    }}
                                >
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
                            scroll={{ x: 2200 }}
                        />
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default TripReportPage;
