import * as XLSX from 'xlsx-js-style';
import { saveAs } from 'file-saver';
import * as turf from '@turf/turf';

// ── Geo helpers (same logic as VietnamMapDrillDown) ─────────────
const haversine = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const findNearest = (lat, lon, list) => {
    let best = null, bestDist = Infinity;
    for (const item of list) {
        const d = haversine(lat, lon, parseFloat(item.latitude), parseFloat(item.longitude));
        if (d < bestDist) { bestDist = d; best = item; }
    }
    return best;
};

// Dùng turf point-in-polygon — chính xác theo ranh giới hành chính
let _geoJsonCache = null;
const getGeoJson = async () => {
    if (_geoJsonCache) return _geoJsonCache;
    const res = await fetch('/geojson/VietNam63.geojson');
    const geo = await res.json();
    geo.features.forEach(f => { f._center = turf.centroid(f); });
    _geoJsonCache = geo;
    return geo;
};

const findDistrictByPoint = (lat, lon, geojson) => {
    if (!geojson?.features?.length) return null;
    const point = turf.point([lon, lat]);
    for (const feature of geojson.features) {
        if (!feature?.geometry) continue;
        try {
            const { type, coordinates } = feature.geometry;
            const poly = type === 'Polygon' ? turf.polygon(coordinates) : turf.multiPolygon(coordinates);
            if (turf.booleanPointInPolygon(point, poly)) return feature;
        } catch (_) { /* skip */ }
    }
    return null;
};

const isOnline = (cruiseItem) => {
    if (!cruiseItem) return false;
    const updated = cruiseItem.updatedAt || cruiseItem.createdAt;
    if (!updated) return false;
    return Date.now() - new Date(updated).getTime() < 24 * 60 * 60 * 1000;
};

const getTodayStr = () => {
    const d = new Date();
    const dd   = String(d.getDate()).padStart(2, '0');
    const mm   = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
};

const HDR_COLOR   = '1677FF';
const ONLINE_BG   = 'E2F5EA';
const OFFLINE_BG  = 'FDE8E8';

/**
 * Xuất Excel danh sách thiết bị từ trang Overview.
 * mode: 'all' | 'online' | 'offline'
 */
export function exportOverviewExcel({ devices, cruiseByImei, mode = 'all', regionLabel = null }) {
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

    const regionSuffix = regionLabel ? ` — ${regionLabel}` : '';
    const titleText    = `Báo cáo ${modeLabel}${regionSuffix} — IKY GPS`;
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

    // Tên file: [Mode]_[KhuVuc]_dd-mm-yyyy.xlsx
    const safeName = (s) => s.replace(/[\/\\?%*:|"<>]/g, '_').replace(/\s+/g, '_').trim();
    const modeSlug = { all: 'ToanBo', online: 'Online', offline: 'Offline' }[mode] || 'ToanBo';
    const regionSlug = regionLabel ? `_${safeName(regionLabel)}` : '';
    const fileName = `ThietBi_${modeSlug}${regionSlug}_${getTodayStr()}.xlsx`;

    const wb  = XLSX.utils.book_new();
    const sheetName = (regionLabel ? `${modeLabel} - ${regionLabel}` : modeLabel).slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });
    saveAs(new Blob([buf]), fileName);
}

/**
 * Xuất Excel theo khu vực (tỉnh/thành hoặc quận/huyện).
 * @param {object} opts
 * @param {Array}  opts.devices        - danh sách thiết bị
 * @param {object} opts.cruiseByImei   - { [imei]: cruise }
 * @param {object} opts.province       - province object từ esgoo API { id, full_name, latitude, longitude, ... }
 * @param {object|null} opts.district  - district GeoJSON feature (nếu null → xuất toàn tỉnh)
 * @param {Array}  opts.provinces      - toàn bộ danh sách tỉnh từ esgoo (để findNearest)
 */
