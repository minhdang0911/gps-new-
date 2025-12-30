'use client';

import React, { useMemo, useState, useSyncExternalStore, useEffect } from 'react';
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
    getDeviceCategories,
    createDeviceCategory,
    updateDeviceCategory,
    deleteDeviceCategory,
    getMadeInFromOptions,
} from '../../lib/api/deviceCategory';

import { MADE_IN_FROM_MAP } from '../../util/ConverMadeIn';
import './DeviceCategoryPage.css';

import { getTodayForFileName } from '../../util/FormatDate';

// Excel style lib
import * as XLSX from 'xlsx-js-style';
import { saveAs } from 'file-saver';

import vi from '../../locales/vi.json';
import en from '../../locales/en.json';

const locales = { vi, en };
const { Option } = Select;

/** ✅ đọc localStorage “chuẩn React”, không cần useEffect + setState */
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

const DeviceCategoryPage = () => {
    const pathname = usePathname() || '/';

    // ✅ token/role/lang đọc trực tiếp
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
    const [filters, setFilters] = useState({
        name: '',
        code: '',
        year: '',
        model: '',
        madeInFrom: '',
    });

    // pagination
    const [pagination, setPagination] = useState({
        current: 1,
        pageSize: 20,
    });

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [form] = Form.useForm();

    // ✅ Fix dropdown trong Modal bị “click không ra”/bị che
    const popupInParent = (triggerNode) => triggerNode?.parentElement || document.body;

    // helper label xuất xứ
    const getMadeInFromLabel = (value, mifOptions = []) => {
        if (!value && value !== 0) return '';

        const key = String(value);
        const cfg = MADE_IN_FROM_MAP?.[key];

        if (cfg) return isEn ? cfg.en : cfg.vi;

        const found = mifOptions.find((opt) => String(opt.value) === key);
        if (found?.label) return found.label;

        return key;
    };

    /* =========================
        SWR: madeInFrom options
        ✅ FIX:
        - expose isLoading + mutate
        - show loading UI for Select
    ========================= */
    const mifKey = token ? ['madeInFromOptions', token] : null;

    const {
        data: mifRes,
        isLoading: mifLoading,
        mutate: mutateMIF,
        isValidating: mifValidating,
    } = useSWR(mifKey, ([, tk]) => getMadeInFromOptions(tk), {
        revalidateOnFocus: false,
        dedupingInterval: 60_000,
        onError: (err) => {
            console.error('Load madeInFrom options error:', err);
            // không spam message nếu không có token
            if (token) message.error(t.loadError);
        },
    });

    const mifOptions = useMemo(() => {
        const res = mifRes || {};
        return Object.entries(res).map(([value, label]) => ({ value, label }));
    }, [mifRes]);

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

    /* =========================
        TABLE CHANGE
    ========================= */
    const handleTableChange = (pag) => {
        setPagination({
            current: pag.current,
            pageSize: pag.pageSize,
        });
    };

    /* =========================
        MODAL
        ✅ FIX:
        - prefetch mifOptions khi mở modal để user không cần F5
    ========================= */
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
        if (!isAdmin) {
            message.warning(t.noPermissionCreate);
            return;
        }
        prefetchMIF();
        setEditingItem(null);
        form.resetFields();
        setIsModalOpen(true);
    };

    const openEditModal = (record) => {
        if (!canEdit) {
            message.warning(t.noPermissionEdit);
            return;
        }

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
        if (!isAdmin) {
            message.warning(t.noPermissionDelete);
            return;
        }
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
        if (!canEdit) {
            message.warning(t.noPermissionAction);
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

    /* =========================
        SEARCH / RESET
    ========================= */
    const handleSearch = () => {
        setPagination((p) => ({ ...p, current: 1 }));
    };

    const handleResetFilter = () => {
        setFilters({
            name: '',
            code: '',
            year: '',
            model: '',
            madeInFrom: '',
        });
        setPagination((p) => ({ ...p, current: 1 }));
    };

    /* =========================
        EXPORT EXCEL (xlsx-js-style)
    ========================= */
    const exportExcel = () => {
        if (!data.length) {
            message.warning(t.noDataToExport);
            return;
        }

        try {
            const excelData = data.map((item) => ({
                [t.columns.code]: item.code || '',
                [t.columns.name]: item.name || '',
                Năm: item.year || '',
                Model: item.model || '',
                [t.columns.origin]: getMadeInFromLabel(item.madeInFrom, mifOptions),
                [t.columns.description]: item.description || '',
            }));

            const ws = XLSX.utils.json_to_sheet(excelData, { origin: 'A2' });
            const headers = Object.keys(excelData[0]);

            const title = t.exportTitle;
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
            XLSX.utils.book_append_sheet(wb, ws, 'DeviceCategories');

            const excelBuffer = XLSX.write(wb, {
                bookType: 'xlsx',
                type: 'array',
                cellStyles: true,
            });

            saveAs(new Blob([excelBuffer]), `DanhSachDongThietBi_${getTodayForFileName()}.xlsx`);
            message.success(t.exportSuccess);
        } catch (err) {
            console.error('Export excel error:', err);
            message.error(t.exportFailed);
        }
    };

    /* =========================
        COLUMNS
    ========================= */
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
            sorter: (a, b) =>
                getMadeInFromLabel(a.madeInFrom, mifOptions).localeCompare(
                    getMadeInFromLabel(b.madeInFrom, mifOptions),
                ),
            render: (value) => getMadeInFromLabel(value, mifOptions) || '-',
        },
        {
            title: t.columns.description,
            dataIndex: 'description',
            key: 'description',
            ellipsis: true,
        },
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

    // customer -> chặn luôn trang
    if (isCustomer) {
        return (
            <div className="dc-page">
                <Card className="dc-card" title={t.title}>
                    <p style={{ color: '#ef4444', fontWeight: 500, margin: 0 }}>{t.noPermissionPage}</p>
                </Card>
            </div>
        );
    }

    // nếu không có quyền view thì chặn
    if (!canView) {
        return (
            <div className="dc-page">
                <Card className="dc-card" title={t.title}>
                    <p style={{ color: '#ef4444', fontWeight: 500, margin: 0 }}>{t.noPermissionPage}</p>
                </Card>
            </div>
        );
    }

    const showMifLoading = mifLoading || mifValidating;

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
                        <Button icon={<DownloadOutlined />} onClick={exportExcel} disabled={!data.length}>
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
                {/* Bộ lọc */}
                <div className="dc-filter">
                    <Input
                        allowClear
                        prefix={<SearchOutlined />}
                        placeholder={t.filters.name}
                        value={filters.name}
                        onChange={(e) => setFilters((prev) => ({ ...prev, name: e.target.value }))}
                    />
                    <Input
                        allowClear
                        placeholder={t.filters.code}
                        value={filters.code}
                        onChange={(e) => setFilters((prev) => ({ ...prev, code: e.target.value }))}
                    />
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
                        loading={showMifLoading}
                        disabled={showMifLoading}
                        notFoundContent={showMifLoading ? <Spin size="small" /> : null}
                        showSearch
                        optionFilterProp="children"
                    >
                        {mifOptions.map((opt) => (
                            <Option key={opt.value} value={opt.value}>
                                {getMadeInFromLabel(opt.value, mifOptions)}
                            </Option>
                        ))}
                    </Select>

                    <Space className="dc-filter__actions">
                        <Button type="primary" onClick={handleSearch}>
                            {t.search}
                        </Button>
                        <Button onClick={handleResetFilter}>{t.resetFilter}</Button>
                    </Space>
                </div>

                {/* Bảng */}
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

            {/* Modal thêm / sửa */}
            <Modal
                open={isModalOpen}
                title={editingItem ? t.modal.editTitle : t.modal.createTitle}
                onOk={handleModalOk}
                onCancel={() => {
                    setIsModalOpen(false);
                    form.resetFields();
                }}
                okText={t.modal.okText}
                cancelText={t.modal.cancelText}
                wrapClassName="dc-modal"
                destroyOnClose
            >
                <Form form={form} layout="vertical">
                    <Form.Item
                        label={t.form.codeLabel}
                        name="code"
                        rules={[{ required: true, message: t.form.codeRequired }]}
                    >
                        <Input />
                    </Form.Item>

                    <Form.Item
                        label={t.form.nameLabel}
                        name="name"
                        rules={[{ required: true, message: t.form.nameRequired }]}
                    >
                        <Input />
                    </Form.Item>

                    <Form.Item
                        label={t.form.yearLabel}
                        name="year"
                        rules={[{ required: true, message: t.form.yearRequired }]}
                    >
                        <Input />
                    </Form.Item>

                    <Form.Item
                        label={t.form.modelLabel}
                        name="model"
                        rules={[{ required: true, message: t.form.modelRequired }]}
                    >
                        <Input />
                    </Form.Item>

                    <Form.Item
                        label={t.form.originLabel}
                        name="madeInFrom"
                        rules={[{ required: true, message: t.form.originRequired }]}
                    >
                        <Select
                            placeholder={t.form.originPlaceholder}
                            getPopupContainer={popupInParent}
                            loading={showMifLoading}
                            disabled={showMifLoading}
                            notFoundContent={showMifLoading ? <Spin size="small" /> : null}
                            showSearch
                            optionFilterProp="children"
                        >
                            {mifOptions.map((opt) => (
                                <Option key={opt.value} value={opt.value}>
                                    {getMadeInFromLabel(opt.value, mifOptions)}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item label={t.form.descLabel} name="description">
                        <Input.TextArea rows={3} />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default DeviceCategoryPage;
