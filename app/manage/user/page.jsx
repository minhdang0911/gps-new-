'use client';

import React, { useMemo, useRef, useState, useEffect, useSyncExternalStore, useCallback } from 'react';
import useSWR from 'swr';
import {
    Card,
    Input,
    Button,
    Table,
    Space,
    Modal,
    Typography,
    Select,
    Descriptions,
    message,
    Row,
    Col,
    Spin,
    Tooltip,
} from 'antd';
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    SearchOutlined,
    EyeOutlined,
    DownloadOutlined,
    QuestionCircleOutlined,
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

// ✅ Intro.js styles
import 'intro.js/introjs.css';
import '../../styles/intro-custom.css';

// ✅ shared guided tour hook
import { useGuidedTour } from '../../hooks/common/useGuidedTour';

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

/** debounce value để khỏi setTimeout effect + setState warning */
function useDebouncedValue(value, delay = 400) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
}

export default function ManageUserPage() {
    const pathname = usePathname() || '/';

    // ✅ token/role/lang đọc trực tiếp (khỏi setState trong effect)
    const token = useLocalStorageValue('accessToken', '');
    const currentRole = useLocalStorageValue('role', '');
    const langFromStorage = useLocalStorageValue('iky_lang', 'vi');

    // ✅ Fix dropdown trong Modal / layout bị “click không ra”
    const popupInParent = (triggerNode) => triggerNode?.parentElement || document.body;

    const isEnFromPath = useMemo(() => {
        const segments = pathname.split('/').filter(Boolean);
        const last = segments[segments.length - 1];
        return last === 'en';
    }, [pathname]);

    const isEn = isEnFromPath ? true : langFromStorage === 'en';
    const t = isEn ? locales.en.manageUser : locales.vi.manageUser;

    const isAdmin = currentRole === 'administrator';
    const isDistributor = currentRole === 'distributor';
    const canEdit = isAdmin || isDistributor;
    const canView = isAdmin || isDistributor;
    const canExport = isAdmin || isDistributor;
    const canCreate = isAdmin;
    const canDelete = isAdmin;

    // ✅ thêm reporter
    const roleLabelMap = useMemo(
        () =>
            isEn
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
                  },
        [isEn],
    );

    // Filters UI (typing)
    const [searchUsername, setSearchUsername] = useState('');
    const [searchEmail, setSearchEmail] = useState('');
    const [searchPhone, setSearchPhone] = useState('');
    const [filterRole, setFilterRole] = useState('');

    // ✅ Debounce để đỡ call API dồn dập
    const dUsername = useDebouncedValue(searchUsername, 450);
    const dEmail = useDebouncedValue(searchEmail, 450);
    const dPhone = useDebouncedValue(searchPhone, 450);
    const dRole = useDebouncedValue(filterRole, 250);

    // Modal state
    const [userModalVisible, setUserModalVisible] = useState(false);
    const [viewUserModalVisible, setViewUserModalVisible] = useState(false);
    const [editingUser, setEditingUser] = useState(null);

    const [viewUserId, setViewUserId] = useState(null);

    // Form data ref (for saving) + state (for render initialData)
    const userFormDataRef = useRef(EMPTY_FORM);
    const [initialFormData, setInitialFormData] = useState(EMPTY_FORM);

    /* =========================
        SWR: USERS LIST
    ========================= */
    const listParams = useMemo(() => {
        const params = {
            username: dUsername || undefined,
            email: dEmail || undefined,
            phone: dPhone || undefined,
            page: 1,
            limit: 50,
        };
        if (dRole) params.position = dRole;
        return params;
    }, [dUsername, dEmail, dPhone, dRole]);

    const usersKey = canView ? ['users', listParams, isEn] : null;

    const {
        data: usersRes,
        isLoading: loadingUsers,
        isValidating: validatingUsers,
        mutate: mutateUsers,
    } = useSWR(
        usersKey,
        async ([, params]) => {
            const res = await getUserList(params);
            return res?.items || [];
        },
        {
            keepPreviousData: true,
            revalidateOnFocus: false,
            dedupingInterval: 10_000,
            onError: (err) => {
                console.log('LOAD USER ERROR', err);
                message.error(t.messages.loadUsersError);
            },
        },
    );

    const users = usersRes || [];

    /* =========================
        SWR: DISTRIBUTORS OPTIONS
        - chỉ load khi mở modal
    ========================= */
    const distributorsKey = userModalVisible ? ['distributors', isEn] : null;

    const {
        data: distributorsRes,
        isLoading: loadingDistributors,
        isValidating: validatingDistributors,
        mutate: mutateDistributors,
    } = useSWR(
        distributorsKey,
        async () => {
            const res = await getUserList({
                position: 'distributor',
                page: 1,
                limit: 100,
            });
            return res?.items || [];
        },
        {
            revalidateOnFocus: false,
            dedupingInterval: 60_000,
            onError: (err) => {
                console.log('LOAD DISTRIBUTOR ERROR', err);
                message.error(t.messages.loadDistributorsError);
            },
        },
    );

    const distributorOptions = distributorsRes || [];
    const distributorsBusy = loadingDistributors || validatingDistributors;

    // ✅ Prefetch distributor list khi mở modal
    useEffect(() => {
        if (!userModalVisible) return;
        try {
            mutateDistributors?.();
        } catch (_) {}
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userModalVisible]);

    /* =========================
        SWR: VIEW USER INFO
    ========================= */
    const viewKey = viewUserModalVisible && viewUserId ? ['userInfo', viewUserId, isEn] : null;

    const { data: viewRes, isLoading: loadingViewUser } = useSWR(
        viewKey,
        async ([, id]) => {
            const res = await getUserInfo(id);
            return res?.user || null;
        },
        {
            revalidateOnFocus: false,
            dedupingInterval: 10_000,
            onError: (err) => {
                console.log(err);
                message.error(t.messages.viewUserError);
            },
        },
    );

    const viewUserData = viewRes;

    /* =========================
        OPEN / CLOSE MODALS
    ========================= */
    const handleOpenAddUser = () => {
        if (!canCreate) return;

        setEditingUser(null);

        const init = { ...EMPTY_FORM };
        userFormDataRef.current = init;
        setInitialFormData(init);

        try {
            mutateDistributors?.();
        } catch (_) {}

        setUserModalVisible(true);
    };

    const handleOpenEditUser = (record) => {
        if (!canEdit) return;

        setEditingUser(record);

        const init = {
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

        userFormDataRef.current = init;
        setInitialFormData(init);

        try {
            mutateDistributors?.();
        } catch (_) {}

        setUserModalVisible(true);
    };

    const handleViewUser = (record) => {
        if (!canView) return;
        setViewUserId(record._id);
        setViewUserModalVisible(true);
    };

    const closeUserModal = useCallback(() => {
        setUserModalVisible(false);
        setEditingUser(null);

        userFormDataRef.current = EMPTY_FORM;
        setInitialFormData(EMPTY_FORM);
    }, []);

    /* =========================
        SAVE / DELETE
    ========================= */
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

            closeUserModal();
            mutateUsers();
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
                    mutateUsers();
                } catch (err) {
                    console.log('DELETE USER ERROR', err);
                    message.error(t.messages.deleteFailed);
                }
            },
        });
    };

    /* =========================
        EXPORT EXCEL
    ========================= */
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

    /* =========================
        TABLE COLUMNS
    ========================= */
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
                <Space data-tour="rowActions">
                    <Button
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => handleOpenEditUser(record)}
                        disabled={!canEdit}
                        data-tour="editBtn"
                    >
                        {t.actions.edit}
                    </Button>

                    <Button
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => handleDeleteUser(record)}
                        disabled={!canDelete}
                        data-tour="deleteBtn"
                    >
                        {t.actions.delete}
                    </Button>

                    <Button
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => handleViewUser(record)}
                        disabled={!canView}
                        data-tour="viewBtn"
                    >
                        {t.actions.view}
                    </Button>
                </Space>
            ),
        },
    ];

    // ✅ TOUR STEPS (role-aware)
    const tourSteps = useMemo(() => {
        const steps = [
            {
                element: '[data-tour="searchBox"]',
                intro: isEn
                    ? 'Use these filters to quickly find users (debounced).'
                    : 'Dùng các bộ lọc này để tìm người dùng nhanh  Gợi ý: Đây là bước review để tránh sửa/xoá nhầm.',
            },
            {
                element: '[data-tour="roleFilter"]',
                intro: isEn ? 'Filter users by role.' : 'Lọc người dùng theo vai trò.',
            },
            {
                element: '[data-tour="table"]',
                intro: isEn ? 'This table shows the user list.' : 'Bảng hiển thị danh sách người dùng.',
            },
        ];

        if (canExport) {
            steps.push({
                element: '[data-tour="exportBtn"]',
                intro: isEn ? 'Export the current list to Excel.' : 'Xuất danh sách hiện tại ra Excel.',
            });
        }

        if (canCreate) {
            steps.push({
                element: '[data-tour="addBtn"]',
                intro: isEn ? 'Admins can create a new user here.' : 'Admin có thể tạo người dùng mới ở đây.',
            });
        }

        if (canEdit) {
            steps.push({
                element: '[data-tour="editBtn"]',
                intro: isEn ? 'Edit a user from here.' : 'Sửa người dùng tại đây.',
            });
        }

        if (canDelete) {
            steps.push({
                element: '[data-tour="deleteBtn"]',
                intro: isEn ? 'Delete a user (admin only).' : 'Xoá người dùng (chỉ admin).',
            });
        }

        if (canView) {
            steps.push({
                element: '[data-tour="viewBtn"]',
                intro: isEn ? 'View user details here.' : 'Xem chi tiết người dùng tại đây.',
            });
        }

        return steps;
    }, [isEn, canExport, canCreate, canEdit, canDelete, canView]);

    const tour = useGuidedTour({
        isEn,
        enabled: true,
        steps: tourSteps,
    });

    return (
        <div className="user-page">
            <Card className="user-page__card">
                <div className="user-page__header" data-tour="header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Title level={4} className="user-page__title" style={{ margin: 0 }}>
                            {t.title}
                        </Title>

                        {/* ✅ Help (tour) */}
                        <Tooltip title={isEn ? 'Guide' : 'Hướng dẫn'}>
                            <Button shape="circle" icon={<QuestionCircleOutlined />} onClick={tour.start} />
                        </Tooltip>
                    </div>

                    <Space>
                        <Button
                            icon={<DownloadOutlined />}
                            onClick={exportExcel}
                            disabled={!canExport || !users.length}
                            data-tour="exportBtn"
                        >
                            {t.buttons.export}
                        </Button>

                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={handleOpenAddUser}
                            className="user-page__add-btn"
                            disabled={!canCreate}
                            data-tour="addBtn"
                        >
                            {t.buttons.add}
                        </Button>
                    </Space>
                </div>

                <div className="user-page__search" style={{ marginBottom: 16 }} data-tour="searchBox">
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
                        <Col xs={24} sm={6} data-tour="roleFilter">
                            <Select
                                placeholder={isEn ? 'Filter by role' : 'Lọc theo vai trò'}
                                value={filterRole || undefined}
                                onChange={(val) => setFilterRole(val || '')}
                                allowClear
                                style={{ width: '100%' }}
                                getPopupContainer={popupInParent}
                            >
                                <Option value="administrator">{roleLabelMap.administrator}</Option>
                                <Option value="distributor">{roleLabelMap.distributor}</Option>
                                <Option value="reporter">{roleLabelMap.reporter}</Option>
                                <Option value="customer">{roleLabelMap.customer}</Option>
                            </Select>
                        </Col>
                    </Row>
                </div>

                <div data-tour="table">
                    <Table
                        rowKey="_id"
                        columns={userColumns}
                        loading={loadingUsers || validatingUsers}
                        dataSource={users}
                        className="user-page__table"
                        scroll={{ x: 900 }}
                        size="middle"
                    />
                </div>
            </Card>

            <Modal
                title={editingUser ? t.modal.editTitle : t.modal.createTitle}
                open={userModalVisible}
                onCancel={closeUserModal}
                onOk={handleSaveUser}
                okText={t.modal.okText}
                cancelText={t.modal.cancelText}
                wrapClassName="user-modal"
                destroyOnClose
                okButtonProps={{ disabled: !canEdit }}
            >
                {distributorsBusy ? (
                    <div style={{ padding: 16 }}>
                        <Spin />
                    </div>
                ) : (
                    <UserForm
                        initialData={initialFormData}
                        currentRole={currentRole}
                        distributors={distributorOptions}
                        distributorsLoading={distributorsBusy}
                        isEditing={!!editingUser}
                        onChange={(data) => {
                            userFormDataRef.current = data;
                        }}
                        getPopupContainer={popupInParent}
                    />
                )}
            </Modal>

            <Modal
                title={t.view.title}
                open={viewUserModalVisible}
                onCancel={() => {
                    setViewUserModalVisible(false);
                    setViewUserId(null);
                }}
                footer={<Button onClick={() => setViewUserModalVisible(false)}>{t.view.close}</Button>}
                wrapClassName="user-modal"
                destroyOnClose
            >
                {loadingViewUser ? (
                    t.view.loading
                ) : viewUserData ? (
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