export async function exportByRegion({ devices, cruiseByImei, province, district, provinces }) {
    // 1. Lọc devices thuộc tỉnh đã chọn (dùng haversine giống map)
    let filtered = devices.filter((d) => {
        const cruise = cruiseByImei[d.imei];
        if (!cruise?.lat || !cruise?.lon) return false;
        const nearest = findNearest(cruise.lat, cruise.lon, provinces);
        return nearest?.id === province.id;
    });

    // 2. Nếu có quận cụ thể → lọc tiếp bằng point-in-polygon
    if (district) {
        let geo;
        try {
            geo = await getGeoJson();
        } catch (e) {
            alert('Không tải được dữ liệu ranh giới hành chính!');
            return;
        }
        filtered = filtered.filter((d) => {
            const cruise = cruiseByImei[d.imei];
            if (!cruise?.lat || !cruise?.lon) return false;
            const feat = findDistrictByPoint(cruise.lat, cruise.lon, geo);
            return feat?.properties?.ma_huyen === district.properties?.ma_huyen;
        });
    }

    if (!filtered.length) {
        alert('Không có thiết bị nào thuộc khu vực đã chọn có dữ liệu GPS!');
        return;
    }

    // 3. Build rows (cùng format với exportOverviewExcel)
    const regionLabel = district
        ? `${district.properties?.loai || ''} ${district.properties?.ten_huyen || ''} - ${province.full_name}`
        : province.full_name;

    const titleText    = `Thiết bị khu vực: ${regionLabel} — IKY GPS`;
    const subtitleText = `Xuất lúc: ${new Date().toLocaleString('vi-VN')}  |  Tổng: ${filtered.length} thiết bị`;

    const rows = filtered.map((d, i) => {
        const cruise = cruiseByImei[d.imei];
        const online = isOnline(cruise);
        const lastUpdate = cruise?.updatedAt || cruise?.createdAt;
        return {
            'STT':               i + 1,
            'IMEI':              d.imei || '',
            'Biển số xe':        d.license_plate || '',
            'Tên thiết bị':      d.name || '',
            'Loại thiết bị':     d.device_category_id?.name || d.device_category_id?.code || '',
            'Trạng thái':        online ? 'Online' : 'Offline',
            'Cập nhật lần cuối': lastUpdate ? new Date(lastUpdate).toLocaleString('vi-VN') : '--',
            'Vĩ độ (lat)':       cruise?.lat ?? '',
            'Kinh độ (lon)':     cruise?.lon ?? '',
            'Tốc độ (km/h)':     cruise?.vgp ?? '',
        };
    });

    const ws = XLSX.utils.json_to_sheet(rows, { origin: 'A3' });
    const headers  = Object.keys(rows[0]);
    const colCount = headers.length;

    // Title row
    ws['A1'] = { v: titleText, t: 's' };
    ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } },
    ];
    ws['A1'].s = {
        font:      { bold: true, sz: 16, color: { rgb: 'FFFFFF' } },
        fill:      { fgColor: { rgb: '0F766E' } }, // teal — phân biệt với "all export"
        alignment: { horizontal: 'center', vertical: 'center' },
    };

    // Subtitle row
    ws['A2'] = { v: subtitleText, t: 's' };
    ws['A2'].s = {
        font:      { italic: true, sz: 10, color: { rgb: '555555' } },
        fill:      { fgColor: { rgb: 'CCFBF1' } },
        alignment: { horizontal: 'left', vertical: 'center' },
    };
    ws['!rows'] = [{ hpt: 28 }, { hpt: 18 }, { hpt: 22 }];

    // Header row style
    const HDR = '0F766E';
    headers.forEach((h, idx) => {
        const ref = XLSX.utils.encode_cell({ r: 2, c: idx });
        if (!ws[ref]) return;
        ws[ref].s = {
            font:      { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
            fill:      { fgColor: { rgb: HDR } },
            alignment: { horizontal: 'center', vertical: 'center' },
            border: {
                top:    { style: 'thin', color: { rgb: 'AAAAAA' } },
                bottom: { style: 'thin', color: { rgb: 'AAAAAA' } },
                left:   { style: 'thin', color: { rgb: 'AAAAAA' } },
                right:  { style: 'thin', color: { rgb: 'AAAAAA' } },
            },
        };
    });

    // Data rows
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
                fill: { fgColor: { rgb: R % 2 === 0 ? 'F0FDFA' : 'FFFFFF' } },
            };
            if (C === statusColIdx) {
                const online = String(cell.v).trim() === 'Online';
                cell.s.fill = { fgColor: { rgb: online ? 'E2F5EA' : 'FDE8E8' } };
                cell.s.font = { bold: true, color: { rgb: online ? '166534' : '991B1B' } };
                cell.s.alignment = { horizontal: 'center', vertical: 'center' };
            }
        }
    }

    // Auto column width
    ws['!cols'] = headers.map((key) => {
        const maxLen = Math.max(key.length, ...rows.map((r) => String(r[key] ?? '').length));
        return { wch: Math.min(maxLen + 4, 40) };
    });

    // Auto filter
    ws['!autofilter'] = {
        ref: XLSX.utils.encode_range({ s: { r: 2, c: 0 }, e: { r: range.e.r, c: range.e.c } }),
    };

    // File name: KhuVuc_TenTinh_TenQuan_dd-mm-yyyy.xlsx
    const safeName = (s) => s.replace(/[/\\?%*:|"<>]/g, '_').trim();
    const provSlug  = safeName(province.full_name);
    const distSlug  = district ? `_${safeName(district.properties?.ten_huyen || '')}` : '';
    const fileName  = `KhuVuc_${provSlug}${distSlug}_${getTodayStr()}.xlsx`;

    const wb  = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, regionLabel.slice(0, 31));
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });
    saveAs(new Blob([buf]), fileName);
}
