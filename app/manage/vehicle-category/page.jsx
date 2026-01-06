'use client';

import React, { useMemo, useState, useEffect } from 'react';
import useSWR from 'swr';
import { Table, Button, Modal, Form, Input, Select, Space, Popconfirm, message, Card, Spin } from 'antd';
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    ReloadOutlined,
    SearchOutlined,
    DownloadOutlined,
} from '@ant-design/icons';
import { usePathname } from 'next/navigation';

import {
    getVehicleCategories,
    createVehicleCategory,
    updateVehicleCategory,
    deleteVehicleCategory,
    getManufacturerOptions,
} from '../../lib/api/vehicleCategory';
import { getMadeInFromOptions, getDeviceCategories } from '../../lib/api/deviceCategory';

import './VehicleCategoryPage.css';

import vi from '../../locales/vi.json';
import en from '../../locales/en.json';

import { useLocalStorageValue } from '../../hooks/useLocalStorageValue';
import {
    buildMapOptions,
    buildDeviceTypeOptions,
    getMifLabel as _getMifLabel,
    getManufacturerLabel as _getManufacturerLabel,
    getDeviceTypeLabel as _getDeviceTypeLabel,
} from './vehicleCategory.utils';
import { exportVehicleCategoriesExcel } from './vehicleCategory.exportExcel';
import VehicleCategoryModal from './VehicleCategoryModal';

const locales = { vi, en };
const { Option } = Select;

