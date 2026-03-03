'use client';

import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Card, Empty, Spin, Table, Tag, Typography, message, Button, Space } from 'antd';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import { usePathname } from 'next/navigation';

import MaintenanceReportFilters from '../components/MaintenanceReportFilters';
import { useMaintenanceDeviceMap } from '../../hooks/useMaintenanceDeviceMap';
import { getMaintenanceDue } from '../../lib/api/maintain';

// IMPORTANT: dùng xlsx-js-style để hỗ trợ style
import * as XLSX from 'xlsx-js-style';

const { Title, Text } = Typography;

function getArrayFromResponse(res) {
    if (!res) return [];
    if (Array.isArray(res)) return res;
    if (Array.isArray(res.items)) return res.items;
    if (Array.isArray(res.history)) return res.history;
    if (Array.isArray(res.data)) return res.data;
    if (Array.isArray(res?.result?.items)) return res.result.items;
    return [];
}

function formatKm(v) {
    if (v === null || v === undefined) return '-';
    const n = Number(v);
    if (Number.isNaN(n)) return `${v}`;
    if (n % 1 === 0) return `${n}`;
    return `${Math.round(n * 10) / 10}`;
}

function formatDateTime(v) {
    if (!v) return '-';
    const d = dayjs(v);
    if (!d.isValid()) return '-';
    return d.format('YYYY-MM-DD HH:mm');
}

function safeText(v) {
    return v === null || v === undefined || v === '' ? '-' : String(v);
}

function statusMeta(s, isEn) {
    switch (s) {
        case 'OVERDUE':
            return { color: 'red', label: isEn ? 'Overdue' : 'Quá hạn' };
        case 'DUE_SOON':
            return { color: 'orange', label: isEn ? 'Due soon' : 'Sắp đến hạn' };
        case 'OK':
            return { color: 'green', label: isEn ? 'On time' : 'Đúng hạn' };
        default:
            return { color: 'default', label: s || '-' };
    }
}

// ---------- Excel helpers (xlsx-js-style) ----------
const COLORS = {
    navy: '1F2A44',
    blue: '2563EB',
    lightBlue: 'E8F0FF',
    grayText: '64748B',
    border: 'CBD5E1',
    white: 'FFFFFF',
    green: '16A34A',
    amber: 'F59E0B',
    red: 'DC2626',
    slate: '0F172A',
};

