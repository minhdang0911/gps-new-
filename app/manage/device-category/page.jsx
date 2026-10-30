'use client';

import React, { useMemo, useState, useEffect } from 'react';
import useSWR from 'swr';
import { Table, Button, Form, Space, Popconfirm, message, Card, Tooltip } from 'antd';
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    ReloadOutlined,
    DownloadOutlined,
    QuestionCircleOutlined,
} from '@ant-design/icons';
import { usePathname } from 'next/navigation';

import {
    getDeviceCategories,
    createDeviceCategory,
    updateDeviceCategory,
    deleteDeviceCategory,
} from '../../lib/api/deviceCategory';

import './DeviceCategoryPage.css';

import vi from '../../locales/vi.json';
import en from '../../locales/en.json';

import { useLocalStorageValue } from '../../hooks/useLocalStorageValue';
import { useIsEn } from '../../hooks/useLang';
import { useAuthStore } from '../../stores/authStore';
import { useMasterMadeInFromOptions, invalidateMasterCache, MASTER_KEYS } from '../../hooks/useMasterData';
import { mutate } from 'swr';
import DeviceCategoryFilters from './components/DeviceCategoryFilters';
import DeviceCategoryModal from './components/DeviceCategoryModal';
import { exportDeviceCategoryExcel, getMadeInFromLabel as getMifLabelUtil } from './utils/deviceCategoryUtils';

// ✅ Intro.js styles
import 'intro.js/introjs.css';
import '../../styles/intro-custom.css';

// ✅ shared guided tour hook
import { useGuidedTour } from '../../hooks/common/useGuidedTour';

const locales = { vi, en };

