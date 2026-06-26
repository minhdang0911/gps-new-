import * as XLSX from 'xlsx-js-style';
import { saveAs } from 'file-saver';

const isOnline = (cruiseItem) => {
    if (!cruiseItem) return false;
    const updated = cruiseItem.updatedAt || cruiseItem.createdAt;
    if (!updated) return false;
    return Date.now() - new Date(updated).getTime() < 24 * 60 * 60 * 1000;
};

const getTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
};

const HDR_COLOR   = '1677FF';
const ONLINE_BG   = 'E2F5EA';
const OFFLINE_BG  = 'FDE8E8';

/**
 * Xuất Excel danh sách thiết bị từ trang Overview.
 * mode: 'all' | 'online' | 'offline'
 */
export function exportOverviewExcel({ devices, cruiseByImei, mode = 'all' }) {
    const allWithStatus = devices.map((d) => {
        const cruise = cruiseByImei[d.imei];
        const online = isOnline(cruise);
        const lastUpdate = cruise?.updatedAt || cruise?.createdAt;
        return { device: d, cruise, online, lastUpdate };
    });

    const filtered =
        mode === 'online'  ? allWithStatus.filter((x) => x.online) :
        mode === 'offline' ? allWithStatus.filter((x) => !x.online) :
        allWithStatus;

    if (!filtered.length) {
        alert('Không có dữ liệu để xuất!');
        return;
    }

    const modeLabel =
        mode === 'online'  ? 'Thiết bị Online' :
        mode === 'offline' ? 'Thiết bị Offline' :
        'Toàn bộ thiết bị';

    const titleText    = `Báo cáo ${modeLabel} — IKY GPS`;
    const subtitleText = `Xuất lúc: ${new Date().toLocaleString('vi-VN')}  |  Tổng: ${filtered.length} thiết bị`;

    const rows = filtered.map((x, i) => ({
        'STT':               i + 1,
        'IMEI':              x.device.imei || '',
        'Biển số xe':        x.device.license_plate || '',
        'Tên thiết bị':      x.device.name || '',
        'Loại thiết bị':     x.device.device_category_id?.name || x.device.device_category_id?.code || '',
        'Trạng thái':        x.online ? 'Online' : 'Offline',
        'Cập nhật lần cuối': x.lastUpdate ? new Date(x.lastUpdate).toLocaleString('vi-VN') : '--',
        'Vĩ độ (lat)':       x.cruise?.lat ?? '',
        'Kinh độ (lon)':     x.cruise?.lon ?? '',
        'Tốc độ (km/h)':     x.cruise?.vgp ?? '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows, { origin: 'A3' });
    const headers  = Object.keys(rows[0]);
    const colCount = headers.length;

    // ── Row 1: Title ────────────────────────────────────────────────
    ws['A1'] = { v: titleText, t: 's' };
    ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } },
    ];
    ws['A1'].s = {
        font:      { bold: true, sz: 16, color: { rgb: 'FFFFFF' } },
        fill:      { fgColor: { rgb: HDR_COLOR } },
        alignment: { horizontal: 'center', vertical: 'center' },
    };

    // ── Row 2: Subtitle ─────────────────────────────────────────────
    ws['A2'] = { v: subtitleText, t: 's' };
    ws['A2'].s = {
        font:      { italic: true, sz: 10, color: { rgb: '555555' } },
        fill:      { fgColor: { rgb: 'EBF2FF' } },
        alignment: { horizontal: 'left', vertical: 'center' },
    };

    ws['!rows'] = [{ hpt: 28 }, { hpt: 18 }, { hpt: 22 }];

    // ── Row 3: Column headers ────────────────────────────────────────
    headers.forEach((h, idx) => {
        const ref = XLSX.utils.encode_cell({ r: 2, c: idx });
        if (!ws[ref]) return;
        ws[ref].s = {
            font:      { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
            fill:      { fgColor: { rgb: HDR_COLOR } },
            alignment: { horizontal: 'center', vertical: 'center' },
            border: {
                top:    { style: 'thin', color: { rgb: 'AAAAAA' } },
                bottom: { style: 'thin', color: { rgb: 'AAAAAA' } },
                left:   { style: 'thin', color: { rgb: 'AAAAAA' } },
                right:  { style: 'thin', color: { rgb: 'AAAAAA' } },
            },
        };
    });

    // ── Data rows ───────────────────────────────────────────────────
    const statusColIdx = headers.indexOf('Trạng thái');
    const range = XLSX.utils.decode_range(ws['!ref']);

    for (let R = 3; R <= range.e.r; R++) {
        for (let C = range.s.c; C <= range.e.c; C++) {
            const ref  = XLSX.utils.encode_cell({ r: R, c: C });
            const cell = ws[ref];
            if (!cell) continue;

            cell.s = {
                alignment: { horizontal: C === 0 ? 'center' : 'left', vertical: 'center' },
                border: {
                    top:    { style: 'thin', color: { rgb: 'DDDDDD' } },
                    bottom: { style: 'thin', color: { rgb: 'DDDDDD' } },
                    left:   { style: 'thin', color: { rgb: 'DDDDDD' } },
                    right:  { style: 'thin', color: { rgb: 'DDDDDD' } },
                },
                fill: { fgColor: { rgb: R % 2 === 0 ? 'F5F8FF' : 'FFFFFF' } },
            };

            if (C === statusColIdx) {
                const online = String(cell.v).trim() === 'Online';
                cell.s.fill = { fgColor: { rgb: online ? ONLINE_BG : OFFLINE_BG } };
                cell.s.font = { bold: true, color: { rgb: online ? '166534' : '991B1B' } };
                cell.s.alignment = { horizontal: 'center', vertical: 'center' };
            }
        }
    }

    // ── Auto column width ───────────────────────────────────────────
    ws['!cols'] = headers.map((key) => {
        const maxLen = Math.max(key.length, ...rows.map((r) => String(r[key] ?? '').length));
        return { wch: Math.min(maxLen + 4, 40) };
    });

    // ── Auto filter ─────────────────────────────────────────────────
    ws['!autofilter'] = {
        ref: XLSX.utils.encode_range({ s: { r: 2, c: 0 }, e: { r: range.e.r, c: range.e.c } }),
    };

    // ── Save ────────────────────────────────────────────────────────
    const fileNames = {
        all:     `ToanBoThietBi_${getTodayStr()}.xlsx`,
        online:  `ThietBiOnline_${getTodayStr()}.xlsx`,
        offline: `ThietBiOffline_${getTodayStr()}.xlsx`,
    };

    const wb  = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, modeLabel);
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });
    saveAs(new Blob([buf]), fileNames[mode]);
}
