'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import dayjs from 'dayjs';
import {
    Card,
    Empty,
    Spin,
    Table,
    Typography,
    message,
    Row,
    Col,
    Input,
    Button,
    DatePicker,
    Space,
    Tooltip,
} from 'antd';
import { SearchOutlined, ReloadOutlined, FileExcelOutlined } from '@ant-design/icons';

import { useMaintenanceDeviceMap } from '../../hooks/useMaintenanceDeviceMap';
import { getMaintenanceHistory } from '../../lib/api/maintain';
import { getUserList } from '../../lib/api/user';
import { useAuthStore } from '../../stores/authStore';

import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx-js-style';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

/* ----------------------------- helpers ----------------------------- */
function getArrayFromResponse(res) {
    if (!res) return [];
    if (Array.isArray(res)) return res;
    if (Array.isArray(res.items)) return res.items;
    if (Array.isArray(res.history)) return res.history;
    if (Array.isArray(res.data)) return res.data;
    if (Array.isArray(res?.result?.items)) return res.result.items;
    return [];
}

function extractItemsTotal(res) {
    const items = getArrayFromResponse(res);
    const total =
        Number(res?.total) ||
        Number(res?.pagination?.total) ||
        Number(res?.meta?.total) ||
        Number(res?.result?.total) ||
        items.length;
    return { items, total };
}

const normStr = (v) => (typeof v === 'string' ? v.trim() : '');
const normalizePlate = (s) =>
    (s || '')
        .toString()
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');

const getRowImei = (row) => normStr(String(row?.imei || row?.device?.imei || row?.device_id?.imei || ''));
const getRowPlate = (row) =>
    normalizePlate(String(row?.license_plate || row?.device?.license_plate || row?.device_id?.license_plate || ''));

const safeNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

const hasAnySearchCondition = (filters) => {
    const imei = normStr(filters?.imei);
    const plate = normalizePlate(filters?.license_plate);
    const range = filters?.maintenanceRange;
    const hasRange = !!(range?.[0] && range?.[1]);
    return !!(imei || plate || hasRange);
};

/* -------------------------- FE filter/sort helpers -------------------------- */
function applyFilters({ rows, filters, plateToImeis, imeiToPlate }) {
    let out = Array.isArray(rows) ? [...rows] : [];

    const imeiInput = normStr(filters?.imei);
    const plateInput = normalizePlate(filters?.license_plate);
    const range = filters?.maintenanceRange;

    // plate
    if (plateInput) {
        if (plateToImeis && plateToImeis instanceof Map) {
            let mappedImeis = plateToImeis.get(plateInput) || [];

            if (mappedImeis.length === 0) {
                for (const [key, imeis] of plateToImeis.entries()) {
                    if (normalizePlate(key) === plateInput) {
                        mappedImeis = imeis;
                        break;
                    }
                }
            }

            if (mappedImeis.length > 0) {
                const set = new Set(mappedImeis.map((x) => normStr(String(x))));
                out = out.filter((r) => set.has(getRowImei(r)));
            } else {
                out = out.filter((r) => {
                    const rowPlate = normalizePlate(getRowPlate(r) || String(imeiToPlate.get(getRowImei(r)) || ''));
                    return rowPlate === plateInput || rowPlate.includes(plateInput);
                });
            }
        } else {
            out = out.filter((r) => {
                const rowPlate = normalizePlate(getRowPlate(r) || String(imeiToPlate.get(getRowImei(r)) || ''));
                return rowPlate === plateInput || rowPlate.includes(plateInput);
            });
        }
    }

    // imei
    if (imeiInput) {
        out = out.filter((r) => getRowImei(r).includes(imeiInput));
    }

    // date range
    if (range?.[0] && range?.[1] && dayjs(range[0]).isValid() && dayjs(range[1]).isValid()) {
        const d0 = dayjs(range[0]).startOf('day').valueOf();
        const d1 = dayjs(range[1]).endOf('day').valueOf();
        out = out.filter((r) => {
            const v = r?.maintenanceDate;
            const t = v && dayjs(v).isValid() ? dayjs(v).valueOf() : NaN;
            return Number.isFinite(t) && t >= d0 && t <= d1;
        });
    }

    return out;
}

