'use client';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, Input, Button, Table, Space, Modal, Typography, Select, Descriptions, message, Row, Col } from 'antd';
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    SearchOutlined,
    EyeOutlined,
    DownloadOutlined,
} from '@ant-design/icons';
import { usePathname } from 'next/navigation';
import { createUser, updateUser, deleteUser, getUserInfo, getUserList } from '../../lib/api/user';
import UserForm from '../../components/UserForm';
import './ManageUserPage.css';
import * as XLSX from 'xlsx-js-style';
import { saveAs } from 'file-saver';
import { getTodayForFileName } from '../../util/FormatDate';
import vi from '../../locales/vi.json';
import en from '../../locales/en.json';

const { Title } = Typography;
const { Option } = Select;
const locales = { vi, en };

const EMPTY_FORM = {
    username: '',
    password: '',
    name: '',
    email: '',
    phone: '',
    address: '',
    position: 'customer',
    distributor_id: null,
    place_id: null,
    place_raw: null,
    address_lat: null,
    address_lng: null,
};

export default function ManageUserPage() {
    const pathname = usePathname() || '/';
    const [currentRole, setCurrentRole] = useState(null);

    const isAdmin = currentRole === 'administrator';
    const isDistributor = currentRole === 'distributor';
    const canEdit = isAdmin || isDistributor;
    const canView = isAdmin || isDistributor;
    const canExport = isAdmin || isDistributor;
    const canCreate = isAdmin;
    const canDelete = isAdmin;

    const [users, setUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);

    const [searchUsername, setSearchUsername] = useState('');
    const [searchEmail, setSearchEmail] = useState('');
    const [searchPhone, setSearchPhone] = useState('');
    const [filterRole, setFilterRole] = useState('');

    const [userModalVisible, setUserModalVisible] = useState(false);
    const [viewUserModalVisible, setViewUserModalVisible] = useState(false);
    const [viewUserData, setViewUserData] = useState(null);
    const [editingUser, setEditingUser] = useState(null);

    const [distributorOptions, setDistributorOptions] = useState([]);
    const userFormDataRef = useRef(EMPTY_FORM);

    // ===== LANG DETECT =====
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

    const t = isEn ? locales.en.manageUser : locales.vi.manageUser;

    // ✅ thêm reporter
    const roleLabelMap = isEn
        ? {
              administrator: 'Admin',
              distributor: 'Distributor',
              reporter: 'Reporter',
              customer: 'Customer',
          }
        : {
              administrator: 'Quản trị',
              distributor: 'Đại lý',
              reporter: 'Giám sát',
              customer: 'Khách hàng',
          };

    // ===== INIT ROLE =====
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const role = localStorage.getItem('role');
        setCurrentRole(role);
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            loadUsers();
        }, 500);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchUsername, searchEmail, searchPhone, filterRole, currentRole]);

    const loadUsers = async () => {
        try {
            setLoadingUsers(true);

            const params = {
                username: searchUsername,
                email: searchEmail,
                phone: searchPhone,
                page: 1,
                limit: 50,
            };

            if (filterRole) {
                params.position = filterRole;
            }

            const res = await getUserList(params);
            setUsers(res?.items || []);
        } catch (err) {
            console.log('LOAD USER ERROR', err);
            message.error(t.messages.loadUsersError);
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
            message.error(t.messages.loadDistributorsError);
        }
    };

    const handleOpenAddUser = async () => {
        if (!canCreate) return;

        setEditingUser(null);
        userFormDataRef.current = { ...EMPTY_FORM };

        await loadDistributors();
        setUserModalVisible(true);
    };

    const handleOpenEditUser = async (record) => {
        if (!canEdit) return;

        setEditingUser(record);

        userFormDataRef.current = {
            username: record.username || '',
            password: '',
            name: record.name || '',
            email: record.email || '',
            phone: record.phone || '',
            address: record.address || '',
            position: record.position || 'customer',
            distributor_id: record.distributor_id || null,
            place_id: record.place_id || null,
            place_raw: record.address_raw || null,
            address_lat: record.address_lat || null,
            address_lng: record.address_lng || null,
        };

        await loadDistributors();
        setUserModalVisible(true);
    };

    const handleViewUser = async (record) => {
        if (!canView) return;

        try {
            const res = await getUserInfo(record._id);
            setViewUserData(res.user);
            setViewUserModalVisible(true);
        } catch (err) {
            console.log(err);
            message.error(t.messages.viewUserError);
        }
    };

    const handleSaveUser = async () => {
        if (!canEdit) return;

        try {
            const data = userFormDataRef.current || EMPTY_FORM;

            if (editingUser) {
                const payload = {
                    name: data.name,
                    email: data.email,
                    phone: data.phone,
                    address: data.address,
                    position: data.position,
                };

                if (data.position === 'customer' || data.position === 'reporter') {
                    payload.distributor_id = data.distributor_id || null;
                }

                if (data.password && data.password.trim() !== '') {
                    payload.password = data.password;
                }

                if (data.place_id) payload.place_id = data.place_id;
                if (data.place_raw) payload.address_raw = data.place_raw;
                if (data.address_lat) payload.address_lat = data.address_lat;
                if (data.address_lng) payload.address_lng = data.address_lng;

                await updateUser(editingUser._id, payload);
                message.success(t.messages.updateSuccess);
            } else {
                if (!canCreate) return;

                const payload = { ...data };
                const cleanPayload = {
                    username: payload.username,
                    password: payload.password,
                    name: payload.name,
                    email: payload.email,
                    phone: payload.phone,
                    address: payload.address,
                    position: payload.position,
                };

                if (payload.distributor_id) cleanPayload.distributor_id = payload.distributor_id;
                if (payload.place_id) cleanPayload.place_id = payload.place_id;
                if (payload.place_raw) cleanPayload.address_raw = payload.place_raw;
                if (payload.address_lat) cleanPayload.address_lat = payload.address_lat;
                if (payload.address_lng) cleanPayload.address_lng = payload.address_lng;

                await createUser(cleanPayload);
                message.success(t.messages.createSuccess);
            }

            setUserModalVisible(false);
            loadUsers();
        } catch (err) {
            console.log('SAVE USER ERROR', err);

            const apiData = err?.response?.data;
            if (apiData && Array.isArray(apiData.errors) && apiData.errors.length) {
                message.error(apiData.errors.join('\n'));
                return;
            }
            const singleMsg = apiData?.error || apiData?.message;
            if (singleMsg) {
                message.error(Array.isArray(singleMsg) ? singleMsg.join('\n') : String(singleMsg));
                return;
            }

            const fallback = err?.message || t.messages.saveFailedFallback;
            message.error(fallback);
        }
    };

    const handleDeleteUser = (record) => {
        if (!canDelete) return;

        Modal.confirm({
            title: t.messages.deleteConfirmTitle,
            content: `${t.messages.deleteConfirmContentPrefix}${record.username}?`,
            okType: 'danger',
            onOk: async () => {
                try {
                    await deleteUser(record._id);
                    message.success(t.messages.deleteSuccess);
                    loadUsers();
                } catch (err) {
                    console.log('DELETE USER ERROR', err);
                    message.error(t.messages.deleteFailed);
                }
            },
        });
    };

    const exportExcel = () => {
        if (!canExport) return;

        if (!users.length) {
            message.warning(t.messages.exportNoData);
            return;
        }

        try {
            const excelData = users.map((u) => {
                let distributorText = '';
                if (u.distributor_id) {
                    if (typeof u.distributor_id === 'string') {
                        distributorText = u.distributor_id;
                    } else {
                        distributorText = `${u.distributor_id?.email || ''} (${u.distributor_id?.username || ''})`;
                    }
                }
                return {
                    [t.excel.columns.username]: u.username || '',
                    [t.excel.columns.name]: u.name || '',
                    [t.excel.columns.email]: u.email || '',
                    [t.excel.columns.phone]: u.phone || '',
                    [t.excel.columns.role]: roleLabelMap[u.position] || u.position || '',
                    [t.excel.columns.distributor]: distributorText,
                    [t.excel.columns.createdAt]: u.createdAt
                        ? new Date(u.createdAt).toLocaleString(isEn ? 'en-GB' : 'vi-VN')
                        : '',
                };
            });

            const ws = XLSX.utils.json_to_sheet(excelData, { origin: 'A2' });
            const headers = Object.keys(excelData[0]);

            ws['A1'] = { v: t.excel.title, t: 's' };
            ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }];

            ws['A1'].s = {
                font: { bold: true, sz: 18, color: { rgb: 'FFFFFF' } },
                fill: { fgColor: { rgb: '4F81BD' } },
                alignment: { horizontal: 'center', vertical: 'center' },
            };

            ws['!rows'] = [{ hpt: 26 }, { hpt: 22 }];

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
                    if (R > 1 && R % 2 === 0) {
                        cell.s.fill = cell.s.fill || {};
                        cell.s.fill.fgColor = cell.s.fill.fgColor || { rgb: 'F9F9F9' };
                    }
                }
            }

            ws['!cols'] = headers.map((key) => {
                const maxLen = Math.max(key.length, ...excelData.map((row) => String(row[key] || '').length));
                return { wch: maxLen + 4 };
            });

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
            message.success(t.messages.exportSuccess);
        } catch (err) {
            console.log('EXPORT EXCEL ERROR', err);
            message.error(t.messages.exportFailed);
        }
    };

    const userColumns = [
        {
            title: t.table.username,
            dataIndex: 'username',
            sorter: (a, b) => (a.username || '').localeCompare(b.username || ''),
        },
        {
            title: t.table.name,
            dataIndex: 'name',
            sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
        },
        {
            title: t.table.email,
            dataIndex: 'email',
            sorter: (a, b) => (a.email || '').localeCompare(b.email || ''),
        },
        {
            title: t.table.phone,
            dataIndex: 'phone',
            sorter: (a, b) => (a.phone || '').localeCompare(b.phone || ''),
        },
        {
            title: t.table.role,
            dataIndex: 'position',
            sorter: (a, b) => (a.position || '').localeCompare(b.position || ''),
            render: (pos) => roleLabelMap[pos] || pos || '',
        },
        {
            title: t.table.actions,
            fixed: 'right',
            width: 240,
            render: (_, record) => (
                <Space>
                    <Button
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => handleOpenEditUser(record)}
                        disabled={!canEdit}
                    >
                        {t.actions.edit}
                    </Button>

                    <Button
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => handleDeleteUser(record)}
                        disabled={!canDelete}
                    >
                        {t.actions.delete}
                    </Button>

                    <Button
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => handleViewUser(record)}
                        disabled={!canView}
                    >
                        {t.actions.view}
                    </Button>
                </Space>
            ),
        },
    ];

    return (
        <div className="user-page">
            <Card className="user-page__card">
                <div className="user-page__header">
                    <Title level={4} className="user-page__title">
                        {t.title}
                    </Title>

                    <Space>
                        <Button
                            icon={<DownloadOutlined />}
                            onClick={exportExcel}
                            disabled={!canExport || !users.length}
                        >
                            {t.buttons.export}
                        </Button>

                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={handleOpenAddUser}
                            className="user-page__add-btn"
                            disabled={!canCreate}
                        >
                            {t.buttons.add}
                        </Button>
                    </Space>
                </div>

                <div className="user-page__search" style={{ marginBottom: 16 }}>
                    <Row gutter={[16, 16]}>
                        <Col xs={24} sm={6}>
                            <Input
                                placeholder={isEn ? 'Search by username' : 'Tìm theo tên đăng nhập'}
                                prefix={<SearchOutlined />}
                                value={searchUsername}
                                onChange={(e) => setSearchUsername(e.target.value)}
                                allowClear
                            />
                        </Col>
                        <Col xs={24} sm={6}>
                            <Input
                                placeholder={isEn ? 'Search by email' : 'Tìm theo email'}
                                prefix={<SearchOutlined />}
                                value={searchEmail}
                                onChange={(e) => setSearchEmail(e.target.value)}
                                allowClear
                            />
                        </Col>
                        <Col xs={24} sm={6}>
                            <Input
                                placeholder={isEn ? 'Search by phone' : 'Tìm theo số điện thoại'}
                                prefix={<SearchOutlined />}
                                value={searchPhone}
                                onChange={(e) => setSearchPhone(e.target.value)}
                                allowClear
                            />
                        </Col>
                        <Col xs={24} sm={6}>
                            <Select
                                placeholder={isEn ? 'Filter by role' : 'Lọc theo vai trò'}
                                value={filterRole || undefined}
                                onChange={(val) => setFilterRole(val || '')}
                                allowClear
                                style={{ width: '100%' }}
                            >
                                <Option value="administrator">{roleLabelMap.administrator}</Option>
                                <Option value="distributor">{roleLabelMap.distributor}</Option>
                                <Option value="reporter">{roleLabelMap.reporter}</Option> {/* ✅ thêm */}
                                <Option value="customer">{roleLabelMap.customer}</Option>
                            </Select>
                        </Col>
                    </Row>
                </div>

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

            <Modal
                title={editingUser ? t.modal.editTitle : t.modal.createTitle}
                open={userModalVisible}
                onCancel={() => setUserModalVisible(false)}
                onOk={handleSaveUser}
                okText={t.modal.okText}
                cancelText={t.modal.cancelText}
                wrapClassName="user-modal"
                destroyOnHidden
                okButtonProps={{ disabled: !canEdit }}
            >
                <UserForm
                    initialData={userFormDataRef.current}
                    currentRole={currentRole}
                    distributors={distributorOptions}
                    isEditing={!!editingUser}
                    onChange={(data) => {
                        userFormDataRef.current = data;
                    }}
                />
            </Modal>

            <Modal
                title={t.view.title}
                open={viewUserModalVisible}
                onCancel={() => setViewUserModalVisible(false)}
                footer={<Button onClick={() => setViewUserModalVisible(false)}>{t.view.close}</Button>}
                wrapClassName="user-modal"
                destroyOnHidden
            >
                {viewUserData ? (
                    <Descriptions column={1} bordered>
                        <Descriptions.Item label={t.view.fields.username}>{viewUserData.username}</Descriptions.Item>
                        <Descriptions.Item label={t.view.fields.name}>{viewUserData.name}</Descriptions.Item>
                        <Descriptions.Item label={t.view.fields.email}>{viewUserData.email}</Descriptions.Item>
                        <Descriptions.Item label={t.view.fields.phone}>{viewUserData.phone}</Descriptions.Item>
                        <Descriptions.Item label={t.view.fields.role}>
                            {roleLabelMap[viewUserData.position] || viewUserData.position || ''}
                        </Descriptions.Item>
                        <Descriptions.Item label={t.view.fields.distributor}>
                            {typeof viewUserData.distributor_id === 'string'
                                ? viewUserData.distributor_id
                                : viewUserData.distributor_id
                                ? `${viewUserData.distributor_id.email} (${viewUserData.distributor_id.username})`
                                : ''}
                        </Descriptions.Item>
                        <Descriptions.Item label={t.view.fields.address}>
                            {viewUserData.address || ''}
                        </Descriptions.Item>
                        <Descriptions.Item label={t.view.fields.createdAt}>
                            {viewUserData.createdAt
                                ? new Date(viewUserData.createdAt).toLocaleString(isEn ? 'en-GB' : 'vi-VN')
                                : ''}
                        </Descriptions.Item>
                    </Descriptions>
                ) : (
                    t.view.loading
                )}
            </Modal>
        </div>
    );
}
