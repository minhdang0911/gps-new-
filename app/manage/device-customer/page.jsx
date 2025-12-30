'use client';

import React, { useMemo, useState, useSyncExternalStore, useEffect } from 'react';
import useSWR from 'swr';
import { Card, Table, Button, Modal, Form, Select, Space, message, Tag, Typography, Popconfirm, Spin } from 'antd';
import { PlusOutlined, ReloadOutlined, DeleteOutlined, UserOutlined, DownloadOutlined } from '@ant-design/icons';
import { usePathname } from 'next/navigation';

import { getUserList } from '@/app/lib/api/user';
import { getDevices } from '@/app/lib/api/devices';
import { getDeviceCustomerList, addDeviceToCustomer, removeDeviceFromCustomer } from '@/app/lib/api/deviceCustomer';

import './DeviceCustomerPage.css';

// Excel xuất file
import * as XLSX from 'xlsx-js-style';
import { saveAs } from 'file-saver';
import { getTodayForFileName } from '@/app/util/FormatDate';

import vi from '../../locales/vi.json';
import en from '../../locales/en.json';

const locales = { vi, en };
const { Option } = Select;
const { Text, Title } = Typography;

/** ✅ đọc localStorage “chuẩn React” (khỏi useEffect + setState) */
function useLocalStorageValue(key, fallback = '') {
    const subscribe = (callback) => {
        if (typeof window === 'undefined') return () => {};
        const handler = (e) => {
            if (!e || e.key === key) callback();
        };
        window.addEventListener('storage', handler);
        return () => window.removeEventListener('storage', handler);
    };

    const getSnapshot = () => {
        if (typeof window === 'undefined') return fallback;
        return localStorage.getItem(key) ?? fallback;
    };

    const getServerSnapshot = () => fallback;

    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export default function DeviceCustomerPage() {
    const pathname = usePathname() || '/';

    // ✅ token/role/lang đọc trực tiếp
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
    const isCustomer = role === 'customer';

    const canView = isAdmin || isDistributor;
    const canEdit = isAdmin || isDistributor; // ✅ distributor được add/remove

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [form] = Form.useForm();

    // User chọn customer (nếu chưa chọn => dùng customer đầu tiên từ API)
    const [selectedCustomer, setSelectedCustomer] = useState(null);

    // ✅ Fix dropdown trong Modal / layout bị “click không ra”
    const popupInParent = (triggerNode) => triggerNode?.parentElement || document.body;

    /* =========================
        SWR: customers (position=customer)
    ========================= */
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

    // ✅ customer hiện tại: ưu tiên user đã chọn, fallback = customer đầu tiên
    const currentCustomerId = selectedCustomer || firstCustomerId;

    /* =========================
        SWR: devices of current customer
    ========================= */
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

    /* =========================
        SWR: all devices for dropdown
    ========================= */
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

    // ✅ Prefetch options khi mở modal (đỡ “bấm không thấy option”)
    useEffect(() => {
        if (!isAddModalOpen) return;
        try {
            mutateAllDevices?.();
            mutateCustomers?.();
        } catch (_) {}
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAddModalOpen]);

    /* =========================
        ACTIONS
    ========================= */
    const handleAddDevice = async () => {
        if (!token || !currentCustomerId) {
            message.error(t.missingTokenOrCustomer);
            return;
        }

        if (!canEdit) {
            message.warning(t.noPermissionAction || (isEn ? 'No permission' : 'Bạn không có quyền thao tác'));
            return;
        }

        try {
            const values = await form.validateFields();

            await addDeviceToCustomer(token, {
                imei: values.imei,
                customerId: currentCustomerId,
            });

            message.success(t.addSuccess);
            setIsAddModalOpen(false);
            form.resetFields();

            mutateDevices(); // ✅ refresh list
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

        if (!canEdit) {
            message.warning(t.noPermissionAction || (isEn ? 'No permission' : 'Bạn không có quyền thao tác'));
            return;
        }

        try {
            await removeDeviceFromCustomer(token, {
                imei: record.imei,
                customerId: currentCustomerId,
            });

            message.success(t.removeSuccess);
            mutateDevices(); // ✅ refresh list
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

    /* =========================
        EXPORT EXCEL
    ========================= */
    const exportExcel = () => {
        if (!currentCustomerId) {
            message.warning(t.exportNeedCustomer);
            return;
        }
        if (!devices.length) {
            message.warning(t.exportNoDevices);
            return;
        }

        try {
            const customer = customers.find((c) => c._id === currentCustomerId);
            const customerLabel =
                customer?.username || customer?.phone || customer?.email || customer?._id || t.customerFallback;

            const excelData = devices.map((item) => ({
                [t.columns.imei]: item.imei || '',
                [t.excel.colPlate]: item.license_plate || '',
                [t.excel.colDeviceCategory]: item.device_category_id?.name || item.device_category_id?.code || '',
                [t.excel.colStatus]: item.status === 10 ? t.status.online : t.status.offline,
            }));

            const ws = XLSX.utils.json_to_sheet(excelData, { origin: 'A3' });
            const headers = Object.keys(excelData[0]);

            // Title row 1
            const title = t.excel.title;
            ws['A1'] = { v: title, t: 's' };
            ws['!merges'] = ws['!merges'] || [];
            ws['!merges'].push({
                s: { r: 0, c: 0 },
                e: { r: 0, c: headers.length - 1 },
            });
            ws['A1'].s = {
                font: { bold: true, sz: 18, color: { rgb: 'FFFFFF' } },
                fill: { fgColor: { rgb: '4F81BD' } },
                alignment: { horizontal: 'center', vertical: 'center' },
            };

            // Row 2: customer info
            const infoText = `${t.excel.customerPrefix}${customerLabel}`;
            ws['A2'] = { v: infoText, t: 's' };
            ws['!merges'].push({
                s: { r: 1, c: 0 },
                e: { r: 1, c: headers.length - 1 },
            });
            ws['A2'].s = {
                font: { italic: true, sz: 11, color: { rgb: '333333' } },
                alignment: { horizontal: 'left', vertical: 'center' },
            };

            ws['!rows'] = [{ hpt: 26 }, { hpt: 20 }, { hpt: 22 }];

            // Header row (row 3 index = 2)
            headers.forEach((h, idx) => {
                const ref = XLSX.utils.encode_cell({ r: 2, c: idx });
                if (!ws[ref]) return;
                ws[ref].s = {
                    font: { bold: true, color: { rgb: 'FFFFFF' } },
                    fill: { fgColor: { rgb: '4F81BD' } },
                    alignment: { horizontal: 'center', vertical: 'center' },
                    border: {
                        top: { style: 'thin', color: { rgb: '000000' } },
                        bottom: { style: 'thin', color: { rgb: '000000' } },
                        left: { style: 'thin', color: { rgb: '000000' } },
                        right: { style: 'thin', color: { rgb: '000000' } },
                    },
                };
            });

            // Style data
            const range = XLSX.utils.decode_range(ws['!ref']);
            for (let R = range.s.r; R <= range.e.r; R++) {
                for (let C = range.s.c; C <= range.e.c; C++) {
                    const ref = XLSX.utils.encode_cell({ r: R, c: C });
                    const cell = ws[ref];
                    if (!cell) continue;

                    cell.s = cell.s || {};
                    cell.s.alignment = { horizontal: 'center', vertical: 'center' };
                    cell.s.border = {
                        top: { style: 'thin', color: { rgb: '000000' } },
                        bottom: { style: 'thin', color: { rgb: '000000' } },
                        left: { style: 'thin', color: { rgb: '000000' } },
                        right: { style: 'thin', color: { rgb: '000000' } },
                    };

                    // zebra stripe row > header (R > 2)
                    if (R > 2 && R % 2 === 1) {
                        cell.s.fill = cell.s.fill || {};
                        cell.s.fill.fgColor = cell.s.fill.fgColor || { rgb: 'F9F9F9' };
                    }

                    // status online highlight
                    if (R > 2) {
                        const statusColIndex = headers.indexOf(t.excel.colStatus);
                        if (C === statusColIndex && String(cell.v).trim() === t.status.online) {
                            cell.s.fill = { fgColor: { rgb: 'E2F0D9' } };
                        }
                    }
                }
            }

            ws['!cols'] = headers.map((key) => {
                const maxLen = Math.max(key.length, ...excelData.map((row) => String(row[key] || '').length));
                return { wch: maxLen + 4 };
            });

            ws['!autofilter'] = {
                ref: XLSX.utils.encode_range({
                    s: { r: 2, c: 0 },
                    e: { r: range.e.r, c: range.e.c },
                }),
            };

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'CustomerDevices');

            const excelBuffer = XLSX.write(wb, {
                bookType: 'xlsx',
                type: 'array',
                cellStyles: true,
            });

            saveAs(new Blob([excelBuffer]), `ThietBiKhachHang_${getTodayForFileName()}.xlsx`);
            message.success(t.exportSuccess);
        } catch (err) {
            console.error('Export excel error:', err);
            message.error(t.exportFailed);
        }
    };

    /* =========================
        TABLE COLUMNS
    ========================= */
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
                ) : null,
        },
    ];

    // ==== PHÂN QUYỀN: CUSTOMER KHÔNG ĐƯỢC VÀO ====
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
                    <Space>
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
                        >
                            {customers.map((c) => (
                                <Option key={c._id} value={c._id}>
                                    {c.username || c.phone || c.email || c._id}
                                </Option>
                            ))}
                        </Select>

                        <Button icon={<ReloadOutlined />} onClick={() => mutateDevices()} disabled={!currentCustomerId}>
                            {t.buttons.refresh}
                        </Button>

                        <Button
                            icon={<DownloadOutlined />}
                            onClick={exportExcel}
                            disabled={!currentCustomerId || !devices.length}
                        >
                            {t.buttons.export}
                        </Button>

                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => {
                                // ✅ prefetch để mở modal là có data
                                try {
                                    mutateAllDevices?.();
                                } catch (_) {}
                                setIsAddModalOpen(true);
                            }}
                            disabled={!currentCustomerId || !canEdit}
                        >
                            {t.buttons.addDevice}
                        </Button>
                    </Space>
                }
            >
                <Table
                    rowKey="_id"
                    loading={loadingDevices || validatingDevices}
                    columns={columns}
                    dataSource={devices}
                    pagination={false}
                    scroll={{ x: 800 }}
                />

                {!currentCustomerId && <div className="dcustomer-empty-tip">{t.emptyTip}</div>}
            </Card>

            {/* MODAL THÊM THIẾT BỊ */}
            <Modal
                open={isAddModalOpen}
                title={t.modal.title}
                onOk={handleAddDevice}
                onCancel={() => {
                    setIsAddModalOpen(false);
                    form.resetFields();
                }}
                okText={t.modal.okText}
                cancelText={t.modal.cancelText}
                destroyOnClose
            >
                <Form form={form} layout="vertical">
                    <Form.Item
                        label={t.modal.imeiLabel}
                        name="imei"
                        rules={[{ required: true, message: t.modal.imeiRequired }]}
                    >
                        <Select
                            showSearch
                            placeholder={t.modal.imeiPlaceholder}
                            loading={allDevicesBusy}
                            disabled={allDevicesBusy}
                            notFoundContent={allDevicesBusy ? <Spin size="small" /> : null}
                            optionFilterProp="children"
                            filterOption={(input, option) =>
                                String(option?.children || '')
                                    .toLowerCase()
                                    .includes(input.toLowerCase())
                            }
                            getPopupContainer={popupInParent}
                        >
                            {allDevices.map((d) => (
                                <Option key={d._id} value={d.imei}>
                                    {d.imei} {d.license_plate ? ` - ${d.license_plate}` : ''}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
