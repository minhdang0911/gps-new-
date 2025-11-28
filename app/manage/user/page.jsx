'use client';

import React, { useState, useEffect } from 'react';
import { Card, Input, Button, Table, Space, Modal, Typography, Form, Select, Descriptions, message } from 'antd';
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    SearchOutlined,
    EyeOutlined,
    DownloadOutlined,
} from '@ant-design/icons';

import { createUser, updateUser, deleteUser, getUserInfo, getUserList } from '../../lib/api/user';

import './ManageUserPage.css';

// Excel
import * as XLSX from 'xlsx-js-style';
import { saveAs } from 'file-saver';
import { getTodayForFileName } from '../../util/FormatDate';

const { Title, Text } = Typography;
const { Option } = Select;

export default function ManageUserPage() {
    const [currentRole, setCurrentRole] = useState(null);
    const [users, setUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [userSearch, setUserSearch] = useState('');

    const [userModalVisible, setUserModalVisible] = useState(false);
    const [viewUserModalVisible, setViewUserModalVisible] = useState(false);
    const [viewUserData, setViewUserData] = useState(null);

    const [editingUser, setEditingUser] = useState(null);
    const [distributorOptions, setDistributorOptions] = useState([]);

    const [userFormData, setUserFormData] = useState({
        username: '',
        password: '',
        name: '',
        email: '',
        phone: '',
        address: '',
        position: 'customer',
        distributor_id: null,
    });

    useEffect(() => {
        const role = localStorage.getItem('role');
        setCurrentRole(role);
    }, []);

    useEffect(() => {
        loadUsers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userSearch]);

    const loadUsers = async () => {
        try {
            setLoadingUsers(true);

            const res = await getUserList({
                username: userSearch,
                phone: userSearch,
                email: userSearch,
                page: 1,
                limit: 50,
            });

            setUsers(res?.items || []);
        } catch (err) {
            console.log('LOAD USER ERROR', err);
            message.error('Không tải được danh sách người dùng');
        } finally {
            setLoadingUsers(false);
        }
    };

    const loadDistributors = async () => {
        try {
            const res = await getUserList({
                position: 'distributor',
                page: 1,
                limit: 100,
            });
            setDistributorOptions(res?.items || []);
        } catch (err) {
            console.log('LOAD DISTRIBUTOR ERROR', err);
        }
    };

    // OPEN CREATE USER
    const handleOpenAddUser = async () => {
        setEditingUser(null);

        setUserFormData({
            username: '',
            password: '',
            name: '',
            email: '',
            phone: '',
            address: '',
            position: 'customer',
            distributor_id: null,
        });

        if (currentRole === 'administrator') await loadDistributors();

        setUserModalVisible(true);
    };

    // OPEN EDIT USER
    const handleOpenEditUser = async (record) => {
        setEditingUser(record);

        setUserFormData({
            username: record.username,
            password: '',
            name: record.name,
            email: record.email,
            phone: record.phone,
            address: record.address,
            position: record.position || 'customer',
            distributor_id: record.distributor_id || null,
        });

        if (currentRole === 'administrator') await loadDistributors();

        setUserModalVisible(true);
    };

    // VIEW USER DETAIL
    const handleViewUser = async (record) => {
        try {
            const res = await getUserInfo(record._id);
            setViewUserData(res.user);
            setViewUserModalVisible(true);
        } catch (err) {
            console.log(err);
            message.error('Không tải được thông tin người dùng');
        }
    };

    const handleSaveUser = async () => {
        try {
            if (editingUser) {
                const payload = {
                    name: userFormData.name,
                    email: userFormData.email,
                    phone: userFormData.phone,
                    address: userFormData.address,
                    position: userFormData.position,
                };

                if (currentRole === 'administrator' && userFormData.position === 'customer') {
                    payload.distributor_id = userFormData.distributor_id || null;
                }

                if (userFormData.password.trim() !== '') {
                    payload.password = userFormData.password;
                }

                await updateUser(editingUser._id, payload);
                message.success('Cập nhật người dùng thành công');
            } else {
                const payload = { ...userFormData };

                if (currentRole !== 'administrator') {
                    delete payload.distributor_id;
                }

                await createUser(payload);
                message.success('Tạo người dùng thành công');
            }

            setUserModalVisible(false);
            loadUsers();
        } catch (err) {
            console.log('SAVE USER ERROR', err);
            const apiData = err?.response?.data;
            const msg =
                apiData?.error ||
                apiData?.message ||
                (typeof apiData === 'string' ? apiData : null) ||
                err?.message ||
                'Lưu người dùng thất bại';
            message.error(msg);
        }
    };

    const handleDeleteUser = (record) => {
        Modal.confirm({
            title: 'Xóa người dùng?',
            content: `Bạn có chắc muốn xóa ${record.username}?`,
            okType: 'danger',
            onOk: async () => {
                try {
                    await deleteUser(record._id);
                    message.success('Xóa người dùng thành công');
                    loadUsers();
                } catch (err) {
                    console.log('DELETE USER ERROR', err);
                    message.error('Xóa người dùng thất bại');
                }
            },
        });
    };

    // ===== EXPORT EXCEL =====
    const exportExcel = () => {
        if (!users.length) {
            message.warning('Không có dữ liệu để xuất');
            return;
        }

        try {
            const excelData = users.map((u) => {
                let distributorText = '';
                if (u.distributor_id) {
                    // có thể là id string hoặc object
                    if (typeof u.distributor_id === 'string') {
                        distributorText = u.distributor_id;
                    } else {
                        distributorText = `${u.distributor_id?.email || ''} (${u.distributor_id?.username || ''})`;
                    }
                }

                return {
                    'Tên đăng nhập': u.username || '',
                    'Họ tên': u.name || '',
                    Email: u.email || '',
                    'Số điện thoại': u.phone || '',
                    'Vai trò': u.position || '',
                    'Thuộc đại lý': distributorText,
                    'Ngày tạo': u.createdAt ? new Date(u.createdAt).toLocaleString('vi-VN') : '',
                };
            });

            const ws = XLSX.utils.json_to_sheet(excelData, { origin: 'A2' });
            const headers = Object.keys(excelData[0]);

            // Title dòng 1
            const title = 'Báo cáo danh sách người dùng';
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
            ws['!rows'] = [{ hpt: 26 }, { hpt: 22 }];

            // Header row (row 2 / index 1)
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

                    // zebra stripe cho row > header
                    if (R > 1 && R % 2 === 0) {
                        cell.s.fill = cell.s.fill || {};
                        cell.s.fill.fgColor = cell.s.fill.fgColor || { rgb: 'F9F9F9' };
                    }
                }
            }

            // Auto width
            ws['!cols'] = headers.map((key) => {
                const maxLen = Math.max(key.length, ...excelData.map((row) => String(row[key] || '').length));
                return { wch: maxLen + 4 };
            });

            // Auto filter
            ws['!autofilter'] = {
                ref: XLSX.utils.encode_range({
                    s: { r: 1, c: 0 },
                    e: { r: range.e.r, c: range.e.c },
                }),
            };

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Users');

            const excelBuffer = XLSX.write(wb, {
                bookType: 'xlsx',
                type: 'array',
                cellStyles: true,
            });

            saveAs(new Blob([excelBuffer]), `DanhSachNguoiDung_${getTodayForFileName()}.xlsx`);
            message.success('Xuất Excel thành công');
        } catch (err) {
            console.log('EXPORT EXCEL ERROR', err);
            message.error('Xuất Excel thất bại');
        }
    };

    // ===== COLUMNS + SORTER =====
    const userColumns = [
        {
            title: 'Tên đăng nhập',
            dataIndex: 'username',
            sorter: (a, b) => (a.username || '').localeCompare(b.username || ''),
        },
        {
            title: 'Họ tên',
            dataIndex: 'name',
            sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
        },
        {
            title: 'Email',
            dataIndex: 'email',
            sorter: (a, b) => (a.email || '').localeCompare(b.email || ''),
        },
        {
            title: 'Số điện thoại',
            dataIndex: 'phone',
            sorter: (a, b) => (a.phone || '').localeCompare(b.phone || ''),
        },
        {
            title: 'Vai trò',
            dataIndex: 'position',
            sorter: (a, b) => (a.position || '').localeCompare(b.position || ''),
        },
        {
            title: 'Thao tác',
            fixed: 'right',
            width: 220,
            render: (_, record) => (
                <Space>
                    <Button size="small" icon={<EditOutlined />} onClick={() => handleOpenEditUser(record)}>
                        Sửa
                    </Button>

                    <Button danger size="small" icon={<DeleteOutlined />} onClick={() => handleDeleteUser(record)}>
                        Xóa
                    </Button>

                    <Button size="small" icon={<EyeOutlined />} onClick={() => handleViewUser(record)}>
                        Xem
                    </Button>
                </Space>
            ),
        },
    ];

    return (
        <div className="user-page">
            <Card className="user-page__card">
                {/* HEADER */}
                <div className="user-page__header">
                    <Title level={4} className="user-page__title">
                        Quản lý người dùng
                    </Title>

                    <Space>
                        <Button icon={<DownloadOutlined />} onClick={exportExcel} disabled={!users.length}>
                            Xuất Excel
                        </Button>

                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={handleOpenAddUser}
                            className="user-page__add-btn"
                        >
                            Thêm người dùng
                        </Button>
                    </Space>
                </div>

                {/* SEARCH */}
                <div className="user-page__search">
                    <Input
                        placeholder="Tìm kiếm theo username / email / phone"
                        prefix={<SearchOutlined />}
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                    />
                </div>

                {/* TABLE */}
                <Table
                    rowKey="_id"
                    columns={userColumns}
                    loading={loadingUsers}
                    dataSource={users}
                    className="user-page__table"
                    scroll={{ x: 900 }}
                    size="middle"
                />
            </Card>

            {/* ADD/EDIT MODAL */}
            <Modal
                title={editingUser ? 'Sửa người dùng' : 'Tạo người dùng'}
                open={userModalVisible}
                onCancel={() => setUserModalVisible(false)}
                onOk={handleSaveUser}
                okText="Lưu"
                cancelText="Đóng"
                wrapClassName="user-modal"
                destroyOnHidden
            >
                <Form layout="vertical">
                    <Form.Item label="Tên đăng nhập">
                        <Input
                            value={userFormData.username}
                            onChange={(e) =>
                                setUserFormData((f) => ({
                                    ...f,
                                    username: e.target.value,
                                }))
                            }
                            disabled={!!editingUser}
                        />
                    </Form.Item>

                    <Form.Item label={editingUser ? 'Mật khẩu mới (tùy chọn)' : 'Mật khẩu'}>
                        <Input.Password
                            value={userFormData.password}
                            onChange={(e) =>
                                setUserFormData((f) => ({
                                    ...f,
                                    password: e.target.value,
                                }))
                            }
                            placeholder={editingUser ? 'Để trống nếu không đổi' : 'Nhập mật khẩu'}
                        />
                    </Form.Item>

                    <Form.Item label="Họ tên">
                        <Input
                            value={userFormData.name}
                            onChange={(e) =>
                                setUserFormData((f) => ({
                                    ...f,
                                    name: e.target.value,
                                }))
                            }
                        />
                    </Form.Item>

                    <Form.Item label="Email">
                        <Input
                            value={userFormData.email}
                            onChange={(e) =>
                                setUserFormData((f) => ({
                                    ...f,
                                    email: e.target.value,
                                }))
                            }
                        />
                    </Form.Item>

                    <Form.Item label="Số điện thoại">
                        <Input
                            value={userFormData.phone}
                            onChange={(e) =>
                                setUserFormData((f) => ({
                                    ...f,
                                    phone: e.target.value,
                                }))
                            }
                        />
                    </Form.Item>

                    <Form.Item label="Địa chỉ">
                        <Input
                            value={userFormData.address}
                            onChange={(e) =>
                                setUserFormData((f) => ({
                                    ...f,
                                    address: e.target.value,
                                }))
                            }
                        />
                    </Form.Item>

                    <Form.Item label="Vai trò">
                        <Select
                            value={userFormData.position}
                            onChange={(v) => setUserFormData((f) => ({ ...f, position: v }))}
                        >
                            {currentRole === 'administrator' && (
                                <>
                                    <Option value="administrator">Admin</Option>
                                    <Option value="distributor">Đại lý</Option>
                                </>
                            )}

                            <Option value="customer">Khách hàng</Option>
                        </Select>
                    </Form.Item>

                    {currentRole === 'administrator' && userFormData.position === 'customer' && (
                        <Form.Item label="Thuộc đại lý">
                            <Select
                                placeholder="Chọn đại lý"
                                value={userFormData.distributor_id || undefined}
                                onChange={(v) =>
                                    setUserFormData((f) => ({
                                        ...f,
                                        distributor_id: v,
                                    }))
                                }
                            >
                                {distributorOptions.map((d) => (
                                    <Option key={d._id} value={d._id}>
                                        {d.email} ({d.username})
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                    )}
                </Form>
            </Modal>

            {/* VIEW USER */}
            <Modal
                title="Thông tin người dùng"
                open={viewUserModalVisible}
                onCancel={() => setViewUserModalVisible(false)}
                footer={<Button onClick={() => setViewUserModalVisible(false)}>Đóng</Button>}
                wrapClassName="user-modal"
                destroyOnHidden
            >
                {viewUserData ? (
                    <Descriptions column={1} bordered>
                        <Descriptions.Item label="Username">{viewUserData.username}</Descriptions.Item>
                        <Descriptions.Item label="Tên">{viewUserData.name}</Descriptions.Item>
                        <Descriptions.Item label="Email">{viewUserData.email}</Descriptions.Item>
                        <Descriptions.Item label="Số điện thoại">{viewUserData.phone}</Descriptions.Item>
                        <Descriptions.Item label="Vai trò">{viewUserData.position}</Descriptions.Item>
                        <Descriptions.Item label="Distributor">
                            {typeof viewUserData.distributor_id === 'string'
                                ? viewUserData.distributor_id
                                : viewUserData.distributor_id
                                ? `${viewUserData.distributor_id.email} (${viewUserData.distributor_id.username})`
                                : ''}
                        </Descriptions.Item>
                        <Descriptions.Item label="Ngày tạo">
                            {viewUserData.createdAt ? new Date(viewUserData.createdAt).toLocaleString('vi-VN') : ''}
                        </Descriptions.Item>
                    </Descriptions>
                ) : (
                    'Đang tải...'
                )}
            </Modal>
        </div>
    );
}
