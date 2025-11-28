// app/report/charging-session/page.jsx
'use client';

import React, { useEffect, useState } from 'react';
import { Card, Form, Input, Button, Row, Col, Table, DatePicker, Space, Typography } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { getChargingSessions } from '../../lib/api/chargingSession';
import '../usage-session/usageSession.css'; // xài chung style với usage

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

const ChargingSessionReportPage = () => {
    const [form] = Form.useForm();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [pagination, setPagination] = useState({
        current: 1,
        pageSize: 20,
        total: 0,
    });

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
            title: '#',
            dataIndex: 'index',
            width: 60,
            render: (text, record, index) => (pagination.current - 1) * pagination.pageSize + index + 1,
        },
        {
            title: 'Session ID',
            dataIndex: 'sessionId',
            ellipsis: true,
        },
        {
            title: 'Battery ID',
            dataIndex: 'batteryId',
            ellipsis: true,
        },
        {
            title: 'Charge code',
            dataIndex: 'chargeCode',
            ellipsis: true,
        },
        {
            title: 'SOH',
            dataIndex: 'soh',
            width: 80,
        },
        {
            title: 'Start time',
            dataIndex: 'start',
            ellipsis: true,
        },
        {
            title: 'End time',
            dataIndex: 'end',
            ellipsis: true,
        },
    ];

    return (
        <div className="usage-report-page">
            <div className="usage-report-header">
                <Title level={4} style={{ margin: 0 }}>
                    Báo cáo sạc (Charging Session)
                </Title>
                <Text type="secondary">Lọc theo session, pin, mã sạc, SOH, khoảng thời gian...</Text>
            </div>

            <Row gutter={[16, 16]} className="usage-report-row">
                {/* FILTER */}
                <Col xs={24} lg={7}>
                    <Card className="usage-filter-card" title="Bộ lọc" size="small">
                        <Form form={form} layout="vertical" onFinish={onFinish}>
                            <Form.Item label="Session ID" name="sessionId">
                                <Input placeholder="Nhập sessionId" allowClear />
                            </Form.Item>

                            <Form.Item label="Battery ID" name="batteryId">
                                <Input placeholder="Nhập batteryId" allowClear />
                            </Form.Item>

                            <Form.Item label="Charge code" name="chargeCode">
                                <Input placeholder="Nhập chargeCode" allowClear />
                            </Form.Item>

                            <Form.Item label="SOH" name="soh">
                                <Input placeholder="VD: 80" allowClear />
                            </Form.Item>

                            <Form.Item label="Khoảng thời gian" name="timeRange">
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
                                        Tìm kiếm
                                    </Button>
                                    <Button icon={<ReloadOutlined />} onClick={onReset} disabled={loading}>
                                        Xoá lọc
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
                        title="Danh sách Charging Session"
                        extra={
                            <Text type="secondary" style={{ fontSize: 12 }}>
                                Tổng: {pagination.total} bản ghi
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
                                showTotal: (total) => `Tổng {total} bản ghi`,
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
