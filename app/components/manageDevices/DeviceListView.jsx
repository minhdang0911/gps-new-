/* =========================
   FILE 2: components/manageDevices/DeviceListView.jsx
   ========================= */
'use client';

import React, { useMemo } from 'react';
import { Card, Input, Button, Table, Space, Typography, Row, Col, Popconfirm, FloatButton, Tooltip } from 'antd';
import {
    SearchOutlined,
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    EyeOutlined,
    DownloadOutlined,
    QuestionCircleOutlined,
    PlayCircleOutlined,
    ToolOutlined,
} from '@ant-design/icons';

import CommandBarTrigger from '../../components/common/CommandBarTrigger';

const { Title, Text } = Typography;

export default function DeviceListView({
    t,
    isEn,
    filters,
    setFilters,
    total,
    devices,
    devicesLoading,
    devicesValidating,
    currentPage,
    pageSize,
    setCurrentPage,
    setPageSize,
    canAddDevice,
    canEditDevice,
    canDeleteDevice,
    onOpenAdd,
    onOpenEdit,
    onDelete,
    onSelectDevice,
    onExportExcel,
    onOpenCommandBar,
    onStartTour,

    // ✅ NEW row actions
    onActivateDevice,
    onMaintainDevice,
    startingMaint,
}) {
    const columns = useMemo(
        () => [
            {
                title: 'STT',
                width: 60,
                render: (_, __, index) => (currentPage - 1) * pageSize + index + 1,
            },
            {
                title: 'IMEI',
                dataIndex: 'imei',
                sorter: (a, b) => (a.imei || '').localeCompare(b.imei || ''),
                render: (text, record) => (
                    <Button type="link" onClick={() => onSelectDevice(record)}>
                        {text}
                    </Button>
                ),
            },
            {
                title: t.deviceType,
                dataIndex: 'device_category_id',
                sorter: (a, b) => (a.device_category_id?.name || '').localeCompare(b.device_category_id?.name || ''),
                render: (d) => d?.name || '-',
            },
            {
                title: t.phone,
                dataIndex: 'phone_number',
                sorter: (a, b) => (a.phone_number || '').localeCompare(b.phone_number || ''),
            },
            {
                title: t.plate,
                dataIndex: 'license_plate',
                sorter: (a, b) => (a.license_plate || '').localeCompare(b.license_plate || ''),
            },
            { title: t.driver, dataIndex: 'driver', sorter: (a, b) => (a.driver || '').localeCompare(b.driver || '') },
            {
                title: t.vehicleLine,
                dataIndex: 'vehicle_category_id',
                sorter: (a, b) => (a.vehicle_category_id?.name || '').localeCompare(b.vehicle_category_id?.name || ''),
                render: (v) => v?.name || '-',
            },
            {
                title: t.distributor,
                dataIndex: 'distributor_id',
                sorter: (a, b) => (a.distributor_id?.username || '').localeCompare(b.distributor_id?.username || ''),
                render: (u) => u?.username || '-',
            },
            {
                title: t.createdDate,
                dataIndex: 'createdAt',
                sorter: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
                render: (v) => new Date(v).toLocaleString(isEn ? 'en-US' : 'vi-VN'),
            },
            {
                title: t.view,
                width: 60,
                render: (_, r) => <Button size="small" icon={<EyeOutlined />} onClick={() => onSelectDevice(r)} />,
            },
            {
                title: t.actions || (isEn ? 'Actions' : 'Thao tác'),
                render: (_, r) => (
                    <Space wrap>
                        {/* ✅ NEW: đặt cạnh sửa/xoá, không cần tick */}
                        <Button
                            size="small"
                            type="primary"
                            icon={<PlayCircleOutlined />}
                            loading={!!startingMaint}
                            onClick={() => onActivateDevice?.(r)}
                        >
                            {isEn ? 'Activate' : 'Kích hoạt'}
                        </Button>

                        <Button size="small" icon={<ToolOutlined />} onClick={() => onMaintainDevice?.(r)}>
                            {isEn ? 'Maintenance' : 'Bảo dưỡng'}
                        </Button>

                        {canEditDevice && (
                            <Button size="small" icon={<EditOutlined />} onClick={() => onOpenEdit(r)}>
                                {t.edit}
                            </Button>
                        )}

                        {canDeleteDevice && (
                            <Popconfirm
                                title={t.deleteConfirm}
                                description={isEn ? 'Are you sure you want to delete?' : 'Bạn chắc chắn muốn xoá?'}
                                okText={isEn ? 'Delete' : 'Xoá'}
                                cancelText={isEn ? 'Cancel' : 'Huỷ'}
                                okButtonProps={{ danger: true }}
                                onConfirm={() => onDelete(r)}
                            >
                                <Button danger size="small" icon={<DeleteOutlined />}>
                                    {t.delete}
                                </Button>
                            </Popconfirm>
                        )}
                    </Space>
                ),
            },
        ],
        [
            t,
            isEn,
            currentPage,
            pageSize,
            canEditDevice,
            canDeleteDevice,
            onOpenEdit,
            onDelete,
            onSelectDevice,
            onActivateDevice,
            onMaintainDevice,
            startingMaint,
        ],
    );

    return (
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
            <Row justify="space-between" align="middle">
                <Col>
                    <Title level={4}>{t.title}</Title>

                    {/* ✅ tour step: cmdk */}
                    <div style={{ marginTop: 10 }} data-tour="cmdk">
                        <CommandBarTrigger
                            placeholder={isEn ? 'Search devices…' : 'Tìm thiết bị…'}
                            onOpen={onOpenCommandBar}
                            width={380}
                        />
                    </div>

                    <div style={{ marginTop: 6 }}>
                        <Text type="secondary">{isEn ? 'or press Ctrl+K' : 'hoặc bấm Ctrl+K'}</Text>
                    </div>
                </Col>

                <Col>
                    <Space>
                        <Button icon={<DownloadOutlined />} onClick={onExportExcel}>
                            {t.exportExcel}
                        </Button>

                        {canAddDevice && (
                            <Button data-tour="addBtn" type="primary" icon={<PlusOutlined />} onClick={onOpenAdd}>
                                {t.addDevice}
                            </Button>
                        )}
                    </Space>
                </Col>
            </Row>

            {/* ✅ tour step: filters */}
            <Card data-tour="filters">
                <Row gutter={[12, 12]}>
                    <Col xs={24} md={6}>
                        <Input
                            placeholder={t.filters.phone}
                            value={filters.phone_number}
                            onChange={(e) => setFilters((f) => ({ ...f, phone_number: e.target.value }))}
                        />
                    </Col>
                    <Col xs={24} md={6}>
                        <Input
                            placeholder={t.filters.plate}
                            value={filters.license_plate}
                            onChange={(e) => setFilters((f) => ({ ...f, license_plate: e.target.value }))}
                        />
                    </Col>
                    <Col xs={24} md={6}>
                        <Input
                            placeholder={t.filters.imei}
                            value={filters.imei}
                            onChange={(e) => setFilters((f) => ({ ...f, imei: e.target.value }))}
                        />
                    </Col>
                    <Col xs={24} md={6}>
                        <Input
                            placeholder={t.filters.driver}
                            value={filters.driver}
                            onChange={(e) => setFilters((f) => ({ ...f, driver: e.target.value }))}
                        />
                    </Col>
                </Row>

                <Row justify="end" style={{ marginTop: 12 }}>
                    {/* ✅ tour step: search */}
                    <Button
                        data-tour="searchBtn"
                        type="primary"
                        icon={<SearchOutlined />}
                        onClick={() => setCurrentPage(1)}
                    >
                        {t.search}
                    </Button>
                </Row>
            </Card>

            <Card>
                <Text strong>
                    {t.deviceList} ({total || (devices || []).length})
                </Text>

                {/* ✅ tour step: table */}
                <div data-tour="table">
                    <Table
                        dataSource={devices}
                        columns={columns}
                        rowKey="_id"
                        loading={devicesLoading || devicesValidating}
                        pagination={{
                            current: currentPage,
                            pageSize,
                            total,
                            showSizeChanger: true,
                            onChange: (page, size) => {
                                setCurrentPage(page);
                                setPageSize(size || pageSize);
                            },
                        }}
                        style={{ marginTop: 12 }}
                        scroll={{ x: 1100 }}
                    />
                </div>
            </Card>

            <FloatButton
                icon={<QuestionCircleOutlined />}
                tooltip={isEn ? 'Guide' : 'Hướng dẫn'}
                onClick={onStartTour}
            />
        </Space>
    );
}
