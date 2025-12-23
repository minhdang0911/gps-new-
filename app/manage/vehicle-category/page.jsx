'use client';

import React, { useMemo, useState, useSyncExternalStore } from 'react';
import useSWR from 'swr';
import { Table, Button, Modal, Form, Input, Select, Space, Popconfirm, message, Card } from 'antd';
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

// Excel
import * as XLSX from 'xlsx-js-style';
import { saveAs } from 'file-saver';
import { getTodayForFileName } from '../../util/FormatDate';

import { MADE_IN_FROM_MAP } from '../../util/ConverMadeIn';
import vi from '../../locales/vi.json';
import en from '../../locales/en.json';

const locales = { vi, en };
const { Option } = Select;

/**
 * ✅ đọc localStorage “chuẩn React” (không cần useEffect + setState)
 * - tự update khi có storage event (đa tab) / hoặc khi bạn tự dispatch event (cùng tab)
 */
function useLocalStorageValue(key, fallback = '') {
    const subscribe = (callback) => {
        if (typeof window === 'undefined') return () => {};
        const handler = (e) => {
            // storage event chỉ bắn khi đổi từ tab khác.
            // nếu bạn muốn cùng tab cũng update => bạn có thể dispatch Event('storage') thủ công sau khi setItem
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

const VehicleCategoryPage = () => {
    const pathname = usePathname() || '/';

    // ✅ đọc token/role/lang trực tiếp từ localStorage store
    const token = useLocalStorageValue('accessToken', '');
    const role = useLocalStorageValue('role', '');

    // ===== LANG =====
    // ✅ không dùng setIsEn trong effect nữa
    const isEnFromPath = useMemo(() => {
        const segments = pathname.split('/').filter(Boolean);
        const last = segments[segments.length - 1];
        return last === 'en';
    }, [pathname]);

    const langFromStorage = useLocalStorageValue('iky_lang', 'vi');

    const isEn = isEnFromPath ? true : langFromStorage === 'en';
    const t = isEn ? locales.en.vehicleCategory : locales.vi.vehicleCategory;

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
        manufacturer: '',
        year: '',
        model: '',
        madeInFrom: '',
    });

    // pagination state: chỉ là nguồn từ UI (không sync ngược từ response bằng effect)
    const [pagination, setPagination] = useState({
        current: 1,
        pageSize: 20,
    });

    const total = 0; // sẽ lấy từ listRes

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [form] = Form.useForm();

    /* =========================
        SWR: options
    ========================= */
    const mifKey = token ? ['madeInFromOptions', token] : null;
    const manuKey = token ? ['manufacturerOptions', token] : null;
    const deviceTypeKey = token ? ['deviceTypeOptions', token] : null;

    const { data: mifRes } = useSWR(mifKey, ([, tk]) => getMadeInFromOptions(tk), {
        revalidateOnFocus: false,
        dedupingInterval: 60_000,
    });

    const { data: manuRes } = useSWR(manuKey, ([, tk]) => getManufacturerOptions(tk), {
        revalidateOnFocus: false,
        dedupingInterval: 60_000,
    });

    const { data: dcRes } = useSWR(deviceTypeKey, ([, tk]) => getDeviceCategories(tk, { page: 1, limit: 100 }), {
        revalidateOnFocus: false,
        dedupingInterval: 60_000,
    });

    const mifOptions = useMemo(() => {
        const res = mifRes || {};
        return Object.entries(res).map(([value, label]) => ({ value, label }));
    }, [mifRes]);

    const manufacturerOptions = useMemo(() => {
        const res = manuRes || {};
        return Object.entries(res).map(([value, label]) => ({ value, label }));
    }, [manuRes]);

    const deviceTypeOptions = useMemo(() => {
        const items = dcRes?.items || [];
        return items.map((item) => ({
            value: item._id,
            label: item.name || item.code || 'Không tên',
        }));
    }, [dcRes]);

    // helper label: Xuất xứ
    const getMifLabel = (value) => {
        if (!value && value !== 0) return '';

        const key = String(value);
        const cfg = MADE_IN_FROM_MAP?.[key];

        if (cfg) return isEn ? cfg.en : cfg.vi;

        const found = mifOptions.find((opt) => String(opt.value) === key);
        if (found?.label) return found.label;

        return key;
    };

    const getManufacturerLabel = (value) => {
        const found = manufacturerOptions.find((opt) => String(opt.value) === String(value));
        return found ? found.label : value || '';
    };

    const getDeviceTypeLabel = (value) => {
        if (!value) return '';
        const found = deviceTypeOptions.find((opt) => String(opt.value) === String(value));
        return found ? found.label : value || '';
    };

    /* =========================
        SWR: list vehicle categories
        - key gồm pagination + filters
        - keepPreviousData để tránh “trống 0.5s”
    ========================= */
    const listParams = useMemo(() => {
        return {
            page: pagination.current,
            limit: pagination.pageSize,
            name: filters.name || undefined,
            manufacturer: filters.manufacturer || undefined,
            year: filters.year || undefined,
            model: filters.model || undefined,
            madeInFrom: filters.madeInFrom || undefined,
        };
    }, [pagination.current, pagination.pageSize, filters]);

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

    /* =========================
        TABLE CHANGE
        - ✅ không cần setPagination trong effect
    ========================= */
    const handleTableChange = (pag) => {
        setPagination({
            current: pag.current,
            pageSize: pag.pageSize,
        });
    };

    /* =========================
        MODAL
    ========================= */
    const openCreateModal = () => {
        if (!isAdmin) {
            message.warning(t.noPermissionCreate);
            return;
        }
        setEditingItem(null);
        form.resetFields();
        setIsModalOpen(true);
    };

    const openEditModal = (record) => {
        if (!canEdit) {
            message.warning(t.noPermissionEdit);
            return;
        }

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
        if (!isAdmin) {
            message.warning(t.noPermissionDelete);
            return;
        }
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
        if (!canEdit) {
            message.warning(t.noPermissionAction);
            return;
        }
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

    /* =========================
        SEARCH / RESET
    ========================= */
    const handleSearch = () => {
        setPagination((p) => ({ ...p, current: 1 }));
    };

    const handleResetFilter = () => {
        setFilters({
            name: '',
            manufacturer: '',
            year: '',
            model: '',
            madeInFrom: '',
        });
        setPagination((p) => ({ ...p, current: 1 }));
    };

    /* =========================
       EXPORT EXCEL
    ========================= */
    const exportExcel = () => {
        if (!data.length) {
            message.warning(t.noDataToExport);
            return;
        }

        try {
            const excelData = data.map((item) => ({
                [t.columns.name]: item.name || '',
                [t.columns.manufacturer]: getManufacturerLabel(item.manufacturer),
                Năm: item.year || '',
                [t.columns.model]: item.model || '',
                [t.columns.origin]: getMifLabel(item.madeInFrom),
                [t.columns.deviceType]: getDeviceTypeLabel(item.deviceTypeId || item.deviceType_id),
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
            XLSX.utils.book_append_sheet(wb, ws, 'VehicleCategories');

            const excelBuffer = XLSX.write(wb, {
                bookType: 'xlsx',
                type: 'array',
                cellStyles: true,
            });

            saveAs(new Blob([excelBuffer]), `DanhSachDongXe_${getTodayForFileName()}.xlsx`);
            message.success(t.exportSuccess);
        } catch (err) {
            console.error('Export excel vehicle category error:', err);
            message.error(t.exportFailed);
        }
    };

    /* =========================
       COLUMNS
    ========================= */
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
            render: (value, record) => {
                const v = value || record.deviceType_id;
                return getDeviceTypeLabel(v) || '-';
            },
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

    // customer -> chặn luôn trang
    if (isCustomer) {
        return (
            <div className="vc-page">
                <Card className="vc-card" title={t.title}>
                    <p style={{ color: '#ef4444', fontWeight: 500, margin: 0 }}>{t.noPermissionPage}</p>
                </Card>
            </div>
        );
    }

    if (!canView) {
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
                    className="vc-table"
                    scroll={{ x: 900 }}
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
                wrapClassName="vc-modal"
                destroyOnHidden
            >
                <Form form={form} layout="vertical">
                    <Form.Item
                        label={t.form.nameLabel}
                        name="name"
                        rules={[{ required: true, message: t.form.nameRequired }]}
                    >
                        <Input />
                    </Form.Item>

                    <Form.Item
                        label={t.form.manufacturerLabel}
                        name="manufacturer"
                        rules={[{ required: true, message: t.form.manufacturerRequired }]}
                    >
                        <Select placeholder={t.form.manufacturerLabel}>
                            {manufacturerOptions.map((opt) => (
                                <Option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </Option>
                            ))}
                        </Select>
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
                        <Select placeholder={t.form.originPlaceholder}>
                            {mifOptions.map((opt) => (
                                <Option key={opt.value} value={opt.value}>
                                    {getMifLabel(opt.value)}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item label={t.form.deviceTypeLabel} name="deviceTypeId">
                        <Select allowClear placeholder={t.form.deviceTypePlaceholder}>
                            {deviceTypeOptions.map((opt) => (
                                <Option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default VehicleCategoryPage;
