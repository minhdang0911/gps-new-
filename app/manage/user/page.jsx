// app/manage/user/page.jsx
'use client';

import React, { useMemo, useState, useEffect } from 'react';
import useSWR from 'swr';
import { Card, Table, Space, Button, Typography, Tooltip, message } from 'antd';
import {
    PlusOutlined,
    DownloadOutlined,
    QuestionCircleOutlined,
    ReloadOutlined,
} from '@ant-design/icons';
import './ManageUserPage.css';
import 'intro.js/introjs.css';
import '../../styles/intro-custom.css';

import { getUserInfo, getUserList } from '../../lib/api/user';
import vi from '../../locales/vi.json';
import en from '../../locales/en.json';
import { useIsEn } from '../../hooks/useLang';
import { useAuthStore } from '../../stores/authStore';
import { searchAndRankRecords } from '../../lib/search/bitParallelSearch';

import ManageUserFilterBar from './components/ManageUserFilterBar';
import ManageUserUpsertModal from './components/ManageUserUpsertModal';
import ManageUserDetailModal from './components/ManageUserDetailModal';
import { useManageUserExcel } from './hooks/useManageUserExcel';
import { useManageUserCrud } from './hooks/useManageUserCrud';
import { useManageUserColumns } from './hooks/useManageUserColumns';
import { useManageUserTour } from './hooks/useManageUserTour';

const { Title } = Typography;
const locales = { vi, en };

function useDebouncedValue(value, delay = 400) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);
    return debounced;
}