function applySort({ rows, sorterState, imeiToPlate, userMap }) {
    const out = [...(rows || [])];
    const { field, order } = sorterState || {};
    if (!field || !order) return out;

    const dir = order === 'ascend' ? 1 : -1;

    const getVal = (r) => {
        if (field === 'imei') return getRowImei(r);
        if (field === 'license_plate') return getRowPlate(r) || normalizePlate(imeiToPlate.get(getRowImei(r)) || '');
        if (field === 'maintenanceKm') return safeNum(r?.maintenanceKm) ?? -Infinity;
        if (field === 'maintenanceDate')
            return dayjs(r?.maintenanceDate).isValid() ? dayjs(r.maintenanceDate).valueOf() : -Infinity;
        if (field === 'createdAt') return dayjs(r?.createdAt).isValid() ? dayjs(r.createdAt).valueOf() : -Infinity;

        if (field === 'confirmedBy') {
            const v = r?.confirmedBy;
            if (!v) return '';
            if (typeof v === 'object') return v?.name || v?.username || v?.email || '';
            return userMap.get(String(v)) || '';
        }

        return r?.[field];
    };

    out.sort((a, b) => {
        const va = getVal(a);
        const vb = getVal(b);
        if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
        return String(va ?? '').localeCompare(String(vb ?? ''), 'vi', { sensitivity: 'base' }) * dir;
    });

    return out;
}

/* -------------------------- excel export --------------------------- */
function buildWorkbook({ rows, filters, imeiToPlate, userMap }) {
    const header = ['Thời gian tạo', 'IMEI', 'Biển số', 'Km bảo trì', 'Ngày bảo trì', 'Xác nhận bởi', 'Ghi chú'];

    const cond = [];
    if (normStr(filters?.imei)) cond.push(`IMEI: ${normStr(filters.imei)}`);
    if (normStr(filters?.license_plate)) cond.push(`Biển số: ${normalizePlate(filters.license_plate)}`);
    if (filters?.maintenanceRange?.[0] && filters?.maintenanceRange?.[1]) {
        cond.push(
            `Ngày bảo trì: ${dayjs(filters.maintenanceRange[0]).format('DD-MM-YYYY')} đến ${dayjs(
                filters.maintenanceRange[1],
            ).format('DD-MM-YYYY')}`,
        );
    }

    // ✅ FIX: conditionLine đúng biến
    const conditionLine = cond.length ? `Điều kiện: ${cond.join(' | ')}` : 'Điều kiện: (Không)';
    const timeLine = `Thời điểm xuất: ${dayjs().format('DD-MM-YYYY HH:mm')}`;

    const data = [];
    data.push(['BÁO CÁO LỊCH SỬ BẢO TRÌ']);
    data.push([conditionLine]);
    data.push([timeLine]);
    data.push([]);
    data.push(header);

    rows.forEach((r) => {
        const createdAt =
            r?.createdAt && dayjs(r.createdAt).isValid() ? dayjs(r.createdAt).format('DD-MM-YYYY HH:mm') : '';
        const imei = getRowImei(r);
        const plate = getRowPlate(r) || normalizePlate(imeiToPlate.get(String(imei)) || '');
        const km = safeNum(r?.maintenanceKm);
        const maintenanceDate =
            r?.maintenanceDate && dayjs(r.maintenanceDate).isValid()
                ? dayjs(r.maintenanceDate).format('DD-MM-YYYY')
                : '';
        const confirmedByRaw = r?.confirmedBy;
        const confirmedBy =
            typeof confirmedByRaw === 'object'
                ? confirmedByRaw?.name || confirmedByRaw?.username || confirmedByRaw?.email || ''
                : userMap.get(String(confirmedByRaw || '')) || '';
        const note = r?.note ? String(r.note) : '';

        data.push([createdAt, imei, plate, km ?? '', maintenanceDate, confirmedBy, note]);
    });

    const ws = XLSX.utils.aoa_to_sheet(data);

    ws['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 22 }, { wch: 40 }];

    ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: header.length - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: header.length - 1 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: header.length - 1 } },
    ];

    const borderAll = {
        top: { style: 'thin', color: { rgb: 'D9D9D9' } },
        bottom: { style: 'thin', color: { rgb: 'D9D9D9' } },
        left: { style: 'thin', color: { rgb: 'D9D9D9' } },
        right: { style: 'thin', color: { rgb: 'D9D9D9' } },
    };

    const setStyle = (addr, style) => {
        if (!ws[addr]) return;
        ws[addr].s = { ...(ws[addr].s || {}), ...style };
    };

    setStyle('A1', { font: { bold: true, sz: 16 }, alignment: { horizontal: 'center', vertical: 'center' } });
    setStyle('A2', { font: { italic: true, sz: 11 }, alignment: { horizontal: 'left', vertical: 'center' } });
    setStyle('A3', { font: { sz: 10 }, alignment: { horizontal: 'left', vertical: 'center' } });

    const headerRow = 5;
    for (let c = 0; c < header.length; c++) {
        const cell = XLSX.utils.encode_cell({ r: headerRow - 1, c });
        setStyle(cell, {
            font: { bold: true },
            fill: { fgColor: { rgb: 'F2F2F2' } },
            border: borderAll,
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        });
    }

    const firstDataRow = headerRow + 1;
    const lastDataRow = firstDataRow + rows.length - 1;
    for (let r = firstDataRow; r <= lastDataRow; r++) {
        for (let c = 0; c < header.length; c++) {
            const addr = XLSX.utils.encode_cell({ r: r - 1, c });
            setStyle(addr, {
                border: borderAll,
                alignment: { vertical: 'top', wrapText: c === 6, horizontal: c === 3 ? 'right' : 'left' },
            });
            if (c === 3 && ws[addr] && typeof ws[addr].v === 'number') ws[addr].z = '#,##0.0';
        }
    }

    ws['!freeze'] = { xSplit: 0, ySplit: headerRow };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Maintenance History');
    return wb;
}

