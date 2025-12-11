'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Card, Form, Input, Button, Row, Col, Table, DatePicker, Space, Typography, message } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import { usePathname } from 'next/navigation';
import { getUsageSessions } from '../../lib/api/usageSession';
import './usageSession.css';
import vi from '../../locales/vi.json';
import en from '../../locales/en.json';
const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

const locales = { vi, en };

const UsageSessionReportPage = () => {
    const [form] = Form.useForm();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

    const pathname = usePathname() || '/';
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
                // [t.table.deviceId]: item.device_id,
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
                [startTime]: formatDateTime(item.startTime),
                [endTime]: formatDateTime(item.endTime),

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

    const columns = [
        {
            title: t.table.index,
            dataIndex: 'index',
            width: 60,
            render: (text, record, index) => (pagination.current - 1) * pagination.pageSize + index + 1,
        },
        { title: t.table.sessionId, dataIndex: 'usageCode', ellipsis: true, width: 210 },
        { title: t.table.vehicleId, dataIndex: 'vehicleId', ellipsis: true, width: 80 },
        // { title: t.table.deviceId, dataIndex: 'device_id', ellipsis: true },
        { title: t.table.batteryId, dataIndex: 'batteryId', ellipsis: true, width: 80 },
        { title: t.table.usageCode, dataIndex: 'usageCode', ellipsis: true, width: 210 },
        { title: t.table.durationMinutes, dataIndex: 'durationMinutes', width: 80 },
        { title: t.table.soh, dataIndex: 'soh', width: 80 },
        { title: t.table.socStart, dataIndex: 'socStart', width: 80 },
        { title: t.table.socEnd, dataIndex: 'socEnd', width: 80 },
        { title: t.table.tempMax, dataIndex: 'tempMax', width: 80 },
        { title: t.table.tempMin, dataIndex: 'tempMin', width: 80 },
        { title: t.table.tempAvg, dataIndex: 'tempAvg', width: 80 },
        { title: t.table.distanceKm, dataIndex: 'distanceKm', width: 80 },
        { title: t.table.speedMax, dataIndex: 'speedMax', width: 80 },
        { title: t.table.speedAvg, dataIndex: 'speedAvg', width: 80 },
        { title: t.table.consumedPercent, dataIndex: 'consumedPercent', width: 80 },
        { title: t.table.consumedKwh, dataIndex: 'consumedKwh', width: 80 },
        { title: t.table.startTime, dataIndex: 'startTime', ellipsis: true, render: formatDateTime, width: 160 },
        { title: t.table.endTime, dataIndex: 'endTime', ellipsis: true, render: formatDateTime, width: 160 },
        { title: t.table.startLat, dataIndex: 'startLat', width: 80 },
        { title: t.table.startLng, dataIndex: 'startLng', width: 80 },
        { title: t.table.endLat, dataIndex: 'endLat', width: 80 },
        { title: t.table.endLng, dataIndex: 'endLng', width: 80 },
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
                            scroll={{ x: 2200 }}
                        />
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default UsageSessionReportPage;
