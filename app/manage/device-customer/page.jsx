'use client';

import React, { useMemo, useState, useEffect } from 'react';
import useSWR from 'swr';
import { Card, Table, Button, Form, Select, Space, message, Tag, Typography, Popconfirm, Spin, Tooltip } from 'antd';
import {
    PlusOutlined,
    ReloadOutlined,
    DeleteOutlined,
    UserOutlined,
    DownloadOutlined,
    QuestionCircleOutlined,
} from '@ant-design/icons';
import { usePathname } from 'next/navigation';

import { getUserList } from '@/app/lib/api/user';
import { getDevices } from '@/app/lib/api/devices';
import { getDeviceCustomerList, addDeviceToCustomer, removeDeviceFromCustomer } from '@/app/lib/api/deviceCustomer';

import './DeviceCustomerPage.css';

import vi from '../../locales/vi.json';
import en from '../../locales/en.json';

import { useLocalStorageValue } from '@/app/hooks/useLocalStorageValue';
import DeviceCustomerAddModal from './DeviceCustomerAddModal';
import { exportCustomerDevicesExcel } from './deviceCustomer.exportExcel';

// ✅ Intro.js styles
import 'intro.js/introjs.css';
import '../../styles/intro-custom.css';

// ✅ shared guided tour hook
import { useGuidedTour } from '../../hooks/common/useGuidedTour';

const locales = { vi, en };
const { Option } = Select;
const { Text, Title } = Typography;

