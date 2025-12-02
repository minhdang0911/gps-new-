// app/report/charging-session/page.jsx
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Card, Form, Input, Button, Row, Col, Table, DatePicker, Space, Typography } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { getChargingSessions } from '../../lib/api/chargingSession';
import '../usage-session/usageSession.css'; // xài chung style với usage

import { usePathname } from 'next/navigation';
import vi from '../../locales/vi.json';
import en from '../../locales/en.json';

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

const locales = { vi, en };

const ChargingSessionReportPage = () => {
    const [form] = Form.useForm();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [pagination, setPagination] = useState({
        current: 1,
        pageSize: 20,
        total: 0,
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

    const t = isEn ? locales.en.chargingSessionReport : locales.vi.chargingSessionReport;

    const buildPayload = (values, page, limit) => {
        const payload = {
            page,
            limit,
        };

        if (values.sessionId) payload.sessionId = values.sessionId.trim();
        if (values.batteryId) payload.batteryId = values.batteryId.trim();
        if (values.chargeCode) payload.chargeCode = values.chargeCode.trim();
        if (values.soh) payload.soh = values.soh;

        if (values.timeRange && values.timeRange.length === 2) {
            payload.start = values.timeRange[0].format('YYYY-MM-DD HH:mm:ss');
            payload.end = values.timeRange[1].format('YYYY-MM-DD HH:mm:ss');
        }

        return payload;
    };

    const fetchData = async (page = 1, pageSize = 20) => {
        try {
            setLoading(true);
            const values = form.getFieldsValue();
            const payload = buildPayload(values, page, pageSize);

            const res = await getChargingSessions(payload);

            setData(res.data || []);
            setPagination({
                current: res.page || page,
                pageSize: res.limit || pageSize,
                total: res.total || 0,
            });
        } catch (err) {
            console.error('Lỗi lấy charging session: ', err);
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
            title: t.table.batteryId,
            dataIndex: 'batteryId',
            ellipsis: true,
        },
        {
            title: t.table.chargeCode,
            dataIndex: 'chargeCode',
            ellipsis: true,
        },
        {
            title: t.table.soh,
            dataIndex: 'soh',
            width: 80,
        },
        {
            title: t.table.startTime,
            dataIndex: 'start',
            ellipsis: true,
        },
        {
            title: t.table.endTime,
            dataIndex: 'end',
            ellipsis: true,
        },
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

                            <Form.Item label={t.filter.batteryId} name="batteryId">
                                <Input placeholder={t.filter.batteryIdPlaceholder} allowClear />
                            </Form.Item>

                            <Form.Item label={t.filter.chargeCode} name="chargeCode">
                                <Input placeholder={t.filter.chargeCodePlaceholder} allowClear />
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

                {/* DATA TABLE */}
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
                            rowKey={(record) => record._id || record.sessionId}
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

export default ChargingSessionReportPage;
