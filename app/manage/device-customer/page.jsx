'use client';

import React, { useEffect, useState } from 'react';
import { Card, Table, Button, Modal, Form, Select, Space, message, Tag, Typography, Popconfirm } from 'antd';
import { PlusOutlined, ReloadOutlined, DeleteOutlined, UserOutlined, DownloadOutlined } from '@ant-design/icons';

import { getUserList } from '@/app/lib/api/user';
import { getDevices } from '@/app/lib/api/devices';
import { getDeviceCustomerList, addDeviceToCustomer, removeDeviceFromCustomer } from '@/app/lib/api/deviceCustomer';

import './DeviceCustomerPage.css';

// Excel xuất file
import * as XLSX from 'xlsx-js-style';
import { saveAs } from 'file-saver';
import { getTodayForFileName } from '@/app/util/FormatDate';

const { Option } = Select;
const { Text, Title } = Typography;

export default function DeviceCustomerPage() {
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

    // ==== INIT TOKEN + ROLE ====
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const t = localStorage.getItem('accessToken') || '';
        const r = localStorage.getItem('role') || '';
        setToken(t);
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
                message.error('Không tải được danh sách khách hàng');
            }
        };

        fetchCustomers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    // ==== LOAD DEVICES CỦA CUSTOMER ĐANG CHỌN ====
    useEffect(() => {
        if (!selectedCustomer) return;
        fetchDevices(selectedCustomer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCustomer]);

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
            message.error('Không tải được danh sách thiết bị của khách hàng');
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
                message.error('Không tải được danh sách thiết bị');
            } finally {
                setLoadingAllDevices(false);
            }
        };

        fetchAllDevices();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    // ==== THÊM THIẾT BỊ VÀO CUSTOMER ====
    const handleAddDevice = async () => {
        if (!token || !selectedCustomer) {
            message.error('Thiếu token hoặc khách hàng');
            return;
        }

        try {
            const values = await form.validateFields();

            await addDeviceToCustomer(token, {
                imei: values.imei,
                customerId: selectedCustomer,
            });

            message.success('Thêm thiết bị cho khách hàng thành công');
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
                'Thêm thiết bị thất bại';

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

            message.success('Gỡ thiết bị khỏi khách hàng thành công');
            fetchDevices(selectedCustomer);
        } catch (err) {
            console.error('Remove device error:', err);

            const apiData = err?.response?.data || err;

            const msg =
                apiData?.error ||
                apiData?.message ||
                (typeof apiData === 'string' ? apiData : null) ||
                err?.message ||
                'Gỡ thiết bị thất bại';

            message.error(msg);
        }
    };

    // ==== EXPORT EXCEL DANH SÁCH THIẾT BỊ CỦA CUSTOMER ====
    const exportExcel = () => {
        if (!selectedCustomer) {
            message.warning('Chọn khách hàng trước khi xuất Excel');
            return;
        }
        if (!devices.length) {
            message.warning('Khách hàng này chưa có thiết bị để xuất');
            return;
        }

        try {
            const customer = customers.find((c) => c._id === selectedCustomer);
            const customerLabel =
                customer?.username || customer?.phone || customer?.email || customer?._id || 'Khách hàng';

            // 1. Chuẩn bị data
            const excelData = devices.map((item) => ({
                IMEI: item.imei || '',
                'Biển số': item.license_plate || '',
                'Dòng thiết bị': item.device_category_id?.name || item.device_category_id?.code || '',
                'Trạng thái': item.status === 10 ? 'Online' : 'Offline',
            }));

            // 2. Tạo sheet, chừa dòng 1 cho title + dòng 2 cho info khách hàng
            const ws = XLSX.utils.json_to_sheet(excelData, { origin: 'A3' });
            const headers = Object.keys(excelData[0]);

            // 3. Title dòng 1
            const title = 'Báo cáo thiết bị theo khách hàng';
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
            const infoText = `Khách hàng: ${customerLabel}`;
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
                        const statusColIndex = headers.indexOf('Trạng thái');
                        if (C === statusColIndex && String(cell.v).trim() === 'Online') {
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
            message.success('Xuất Excel thành công');
        } catch (err) {
            console.error('Export excel error:', err);
            message.error('Xuất Excel thất bại');
        }
    };

    // ==== CỘT BẢNG (THÊM SORTER) ====
    const columns = [
        {
            title: 'IMEI',
            dataIndex: 'imei',
            key: 'imei',
            sorter: (a, b) => (a.imei || '').localeCompare(b.imei || ''),
        },
        {
            title: 'Biển số',
            dataIndex: 'license_plate',
            key: 'license_plate',
            sorter: (a, b) => (a.license_plate || '').localeCompare(b.license_plate || ''),
            render: (v) => v || '-',
        },
        {
            title: 'Dòng thiết bị',
            key: 'device_category',
            sorter: (a, b) => {
                const aLabel = a.device_category_id?.name || a.device_category_id?.code || '';
                const bLabel = b.device_category_id?.name || b.device_category_id?.code || '';
                return aLabel.localeCompare(bLabel);
            },
            render: (_, record) => record.device_category_id?.name || record.device_category_id?.code || '-',
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            sorter: (a, b) => (a.status || 0) - (b.status || 0),
            render: (status) => (
                <Tag color={status === 10 ? 'green' : 'red'}>{status === 10 ? 'Online' : 'Offline'}</Tag>
            ),
        },
        {
            title: 'Hành động',
            key: 'actions',
            width: 120,
            render: (_, record) => (
                <Popconfirm
                    title="Gỡ thiết bị khỏi khách hàng?"
                    description="Bạn có chắc chắn muốn gỡ thiết bị này?"
                    onConfirm={() => handleRemoveDevice(record)}
                    okText="Gỡ"
                    cancelText="Huỷ"
                >
                    <Button size="small" danger icon={<DeleteOutlined />}>
                        Gỡ
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
                        Bạn không có quyền truy cập trang này
                    </Title>
                    <Text type="secondary">Vui lòng liên hệ quản trị viên hoặc đại lý để được cấp quyền.</Text>
                </Card>
            </div>
        );
    }

    return (
        <div className="dcustomer-page">
            <Card
                className="dcustomer-card"
                title="Quản lý thiết bị khách hàng"
                extra={
                    <Space>
                        <Select
                            className="dcustomer-customer-select"
                            placeholder="Chọn khách hàng"
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
                            Refresh
                        </Button>

                        <Button
                            icon={<DownloadOutlined />}
                            onClick={exportExcel}
                            disabled={!selectedCustomer || !devices.length}
                        >
                            Xuất Excel
                        </Button>

                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => setIsAddModalOpen(true)}
                            disabled={!selectedCustomer}
                        >
                            Thêm thiết bị
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

                {!selectedCustomer && (
                    <div className="dcustomer-empty-tip">Chọn một khách hàng để xem danh sách thiết bị.</div>
                )}
            </Card>

            {/* MODAL THÊM THIẾT BỊ */}
            <Modal
                open={isAddModalOpen}
                title="Thêm thiết bị vào khách hàng"
                onOk={handleAddDevice}
                onCancel={() => {
                    setIsAddModalOpen(false);
                    form.resetFields();
                }}
                okText="Lưu"
                cancelText="Huỷ"
                destroyOnHidden
            >
                <Form form={form} layout="vertical">
                    <Form.Item
                        label="Thiết bị (IMEI)"
                        name="imei"
                        rules={[{ required: true, message: 'Chọn thiết bị (IMEI)' }]}
                    >
                        <Select
                            showSearch
                            placeholder="Chọn thiết bị"
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