export default function DeviceCustomerPage() {
    const pathname = usePathname() || '/';

    const token = useLocalStorageValue('accessToken', '');
    const role = useLocalStorageValue('role', '');
    const langFromStorage = useLocalStorageValue('iky_lang', 'vi');

    const isEnFromPath = useMemo(() => {
        const segments = pathname.split('/').filter(Boolean);
        const last = segments[segments.length - 1];
        return last === 'en';
    }, [pathname]);

    const isEn = isEnFromPath ? true : langFromStorage === 'en';
    const t = isEn ? locales.en.deviceCustomer : locales.vi.deviceCustomer;

    const isAdmin = role === 'administrator';
    const isDistributor = role === 'distributor';

    const canView = isAdmin || isDistributor;
    const canEdit = isAdmin || isDistributor;

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [form] = Form.useForm();
    const [selectedCustomer, setSelectedCustomer] = useState(null);

    const popupInParent = (triggerNode) => triggerNode?.parentElement || document.body;

    // ===== SWR customers
    const customersKey = canView ? ['customers', isEn] : null;

    const {
        data: customersRes,
        isLoading: customersLoading,
        isValidating: customersValidating,
        mutate: mutateCustomers,
    } = useSWR(
        customersKey,
        async () => {
            const res = await getUserList({ page: 1, limit: 100 });
            const allUsers = res.items || res.users || [];
            return allUsers.filter((u) => u.position === 'customer');
        },
        {
            revalidateOnFocus: false,
            dedupingInterval: 30_000,
            onError: (err) => {
                console.error('Load customers error:', err);
                message.error(t.loadCustomersError);
            },
        },
    );

    const customers = customersRes || [];
    const firstCustomerId = customers?.[0]?._id || null;
    const currentCustomerId = selectedCustomer || firstCustomerId;

    // ===== SWR devices of current customer
    const devicesKey = token && currentCustomerId && canView ? ['customerDevices', token, currentCustomerId] : null;

    const {
        data: devicesRes,
        isLoading: loadingDevices,
        isValidating: validatingDevices,
        mutate: mutateDevices,
    } = useSWR(
        devicesKey,
        async ([, tk, customerId]) => {
            const res = await getDeviceCustomerList(tk, customerId, { page: 1, limit: 50 });
            return res.devices || [];
        },
        {
            keepPreviousData: true,
            revalidateOnFocus: false,
            dedupingInterval: 10_000,
            onError: (err) => {
                console.error('Load device of customer error:', err);
            },
        },
    );

    const devices = devicesRes || [];

    // ===== SWR all devices for dropdown
    const allDevicesKey = token && canView ? ['allDevices', token] : null;

    const {
        data: allDevicesRes,
        isLoading: loadingAllDevices,
        isValidating: validatingAllDevices,
        mutate: mutateAllDevices,
    } = useSWR(
        allDevicesKey,
        async ([, tk]) => {
            const res = await getDevices(tk, { page: 1, limit: 200 });
            return res.devices || res.items || [];
        },
        {
            revalidateOnFocus: false,
            dedupingInterval: 60_000,
            onError: (err) => {
                console.error('Load all devices error:', err);
                message.error(t.loadAllDevicesError);
            },
        },
    );

    const allDevices = allDevicesRes || [];

    useEffect(() => {
        if (!isAddModalOpen) return;
        try {
            mutateAllDevices?.();
            mutateCustomers?.();
        } catch (_) {}
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAddModalOpen]);

    // ===== actions
    const handleAddDevice = async () => {
        if (!token || !currentCustomerId) return message.error(t.missingTokenOrCustomer);
        if (!canEdit)
            return message.warning(t.noPermissionAction || (isEn ? 'No permission' : 'Bạn không có quyền thao tác'));

        try {
            const values = await form.validateFields();
            await addDeviceToCustomer(token, { imei: values.imei, customerId: currentCustomerId });

            message.success(t.addSuccess);
            setIsAddModalOpen(false);
            form.resetFields();
            mutateDevices();
        } catch (err) {
            console.error('Add device error:', err);
            const apiData = err?.response?.data || err;
            const msg =
                apiData?.error ||
                apiData?.message ||
                (typeof apiData === 'string' ? apiData : null) ||
                err?.message ||
                t.addFailed;
            message.error(msg);
        }
    };

    const handleRemoveDevice = async (record) => {
        if (!token || !currentCustomerId) return;
        if (!canEdit)
            return message.warning(t.noPermissionAction || (isEn ? 'No permission' : 'Bạn không có quyền thao tác'));

        try {
            await removeDeviceFromCustomer(token, { imei: record.imei, customerId: currentCustomerId });
            message.success(t.removeSuccess);
            mutateDevices();
        } catch (err) {
            console.error('Remove device error:', err);
            const apiData = err?.response?.data || err;
            const msg =
                apiData?.error ||
                apiData?.message ||
                (typeof apiData === 'string' ? apiData : null) ||
                err?.message ||
                t.removeFailed;
            message.error(msg);
        }
    };

    const onExportExcel = () => {
        const res = exportCustomerDevicesExcel({ t, customers, currentCustomerId, devices });
        if (!res.ok && res.reason === 'NEED_CUSTOMER') return message.warning(t.exportNeedCustomer);
        if (!res.ok && res.reason === 'NO_DEVICES') return message.warning(t.exportNoDevices);
        if (res.ok) message.success(t.exportSuccess);
    };

    const columns = [
        {
            title: t.columns.imei,
            dataIndex: 'imei',
            key: 'imei',
            sorter: (a, b) => (a.imei || '').localeCompare(b.imei || ''),
        },
        {
            title: t.columns.plate,
            dataIndex: 'license_plate',
            key: 'license_plate',
            sorter: (a, b) => (a.license_plate || '').localeCompare(b.license_plate || ''),
            render: (v) => v || '-',
        },
        {
            title: t.columns.deviceCategory,
            key: 'device_category',
            sorter: (a, b) => {
                const aLabel = a.device_category_id?.name || a.device_category_id?.code || '';
                const bLabel = b.device_category_id?.name || b.device_category_id?.code || '';
                return aLabel.localeCompare(bLabel);
            },
            render: (_, record) => record.device_category_id?.name || record.device_category_id?.code || '-',
        },
        {
            title: t.columns.status,
            dataIndex: 'status',
            key: 'status',
            sorter: (a, b) => (a.status || 0) - (b.status || 0),
            render: (status) => (
                <Tag color={status === 10 ? 'green' : 'red'}>{status === 10 ? t.status.online : t.status.offline}</Tag>
            ),
        },
        {
            title: t.columns.actions,
            key: 'actions',
            width: 120,
            render: (_, record) =>
                canEdit ? (
                    <span data-tour="removeBtn">
                        <Popconfirm
                            title={t.actions.removeTitle}
                            description={t.actions.removeDesc}
                            onConfirm={() => handleRemoveDevice(record)}
                            okText={t.actions.removeOk}
                            cancelText={t.actions.removeCancel}
                        >
                            <Button size="small" danger icon={<DeleteOutlined />}>
                                {t.actions.remove}
                            </Button>
                        </Popconfirm>
                    </span>
                ) : null,
        },
    ];

    // ✅ TOUR STEPS (role-aware)
    const tourSteps = useMemo(() => {
        const steps = [
            {
                element: '[data-tour="customerSelect"]',
                intro: isEn
                    ? 'Select a customer to view assigned devices.'
                    : 'Chọn khách hàng để xem danh sách thiết bị đã gán.',
            },
            {
                element: '[data-tour="refreshBtn"]',
                intro: isEn
                    ? 'Refresh the device list for this customer.'
                    : 'Tải lại danh sách thiết bị của khách hàng.',
            },
            {
                element: '[data-tour="exportBtn"]',
                intro: isEn ? 'Export the current list to Excel.' : 'Xuất danh sách hiện tại ra Excel.',
            },
            {
                element: '[data-tour="tableWrap"]',
                intro: isEn
                    ? 'This table shows devices assigned to the customer.'
                    : 'Bảng hiển thị các thiết bị thuộc khách hàng.',
            },
        ];

        if (canEdit) {
            steps.push({
                element: '[data-tour="addBtn"]',
                intro: isEn ? 'Add a device to this customer.' : 'Thêm thiết bị cho khách hàng này.',
            });
            steps.push({
                element: '[data-tour="removeBtn"]',
                intro: isEn ? 'Remove a device from this customer.' : 'Gỡ thiết bị khỏi khách hàng.',
            });
        }

        return steps;
    }, [isEn, canEdit]);

    const tour = useGuidedTour({
        isEn,
        enabled: true,
        steps: tourSteps,
    });

    if (!canView) {
        return (
            <div className="dcustomer-page dcustomer-page--denied">
                <Card className="dcustomer-card-denied">
                    <UserOutlined style={{ fontSize: 32, color: '#ff4d4f' }} />
                    <Title level={4} style={{ marginTop: 16 }}>
                        {t.noPermissionTitle}
                    </Title>
                    <Text type="secondary">{t.noPermissionDesc}</Text>
                </Card>
            </div>
        );
    }

    const customersBusy = customersLoading || customersValidating;
    const allDevicesBusy = loadingAllDevices || validatingAllDevices;

    return (
        <div className="dcustomer-page">
            <Card
                className="dcustomer-card"
                title={t.title}
                extra={
                    <Space data-tour="actionsBar">
                        {/* ✅ Help (tour) */}
                        <Tooltip title={isEn ? 'Guide' : 'Hướng dẫn'}>
                            <Button shape="circle" icon={<QuestionCircleOutlined />} onClick={tour.start} />
                        </Tooltip>

                        <Select
                            className="dcustomer-customer-select"
                            placeholder={t.filter.selectCustomerPlaceholder}
                            value={currentCustomerId || undefined}
                            onChange={(val) => setSelectedCustomer(val)}
                            showSearch
                            optionFilterProp="children"
                            filterOption={(input, option) =>
                                String(option?.children || '')
                                    .toLowerCase()
                                    .includes(input.toLowerCase())
                            }
                            loading={customersBusy}
                            disabled={customersBusy}
                            notFoundContent={customersBusy ? <Spin size="small" /> : null}
                            getPopupContainer={popupInParent}
                            data-tour="customerSelect"
                        >
                            {customers.map((c) => (
                                <Option key={c._id} value={c._id}>
                                    {c.username || c.phone || c.email || c._id}
                                </Option>
                            ))}
                        </Select>

                        <Button
                            icon={<ReloadOutlined />}
                            onClick={() => mutateDevices()}
                            disabled={!currentCustomerId}
                            data-tour="refreshBtn"
                        >
                            {t.buttons.refresh}
                        </Button>

                        <Button
                            icon={<DownloadOutlined />}
                            onClick={onExportExcel}
                            disabled={!currentCustomerId || !devices.length}
                            data-tour="exportBtn"
                        >
                            {t.buttons.export}
                        </Button>

                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => {
                                try {
                                    mutateAllDevices?.();
                                } catch (_) {}
                                setIsAddModalOpen(true);
                            }}
                            disabled={!currentCustomerId || !canEdit}
                            data-tour="addBtn"
                        >
                            {t.buttons.addDevice}
                        </Button>
                    </Space>
                }
            >
                <div data-tour="tableWrap">
                    <Table
                        rowKey="_id"
                        loading={loadingDevices || validatingDevices}
                        columns={columns}
                        dataSource={devices}
                        pagination={false}
                        scroll={{ x: 800 }}
                    />
                </div>

                {!currentCustomerId && <div className="dcustomer-empty-tip">{t.emptyTip}</div>}
            </Card>

            <DeviceCustomerAddModal
                open={isAddModalOpen}
                t={t}
                form={form}
                onOk={handleAddDevice}
                onCancel={() => {
                    setIsAddModalOpen(false);
                    form.resetFields();
                }}
                allDevices={allDevices}
                allDevicesBusy={allDevicesBusy}
                popupInParent={popupInParent}
            />
        </div>
    );
}
