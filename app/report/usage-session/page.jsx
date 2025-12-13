'use client';

import React, { useEffect, useState, useMemo } from 'react';
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
    message,
    Tooltip,
    Grid,
} from 'antd';
import { SearchOutlined, ReloadOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import { usePathname } from 'next/navigation';

import { getUsageSessions } from '../../lib/api/usageSession';
import './usageSession.css';

import vi from '../../locales/vi.json';
import en from '../../locales/en.json';

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const locales = { vi, en };

const UsageSessionReportPage = () => {
    const [form] = Form.useForm();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

    const pathname = usePathname() || '/';
    const screens = useBreakpoint();
    const isMobile = !screens.lg;

    const [isEn, setIsEn] = useState(false);

    const isEnFromPath = useMemo(() => {
        const segments = pathname.split('/').filter(Boolean);
        const last = segments[segments.length - 1];
        return last === 'en';
    }, [pathname]);

    const formatDateTime = (value) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-');

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

    const t = isEn ? locales.en.usageSessionReport : locales.vi.usageSessionReport;

    const buildParams = (values, page, limit, noPagination = false) => {
        const params = {};

        if (!noPagination) {
            params.page = page;
            params.limit = limit;
        }

        // NOTE: giữ như code bạn
        if (values.sessionId) params.usageCode = values.sessionId.trim();
        if (values.batteryId) params.batteryId = values.batteryId.trim();
        if (values.usageCode) params.usageCode = values.usageCode.trim();
        if (values.deviceId) params.deviceId = values.deviceId.trim();
        if (values.soh) params.soh = values.soh;

        if (values.timeRange?.length === 2) {
            params.startTime = values.timeRange[0].format('YYYY-MM-DD HH:mm:ss');
            params.endTime = values.timeRange[1].format('YYYY-MM-DD HH:mm:ss');
        }

        return params;
    };

    const fetchData = async (page = 1, pageSize = 20) => {
        try {
            setLoading(true);
            const values = form.getFieldsValue();
            const params = buildParams(values, page, pageSize);
            const res = await getUsageSessions(params);

            setData(res.data || []);
            setPagination({ current: res.page || page, pageSize: res.limit || pageSize, total: res.total || 0 });
        } catch (err) {
            console.error('Lỗi lấy usage session: ', err);
            message.error(
                t.messages?.loadError ||
                    (!isEn ? 'Không tải được danh sách phiên sử dụng' : 'Failed to load usage sessions'),
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData(1, pagination.pageSize);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const onFinish = () => fetchData(1, pagination.pageSize);

    const onReset = () => {
        form.resetFields();
        fetchData(1, pagination.pageSize);
    };

    const handleTableChange = (pager) => fetchData(pager.current, pager.pageSize);

    const handleExportExcel = async () => {
        try {
            setExporting(true);
            const values = form.getFieldsValue();
            const params = buildParams(values, 1, 100000);
            const res = await getUsageSessions(params);
            const list = res.data || [];

            if (!list.length) {
                message.warning(t.excel?.noData || (!isEn ? 'Không có dữ liệu để xuất' : 'No data to export'));
                return;
            }

            const rows = list.map((item, index) => ({
                [t.table.index]: index + 1,
                [t.table.sessionId]: item.usageCode,
                [t.table.vehicleId]: item.vehicleId,
                [t.table.batteryId]: item.batteryId,
                [t.table.usageCode]: item.usageCode,
                [t.table.durationMinutes]: item.durationMinutes,
                [t.table.soh]: item.soh,
                [t.table.socStart]: item.socStart,
                [t.table.socEnd]: item.socEnd,
                [t.table.tempMax]: item.tempMax,
                [t.table.tempMin]: item.tempMin,
                [t.table.tempAvg]: item.tempAvg,
                [t.table.distanceKm]: item.distanceKm,
                [t.table.speedMax]: item.speedMax,
                [t.table.speedAvg]: item.speedAvg,
                [t.table.consumedPercent]: item.consumedPercent,
                [t.table.consumedKwh]: item.consumedKwh,

                // ✅ FIX key name
                [t.table.startTime]: formatDateTime(item.startTime),
                [t.table.endTime]: formatDateTime(item.endTime),

                [t.table.startLat]: item.startLat,
                [t.table.startLng]: item.startLng,
                [t.table.endLat]: item.endLat,
                [t.table.endLng]: item.endLng,
            }));

            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'UsageSessions');

            XLSX.writeFile(
                wb,
                t.excel?.fileName || (!isEn ? 'bao_cao_usage_session.xlsx' : 'usage_session_report.xlsx'),
            );

            message.success(t.excel?.success || (!isEn ? 'Xuất Excel thành công' : 'Export Excel successfully'));
        } catch (err) {
            console.error('Export usage session Excel error: ', err);
            message.error(t.excel?.failed || (!isEn ? 'Xuất Excel thất bại' : 'Export Excel failed'));
        } finally {
            setExporting(false);
        }
    };

    // ✅ Tooltip content cho từng cột
    const colHelp = {
        index: {
            vi: 'Số thứ tự dòng trong danh sách.',
            en: 'Row number in the list.',
        },

        sessionId: {
            vi: 'Mã phiên sử dụng (mỗi dòng là 1 phiên/chuyến).',
            en: 'Usage session ID (each row is one session/trip).',
        },

        vehicleId: {
            vi: 'Mã xe / định danh xe của phiên này.',
            en: 'Vehicle ID for this session.',
        },

        batteryId: {
            vi: 'Mã pin sử dụng trong phiên này.',
            en: 'Battery ID used in this session.',
        },

        usageCode: {
            vi: 'Mã phiên (thường trùng với “Mã phiên” ở bên trái). Dùng để tra cứu nội bộ.',
            en: 'Session code (often same as Session ID). Used for lookup.',
        },

        durationMinutes: {
            vi: 'Tổng thời gian phiên (phút).',
            en: 'Total session duration (minutes).',
        },

        soh: {
            vi: 'Sức khỏe pin (SOH) – % tình trạng pin.',
            en: 'Battery health (SOH) – percentage.',
        },

        socStart: {
            vi: 'Pin lúc bắt đầu phiên (%).',
            en: 'Battery level at start (%).',
        },

        socEnd: {
            vi: 'Pin lúc kết thúc phiên (%).',
            en: 'Battery level at end (%).',
        },

        tempMax: {
            vi: 'Nhiệt độ pin cao nhất trong phiên (°C).',
            en: 'Maximum battery temperature during session (°C).',
        },

        tempMin: {
            vi: 'Nhiệt độ pin thấp nhất trong phiên (°C).',
            en: 'Minimum battery temperature during session (°C).',
        },

        tempAvg: {
            vi: 'Nhiệt độ pin trung bình trong phiên (°C).',
            en: 'Average battery temperature during session (°C).',
        },

        distanceKm: {
            vi: 'Quãng đường di chuyển trong phiên (km).',
            en: 'Distance traveled in session (km).',
        },

        speedMax: {
            vi: 'Vận tốc cao nhất trong phiên (km/h).',
            en: 'Maximum speed in session (km/h).',
        },

        speedAvg: {
            vi: 'Vận tốc trung bình trong phiên (km/h).',
            en: 'Average speed in session (km/h).',
        },

        consumedPercent: {
            vi: 'Pin tiêu hao trong phiên (%).',
            en: 'Battery consumed during session (%).',
        },

        consumedKwh: {
            vi: 'Năng lượng tiêu thụ trong phiên (kWh).',
            en: 'Energy consumed during session (kWh).',
        },

        startTime: {
            vi: 'Thời điểm bắt đầu phiên.',
            en: 'Session start time.',
        },

        endTime: {
            vi: 'Thời điểm kết thúc phiên.',
            en: 'Session end time.',
        },

        startLat: {
            vi: 'Vĩ độ tại điểm bắt đầu.',
            en: 'Latitude at start point.',
        },

        startLng: {
            vi: 'Kinh độ tại điểm bắt đầu.',
            en: 'Longitude at start point.',
        },

        endLat: {
            vi: 'Vĩ độ tại điểm kết thúc.',
            en: 'Latitude at end point.',
        },

        endLng: {
            vi: 'Kinh độ tại điểm kết thúc.',
            en: 'Longitude at end point.',
        },
    };

    const ColTitle = ({ label, tip, isEn }) => {
        const tipText = tip && typeof tip === 'object' ? (isEn ? tip.en : tip.vi) : tip;

        return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                <span>{label}</span>

                <Tooltip
                    title={tipText} // ✅ FIX: dùng string
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

    const columns = [
        {
            title: <ColTitle label={t.table.index} tip={colHelp.index} />,
            dataIndex: 'index',
            width: 60,
            render: (text, record, index) => (pagination.current - 1) * pagination.pageSize + index + 1,
            fixed: 'left',
        },

        {
            title: <ColTitle label={t.table.sessionId} tip={colHelp.sessionId} />,
            dataIndex: 'usageCode',
            ellipsis: true,
            width: 210,
        },
        {
            title: <ColTitle label={t.table.vehicleId} tip={colHelp.vehicleId} />,
            dataIndex: 'vehicleId',
            ellipsis: true,
            width: 80,
        },
        {
            title: <ColTitle label={t.table.batteryId} tip={colHelp.batteryId} />,
            dataIndex: 'batteryId',
            ellipsis: true,
            width: 90,
        },
        {
            title: <ColTitle label={t.table.usageCode} tip={colHelp.usageCode} />,
            dataIndex: 'usageCode',
            ellipsis: true,
            width: 210,
        },

        {
            title: <ColTitle label={t.table.durationMinutes} tip={colHelp.durationMinutes} />,
            dataIndex: 'durationMinutes',
            width: 150,
        },
        { title: <ColTitle label={t.table.soh} tip={colHelp.soh} />, dataIndex: 'soh', width: 90 },
        { title: <ColTitle label={t.table.socStart} tip={colHelp.socStart} />, dataIndex: 'socStart', width: 130 },
        { title: <ColTitle label={t.table.socEnd} tip={colHelp.socEnd} />, dataIndex: 'socEnd', width: 130 },

        { title: <ColTitle label={t.table.tempMax} tip={colHelp.tempMax} />, dataIndex: 'tempMax', width: 130 },
        { title: <ColTitle label={t.table.tempMin} tip={colHelp.tempMin} />, dataIndex: 'tempMin', width: 130 },
        { title: <ColTitle label={t.table.tempAvg} tip={colHelp.tempAvg} />, dataIndex: 'tempAvg', width: 170 },

        {
            title: <ColTitle label={t.table.distanceKm} tip={colHelp.distanceKm} />,
            dataIndex: 'distanceKm',
            width: 170,
        },
        { title: <ColTitle label={t.table.speedMax} tip={colHelp.speedMax} />, dataIndex: 'speedMax', width: 120 },
        { title: <ColTitle label={t.table.speedAvg} tip={colHelp.speedAvg} />, dataIndex: 'speedAvg', width: 160 },

        {
            title: <ColTitle label={t.table.consumedPercent} tip={colHelp.consumedPercent} />,
            dataIndex: 'consumedPercent',
            width: 140,
        },
        {
            title: <ColTitle label={t.table.consumedKwh} tip={colHelp.consumedKwh} />,
            dataIndex: 'consumedKwh',
            width: 130,
        },

        {
            title: <ColTitle label={t.table.startTime} tip={colHelp.startTime} />,
            dataIndex: 'startTime',
            ellipsis: true,
            render: formatDateTime,
            width: 170,
        },
        {
            title: <ColTitle label={t.table.endTime} tip={colHelp.endTime} />,
            dataIndex: 'endTime',
            ellipsis: true,
            render: formatDateTime,
            width: 170,
        },

        { title: <ColTitle label={t.table.startLat} tip={colHelp.startLat} />, dataIndex: 'startLat', width: 130 },
        { title: <ColTitle label={t.table.startLng} tip={colHelp.startLng} />, dataIndex: 'startLng', width: 150 },
        { title: <ColTitle label={t.table.endLat} tip={colHelp.endLat} />, dataIndex: 'endLat', width: 130 },
        { title: <ColTitle label={t.table.endLng} tip={colHelp.endLng} />, dataIndex: 'endLng', width: 110 },
    ];

    return (
        <div className="usage-report-page">
            <div className="usage-report-header">
                <Title level={4} style={{ margin: 0 }}>
                    {t.title}
                </Title>
                <Text type="secondary">{t.subtitle}</Text>
            </div>

            <Row gutter={[16, 16]} className="usage-report-row">
                <Col xs={24} lg={7}>
                    <Card className="usage-filter-card" title={t.filter.title} size="small">
                        <Form form={form} layout="vertical" onFinish={onFinish}>
                            <Form.Item label={t.filter.sessionId} name="sessionId">
                                <Input placeholder={t.filter.sessionIdPlaceholder} allowClear />
                            </Form.Item>

                            <Form.Item label={t.filter.batteryId} name="batteryId">
                                <Input placeholder={t.filter.batteryIdPlaceholder} allowClear />
                            </Form.Item>

                            <Form.Item label={t.filter.usageCode} name="usageCode">
                                <Input placeholder={t.filter.usageCodePlaceholder} allowClear />
                            </Form.Item>

                            <Form.Item label={t.filter.deviceId} name="deviceId">
                                <Input placeholder={t.filter.deviceIdPlaceholder} allowClear />
                            </Form.Item>

                            <Form.Item label={t.filter.soh} name="soh">
                                <Input placeholder={t.filter.sohPlaceholder} allowClear />
                            </Form.Item>

                            <Form.Item label={t.filter.timeRange} name="timeRange">
                                <RangePicker showTime style={{ width: '100%' }} format="YYYY-MM-DD HH:mm:ss" />
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
                        </Form>
                    </Card>
                </Col>

                <Col xs={24} lg={17}>
                    <Card
                        className="usage-table-card"
                        size="small"
                        title={t.table.title}
                        extra={
                            <Space size={12}>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                    {t.table.total.replace('{total}', String(pagination.total))}
                                </Text>
                                <Button size="small" onClick={handleExportExcel} loading={exporting}>
                                    {t.excel?.buttonText || (!isEn ? 'Xuất Excel' : 'Export Excel')}
                                </Button>
                            </Space>
                        }
                    >
                        <Table
                            rowKey={(record) => record._id || record.usageCode}
                            columns={columns}
                            dataSource={data}
                            loading={loading}
                            locale={{ emptyText: isEn ? 'No data' : 'Không tìm thấy dữ liệu' }}
                            pagination={{
                                current: pagination.current,
                                pageSize: pagination.pageSize,
                                total: pagination.total,
                                showSizeChanger: true,
                                pageSizeOptions: ['10', '20', '50', '100'],
                                showTotal: (total) => t.table.showTotal.replace('{total}', String(total)),
                            }}
                            onChange={handleTableChange}
                            scroll={{ x: 2400 }}
                        />
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default UsageSessionReportPage;
