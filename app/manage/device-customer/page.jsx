'use client';

import React, { useEffect, useState } from 'react';
import { Card, Table, Button, Modal, Form, Select, Space, message, Tag, Typography, Popconfirm } from 'antd';
import { PlusOutlined, ReloadOutlined, DeleteOutlined, UserOutlined } from '@ant-design/icons';

import { getUserList } from '@/app/lib/api/user';
import { getDevices } from '@/app/lib/api/devices';
import { getDeviceCustomerList, addDeviceToCustomer, removeDeviceFromCustomer } from '@/app/lib/api/deviceCustomer';

import './DeviceCustomerPage.css';

const { Option } = Select;
const { Text } = Typography;

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

                // API m đang trả res.items
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

            // BE trả dạng { devices: [...] }
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

                // API getDevices tao đã để res.data
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

    // ==== GỠ THIẾT BỊ KHỎI CUSTOMER (CÓ CONFIRM) ====
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

    // ==== CỘT BẢNG ====
    const columns = [
        {
            title: 'IMEI',
            dataIndex: 'imei',
            key: 'imei',
        },
        {
            title: 'Biển số',
            dataIndex: 'license_plate',
            key: 'license_plate',
            render: (v) => v || '-',
        },
        {
            title: 'Dòng thiết bị',
            key: 'device_category',
            render: (_, record) => record.device_category_id?.name || record.device_category_id?.code || '-',
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
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
                    <Typography.Title level={4} style={{ marginTop: 16 }}>
                        Bạn không có quyền truy cập trang này
                    </Typography.Title>
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
                destroyOnClose
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
