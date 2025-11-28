'use client';

import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, Space, Popconfirm, message, Card } from 'antd';
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    ReloadOutlined,
    SearchOutlined,
    DownloadOutlined,
} from '@ant-design/icons';

import {
    getDeviceCategories,
    createDeviceCategory,
    updateDeviceCategory,
    deleteDeviceCategory,
    getMadeInFromOptions,
} from '../../lib/api/deviceCategory';

import './DeviceCategoryPage.css';

import { getTodayForFileName } from '../../util/FormatDate';

// Excel style lib
import * as XLSX from 'xlsx-js-style';
import { saveAs } from 'file-saver';

const { Option } = Select;

const DeviceCategoryPage = () => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState([]);
    const [pagination, setPagination] = useState({
        current: 1,
        pageSize: 20,
        total: 0,
    });

    const [filters, setFilters] = useState({
        name: '',
        code: '',
        year: '',
        model: '',
        madeInFrom: '',
    });

    const [mifOptions, setMifOptions] = useState([]);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [form] = Form.useForm();

    const [role, setRole] = useState(null); // customer | distributor | administrator

    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';

    const isAdmin = role === 'administrator';
    const isDistributor = role === 'distributor';
    const isCustomer = role === 'customer';

    // helper lấy label xuất xứ
    const getMadeInFromLabel = (value) => {
        const found = mifOptions.find((opt) => String(opt.value) === String(value));
        return found ? found.label : value || '';
    };

    // Lấy role từ localStorage
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const storedRole = localStorage.getItem('role');
        setRole(storedRole);
    }, []);

    // load madeInFrom options
    useEffect(() => {
        const fetchMif = async () => {
            try {
                if (!token) return;
                const res = await getMadeInFromOptions(token);
                const opts = Object.entries(res || {}).map(([value, label]) => ({
                    value,
                    label,
                }));
                setMifOptions(opts);
            } catch (err) {
                console.error('Load madeInFrom options error:', err);
            }
        };

        fetchMif();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    const fetchList = async (page = 1, pageSize = 20, extraFilter = {}) => {
        if (!token) {
            message.error('Thiếu token, vui lòng đăng nhập lại');
            return;
        }

        // customer không cần gọi API luôn
        if (role === 'customer') return;

        try {
            setLoading(true);
            const params = {
                page,
                limit: pageSize,
                name: filters.name || undefined,
                code: filters.code || undefined,
                year: filters.year || undefined,
                model: filters.model || undefined,
                madeInFrom: filters.madeInFrom || undefined,
                ...extraFilter,
            };

            const res = await getDeviceCategories(token, params);

            setData(res.items || []);
            setPagination({
                current: res.page || page,
                pageSize: res.limit || pageSize,
                total: res.total || 0,
            });
        } catch (err) {
            console.error('Load device categories error:', err);
            message.error('Không tải được danh sách dòng thiết bị');
        } finally {
            setLoading(false);
        }
    };

    // Chỉ load list khi đã biết role và role != customer
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
            message.warning('Bạn không có quyền tạo dòng thiết bị');
            return;
        }
        setEditingItem(null);
        form.resetFields();
        setIsModalOpen(true);
    };

    const openEditModal = (record) => {
        if (!isAdmin) {
            message.warning('Bạn không có quyền chỉnh sửa dòng thiết bị');
            return;
        }
        setEditingItem(record);
        form.setFieldsValue({
            code: record.code,
            name: record.name,
            year: record.year,
            model: record.model,
            madeInFrom: record.madeInFrom || record.madeInFromId || record.madeInFrom_id,
            description: record.description,
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (record) => {
        if (!isAdmin) {
            message.warning('Bạn không có quyền xoá dòng thiết bị');
            return;
        }
        if (!token) return;

        try {
            await deleteDeviceCategory(token, record._id);
            message.success('Xoá dòng thiết bị thành công');
            fetchList(pagination.current, pagination.pageSize);
        } catch (err) {
            console.error('Delete device category error:', err);
            message.error('Xoá dòng thiết bị thất bại');
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
                code: values.code?.trim(),
                name: values.name?.trim(),
                year: values.year?.trim(),
                model: values.model?.trim(),
                madeInFrom: values.madeInFrom,
                description: values.description?.trim() || '',
            };

            if (editingItem) {
                await updateDeviceCategory(token, editingItem._id, payload);
                message.success('Cập nhật dòng thiết bị thành công');
            } else {
                await createDeviceCategory(token, payload);
                message.success('Tạo dòng thiết bị thành công');
            }

            setIsModalOpen(false);
            form.resetFields();
            fetchList(pagination.current, pagination.pageSize);
        } catch (err) {
            if (err?.errorFields) {
                return;
            }

            console.error('Save device category error:', err);

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
            code: '',
            year: '',
            model: '',
            madeInFrom: '',
        });
        fetchList(1, pagination.pageSize, {
            name: undefined,
            code: undefined,
            year: undefined,
            model: undefined,
            madeInFrom: undefined,
        });
    };

    /* =========================
        EXPORT EXCEL (xlsx-js-style)
    ========================= */
    const exportExcel = () => {
        if (!data.length) {
            message.warning('Không có dữ liệu để xuất');
            return;
        }

        try {
            // 1. Chuẩn bị data
            const excelData = data.map((item) => ({
                'Mã dòng': item.code || '',
                'Tên dòng thiết bị': item.name || '',
                Năm: item.year || '',
                Model: item.model || '',
                'Xuất xứ': getMadeInFromLabel(item.madeInFrom),
                'Mô tả': item.description || '',
            }));

            // 2. Tạo sheet, chừa dòng 1 cho title
            const ws = XLSX.utils.json_to_sheet(excelData, { origin: 'A2' });
            const headers = Object.keys(excelData[0]);

            // 3. Title dòng 1
            const title = 'Báo cáo danh sách dòng thiết bị';
            ws['A1'] = { v: title, t: 's' };
            ws['!merges'] = [
                {
                    s: { r: 0, c: 0 },
                    e: { r: 0, c: headers.length - 1 },
                },
            ];
            ws['A1'].s = {
                font: { bold: true, sz: 18, color: { rgb: 'FFFFFF' } },
                fill: { fgColor: { rgb: '4F81BD' } },
                alignment: { horizontal: 'center', vertical: 'center' },
            };
            ws['!rows'] = [{ hpt: 28 }, { hpt: 22 }];

            // 4. Header row (row 2)
            headers.forEach((h, idx) => {
                const ref = XLSX.utils.encode_cell({ r: 1, c: idx });
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

            // 5. Style data
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

                    // zebra stripe cho row > header
                    if (R > 1 && R % 2 === 0) {
                        cell.s.fill = cell.s.fill || {};
                        cell.s.fill.fgColor = cell.s.fill.fgColor || { rgb: 'F9F9F9' };
                    }
                }
            }

            // 6. Auto width
            ws['!cols'] = headers.map((key) => {
                const maxLen = Math.max(key.length, ...excelData.map((row) => String(row[key] || '').length));
                return { wch: maxLen + 4 };
            });

            // 7. Auto filter (header row 2)
            ws['!autofilter'] = {
                ref: XLSX.utils.encode_range({
                    s: { r: 1, c: 0 },
                    e: { r: range.e.r, c: range.e.c },
                }),
            };

            // 8. Workbook + save
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'DeviceCategories');

            const excelBuffer = XLSX.write(wb, {
                bookType: 'xlsx',
                type: 'array',
                cellStyles: true,
            });

            saveAs(new Blob([excelBuffer]), `DanhSachDongThietBi_${getTodayForFileName()}.xlsx`);
            message.success('Xuất Excel thành công');
        } catch (err) {
            console.error('Export excel error:', err);
            message.error('Xuất Excel thất bại');
        }
    };

    /* =========================
        COLUMNS + SORTER
    ========================= */
    const columns = [
        {
            title: 'Mã dòng',
            dataIndex: 'code',
            key: 'code',
            sorter: (a, b) => (a.code || '').localeCompare(b.code || ''),
        },
        {
            title: 'Tên dòng thiết bị',
            dataIndex: 'name',
            key: 'name',
            sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
        },
        {
            title: 'Năm',
            dataIndex: 'year',
            key: 'year',
            width: 100,
            sorter: (a, b) => Number(a.year || 0) - Number(b.year || 0),
        },
        {
            title: 'Model',
            dataIndex: 'model',
            key: 'model',
            sorter: (a, b) => (a.model || '').localeCompare(b.model || ''),
        },
        {
            title: 'Xuất xứ',
            dataIndex: 'madeInFrom',
            key: 'madeInFrom',
            sorter: (a, b) => getMadeInFromLabel(a.madeInFrom).localeCompare(getMadeInFromLabel(b.madeInFrom)),
            render: (value) => getMadeInFromLabel(value) || '-',
        },
        {
            title: 'Mô tả',
            dataIndex: 'description',
            key: 'description',
            ellipsis: true,
        },
        {
            title: 'Hành động',
            key: 'actions',
            width: 150,
            render: (_, record) =>
                isAdmin ? (
                    <Space>
                        <Button size="small" icon={<EditOutlined />} onClick={() => openEditModal(record)}>
                            Sửa
                        </Button>
                        <Popconfirm
                            title="Xoá dòng thiết bị?"
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

    // Nếu là customer -> chặn hẳn trang
    if (isCustomer) {
        return (
            <div className="dc-page">
                <Card className="dc-card" title="Quản lý dòng thiết bị (Device Category)">
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
        <div className="dc-page">
            <Card
                className="dc-card"
                title="Quản lý dòng thiết bị (Device Category)"
                extra={
                    <Space className="dc-card__actions">
                        <Button
                            icon={<ReloadOutlined />}
                            onClick={() => fetchList(pagination.current, pagination.pageSize)}
                        >
                            Refresh
                        </Button>
                        <Button icon={<DownloadOutlined />} onClick={exportExcel}>
                            Xuất Excel
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
                <div className="dc-filter">
                    <Input
                        allowClear
                        prefix={<SearchOutlined />}
                        placeholder="Tìm theo tên"
                        value={filters.name}
                        onChange={(e) =>
                            setFilters((prev) => ({
                                ...prev,
                                name: e.target.value,
                            }))
                        }
                    />
                    <Input
                        allowClear
                        placeholder="Mã dòng"
                        value={filters.code}
                        onChange={(e) =>
                            setFilters((prev) => ({
                                ...prev,
                                code: e.target.value,
                            }))
                        }
                    />
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
                        placeholder="Model"
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

                    <Space className="dc-filter__actions">
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
                    className="dc-table"
                    scroll={{ x: 800 }}
                    size="middle"
                />
            </Card>

            {/* Modal thêm / sửa */}
            <Modal
                open={isModalOpen}
                title={editingItem ? 'Cập nhật dòng thiết bị' : 'Thêm dòng thiết bị'}
                onOk={handleModalOk}
                onCancel={() => {
                    setIsModalOpen(false);
                    form.resetFields();
                }}
                okText="Lưu"
                cancelText="Huỷ"
                wrapClassName="dc-modal"
                destroyOnHidden
            >
                <Form form={form} layout="vertical">
                    <Form.Item
                        label="Mã dòng"
                        name="code"
                        rules={[{ required: true, message: 'Nhập mã dòng thiết bị' }]}
                    >
                        <Input />
                    </Form.Item>

                    <Form.Item
                        label="Tên dòng thiết bị"
                        name="name"
                        rules={[
                            {
                                required: true,
                                message: 'Nhập tên dòng thiết bị',
                            },
                        ]}
                    >
                        <Input />
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

                    <Form.Item label="Model" name="model" rules={[{ required: true, message: 'Nhập model' }]}>
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

                    <Form.Item label="Mô tả" name="description">
                        <Input.TextArea rows={3} />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default DeviceCategoryPage;