const styles = {
    title: {
        font: { bold: true, sz: 16, color: { rgb: COLORS.white } },
        fill: { fgColor: { rgb: COLORS.navy } },
        alignment: { horizontal: 'center', vertical: 'center' },
    },
    subtitle: {
        font: { italic: true, sz: 10, color: { rgb: COLORS.grayText } },
        alignment: { horizontal: 'left', vertical: 'center' },
    },
    header: {
        font: { bold: true, sz: 11, color: { rgb: COLORS.white } },
        fill: { fgColor: { rgb: COLORS.blue } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: {
            top: { style: 'thin', color: { rgb: COLORS.border } },
            bottom: { style: 'thin', color: { rgb: COLORS.border } },
            left: { style: 'thin', color: { rgb: COLORS.border } },
            right: { style: 'thin', color: { rgb: COLORS.border } },
        },
    },
    cell: {
        font: { sz: 10, color: { rgb: COLORS.slate } },
        alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
        border: {
            top: { style: 'thin', color: { rgb: COLORS.border } },
            bottom: { style: 'thin', color: { rgb: COLORS.border } },
            left: { style: 'thin', color: { rgb: COLORS.border } },
            right: { style: 'thin', color: { rgb: COLORS.border } },
        },
    },
    cellCenter: {
        font: { sz: 10, color: { rgb: COLORS.slate } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: {
            top: { style: 'thin', color: { rgb: COLORS.border } },
            bottom: { style: 'thin', color: { rgb: COLORS.border } },
            left: { style: 'thin', color: { rgb: COLORS.border } },
            right: { style: 'thin', color: { rgb: COLORS.border } },
        },
    },
    zebra: {
        fill: { fgColor: { rgb: COLORS.lightBlue } },
    },
};

function statusCellStyle(status) {
    if (status === 'OK') {
        return {
            font: { bold: true, color: { rgb: COLORS.green } },
            alignment: { horizontal: 'center', vertical: 'center' },
        };
    }
    if (status === 'DUE_SOON') {
        return {
            font: { bold: true, color: { rgb: COLORS.amber } },
            alignment: { horizontal: 'center', vertical: 'center' },
        };
    }
    if (status === 'OVERDUE') {
        return {
            font: { bold: true, color: { rgb: COLORS.red } },
            alignment: { horizontal: 'center', vertical: 'center' },
        };
    }
    return {
        font: { bold: true, color: { rgb: COLORS.slate } },
        alignment: { horizontal: 'center', vertical: 'center' },
    };
}

function mergeStyle(base, extra) {
    return { ...(base || {}), ...(extra || {}) };
}

function applyRangeStyle(ws, range, styleObj) {
    for (let r = range.s.r; r <= range.e.r; r += 1) {
        for (let c = range.s.c; c <= range.e.c; c += 1) {
            const addr = XLSX.utils.encode_cell({ r, c });
            if (!ws[addr]) continue;
            ws[addr].s = mergeStyle(ws[addr].s, styleObj);
        }
    }
}

function setCell(ws, r, c, v, s) {
    const addr = XLSX.utils.encode_cell({ r, c });
    ws[addr] = { v, t: typeof v === 'number' ? 'n' : 's', s: s || undefined };
}

function exportMaintenanceDueXlsx({ rows, imeiToPlate, filterImei, isEn }) {
    const now = dayjs();

    const reportName = isEn ? 'MAINTENANCE DUE REPORT' : 'BÁO CÁO BẢO TRÌ SẮP ĐẾN HẠN';
    const subtitle = isEn
        ? `Report generated at: ${now.format('YYYY-MM-DD HH:mm')}`
        : `Tạo báo cáo lúc: ${now.format('YYYY-MM-DD HH:mm')}`;

    const headers = isEn
        ? [
              'IMEI',
              'License plate',
              'Last maint. km',
              'Next due km',
              'Last maint. date',
              'Tracking since',
              'Updated at',
              'Status',
          ]
        : [
              'IMEI',
              'Biển số',
              'Km bảo trì gần nhất',
              'Km đến hạn tiếp theo',
              'Ngày bảo trì gần nhất',
              'Bắt đầu theo dõi',
              'Cập nhật lúc',
              'Trạng thái',
          ];

    const normalized = (rows || []).map((row) => {
        const imei = row?.imei || row?.device?.imei || row?.device_id?.imei || '';
        const plateDirect = row?.license_plate || row?.device?.license_plate || row?.device_id?.license_plate;
        const plate = plateDirect || (imei ? imeiToPlate.get(String(imei)) : '') || '';

        const status = row?.status || '';
        const meta = statusMeta(status, isEn);

        return {
            imei: safeText(imei),
            plate: safeText(plate),
            lastMaintenanceKm: safeText(formatKm(row?.lastMaintenanceKm)),
            nextDueKm: safeText(formatKm(row?.nextDueKm)),
            lastMaintenanceDate: safeText(formatDateTime(row?.lastMaintenanceDate)),
            startedAt: safeText(formatDateTime(row?.startedAt)),
            updatedAt: safeText(formatDateTime(row?.updatedAt)),
            statusLabel: safeText(meta.label),
            statusRaw: safeText(status),
        };
    });

    const ws = {};
    const colCount = headers.length;
    const lastCol = colCount - 1;

    // Title
    setCell(ws, 0, 0, reportName, styles.title);
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } }];

    // Subtitle
    setCell(ws, 1, 0, subtitle, styles.subtitle);
    ws['!merges'].push({ s: { r: 1, c: 0 }, e: { r: 1, c: lastCol } });

    const headerRow = 3;
    headers.forEach((h, idx) => setCell(ws, headerRow, idx, h, styles.header));

    const startDataRow = headerRow + 1;
    normalized.forEach((it, i) => {
        const r = startDataRow + i;
        const isZebra = i % 2 === 1;

        const baseCell = isZebra ? mergeStyle(styles.cell, styles.zebra) : styles.cell;
        const baseCenter = isZebra ? mergeStyle(styles.cellCenter, styles.zebra) : styles.cellCenter;

        setCell(ws, r, 0, it.imei, baseCell);
        setCell(ws, r, 1, it.plate, baseCell);
        setCell(ws, r, 2, it.lastMaintenanceKm, baseCenter);
        setCell(ws, r, 3, it.nextDueKm, baseCenter);
        setCell(ws, r, 4, it.lastMaintenanceDate, baseCenter);
        setCell(ws, r, 5, it.startedAt, baseCenter);
        setCell(ws, r, 6, it.updatedAt, baseCenter);

        const statusStyle = mergeStyle(baseCenter, statusCellStyle(it.statusRaw));
        setCell(ws, r, 7, it.statusLabel, statusStyle);
    });

    const endRow = startDataRow + normalized.length - 1;
    const usedEndRow = Math.max(endRow, headerRow);

    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: usedEndRow, c: lastCol } });

    ws['!cols'] = [{ wch: 20 }, { wch: 16 }, { wch: 18 }, { wch: 24 }, { wch: 20 }, { wch: 20 }, { wch: 14 }];

    ws['!rows'] = [{ hpt: 28 }, { hpt: 16 }, { hpt: 8 }, { hpt: 22 }];

    ws['!freeze'] = { xSplit: 0, ySplit: startDataRow, topLeftCell: 'A5', activePane: 'bottomLeft', state: 'frozen' };

    applyRangeStyle(ws, { s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } }, styles.title);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, isEn ? 'Maintenance Due' : 'Bao cao bao tri');

    const dateStr = now.format('DDMMYYYY');

    const fileName = isEn ? `maintenance_due_${dateStr}.xlsx` : `danh-sach-xe-sap-den-han-bao-duong-${dateStr}.xlsx`;
    XLSX.writeFile(wb, fileName);
}