export default function ManageUserPage() {
    const user = useAuthStore((state) => state.user);
    const currentRole = user?.position || user?.role || (typeof window !== 'undefined' ? localStorage.getItem('role') || '' : '');
    const isEn = useIsEn();
    const translation = isEn ? locales.en.manageUser : locales.vi.manageUser;

    const isAdmin = currentRole === 'administrator';
    const isDistributor = currentRole === 'distributor';
    const canEdit = isAdmin || isDistributor;
    const canView = isAdmin || isDistributor;
    const canExport = isAdmin || isDistributor;
    const canCreate = isAdmin;
    const canDelete = isAdmin;

    const roleLabelMap = useMemo(
        () =>
            isEn
                ? { administrator: 'Administrator', distributor: 'Distributor', reporter: 'Reporter', technical: 'Technical', customer: 'Customer' }
                : { administrator: 'Quản trị hệ thống', distributor: 'Đại lý', reporter: 'Giám sát', technical: 'Kỹ thuật', customer: 'Khách hàng' },
        [isEn]
    );

    const [searchUsername, setSearchUsername] = useState('');
    const [searchEmail, setSearchEmail] = useState('');
    const [searchPhone, setSearchPhone] = useState('');
    const [filterRole, setFilterRole] = useState('');

    const debouncedUsername = useDebouncedValue(searchUsername, 450);
    const debouncedEmail = useDebouncedValue(searchEmail, 450);
    const debouncedPhone = useDebouncedValue(searchPhone, 450);
    const debouncedRole = useDebouncedValue(filterRole, 250);

    const listParams = useMemo(() => {
        const params = {
            username: debouncedUsername || undefined,
            email: debouncedEmail || undefined,
            phone: debouncedPhone || undefined,
            page: 1,
            limit: 200,
        };
        if (debouncedRole) params.position = debouncedRole;
        return params;
    }, [debouncedUsername, debouncedEmail, debouncedPhone, debouncedRole]);

    const {
        data: rawUsers = [],
        isLoading: loadingUsers,
        isValidating: validatingUsers,
        mutate: mutateUsers,
    } = useSWR(
        canView ? ['users', listParams, isEn] : null,
        async ([, params]) => {
            const res = await getUserList(params);
            return res?.items || [];
        },
        {
            keepPreviousData: true,
            revalidateOnFocus: false,
            dedupingInterval: 10000,
            onError: (err) => {
                const status = err?.response?.status;
                if (status === 401 || status === 403) return;
                message.error(translation.messages.loadUsersError);
            },
        }
    );

    const filteredUsers = useMemo(() => {
        const activeSearchQuery = searchUsername || searchEmail || searchPhone;
        if (!activeSearchQuery) return rawUsers;
        return searchAndRankRecords(rawUsers, activeSearchQuery, ['username', 'name', 'email', 'phone']);
    }, [rawUsers, searchUsername, searchEmail, searchPhone]);

    const crud = useManageUserCrud({
        canCreate,
        canEdit,
        canDelete,
        canView,
        mutateUsers,
        mutateDistributors: () => mutateDistributors?.(),
        translation,
    });

    const { data: distributorOptions = [], isLoading: loadingDistributors, isValidating: validatingDistributors, mutate: mutateDistributors } = useSWR(
        crud.userModalVisible ? ['distributors', isEn] : null,
        async () => {
            const res = await getUserList({ position: 'distributor', page: 1, limit: 100 });
            return res?.items || [];
        },
        { revalidateOnFocus: false, dedupingInterval: 60000 }
    );

    const { data: viewUserData = null, isLoading: loadingViewUser } = useSWR(
        crud.viewUserModalVisible && crud.viewUserId ? ['userInfo', crud.viewUserId, isEn] : null,
        async ([, id]) => {
            const res = await getUserInfo(id);
            return res?.user || null;
        },
        { revalidateOnFocus: false, dedupingInterval: 10000 }
    );

    const { exportExcel } = useManageUserExcel({
        users: filteredUsers,
        canExport,
        roleLabelMap,
        isEnglish: isEn,
        translation,
    });

    const userColumns = useManageUserColumns({
        translation,
        roleLabelMap,
        canEdit,
        canDelete,
        canView,
        onEditUser: crud.handleOpenEditUser,
        onDeleteUser: crud.handleDeleteUser,
        onViewUser: crud.handleViewUser,
    });

    const tour = useManageUserTour({ isEnglish: isEn, canExport, canCreate });
    const popupInParent = (node) => node?.parentElement || document.body;

    return (
        <div className="user-page">
            <Card className="user-page__card">
                <div className="user-page__header" data-tour="header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Title level={4} className="user-page__title" style={{ margin: 0 }}>{translation.title}</Title>
                        <Tooltip title={isEn ? 'Guide' : 'Hướng dẫn'}>
                            <Button shape="circle" icon={<QuestionCircleOutlined />} onClick={tour.start} />
                        </Tooltip>
                    </div>
                    <Space>
                        <Button icon={<ReloadOutlined />} onClick={() => mutateUsers()} loading={loadingUsers || validatingUsers}>
                            {isEn ? 'Refresh' : 'Làm mới'}
                        </Button>
                        <Button icon={<DownloadOutlined />} onClick={exportExcel} disabled={!canExport || !filteredUsers.length} data-tour="exportBtn">
                            {translation.buttons.export}
                        </Button>
                        <Button type="primary" icon={<PlusOutlined />} onClick={crud.handleOpenAddUser} className="user-page__add-btn" disabled={!canCreate} data-tour="addBtn">
                            {translation.buttons.add}
                        </Button>
                    </Space>
                </div>

                <ManageUserFilterBar
                    searchUsername={searchUsername}
                    setSearchUsername={setSearchUsername}
                    searchEmail={searchEmail}
                    setSearchEmail={setSearchEmail}
                    searchPhone={searchPhone}
                    setSearchPhone={setSearchPhone}
                    filterRole={filterRole}
                    setFilterRole={setFilterRole}
                    roleLabelMap={roleLabelMap}
                    isEnglish={isEn}
                    popupInParent={popupInParent}
                />

                <div data-tour="table">
                    <Table
                        rowKey="_id"
                        columns={userColumns}
                        loading={loadingUsers && (!filteredUsers || filteredUsers.length === 0)}
                        dataSource={filteredUsers}
                        className="user-page__table"
                        scroll={{ x: 900 }}
                        size="middle"
                        pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'] }}
                    />
                </div>
            </Card>

            <ManageUserUpsertModal
                isOpen={crud.userModalVisible}
                isEditing={!!crud.editingUser}
                onClose={crud.closeUserModal}
                onSave={crud.handleSaveUser}
                canEdit={canEdit}
                distributorsBusy={loadingDistributors || validatingDistributors}
                initialFormData={crud.initialFormData}
                currentRole={currentRole}
                distributorOptions={distributorOptions}
                userFormDataRef={crud.userFormDataRef}
                popupInParent={popupInParent}
                translation={translation}
            />

            <ManageUserDetailModal
                isOpen={crud.viewUserModalVisible}
                onClose={crud.closeViewUserModal}
                isLoading={loadingViewUser}
                userData={viewUserData}
                roleLabelMap={roleLabelMap}
                isEnglish={isEn}
                translation={translation}
            />
        </div>
    );
}
