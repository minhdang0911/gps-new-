'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Card, Table, Button, Modal, Form, Select, Space, message, Tag, Typography, Popconfirm } from 'antd';
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

export default function DeviceCustomerPage() {
    const pathname = usePathname() || '/';

    const [role, setRole] = useState('');
    const [token, setToken] = useState('');

    const [customers, setCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);

    const [devices, setDevices] = useState([]);
    const [loadingDevices, setLoadingDevices] = useState(false);

    const [allDevices, setAllDevices] = useState([]);
    const [loadingAllDevices, setLoadingAllDevices] = useState(false);

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [form] = Form.useForm();

    // ===== LANG =====
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

    const t = isEn ? locales.en.deviceCustomer : locales.vi.deviceCustomer;

    // ==== INIT TOKEN + ROLE ====
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const tkn = localStorage.getItem('accessToken') || '';
        const r = localStorage.getItem('role') || '';
        setToken(tkn);
        setRole(r);
    }, []);

    // ==== LOAD CUSTOMERS (user position = customer) ====
    useEffect(() => {
        const fetchCustomers = async () => {
            if (!token) return;
            try {
                const res = await getUserList({
                    page: 1,
                    limit: 100,
                });

                const allUsers = res.items || res.users || [];
                const onlyCustomers = allUsers.filter((u) => u.position === 'customer');

                setCustomers(onlyCustomers);

                // auto select customer đầu tiên
                if (!selectedCustomer && onlyCustomers.length > 0) {
                    setSelectedCustomer(onlyCustomers[0]._id);
                }
            } catch (err) {
                console.error('Load customers error:', err);
                message.error(t.loadCustomersError);
            }
        };

        fetchCustomers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, isEn]); // đổi lang vẫn xài được message mới

    // ==== LOAD DEVICES CỦA CUSTOMER ĐANG CHỌN ====
    useEffect(() => {
        if (!selectedCustomer) return;
        fetchDevices(selectedCustomer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCustomer, isEn]);

    const fetchDevices = async (customerId) => {
        if (!token || !customerId) return;

        try {
            setLoadingDevices(true);
            const res = await getDeviceCustomerList(token, customerId, {
                page: 1,
                limit: 50,
            });

            setDevices(res.devices || []);
        } catch (err) {
            console.error('Load device of customer error:', err);
            message.error(t.loadDevicesError);
        } finally {
            setLoadingDevices(false);
        }
    };

    // ==== LOAD TOÀN BỘ THIẾT BỊ (CHO DROPDOWN IMEI) ====
    useEffect(() => {
        const fetchAllDevices = async () => {
            if (!token) return;
            try {
                setLoadingAllDevices(true);
                const res = await getDevices(token, {
                    page: 1,
                    limit: 200,
                });

                setAllDevices(res.devices || res.items || []);
            } catch (err) {
                console.error('Load all devices error:', err);
                message.error(t.loadAllDevicesError);
            } finally {
                setLoadingAllDevices(false);
            }
        };

        fetchAllDevices();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, isEn]);

    // ==== THÊM THIẾT BỊ VÀO CUSTOMER ====
    const handleAddDevice = async () => {
        if (!token || !selectedCustomer) {
            message.error(t.missingTokenOrCustomer);
            return;
        }

        try {
            const values = await form.validateFields();

            await addDeviceToCustomer(token, {
                imei: values.imei,
                customerId: selectedCustomer,
            });

            message.success(t.addSuccess);
            setIsAddModalOpen(false);
            form.resetFields();
            fetchDevices(selectedCustomer);
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

    // ==== GỠ THIẾT BỊ KHỎI CUSTOMER ====
    const handleRemoveDevice = async (record) => {
        if (!token || !selectedCustomer) return;

        try {
            await removeDeviceFromCustomer(token, {
                imei: record.imei,
                customerId: selectedCustomer,
            });

            message.success(t.removeSuccess);
            fetchDevices(selectedCustomer);
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

    // ==== EXPORT EXCEL DANH SÁCH THIẾT BỊ CỦA CUSTOMER ====
    const exportExcel = () => {
        if (!selectedCustomer) {
            message.warning(t.exportNeedCustomer);
            return;
        }
        if (!devices.length) {
            message.warning(t.exportNoDevices);
            return;
        }

        try {
            const customer = customers.find((c) => c._id === selectedCustomer);
            const customerLabel =
                customer?.username || customer?.phone || customer?.email || customer?._id || t.customerFallback;

            // 1. Chuẩn bị data
            const excelData = devices.map((item) => ({
                [t.columns.imei]: item.imei || '',
                [t.excel.colPlate]: item.license_plate || '',
                [t.excel.colDeviceCategory]: item.device_category_id?.name || item.device_category_id?.code || '',
                [t.excel.colStatus]: item.status === 10 ? t.status.online : t.status.offline,
            }));

            // 2. Tạo sheet, chừa dòng 1 cho title + dòng 2 cho info khách hàng
            const ws = XLSX.utils.json_to_sheet(excelData, { origin: 'A3' });
            const headers = Object.keys(excelData[0]);

            // 3. Title dòng 1
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

            // 4. Dòng 2: thông tin khách hàng
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

            // 5. Header row (row 3 index = 2)
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

            // 6. Style data
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

                    // zebra stripe cho row > header (R > 2)
                    if (R > 2 && R % 2 === 1) {
                        cell.s.fill = cell.s.fill || {};
                        cell.s.fill.fgColor = cell.s.fill.fgColor || { rgb: 'F9F9F9' };
                    }

                    // Trạng thái online -> xanh nhạt
                    if (R > 2) {
                        const statusColIndex = headers.indexOf(t.excel.colStatus);
                        if (C === statusColIndex && String(cell.v).trim() === t.status.online) {
                            cell.s.fill = { fgColor: { rgb: 'E2F0D9' } };
                        }
                    }
                }
            }

            // 7. Auto width
            ws['!cols'] = headers.map((key) => {
                const maxLen = Math.max(key.length, ...excelData.map((row) => String(row[key] || '').length));
                return { wch: maxLen + 4 };
            });

            // 8. Auto filter (header row index 2)
            ws['!autofilter'] = {
                ref: XLSX.utils.encode_range({
                    s: { r: 2, c: 0 },
                    e: { r: range.e.r, c: range.e.c },
                }),
            };

            // 9. Workbook + save
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

    // ==== CỘT BẢNG (THÊM SORTER) ====
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
            render: (_, record) => (
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
            ),
        },
    ];

    // ==== PHÂN QUYỀN: CUSTOMER KHÔNG ĐƯỢC VÀO ====
    if (role === 'customer') {
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
                            value={selectedCustomer || undefined}
                            onChange={(val) => setSelectedCustomer(val)}
                            showSearch
                            optionFilterProp="children"
                            filterOption={(input, option) =>
                                (option?.children || '').toLowerCase().includes(input.toLowerCase())
                            }
                        >
                            {customers.map((c) => (
                                <Option key={c._id} value={c._id}>
                                    {c.username || c.phone || c.email || c._id}
                                </Option>
                            ))}
                        </Select>

                        <Button
                            icon={<ReloadOutlined />}
                            onClick={() => selectedCustomer && fetchDevices(selectedCustomer)}
                        >
                            {t.buttons.refresh}
                        </Button>

                        <Button
                            icon={<DownloadOutlined />}
                            onClick={exportExcel}
                            disabled={!selectedCustomer || !devices.length}
                        >
                            {t.buttons.export}
                        </Button>

                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => setIsAddModalOpen(true)}
                            disabled={!selectedCustomer}
                        >
                            {t.buttons.addDevice}
                        </Button>
                    </Space>
                }
            >
                <Table
                    rowKey="_id"
                    loading={loadingDevices}
                    columns={columns}
                    dataSource={devices}
                    pagination={false}
                    scroll={{ x: 800 }}
                />

                {!selectedCustomer && <div className="dcustomer-empty-tip">{t.emptyTip}</div>}
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
                destroyOnHidden
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
                            loading={loadingAllDevices}
                            optionFilterProp="children"
                            filterOption={(input, option) =>
                                (option?.children || '').toLowerCase().includes(input.toLowerCase())
                            }
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