function downloadWorkbook(wb, filename) {
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([out], { type: 'application/octet-stream' }), filename);
}

/* ------------------------------ page ------------------------------ */
export default function MaintenanceHistoryReportPage() {
    const deviceMap = useMaintenanceDeviceMap();
    const imeiToPlate = deviceMap?.imeiToPlate || new Map();
    const plateToImeis = deviceMap?.plateToImeis;

    const [filters, setFilters] = useState({
        imei: '',
        license_plate: '',
        maintenanceRange: null,
    });

    // data sources
    const [rawData, setRawData] = useState([]);
    const [allData, setAllData] = useState([]);
    const [searchMode, setSearchMode] = useState(false); // fetch all + FE filter/sort/paging

    const [tableLoading, setTableLoading] = useState(false);
    const [exportLoading, setExportLoading] = useState(false);

    // paging
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;
    const [total, setTotal] = useState(0);

    // map userId -> display
    const [userMap, setUserMap] = useState(new Map());

    // role
    const user = useAuthStore((s) => s.user);
    const role = useMemo(() => {
        const r1 = user?.position || user?.role;
        if (r1) return String(r1).toLowerCase();
        if (typeof window !== 'undefined') return String(localStorage.getItem('role') || '').toLowerCase();
        return '';
    }, [user]);
    const hideConfirmedByCol = role === 'distributor' || role === 'customer';

    // ✅ FIX: nếu có điều kiện lọc (kể cả chưa bấm Tìm) thì total/paging phải theo FE
    const isFiltering = hasAnySearchCondition(filters);
    const pagingOnClient = searchMode || isFiltering;

    // load users name map
    useEffect(() => {
        const loadUsers = async () => {
            try {
                const res = await getUserList({ limit: 5000 });
                const items = res?.items || res?.data || res || [];
                const m = new Map();
                items.forEach((u) => {
                    const id = u?._id;
                    if (!id) return;
                    const display =
                        (u?.name && String(u.name).trim()) ||
                        (u?.username && String(u.username).trim()) ||
                        (u?.email && String(u.email).trim()) ||
                        String(id);
                    m.set(String(id), display);
                });
                setUserMap(m);
            } catch (e) {
                console.warn('loadUsers failed', e);
            }
        };
        loadUsers();
    }, []);

    // fetch 1 page from server
    const loadServerPage = useCallback(
        async ({ p = 1 } = {}) => {
            try {
                setTableLoading(true);
                const res = await getMaintenanceHistory({ page: p, limit: PAGE_SIZE });
                const { items, total } = extractItemsTotal(res);
                setRawData(items);
                setTotal(total);
            } catch (e) {
                console.error(e);
                message.error('Không tải được lịch sử bảo trì');
            } finally {
                setTableLoading(false);
            }
        },
        [PAGE_SIZE],
    );

    // fetch many pages (for search/export)
    const fetchAllPages = useCallback(async () => {
        const LIMIT = 300;
        const MAX_PAGES = 500;

        let p = 1;
        let all = [];

        while (p <= MAX_PAGES) {
            const res = await getMaintenanceHistory({ page: p, limit: LIMIT });
            const items = getArrayFromResponse(res);
            if (!items.length) break;

            all = all.concat(items);
            if (items.length < LIMIT) break;
            p += 1;
        }
        return all;
    }, []);

    // first load
    useEffect(() => {
        setPage(1);
        loadServerPage({ p: 1 });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* -------------------------- base rows -------------------------- */
    const baseRows = useMemo(() => (searchMode ? allData : rawData), [searchMode, allData, rawData]);

    /* -------------------------- FE filter + sort -------------------------- */
    const processedData = useMemo(() => {
        return applyFilters({ rows: baseRows, filters, plateToImeis, imeiToPlate });
    }, [baseRows, filters, plateToImeis, imeiToPlate]);

    const [sorterState, setSorterState] = useState({ field: 'createdAt', order: 'descend' });

    const sortedData = useMemo(() => {
        return applySort({ rows: processedData, sorterState, imeiToPlate, userMap });
    }, [processedData, sorterState, imeiToPlate, userMap]);

    const onTableChange = (_, __, sorter) => {
        const s = Array.isArray(sorter) ? sorter[0] : sorter;
        if (!s?.order) {
            setSorterState({ field: 'createdAt', order: 'descend' });
            return;
        }
        setSorterState({ field: s.field || s.columnKey, order: s.order });
    };

    /* ------------------------------ Pagination ------------------------------ */
    const totalForPaging = useMemo(() => {
        if (pagingOnClient) return sortedData.length; // ✅ total khớp data sau lọc
        return total; // server paging
    }, [pagingOnClient, sortedData.length, total]);

    const pagedData = useMemo(() => {
        if (!pagingOnClient) return sortedData; // server paging: sortedData đã là 1 page
        const start = (page - 1) * PAGE_SIZE;
        return sortedData.slice(start, start + PAGE_SIZE);
    }, [pagingOnClient, sortedData, page, PAGE_SIZE]);

    useEffect(() => {
        if (!pagingOnClient) return;
        const maxPage = Math.max(1, Math.ceil(sortedData.length / PAGE_SIZE));
        if (page > maxPage) setPage(1);
    }, [pagingOnClient, sortedData.length, page, PAGE_SIZE]);

    /* ----------------------------- actions ----------------------------- */
    const onSearch = async () => {
        setPage(1);

        const searchingNow = hasAnySearchCondition(filters);

        if (searchingNow) {
            setTableLoading(true);
            setSearchMode(false);
            try {
                const all = await fetchAllPages();
                setAllData(all);
                setRawData([]);
                setTotal(all.length);
                setSearchMode(true);
            } finally {
                setTableLoading(false);
            }
            return;
        }

        setSearchMode(false);
        setAllData([]);
        await loadServerPage({ p: 1 });
    };

    const onClear = async () => {
        setFilters({ imei: '', license_plate: '', maintenanceRange: null });
        setSorterState({ field: 'createdAt', order: 'descend' });
        setPage(1);
        setSearchMode(false);
        setAllData([]);
        setTotal(0);
        await loadServerPage({ p: 1 });
    };

    const onReload = async () => {
        if (searchMode) {
            try {
                setTableLoading(true);
                const all = await fetchAllPages();
                setAllData(all);
            } finally {
                setTableLoading(false);
            }
            return;
        }
        await loadServerPage({ p: page });
    };

    const onExport = async () => {
        try {
            setExportLoading(true);

            const hasCond = hasAnySearchCondition(filters);

            let rowsToExport = [];
            if (hasCond) {
                const all = searchMode ? allData : await fetchAllPages();
                const filtered = applyFilters({ rows: all, filters, plateToImeis, imeiToPlate });
                rowsToExport = applySort({ rows: filtered, sorterState, imeiToPlate, userMap });
            } else {
                const all = await fetchAllPages();
                rowsToExport = applySort({ rows: all, sorterState, imeiToPlate, userMap });
            }

            const wb = buildWorkbook({
                rows: rowsToExport,
                filters: hasCond ? filters : { imei: '', license_plate: '', maintenanceRange: null },
                imeiToPlate,
                userMap,
            });

            const dateText = dayjs().format('DD-MM-YYYY');
            const fileName = `Bao_cao_lich_su_bao_tri_${dateText}.xlsx`;

            downloadWorkbook(wb, fileName);
            message.success('Đã xuất báo cáo');
        } catch (e) {
            console.error(e);
            message.error('Xuất báo cáo thất bại');
        } finally {
            setExportLoading(false);
        }
    };

    /* ----------------------------- columns ----------------------------- */
    const columns = useMemo(() => {
        const cols = [
            {
                title: 'Thời gian tạo',
                dataIndex: 'createdAt',
                key: 'createdAt',
                width: 170,
                sorter: true,
                sortOrder: sorterState.field === 'createdAt' ? sorterState.order : null,
                render: (v) => (v && dayjs(v).isValid() ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'),
            },
            {
                title: 'IMEI',
                key: 'imei',
                width: 180,
                sorter: true,
                sortOrder: sorterState.field === 'imei' ? sorterState.order : null,
                render: (_, row) => getRowImei(row) || '-',
            },
            {
                title: 'Biển số',
                key: 'license_plate',
                width: 150,
                sorter: true,
                sortOrder: sorterState.field === 'license_plate' ? sorterState.order : null,
                render: (_, row) => {
                    const plate = getRowPlate(row);
                    if (plate) return plate;
                    const rowImei = getRowImei(row);
                    return rowImei ? imeiToPlate.get(String(rowImei)) || '-' : '-';
                },
            },
            {
                title: 'Km bảo trì',
                dataIndex: 'maintenanceKm',
                key: 'maintenanceKm',
                width: 120,
                sorter: true,
                sortOrder: sorterState.field === 'maintenanceKm' ? sorterState.order : null,
                render: (v) => (v === null || v === undefined ? '-' : `${v}`),
            },
            {
                title: 'Ngày bảo trì',
                dataIndex: 'maintenanceDate',
                key: 'maintenanceDate',
                width: 130,
                sorter: true,
                sortOrder: sorterState.field === 'maintenanceDate' ? sorterState.order : null,
                render: (v) => (v && dayjs(v).isValid() ? dayjs(v).format('YYYY-MM-DD') : '-'),
            },
            {
                title: 'Xác nhận bởi',
                dataIndex: 'confirmedBy',
                key: 'confirmedBy',
                width: 170,
                sorter: true,
                sortOrder: sorterState.field === 'confirmedBy' ? sorterState.order : null,
                render: (v) => {
                    if (!v) return '-';
                    if (typeof v === 'object') return v?.name || v?.username || v?.email || '-';
                    const id = String(v);
                    return userMap.get(id) || '-';
                },
            },
            {
                title: 'Ghi chú',
                dataIndex: 'note',
                key: 'note',
                ellipsis: true,
                render: (v) => v || '-',
            },
        ];

        return hideConfirmedByCol ? cols.filter((c) => c.key !== 'confirmedBy') : cols;
    }, [hideConfirmedByCol, imeiToPlate, sorterState, userMap]);

    const exportTooltip = hasAnySearchCondition(filters)
        ? 'Xuất báo cáo theo kết quả đang lọc/tìm'
        : 'Xuất toàn bộ danh sách';

    return (
        <div style={{ padding: 16 }}>
            <Row justify="space-between" align="middle">
                <Col>
                    <Title level={3} style={{ marginBottom: 4 }}>
                        Báo cáo lịch sử bảo trì
                    </Title>
                    <Text type="secondary">
                        Nhập điều kiện tìm kiếm rồi bấm <b>Tìm</b>. Bấm tiêu đề cột để sắp xếp.
                    </Text>
                </Col>

                <Col>
                    <Tooltip title={exportTooltip}>
                        <Button
                            icon={<FileExcelOutlined />}
                            onClick={onExport}
                            loading={exportLoading}
                            disabled={tableLoading}
                        >
                            Xuất báo cáo
                        </Button>
                    </Tooltip>
                </Col>
            </Row>

            <Card style={{ marginTop: 12 }} size="small">
                <Row gutter={[12, 12]} align="middle">
                    <Col xs={24} md={6}>
                        <Text strong>IMEI</Text>
                        <Input
                            value={filters.imei}
                            placeholder="Nhập IMEI..."
                            allowClear
                            onChange={(e) => setFilters((p) => ({ ...p, imei: e.target.value }))}
                            onPressEnter={onSearch}
                        />
                    </Col>

                    <Col xs={24} md={6}>
                        <Text strong>Biển số</Text>
                        <Input
                            value={filters.license_plate}
                            placeholder="Nhập biển số..."
                            allowClear
                            onChange={(e) => setFilters((p) => ({ ...p, license_plate: e.target.value }))}
                            onPressEnter={onSearch}
                        />
                    </Col>

                    <Col xs={24} md={8}>
                        <Text strong>Khoảng ngày bảo trì</Text>
                        <RangePicker
                            style={{ width: '100%' }}
                            format="YYYY-MM-DD"
                            placeholder={['Từ ngày', 'Đến ngày']}
                            value={filters.maintenanceRange}
                            onChange={(v) => setFilters((p) => ({ ...p, maintenanceRange: v }))}
                            allowClear
                        />
                    </Col>

                    <Col xs={24} md={4}>
                        <Space wrap style={{ marginTop: 22 }}>
                            <Button type="primary" icon={<SearchOutlined />} onClick={onSearch} loading={tableLoading}>
                                Tìm
                            </Button>
                            <Button icon={<ReloadOutlined />} onClick={onClear} disabled={tableLoading}>
                                Xóa điều kiện
                            </Button>
                            <Button onClick={onReload} disabled={tableLoading}>
                                Tải lại
                            </Button>
                        </Space>
                    </Col>
                </Row>
            </Card>

            <Card style={{ marginTop: 12 }}>
                {tableLoading ? (
                    <div style={{ textAlign: 'center', padding: 24 }}>
                        <Spin />
                    </div>
                ) : pagedData.length === 0 ? (
                    <Empty description="Chưa có lịch sử bảo trì" />
                ) : (
                    <Table
                        rowKey={(row) =>
                            row?._id || `${getRowImei(row)}-${row?.createdAt || ''}-${row?.maintenanceDate || ''}`
                        }
                        columns={columns}
                        dataSource={pagedData}
                        scroll={{ x: 980 }}
                        onChange={onTableChange}
                        pagination={{
                            current: page,
                            pageSize: PAGE_SIZE,
                            total: totalForPaging,
                            showSizeChanger: false,
                            onChange: async (p) => {
                                setPage(p);
                                // ✅ nếu paging FE (searchMode hoặc đang filter) thì KHÔNG gọi server
                                if (pagingOnClient) return;
                                await loadServerPage({ p });
                            },
                        }}
                    />
                )}
            </Card>
        </div>
    );
}