export default function DeviceCategoryPage() {
    const pathname = usePathname() || '/';

    const user = useAuthStore((s) => s.user);
    const authStoreToken = useAuthStore((s) => s.accessToken);

    const localToken = typeof window !== 'undefined' ? localStorage.getItem('accessToken') || '' : '';
    const token = authStoreToken || useLocalStorageValue('accessToken', localToken) || localToken;
    const localRole = typeof window !== 'undefined' ? localStorage.getItem('role') || '' : '';
    const storedRole = useLocalStorageValue('role', localRole) || localRole;
    const role = user?.position || user?.role || storedRole;
    const isEn = useIsEn();
    const t = isEn ? locales.en.deviceCategory : locales.vi.deviceCategory;

    const isAdmin = role === 'administrator';
    const isDistributor = role === 'distributor';
    const isCustomer = role === 'customer';
    const canView = isAdmin || isDistributor;
    const canEdit = isAdmin || isDistributor;
    const canCreate = isAdmin;
    const canDelete = isAdmin;

    // FILTERS
    const [filters, setFilters] = useState({ name: '', code: '', year: '', model: '', madeInFrom: '' });

    // pagination
    const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [form] = Form.useForm();

    const popupInParent = (triggerNode) => triggerNode?.parentElement || document.body;

    const { madeInFromRes, mifLoading, mifValidating, mutateMadeInFrom: mutateMIF } = useMasterMadeInFromOptions();
    const mifOptions = useMemo(() => {
        return Object.entries(madeInFromRes || {}).map(([value, label]) => ({ value, label }));
    }, [madeInFromRes]);
    const showMifLoading = mifLoading || mifValidating;

    const getMadeInFromLabel = (value) => getMifLabelUtil({ value, mifOptions, isEn });

    const listParams = useMemo(() => {
        return {
            page: pagination.current,
            limit: pagination.pageSize,
            name: filters.name || undefined,
            code: filters.code || undefined,
            year: filters.year || undefined,
            model: filters.model || undefined,
            madeInFrom: filters.madeInFrom || undefined,
        };
    }, [pagination.current, pagination.pageSize, filters]);

    const listKey = role && role !== 'customer' ? ['deviceCategories', listParams] : null;

    const listFetcher = async ([, params]) => {
        if (role === 'customer') return { items: [], page: 1, limit: params.limit, total: 0 };
        return getDeviceCategories(params);
    };

    const {
        data: listRes,
        isLoading: listLoading,
        isValidating: listValidating,
        mutate: mutateList,
    } = useSWR(listKey, listFetcher, {
        keepPreviousData: true,
        revalidateOnFocus: false,
        dedupingInterval: 10_000,
        onError: (err) => {
            console.error('Load device categories error:', err);
            message.error(t.loadError);
        },
    });

    const data = listRes?.items || [];
    const apiTotal = listRes?.total ?? 0;

    const handleTableChange = (pag) => setPagination({ current: pag.current, pageSize: pag.pageSize });

    const openCreateModal = () => {
        if (!isAdmin) return message.warning(t.noPermissionCreate);
        setEditingItem(null);
        form.resetFields();
        setIsModalOpen(true);
    };

    const openEditModal = (record) => {
        if (!canEdit) return message.warning(t.noPermissionEdit);
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
        if (!isAdmin) return message.warning(t.noPermissionDelete);
        try {
            await deleteDeviceCategory(record._id);
            message.success(t.deleteSuccess);
            mutateList();
            invalidateMasterCache('deviceCategories');
        } catch (err) {
            console.error('Delete device category error:', err);
            message.error(t.deleteFailed);
        }
    };

    const handleModalOk = async () => {
        if (!canEdit) return message.warning(t.noPermissionAction);

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
                await updateDeviceCategory(editingItem._id, payload);
                message.success(t.updateSuccess);
            } else {
                await createDeviceCategory(payload);
                message.success(t.createSuccess);
            }

            setIsModalOpen(false);
            form.resetFields();
            mutateList();
            invalidateMasterCache('deviceCategories');
        } catch (err) {
            if (err?.errorFields) return;

            console.error('Save device category error:', err);
            const apiData = err?.response?.data;
            const msg =
                apiData?.error ||
                apiData?.message ||
                (typeof apiData === 'string' ? apiData : null) ||
                err?.message ||
                t.saveFailed;

            message.error(msg);
        }
    };

    const handleSearch = () => setPagination((p) => ({ ...p, current: 1 }));
    const handleResetFilter = () => {
        setFilters({ name: '', code: '', year: '', model: '', madeInFrom: '' });
        setPagination((p) => ({ ...p, current: 1 }));
    };

    const columns = [
        {
            title: t.columns.code,
            dataIndex: 'code',
            key: 'code',
            sorter: (a, b) => (a.code || '').localeCompare(b.code || ''),
        },
        {
            title: t.columns.name,
            dataIndex: 'name',
            key: 'name',
            sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
        },
        {
            title: t.columns.year,
            dataIndex: 'year',
            key: 'year',
            width: 100,
            sorter: (a, b) => Number(a.year || 0) - Number(b.year || 0),
        },
        {
            title: t.columns.model,
            dataIndex: 'model',
            key: 'model',
            sorter: (a, b) => (a.model || '').localeCompare(b.model || ''),
        },
        {
            title: t.columns.origin,
            dataIndex: 'madeInFrom',
            key: 'madeInFrom',
            sorter: (a, b) => getMadeInFromLabel(a.madeInFrom).localeCompare(getMadeInFromLabel(b.madeInFrom)),
            render: (value) => getMadeInFromLabel(value) || '-',
        },
        { title: t.columns.description, dataIndex: 'description', key: 'description', ellipsis: true },
        {
            title: t.columns.actions,
            key: 'actions',
            width: 150,
            render: (_, record) =>
                canEdit ? (
                    <Space data-tour="rowActions">
                        <Button size="small" icon={<EditOutlined />} onClick={() => openEditModal(record)}>
                            {t.actions.edit}
                        </Button>
                        {canDelete && (
                            <Popconfirm
                                title={t.actions.deleteConfirmTitle}
                                description={t.actions.deleteConfirmDesc}
                                onConfirm={() => handleDelete(record)}
                                okText={t.actions.deleteOk}
                                cancelText={t.actions.deleteCancel}
                            >
                                <Button size="small" danger icon={<DeleteOutlined />}>
                                    {t.actions.delete}
                                </Button>
                            </Popconfirm>
                        )}
                    </Space>
                ) : null,
        },
    ];

    // ✅ TOUR STEPS (trỏ đúng element thật, role-aware)
    const tourSteps = useMemo(() => {
        const steps = [
            {
                element: '[data-tour="filtersWrap"]',
                intro: isEn ? 'Use filters to find categories quickly.' : 'Dùng bộ lọc để tìm danh mục nhanh.',
            },
            {
                element: '[data-tour="searchBtn"]',
                intro: isEn ? 'Click to search with current filters.' : 'Bấm để tìm theo bộ lọc hiện tại.',
            },
            {
                element: '[data-tour="tableWrap"]',
                intro: isEn ? 'This is the device category list.' : 'Đây là danh sách danh mục thiết bị.',
            },
            {
                element: '[data-tour="rowActions"]',
                intro: isEn ? 'Edit/Delete actions (depending on your role).' : 'Nút Sửa/Xoá  .',
            },
        ];

        if (canCreate) {
            steps.push({
                element: '[data-tour="addBtn"]',
                intro: isEn ? 'Admins can add a new category here.' : 'Admin có thể thêm danh mục mới ở đây.',
            });
        }

        return steps;
    }, [isEn, canCreate]);

    const tour = useGuidedTour({
        isEn,
        enabled: true,
        steps: tourSteps,
    });

    if (isCustomer || !canView) {
        return (
            <div className="dc-page">
                <Card className="dc-card" title={t.title}>
                    <p style={{ color: '#ef4444', fontWeight: 500, margin: 0 }}>{t.noPermissionPage}</p>
                </Card>
            </div>
        );
    }

    return (
        <div className="dc-page">
            <Card
                className="dc-card"
                title={t.title}
                extra={
                    <Space className="dc-card__actions">
                        {/* ✅ Tour button đặt chung với action, giống layout chuẩn */}
                        <Tooltip title={isEn ? 'Guide' : 'Hướng dẫn'}>
                            <Button shape="circle" icon={<QuestionCircleOutlined />} onClick={tour.start} />
                        </Tooltip>

                        <Button
                            icon={<ReloadOutlined />}
                            onClick={async () => {
                                message.loading({ content: isEn ? 'Refreshing...' : 'Đang làm mới...', key: 'dc_refresh', duration: 1 });
                                await mutateList();
                                message.success({ content: isEn ? 'Refreshed' : 'Đã làm mới dữ liệu', key: 'dc_refresh', duration: 1.5 });
                            }}
                        >
                            {t.refresh}
                        </Button>

                        <Button
                            icon={<DownloadOutlined />}
                            onClick={() => exportDeviceCategoryExcel({ data, t, mifOptions, isEn })}
                            disabled={!data.length}
                        >
                            {t.exportExcel}
                        </Button>

                        {canCreate && (
                            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal} data-tour="addBtn">
                                {t.addNew}
                            </Button>
                        )}
                    </Space>
                }
            >
                {/* ✅ Tour: filters wrapper */}
                <div data-tour="filtersWrap">
                    <DeviceCategoryFilters
                        t={t}
                        filters={filters}
                        setFilters={setFilters}
                        onSearch={handleSearch}
                        onReset={handleResetFilter}
                        mifOptions={mifOptions}
                        getMadeInFromLabel={getMadeInFromLabel}
                        showMifLoading={showMifLoading}
                        popupInParent={popupInParent}
                    />
                </div>

                {/* ✅ Tour: table wrapper */}
                <div data-tour="tableWrap">
                    <Table
                        rowKey="_id"
                        loading={listLoading && (!data || data.length === 0)}
                        columns={columns}
                        dataSource={data}
                        pagination={{
                            current: pagination.current,
                            pageSize: pagination.pageSize,
                            total: apiTotal,
                            showSizeChanger: true,
                            pageSizeOptions: ['10', '20', '50', '100', '200'],
                        }}
                        onChange={handleTableChange}
                        className="dc-table"
                        scroll={{ x: 800 }}
                        size="middle"
                    />
                </div>
            </Card>

            <DeviceCategoryModal
                open={isModalOpen}
                onOk={handleModalOk}
                onCancel={() => {
                    setIsModalOpen(false);
                    form.resetFields();
                }}
                form={form}
                t={t}
                editingItem={editingItem}
                mifOptions={mifOptions}
                getMadeInFromLabel={getMadeInFromLabel}
                showMifLoading={showMifLoading}
                popupInParent={popupInParent}
            />
        </div>
    );
}
