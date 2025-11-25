'use client';

import React, { useState, useEffect } from 'react';
import { Card, Input, Button, Table, Space, Modal, Typography, Form, Select, Descriptions } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, EyeOutlined } from '@ant-design/icons';

import { createUser, updateUser, deleteUser, getUserInfo, getUserList } from '../../lib/api/user';

import './ManageUserPage.css';

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
            } else {
                const payload = { ...userFormData };

                if (currentRole !== 'administrator') {
                    delete payload.distributor_id;
                }

                await createUser(payload);
            }

            setUserModalVisible(false);
            loadUsers();
        } catch (err) {
            console.log('SAVE USER ERROR', err);
        }
    };

    const handleDeleteUser = (record) => {
        Modal.confirm({
            title: 'Xóa người dùng?',
            content: `Bạn có chắc muốn xóa ${record.username}?`,
            okType: 'danger',
            onOk: async () => {
                await deleteUser(record._id);
                loadUsers();
            },
        });
    };

    const userColumns = [
        { title: 'Tên đăng nhập', dataIndex: 'username' },
        { title: 'Họ tên', dataIndex: 'name' },
        { title: 'Email', dataIndex: 'email' },
        { title: 'Số điện thoại', dataIndex: 'phone' },
        { title: 'Vai trò', dataIndex: 'position' },
        {
            title: 'Thao tác',
            fixed: 'right',
            width: 200,
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

                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={handleOpenAddUser}
                        className="user-page__add-btn"
                    >
                        Thêm người dùng
                    </Button>
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
                    scroll={{ x: 800 }}
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
                destroyOnClose
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
                destroyOnClose
            >
                {viewUserData ? (
                    <Descriptions column={1} bordered>
                        <Descriptions.Item label="Username">{viewUserData.username}</Descriptions.Item>
                        <Descriptions.Item label="Tên">{viewUserData.name}</Descriptions.Item>
                        <Descriptions.Item label="Email">{viewUserData.email}</Descriptions.Item>
                        <Descriptions.Item label="Số điện thoại">{viewUserData.phone}</Descriptions.Item>
                        <Descriptions.Item label="Vai trò">{viewUserData.position}</Descriptions.Item>
                        <Descriptions.Item label="Distributor">{viewUserData.distributor_id}</Descriptions.Item>
                        <Descriptions.Item label="Ngày tạo">
                            {new Date(viewUserData.createdAt).toLocaleString()}
                        </Descriptions.Item>
                    </Descriptions>
                ) : (
                    'Đang tải...'
                )}
            </Modal>
        </div>
    );
}
