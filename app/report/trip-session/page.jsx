// app/report/trip-session/page.jsx
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Card, Form, Input, Button, Row, Col, Table, DatePicker, Space, Typography } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { getTripSessions } from '../../lib/api/tripSession';
import '../usage-session/usageSession.css'; // xài chung style

import { usePathname } from 'next/navigation';
import vi from '../../locales/vi.json';
import en from '../../locales/en.json';

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

const locales = { vi, en };

const TripSessionReportPage = () => {
    const [form] = Form.useForm();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [pagination, setPagination] = useState({
        current: 1,
        pageSize: 20,
        total: 0,
    });

    // ===== LANG DETECT =====
    const pathname = usePathname() || '/';
    const [isEn, setIsEn] = useState(false);

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

    const t = isEn ? locales.en.tripSessionReport : locales.vi.tripSessionReport;

    // ===== API PARAMS =====
    const buildParams = (values, page, limit) => {
        const params = {
            page,
            limit,
        };

        if (values.sessionId) params.sessionId = values.sessionId.trim();
        if (values.tripCode) params.tripCode = values.tripCode.trim();
        if (values.batteryId) params.batteryId = values.batteryId.trim();
        if (values.deviceId) params.deviceId = values.deviceId.trim();
        if (values.imei) params.imei = values.imei.trim();
        if (values.soh) params.soh = values.soh;

        if (values.timeRange && values.timeRange.length === 2) {
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

            const res = await getTripSessions(params);

            setData(res.data || []);
            setPagination({
                current: res.page || page,
                pageSize: res.limit || pageSize,
                total: res.total || 0,
            });
        } catch (err) {
            console.error('Lỗi lấy trip session: ', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData(1, pagination.pageSize);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const onFinish = () => {
        fetchData(1, pagination.pageSize);
    };

    const onReset = () => {
        form.resetFields();
        fetchData(1, pagination.pageSize);
    };

    const handleTableChange = (pager) => {
        fetchData(pager.current, pager.pageSize);
    };

    const columns = [
        {
            title: t.table.index,
            dataIndex: 'index',
            width: 60,
            render: (text, record, index) => (pagination.current - 1) * pagination.pageSize + index + 1,
        },
        {
            title: t.table.sessionId,
            dataIndex: 'sessionId',
            ellipsis: true,
        },
        {
            title: t.table.tripCode,
            dataIndex: 'tripCode',
            ellipsis: true,
        },
        {
            title: t.table.deviceId,
            dataIndex: 'deviceId',
            ellipsis: true,
        },
        {
            title: t.table.imei,
            dataIndex: 'imei',
            ellipsis: true,
        },
        {
            title: t.table.batteryId,
            dataIndex: 'batteryId',
            ellipsis: true,
        },
        {
            title: t.table.soh,
            dataIndex: 'soh',
            width: 80,
        },
        {
            title: t.table.startTime,
            dataIndex: 'startTime',
            ellipsis: true,
        },
        {
            title: t.table.endTime,
            dataIndex: 'endTime',
            ellipsis: true,
        },
        // backend có thêm distance, duration... thì m add cột ở đây
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
                {/* FILTER */}
                <Col xs={24} lg={7}>
                    <Card className="usage-filter-card" title={t.filter.title} size="small">
                        <Form form={form} layout="vertical" onFinish={onFinish}>
                            <Form.Item label={t.filter.sessionId} name="sessionId">
                                <Input placeholder={t.filter.sessionIdPlaceholder} allowClear />
                            </Form.Item>

                            <Form.Item label={t.filter.tripCode} name="tripCode">
                                <Input placeholder={t.filter.tripCodePlaceholder} allowClear />
                            </Form.Item>

                            <Form.Item label={t.filter.batteryId} name="batteryId">
                                <Input placeholder={t.filter.batteryIdPlaceholder} allowClear />
                            </Form.Item>

                            <Form.Item label={t.filter.deviceId} name="deviceId">
                                <Input placeholder={t.filter.deviceIdPlaceholder} allowClear />
                            </Form.Item>

                            <Form.Item label={t.filter.imei} name="imei">
                                <Input placeholder={t.filter.imeiPlaceholder} allowClear />
                            </Form.Item>

                            <Form.Item label={t.filter.soh} name="soh">
                                <Input placeholder={t.filter.sohPlaceholder} allowClear />
                            </Form.Item>

                            <Form.Item label={t.filter.timeRange} name="timeRange">
                                <RangePicker showTime style={{ width: '100%' }} format="YYYY-MM-DD HH:mm:ss" />
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
                            <Text type="secondary" style={{ fontSize: 12 }}>
                                {t.table.total.replace('{total}', String(pagination.total))}
                            </Text>
                        }
                    >
                        <Table
                            rowKey={(record) => record._id || record.sessionId || record.tripCode}
                            columns={columns}
                            dataSource={data}
                            loading={loading}
                            pagination={{
                                current: pagination.current,
                                pageSize: pagination.pageSize,
                                total: pagination.total,
                                showSizeChanger: true,
                                pageSizeOptions: ['10', '20', '50', '100'],
                                showTotal: (total) => t.table.showTotal.replace('{total}', String(total)),
                            }}
                            onChange={handleTableChange}
                            scroll={{ x: 800 }}
                        />
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default TripSessionReportPage;
