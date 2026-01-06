'use client';

import React, { useMemo, useState, useEffect } from 'react';
import useSWR from 'swr';
import { Table, Button, Form, Space, Popconfirm, message, Card } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, DownloadOutlined } from '@ant-design/icons';
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
import { useMadeInFromOptions } from './hooks/useMadeInFromOptions';
import DeviceCategoryFilters from './components/DeviceCategoryFilters';
import DeviceCategoryModal from './components/DeviceCategoryModal';
import { exportDeviceCategoryExcel, getMadeInFromLabel as getMifLabelUtil } from './utils/deviceCategoryUtils';

const locales = { vi, en };

export default function DeviceCategoryPage() {
    const pathname = usePathname() || '/';

    const token = useLocalStorageValue('accessToken', '');
    const role = useLocalStorageValue('role', '');
    const langFromStorage = useLocalStorageValue('iky_lang', 'vi');

    const isEnFromPath = useMemo(() => {
        const segments = pathname.split('/').filter(Boolean);
        const last = segments[segments.length - 1];
        return last === 'en';
    }, [pathname]);

    const isEn = isEnFromPath ? true : langFromStorage === 'en';
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

    // ✅ Fix dropdown trong Modal bị “click không ra”/bị che
    const popupInParent = (triggerNode) => triggerNode?.parentElement || document.body;

    // madeInFrom options (hook)
    const { mifOptions, mifLoading, mifValidating, mutateMIF } = useMadeInFromOptions({ token, t });
    const showMifLoading = mifLoading || mifValidating;

    const getMadeInFromLabel = (value) => getMifLabelUtil({ value, mifOptions, isEn });

    /* =========================
      SWR: list device categories
  ========================= */
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

    const listKey = token && role && role !== 'customer' ? ['deviceCategories', token, listParams] : null;

    const listFetcher = async ([, tk, params]) => {
        if (role === 'customer') return { items: [], page: 1, limit: params.limit, total: 0 };
        return getDeviceCategories(tk, params);
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

    const prefetchMIF = () => {
        try {
            mutateMIF?.();
        } catch (_) {}
    };

    useEffect(() => {
        if (isModalOpen) prefetchMIF();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isModalOpen]);

    const openCreateModal = () => {
        if (!isAdmin) return message.warning(t.noPermissionCreate);
        prefetchMIF();
        setEditingItem(null);
        form.resetFields();
        setIsModalOpen(true);
    };

    const openEditModal = (record) => {
        if (!canEdit) return message.warning(t.noPermissionEdit);
        prefetchMIF();
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
        if (!token) return;
        try {
            await deleteDeviceCategory(token, record._id);
            message.success(t.deleteSuccess);
            mutateList();
        } catch (err) {
            console.error('Delete device category error:', err);
            message.error(t.deleteFailed);
        }
    };

    const handleModalOk = async () => {
        if (!canEdit) return message.warning(t.noPermissionAction);
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
                message.success(t.updateSuccess);
            } else {
                await createDeviceCategory(token, payload);
                message.success(t.createSuccess);
            }

            setIsModalOpen(false);
            form.resetFields();
            mutateList();
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
                    <Space>
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
                        <Button icon={<ReloadOutlined />} onClick={() => mutateList()}>
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
                            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
                                {t.addNew}
                            </Button>
                        )}
                    </Space>
                }
            >
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

                <Table
                    rowKey="_id"
                    loading={listLoading || listValidating}
                    columns={columns}
                    dataSource={data}
                    pagination={{
                        current: pagination.current,
                        pageSize: pagination.pageSize,
                        total: apiTotal,
                        showSizeChanger: true,
                    }}
                    onChange={handleTableChange}
                    className="dc-table"
                    scroll={{ x: 800 }}
                    size="middle"
                />
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
