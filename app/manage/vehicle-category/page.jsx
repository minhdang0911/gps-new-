'use client';

import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, Space, Popconfirm, message, Card } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';

import {
    getVehicleCategories,
    createVehicleCategory,
    updateVehicleCategory,
    deleteVehicleCategory,
    getManufacturerOptions,
} from '../../lib/api/vehicleCategory';

import { getMadeInFromOptions, getDeviceCategories } from '../../lib/api/deviceCategory';

import './VehicleCategoryPage.css';

const { Option } = Select;

const VehicleCategoryPage = () => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState([]);
    const [pagination, setPagination] = useState({
        current: 1,
        pageSize: 20,
        total: 0,
    });

    const [filters, setFilters] = useState({
        name: '',
        manufacturer: '',
        year: '',
        model: '',
        madeInFrom: '',
    });

    const [mifOptions, setMifOptions] = useState([]); // xuất xứ
    const [manufacturerOptions, setManufacturerOptions] = useState([]); // hãng xe
    const [deviceTypeOptions, setDeviceTypeOptions] = useState([]); // dòng thiết bị (device category)

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [form] = Form.useForm();

    const [role, setRole] = useState(null); // customer | distributor | administrator

    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';

    const isAdmin = role === 'administrator';
    const isDistributor = role === 'distributor';
    const isCustomer = role === 'customer';

    // Lấy role từ localStorage
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const storedRole = localStorage.getItem('role');
        setRole(storedRole);
    }, []);

    // Load options: xuất xứ + hãng + dòng thiết bị
    useEffect(() => {
        const fetchOptions = async () => {
            if (!token) return;
            try {
                // Xuất xứ (madeInFrom)
                const mifRes = await getMadeInFromOptions(token);
                const mifOpts = Object.entries(mifRes || {}).map(([value, label]) => ({
                    value,
                    label,
                }));
                setMifOptions(mifOpts);

                // Hãng xe (manufacturer)
                const manuRes = await getManufacturerOptions(token);
                const manuOpts = Object.entries(manuRes || {}).map(([value, label]) => ({
                    value,
                    label,
                }));
                setManufacturerOptions(manuOpts);

                // Dòng thiết bị (device category) – lấy làm options cho deviceTypeId
                const dcRes = await getDeviceCategories(token, {
                    page: 1,
                    limit: 100,
                });
                const dcItems = dcRes.items || [];
                const dtOpts = dcItems.map((item) => ({
                    value: item._id,
                    label: item.name || item.code || 'Không tên',
                }));
                setDeviceTypeOptions(dtOpts);
            } catch (err) {
                console.error('Load options vehicle category error:', err);
            }
        };

        fetchOptions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    const fetchList = async (page = 1, pageSize = 20, extraFilter = {}) => {
        if (!token) {
            message.error('Thiếu token, vui lòng đăng nhập lại');
            return;
        }

        // customer không cần gọi API
        if (role === 'customer') return;

        try {
            setLoading(true);
            const params = {
                page,
                limit: pageSize,
                name: filters.name || undefined,
                manufacturer: filters.manufacturer || undefined,
                year: filters.year || undefined,
                model: filters.model || undefined,
                madeInFrom: filters.madeInFrom || undefined,
                ...extraFilter,
            };

            const res = await getVehicleCategories(token, params);

            setData(res.items || []);
            setPagination({
                current: res.page || page,
                pageSize: res.limit || pageSize,
                total: res.total || 0,
            });
        } catch (err) {
            console.error('Load vehicle categories error:', err);
            message.error('Không tải được danh sách dòng xe');
        } finally {
            setLoading(false);
        }
    };

    // Chỉ fetch list khi đã biết role và role != customer
    useEffect(() => {
        if (!role || role === 'customer') return;
        fetchList(pagination.current, pagination.pageSize);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [role]);

    const handleTableChange = (pag) => {
        fetchList(pag.current, pag.pageSize);
    };

    const openCreateModal = () => {
        if (!isAdmin) {
            message.warning('Bạn không có quyền tạo dòng xe');
            return;
        }
        setEditingItem(null);
        form.resetFields();
        setIsModalOpen(true);
    };

    const openEditModal = (record) => {
        if (!isAdmin) {
            message.warning('Bạn không có quyền chỉnh sửa dòng xe');
            return;
        }
        setEditingItem(record);
        form.setFieldsValue({
            name: record.name,
            manufacturer: record.manufacturer,
            year: record.year,
            model: record.model,
            madeInFrom: record.madeInFrom,
            deviceTypeId: record.deviceTypeId || record.deviceType_id || '',
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (record) => {
        if (!isAdmin) {
            message.warning('Bạn không có quyền xoá dòng xe');
            return;
        }
        if (!token) return;

        try {
            await deleteVehicleCategory(token, record._id);
            message.success('Xoá dòng xe thành công');
            fetchList(pagination.current, pagination.pageSize);
        } catch (err) {
            console.error('Delete vehicle category error:', err);
            message.error('Xoá dòng xe thất bại');
        }
    };

    const handleModalOk = async () => {
        if (!isAdmin) {
            message.warning('Bạn không có quyền thao tác');
            return;
        }
        if (!token) return;

        try {
            const values = await form.validateFields();

            const payload = {
                name: values.name?.trim(),
                manufacturer: values.manufacturer,
                year: values.year?.trim(),
                model: values.model?.trim(),
                madeInFrom: values.madeInFrom,
            };

            // deviceTypeId không bắt buộc – chỉ gửi nếu có chọn
            if (values.deviceTypeId) {
                payload.deviceTypeId = values.deviceTypeId;
            }

            if (editingItem) {
                await updateVehicleCategory(token, editingItem._id, payload);
                message.success('Cập nhật dòng xe thành công');
            } else {
                await createVehicleCategory(token, payload);
                message.success('Tạo dòng xe thành công');
            }

            setIsModalOpen(false);
            form.resetFields();
            fetchList(pagination.current, pagination.pageSize);
        } catch (err) {
            if (err?.errorFields) {
                // lỗi validate form
                return;
            }

            console.error('Save vehicle category error:', err);

            const apiData = err?.response?.data;

            const msg =
                apiData?.error ||
                apiData?.message ||
                (typeof apiData === 'string' ? apiData : null) ||
                err?.message ||
                'Lưu dữ liệu thất bại';

            message.error(msg);
        }
    };

    const handleSearch = () => {
        fetchList(1, pagination.pageSize);
    };

    const handleResetFilter = () => {
        setFilters({
            name: '',
            manufacturer: '',
            year: '',
            model: '',
            madeInFrom: '',
        });
        fetchList(1, pagination.pageSize, {
            name: undefined,
            manufacturer: undefined,
            year: undefined,
            model: undefined,
            madeInFrom: undefined,
        });
    };

    const columns = [
        {
            title: 'Tên dòng xe',
            dataIndex: 'name',
            key: 'name',
        },
        {
            title: 'Hãng xe',
            dataIndex: 'manufacturer',
            key: 'manufacturer',
            render: (value) => {
                const found = manufacturerOptions.find((opt) => String(opt.value) === String(value));
                return found ? found.label : value || '-';
            },
        },
        {
            title: 'Năm',
            dataIndex: 'year',
            key: 'year',
            width: 100,
        },
        {
            title: 'Phiên bản / Model',
            dataIndex: 'model',
            key: 'model',
        },
        {
            title: 'Xuất xứ',
            dataIndex: 'madeInFrom',
            key: 'madeInFrom',
            render: (value) => {
                const found = mifOptions.find((opt) => String(opt.value) === String(value));
                return found ? found.label : value || '-';
            },
        },
        {
            title: 'Dòng thiết bị',
            dataIndex: 'deviceTypeId',
            key: 'deviceTypeId',
            render: (value) => {
                if (!value) return '-';
                const found = deviceTypeOptions.find((opt) => String(opt.value) === String(value));
                return found ? found.label : value;
            },
        },
        {
            title: 'Hành động',
            key: 'actions',
            width: 160,
            render: (_, record) =>
                isAdmin ? (
                    <Space>
                        <Button size="small" icon={<EditOutlined />} onClick={() => openEditModal(record)}>
                            Sửa
                        </Button>
                        <Popconfirm
                            title="Xoá dòng xe?"
                            description="Bạn có chắc chắn muốn xoá?"
                            onConfirm={() => handleDelete(record)}
                            okText="Xoá"
                            cancelText="Huỷ"
                        >
                            <Button size="small" danger icon={<DeleteOutlined />}>
                                Xoá
                            </Button>
                        </Popconfirm>
                    </Space>
                ) : null,
        },
    ];

    // customer -> chặn luôn trang
    if (isCustomer) {
        return (
            <div className="vc-page">
                <Card className="vc-card" title="Quản lý dòng xe (Vehicle Category)">
                    <p
                        style={{
                            color: '#ef4444',
                            fontWeight: 500,
                            margin: 0,
                        }}
                    >
                        Bạn không có quyền truy cập chức năng này.
                    </p>
                </Card>
            </div>
        );
    }

    return (
        <div className="vc-page">
            <Card
                className="vc-card"
                title="Quản lý dòng xe (Vehicle Category)"
                extra={
                    <Space className="vc-card__actions">
                        <Button
                            icon={<ReloadOutlined />}
                            onClick={() => fetchList(pagination.current, pagination.pageSize)}
                        >
                            Refresh
                        </Button>
                        {isAdmin && (
                            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
                                Thêm mới
                            </Button>
                        )}
                    </Space>
                }
            >
                {/* Bộ lọc */}
                <div className="vc-filter">
                    <Input
                        allowClear
                        prefix={<SearchOutlined />}
                        placeholder="Tìm theo tên dòng xe"
                        value={filters.name}
                        onChange={(e) =>
                            setFilters((prev) => ({
                                ...prev,
                                name: e.target.value,
                            }))
                        }
                    />
                    <Select
                        allowClear
                        placeholder="Hãng xe"
                        value={filters.manufacturer || undefined}
                        onChange={(value) =>
                            setFilters((prev) => ({
                                ...prev,
                                manufacturer: value || '',
                            }))
                        }
                        style={{ minWidth: 180 }}
                    >
                        {manufacturerOptions.map((opt) => (
                            <Option key={opt.value} value={opt.value}>
                                {opt.label}
                            </Option>
                        ))}
                    </Select>
                    <Input
                        allowClear
                        placeholder="Năm (vd: 2025)"
                        value={filters.year}
                        onChange={(e) =>
                            setFilters((prev) => ({
                                ...prev,
                                year: e.target.value,
                            }))
                        }
                    />
                    <Input
                        allowClear
                        placeholder="Phiên bản / Model"
                        value={filters.model}
                        onChange={(e) =>
                            setFilters((prev) => ({
                                ...prev,
                                model: e.target.value,
                            }))
                        }
                    />
                    <Select
                        allowClear
                        placeholder="Xuất xứ"
                        value={filters.madeInFrom || undefined}
                        onChange={(value) =>
                            setFilters((prev) => ({
                                ...prev,
                                madeInFrom: value || '',
                            }))
                        }
                        style={{ minWidth: 180 }}
                    >
                        {mifOptions.map((opt) => (
                            <Option key={opt.value} value={opt.value}>
                                {opt.label}
                            </Option>
                        ))}
                    </Select>

                    <Space className="vc-filter__actions">
                        <Button type="primary" onClick={handleSearch}>
                            Tìm kiếm
                        </Button>
                        <Button onClick={handleResetFilter}>Xoá lọc</Button>
                    </Space>
                </div>

                {/* Bảng */}
                <Table
                    rowKey="_id"
                    loading={loading}
                    columns={columns}
                    dataSource={data}
                    pagination={pagination}
                    onChange={handleTableChange}
                    className="vc-table"
                    scroll={{ x: 900 }}
                    size="middle"
                />
            </Card>

            {/* Modal thêm / sửa */}
            <Modal
                open={isModalOpen}
                title={editingItem ? 'Cập nhật dòng xe' : 'Thêm dòng xe'}
                onOk={handleModalOk}
                onCancel={() => {
                    setIsModalOpen(false);
                    form.resetFields();
                }}
                okText="Lưu"
                cancelText="Huỷ"
                wrapClassName="vc-modal"
                destroyOnClose
            >
                <Form form={form} layout="vertical">
                    <Form.Item
                        label="Tên dòng xe"
                        name="name"
                        rules={[
                            {
                                required: true,
                                message: 'Nhập tên dòng xe',
                            },
                        ]}
                    >
                        <Input />
                    </Form.Item>

                    <Form.Item
                        label="Hãng xe (manufacturer)"
                        name="manufacturer"
                        rules={[{ required: true, message: 'Chọn hãng xe' }]}
                    >
                        <Select placeholder="Chọn hãng xe">
                            {manufacturerOptions.map((opt) => (
                                <Option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item
                        label="Năm"
                        name="year"
                        rules={[
                            {
                                required: true,
                                message: 'Nhập năm (vd: 2025)',
                            },
                        ]}
                    >
                        <Input />
                    </Form.Item>

                    <Form.Item
                        label="Phiên bản / Model"
                        name="model"
                        rules={[
                            {
                                required: true,
                                message: 'Nhập phiên bản / model',
                            },
                        ]}
                    >
                        <Input />
                    </Form.Item>

                    <Form.Item
                        label="Xuất xứ (madeInFrom)"
                        name="madeInFrom"
                        rules={[{ required: true, message: 'Chọn xuất xứ' }]}
                    >
                        <Select placeholder="Chọn xuất xứ">
                            {mifOptions.map((opt) => (
                                <Option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item label="Dòng thiết bị (deviceTypeId)" name="deviceTypeId">
                        <Select allowClear placeholder="Chọn dòng thiết bị (không bắt buộc)">
                            {deviceTypeOptions.map((opt) => (
                                <Option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default VehicleCategoryPage;