// ---------- Page ----------
export default function MaintenanceDueReportPage() {
    const { imeiToPlate } = useMaintenanceDeviceMap();
    const pathname = usePathname() || '/';

    const [mounted, setMounted] = useState(false);
    const [isEn, setIsEn] = useState(false);

    const [filterImei, setFilterImei] = useState('');
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);

    // detect EN từ URL giống Navbar
    const { isEnFromPath, normalizedPath } = useMemo(() => {
        const segments = pathname.split('/').filter(Boolean);
        const last = segments[segments.length - 1];
        const hasEn = last === 'en';

        if (hasEn) {
            const baseSegments = segments.slice(0, -1);
            const basePath = baseSegments.length ? '/' + baseSegments.join('/') : '/';
            return { isEnFromPath: true, normalizedPath: basePath };
        }

        return { isEnFromPath: false, normalizedPath: pathname };
    }, [pathname]);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        if (isEnFromPath) {
            setIsEn(true);
            localStorage.setItem('iky_lang', 'en');
        } else {
            const saved = localStorage.getItem('iky_lang');
            setIsEn(saved === 'en');
        }
    }, [isEnFromPath, pathname]);

    const t = useMemo(() => {
        return {
            pageTitle: isEn ? 'Maintenance Due Report' : 'Báo cáo bảo trì sắp đến hạn',
            pageDesc: isEn
                ? 'Search by IMEI or by License plate (mapped to IMEI).'
                : 'Tìm theo IMEI hoặc theo Biển số (map ra IMEI).',
            reload: isEn ? 'Reload' : 'Tải lại',
            export: isEn ? 'Export Excel' : 'Xuất Excel',
            exportingOk: isEn ? 'Excel exported' : 'Đã xuất báo cáo Excel',
            exportFail: isEn ? 'Export failed' : 'Xuất Excel thất bại',
            noDataExport: isEn ? 'No data to export' : 'Không có dữ liệu để xuất',
            loadFail: isEn ? 'Failed to load report' : 'Không tải được báo cáo sắp đến hạn',
            empty: isEn ? 'No upcoming maintenance' : 'Không có lịch sắp đến hạn',

            colImei: 'IMEI',
            colPlate: isEn ? 'License plate' : 'Biển số',
            colLastKm: isEn ? 'Last maint. km' : 'Km bảo trì gần nhất',
            colNextKm: isEn ? 'Next due km' : 'Km đến hạn tiếp theo',
            colLastDate: isEn ? 'Last maint. date' : 'Ngày bảo trì gần nhất',
            colStartedAt: isEn ? 'Tracking since' : 'Bắt đầu theo dõi',
            colUpdatedAt: isEn ? 'Updated at' : 'Cập nhật lúc',
            colStatus: isEn ? 'Status' : 'Trạng thái',
        };
    }, [isEn]);

    const load = async (imei = filterImei) => {
        try {
            setLoading(true);
            const res = imei ? await getMaintenanceDue({ imei }) : await getMaintenanceDue({});
            setData(getArrayFromResponse(res));
        } catch (err) {
            console.error(err);
            message.error(t.loadFail);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!mounted) return;
        load('');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mounted]);

    const columns = useMemo(
        () => [
            {
                title: t.colImei,
                key: 'imei',
                width: 180,
                render: (_, row) => row?.imei || row?.device?.imei || row?.device_id?.imei || '-',
            },
            {
                title: t.colPlate,
                key: 'license_plate',
                width: 150,
                render: (_, row) => {
                    const plate = row?.license_plate || row?.device?.license_plate || row?.device_id?.license_plate;
                    if (plate) return plate;

                    const rowImei = row?.imei || row?.device?.imei || row?.device_id?.imei;
                    return rowImei ? imeiToPlate.get(String(rowImei)) || '-' : '-';
                },
            },
            {
                title: t.colLastKm,
                dataIndex: 'lastMaintenanceKm',
                key: 'lastMaintenanceKm',
                width: 170,
                render: (v) => formatKm(v),
            },
            {
                title: t.colNextKm,
                dataIndex: 'nextDueKm',
                key: 'nextDueKm',
                width: 170,
                render: (v) => formatKm(v),
            },
            {
                title: t.colLastDate,
                dataIndex: 'lastMaintenanceDate',
                key: 'lastMaintenanceDate',
                width: 180,
                render: (v) => formatDateTime(v),
            },
            {
                title: t.colStartedAt,
                dataIndex: 'startedAt',
                key: 'startedAt',
                width: 180,
                render: (v) => formatDateTime(v),
            },
            {
                title: t.colUpdatedAt,
                dataIndex: 'updatedAt',
                key: 'updatedAt',
                width: 180,
                render: (v) => formatDateTime(v),
            },
            {
                title: t.colStatus,
                dataIndex: 'status',
                key: 'status',
                width: 130,
                render: (s) => {
                    const { color, label } = statusMeta(s, isEn);
                    return <Tag color={color}>{label}</Tag>;
                },
            },
        ],
        [imeiToPlate, isEn, t],
    );

    const onExport = () => {
        try {
            if (!data || data.length === 0) {
                message.warning(t.noDataExport);
                return;
            }
            exportMaintenanceDueXlsx({ rows: data, imeiToPlate, filterImei, isEn });
            message.success(t.exportingOk);
        } catch (e) {
            console.error(e);
            message.error(t.exportFail);
        }
    };

    if (!mounted) return null;

    return (
        <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
                <div>
                    <Title level={3} style={{ marginBottom: 0 }}>
                        {t.pageTitle}
                    </Title>
                    <Text type="secondary">{t.pageDesc}</Text>
                </div>

                <Space>
                    <Button icon={<ReloadOutlined />} onClick={() => load(filterImei)} disabled={loading}>
                        {t.reload}
                    </Button>
                    <Button
                        type="primary"
                        icon={<DownloadOutlined />}
                        onClick={onExport}
                        disabled={loading || !data || data.length === 0}
                    >
                        {t.export}
                    </Button>
                </Space>
            </div>

            <div style={{ marginTop: 12 }}>
                <MaintenanceReportFilters
                    onSearch={(imei) => {
                        setFilterImei(imei);
                        load(imei);
                    }}
                    onClear={() => {
                        setFilterImei('');
                        load('');
                    }}
                    onReload={(imei) => load(imei)}
                />
            </div>

            <Card style={{ marginTop: 12 }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: 24 }}>
                        <Spin />
                    </div>
                ) : data.length === 0 ? (
                    <Empty description={t.empty} />
                ) : (
                    <Table
                        rowKey={(row) => row?._id || row?.imei}
                        columns={columns}
                        dataSource={data}
                        scroll={{ x: 1300 }}
                        pagination={{ pageSize: 10, showSizeChanger: false }}
                    />
                )}
            </Card>
        </div>
    );
}