const VehicleCategoryPage = () => {
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
    const t = isEn ? locales.en.vehicleCategory : locales.vi.vehicleCategory;

    const isAdmin = role === 'administrator';
    const isDistributor = role === 'distributor';
    const isCustomer = role === 'customer';
    const canView = isAdmin || isDistributor;
    const canEdit = isAdmin || isDistributor;
    const canCreate = isAdmin;
    const canDelete = isAdmin;

    const [filters, setFilters] = useState({ name: '', manufacturer: '', year: '', model: '', madeInFrom: '' });
    const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [form] = Form.useForm();

    const popupInParent = (triggerNode) => triggerNode?.parentElement || document.body;

    // ===== SWR OPTIONS
    const mifKey = token ? ['madeInFromOptions', token] : null;
    const manuKey = token ? ['manufacturerOptions', token] : null;
    const deviceTypeKey = token ? ['deviceTypeOptions', token] : null;

    const {
        data: mifRes,
        isLoading: mifLoading,
        isValidating: mifValidating,
        mutate: mutateMIF,
    } = useSWR(mifKey, ([, tk]) => getMadeInFromOptions(tk), { revalidateOnFocus: false, dedupingInterval: 60_000 });

    const {
        data: manuRes,
        isLoading: manuLoading,
        isValidating: manuValidating,
        mutate: mutateManu,
    } = useSWR(manuKey, ([, tk]) => getManufacturerOptions(tk), { revalidateOnFocus: false, dedupingInterval: 60_000 });

    const {
        data: dcRes,
        isLoading: dcLoading,
        isValidating: dcValidating,
        mutate: mutateDC,
    } = useSWR(deviceTypeKey, ([, tk]) => getDeviceCategories(tk, { page: 1, limit: 100 }), {
        revalidateOnFocus: false,
        dedupingInterval: 60_000,
    });

    const mifOptions = useMemo(() => buildMapOptions(mifRes || {}), [mifRes]);
    const manufacturerOptions = useMemo(() => buildMapOptions(manuRes || {}), [manuRes]);
    const deviceTypeOptions = useMemo(() => buildDeviceTypeOptions(dcRes?.items || []), [dcRes]);

    const getMifLabel = (value) => _getMifLabel({ value, mifOptions, isEn });
    const getManufacturerLabel = (value) => _getManufacturerLabel({ value, manufacturerOptions });
    const getDeviceTypeLabel = (value) => _getDeviceTypeLabel({ value, deviceTypeOptions });

    const mifBusy = mifLoading || mifValidating;
    const manuBusy = manuLoading || manuValidating;
    const dcBusy = dcLoading || dcValidating;

    const prefetchOptions = () => {
        try {
            mutateMIF?.();
            mutateManu?.();
            mutateDC?.();
        } catch (_) {}
    };

    useEffect(() => {
        if (isModalOpen) prefetchOptions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isModalOpen]);

    // ===== SWR LIST
    const listParams = useMemo(
        () => ({
            page: pagination.current,
            limit: pagination.pageSize,
            name: filters.name || undefined,
            manufacturer: filters.manufacturer || undefined,
            year: filters.year || undefined,
            model: filters.model || undefined,
            madeInFrom: filters.madeInFrom || undefined,
        }),
        [pagination.current, pagination.pageSize, filters],
    );

    const listKey = token && role && role !== 'customer' ? ['vehicleCategories', token, listParams] : null;

    const listFetcher = async ([, tk, params]) => {
        if (role === 'customer') return { items: [], page: 1, limit: params.limit, total: 0 };
        return getVehicleCategories(tk, params);
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
            console.error('Load vehicle categories error:', err);
            message.error(t.loadError);
        },
    });

    const data = listRes?.items || [];
    const apiTotal = listRes?.total ?? 0;

    const handleTableChange = (pag) => setPagination({ current: pag.current, pageSize: pag.pageSize });

    // ===== MODAL handlers
    const openCreateModal = () => {
        if (!isAdmin) return message.warning(t.noPermissionCreate);
        prefetchOptions();
        setEditingItem(null);
        form.resetFields();
        setIsModalOpen(true);
    };

    const openEditModal = (record) => {
        if (!canEdit) return message.warning(t.noPermissionEdit);

        prefetchOptions();
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
        if (!isAdmin) return message.warning(t.noPermissionDelete);
        if (!token) return;

        try {
            await deleteVehicleCategory(token, record._id);
            message.success(t.deleteSuccess);
            mutateList();
        } catch (err) {
            console.error('Delete vehicle category error:', err);
            message.error(t.deleteFailed);
        }
    };

    const handleModalOk = async () => {
        if (!canEdit) return message.warning(t.noPermissionAction);
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

            if (values.deviceTypeId) payload.deviceTypeId = values.deviceTypeId;

            if (editingItem) {
                await updateVehicleCategory(token, editingItem._id, payload);
                message.success(t.updateSuccess);
            } else {
                await createVehicleCategory(token, payload);
                message.success(t.createSuccess);
            }

            setIsModalOpen(false);
            form.resetFields();
            mutateList();
        } catch (err) {
            if (err?.errorFields) return;

            console.error('Save vehicle category error:', err);

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

    // ===== SEARCH / RESET
    const handleSearch = () => setPagination((p) => ({ ...p, current: 1 }));
    const handleResetFilter = () => {
        setFilters({ name: '', manufacturer: '', year: '', model: '', madeInFrom: '' });
        setPagination((p) => ({ ...p, current: 1 }));
    };

    // ===== EXPORT EXCEL
    const onExportExcel = () => {
        const res = exportVehicleCategoriesExcel({
            data,
            t,
            getManufacturerLabel,
            getMifLabel: getMifLabel,
            getDeviceTypeLabel,
        });

        if (!res.ok && res.reason === 'NO_DATA') message.warning(t.noDataToExport);
        if (res.ok) message.success(t.exportSuccess);
    };

    const columns = [
        {
            title: t.columns.name,
            dataIndex: 'name',
            key: 'name',
            sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
        },
        {
            title: t.columns.manufacturer,
            dataIndex: 'manufacturer',
            key: 'manufacturer',
            sorter: (a, b) => getManufacturerLabel(a.manufacturer).localeCompare(getManufacturerLabel(b.manufacturer)),
            render: (value) => getManufacturerLabel(value) || '-',
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
            sorter: (a, b) => getMifLabel(a.madeInFrom).localeCompare(getMifLabel(b.madeInFrom)),
            render: (value) => getMifLabel(value) || '-',
        },
        {
            title: t.columns.deviceType,
            dataIndex: 'deviceTypeId',
            key: 'deviceTypeId',
            render: (value, record) => getDeviceTypeLabel(value || record.deviceType_id) || '-',
        },
        {
            title: t.columns.actions,
            key: 'actions',
            width: 160,
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
            <div className="vc-page">
                <Card className="vc-card" title={t.title}>
                    <p style={{ color: '#ef4444', fontWeight: 500, margin: 0 }}>{t.noPermissionPage}</p>
                </Card>
            </div>
        );
    }

    return (
        <div className="vc-page">
            <Card
                className="vc-card"
                title={t.title}
                extra={
                    <Space className="vc-card__actions">
                        <Button icon={<ReloadOutlined />} onClick={() => mutateList()}>
                            {t.refresh}
                        </Button>
                        <Button icon={<DownloadOutlined />} onClick={onExportExcel} disabled={!data.length}>
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
                <div className="vc-filter">
                    <Input
                        allowClear
                        prefix={<SearchOutlined />}
                        placeholder={t.filters.name}
                        value={filters.name}
                        onChange={(e) => setFilters((prev) => ({ ...prev, name: e.target.value }))}
                    />

                    <Select
                        allowClear
                        placeholder={t.filters.manufacturer}
                        value={filters.manufacturer || undefined}
                        onChange={(value) => setFilters((prev) => ({ ...prev, manufacturer: value || '' }))}
                        style={{ minWidth: 180 }}
                        getPopupContainer={popupInParent}
                        loading={manuBusy}
                        disabled={manuBusy}
                        notFoundContent={manuBusy ? <Spin size="small" /> : null}
                        showSearch
                        optionFilterProp="children"
                    >
                        {manufacturerOptions.map((opt) => (
                            <Option key={opt.value} value={opt.value}>
                                {opt.label}
                            </Option>
                        ))}
                    </Select>

                    <Input
                        allowClear
                        placeholder={t.filters.year}
                        value={filters.year}
                        onChange={(e) => setFilters((prev) => ({ ...prev, year: e.target.value }))}
                    />
                    <Input
                        allowClear
                        placeholder={t.filters.model}
                        value={filters.model}
                        onChange={(e) => setFilters((prev) => ({ ...prev, model: e.target.value }))}
                    />

                    <Select
                        allowClear
                        placeholder={t.filters.origin}
                        value={filters.madeInFrom || undefined}
                        onChange={(value) => setFilters((prev) => ({ ...prev, madeInFrom: value || '' }))}
                        style={{ minWidth: 180 }}
                        getPopupContainer={popupInParent}
                        loading={mifBusy}
                        disabled={mifBusy}
                        notFoundContent={mifBusy ? <Spin size="small" /> : null}
                        showSearch
                        optionFilterProp="children"
                    >
                        {mifOptions.map((opt) => (
                            <Option key={opt.value} value={opt.value}>
                                {getMifLabel(opt.value)}
                            </Option>
                        ))}
                    </Select>

                    <Space className="vc-filter__actions">
                        <Button type="primary" onClick={handleSearch}>
                            {t.search}
                        </Button>
                        <Button onClick={handleResetFilter}>{t.resetFilter}</Button>
                    </Space>
                </div>

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
                    className="vc-table"
                    scroll={{ x: 900 }}
                    size="middle"
                />
            </Card>

            <VehicleCategoryModal
                open={isModalOpen}
                editingItem={editingItem}
                t={t}
                form={form}
                onOk={handleModalOk}
                onCancel={() => {
                    setIsModalOpen(false);
                    form.resetFields();
                }}
                popupInParent={popupInParent}
                manuBusy={manuBusy}
                mifBusy={mifBusy}
                dcBusy={dcBusy}
                manufacturerOptions={manufacturerOptions}
                mifOptions={mifOptions}
                deviceTypeOptions={deviceTypeOptions}
                getMifLabel={getMifLabel}
            />
        </div>
    );
};

export default VehicleCategoryPage;
