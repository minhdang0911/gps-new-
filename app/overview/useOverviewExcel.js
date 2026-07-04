import * as XLSX from 'xlsx-js-style';
import { saveAs } from 'file-saver';
import * as turf from '@turf/turf';
import { message } from 'antd';

// ── Geo helpers ──────────────────────────────────────────────────────────────
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
    return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
};

const safeName = (s) => String(s || '').replace(/[\/\\?%*:|"<>]/g, '_').replace(/\s+/g, '_').trim();

const getDistName = (device) => {
    const dist = device.distributor_id;
    if (!dist) return '--';
    if (typeof dist === 'string') return dist;
    return dist.name || dist.username || dist._id || '--';
};

// Apply common xlsx-js-style to a worksheet
const applySheetStyle = (ws, rows, HDR_CLR, EVEN_BG) => {
    const headers = Object.keys(rows[0] || {});
    const statusColIdx = headers.indexOf('Trạng thái');
    const range = XLSX.utils.decode_range(ws['!ref']);

    headers.forEach((_, idx) => {
        const ref = XLSX.utils.encode_cell({ r: 2, c: idx });
        if (!ws[ref]) return;
        ws[ref].s = {
            font:      { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
            fill:      { fgColor: { rgb: HDR_CLR } },
            alignment: { horizontal: 'center', vertical: 'center' },
            border: {
                top:    { style: 'thin', color: { rgb: 'AAAAAA' } },
                bottom: { style: 'thin', color: { rgb: 'AAAAAA' } },
                left:   { style: 'thin', color: { rgb: 'AAAAAA' } },
                right:  { style: 'thin', color: { rgb: 'AAAAAA' } },
            },
        };
    });

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
                fill: { fgColor: { rgb: R % 2 === 0 ? EVEN_BG : 'FFFFFF' } },
            };
            if (C === statusColIdx) {
                const online = String(cell.v).trim() === 'Online';
                cell.s.fill = { fgColor: { rgb: online ? 'E2F5EA' : 'FDE8E8' } };
                cell.s.font = { bold: true, color: { rgb: online ? '166534' : '991B1B' } };
                cell.s.alignment = { horizontal: 'center', vertical: 'center' };
            }
        }
    }

    ws['!cols'] = headers.map((key) => {
        const maxLen = Math.max(key.length, ...rows.map((r) => String(r[key] ?? '').length));
        return { wch: Math.min(maxLen + 4, 40) };
    });

    ws['!autofilter'] = {
        ref: XLSX.utils.encode_range({ s: { r: 2, c: 0 }, e: { r: range.e.r, c: range.e.c } }),
    };
};

/**
 * Xuất Excel toàn bộ/online/offline từ trang Overview.
 * Tên file và tiêu đề phản ánh các filter đang active.
 *
 * @param {Array}       devices          - danh sách thiết bị đã lọc
 * @param {object}      cruiseByImei     - { [imei]: cruise }
 * @param {string}      mode             - 'all' | 'online' | 'offline'
 * @param {string|null} regionLabel      - label tỉnh/quận filter (nếu có)
 * @param {Array}       provinces        - danh sách tỉnh esgoo (để resolve Tỉnh/TP)
 * @param {string|null} distributorName  - tên đại lý đang filter (nếu có)
 */
export async function exportOverviewExcel({
    devices,
    cruiseByImei,
    mode = 'all',
    regionLabel = null,
    provinces = [],
    distributorName = null,
}) {
    const allWithStatus = devices.map((d) => {
        const cruise = cruiseByImei[d.imei];
        return { device: d, cruise, online: isOnline(cruise), lastUpdate: cruise?.updatedAt || cruise?.createdAt };
    });

    const filtered =
        mode === 'online'  ? allWithStatus.filter((x) => x.online) :
        mode === 'offline' ? allWithStatus.filter((x) => !x.online) :
        allWithStatus;

    if (!filtered.length) { message.warning('Không có dữ liệu để xuất!'); return; }

    // Resolve province (haversine — sync)
    const resolveProvince = (cruise) => {
        if (!cruise?.lat || !cruise?.lon || !provinces.length) return '';
        return findNearest(cruise.lat, cruise.lon, provinces)?.full_name || '';
    };

    // Resolve district (turf PIP — async, GeoJSON loaded once)
    let geoJson = null;
    if (filtered.some(x => x.cruise?.lat && x.cruise?.lon)) {
        try { geoJson = await getGeoJson(); } catch (_) {}
    }
    const resolveDistrict = (cruise) => {
        if (!cruise?.lat || !cruise?.lon || !geoJson) return '';
        const feat = findDistrictByPoint(cruise.lat, cruise.lon, geoJson);
        if (!feat) return '';
        const loai = feat.properties?.loai || '';
        const ten  = feat.properties?.ten_huyen || feat.properties?.Ten_Huyen || '';
        return `${loai} ${ten}`.trim();
    };

    const rows = filtered.map((x, i) => ({
        'STT':               i + 1,
        'IMEI':              x.device.imei || '',
        'Biển số xe':        x.device.license_plate || '',
        'Tên thiết bị':      x.device.name || '',
        'Loại thiết bị':     x.device.device_category_id?.name || x.device.device_category_id?.code || '',
        'Đại lý':            getDistName(x.device),
        'Tỉnh/TP':           resolveProvince(x.cruise),
        'Quận/Huyện':        resolveDistrict(x.cruise),
        'Trạng thái':        x.online ? 'Online' : 'Offline',
        'Cập nhật lần cuối': x.lastUpdate ? new Date(x.lastUpdate).toLocaleString('vi-VN') : '--',
        'Vĩ độ (lat)':       x.cruise?.lat ?? '',
        'Kinh độ (lon)':     x.cruise?.lon ?? '',
        'Tốc độ (km/h)':     x.cruise?.vgp ?? '',
    }));

    const modeLabel =
        mode === 'online'  ? 'Thiết bị Online' :
        mode === 'offline' ? 'Thiết bị Offline' :
        'Toàn bộ thiết bị';

    // Tiêu đề bao gồm các filter đang active
    const filterParts = [
        distributorName ? `Đại lý: ${distributorName}` : null,
        regionLabel     ? `Khu vực: ${regionLabel}`    : null,
    ].filter(Boolean);
    const filterSuffix = filterParts.length ? ` — ${filterParts.join(' | ')}` : '';
    const titleText    = `Báo cáo ${modeLabel}${filterSuffix} — IKY GPS`;
    const subtitleText = `Xuất lúc: ${new Date().toLocaleString('vi-VN')}  |  Tổng: ${filtered.length} thiết bị`;

    const ws = XLSX.utils.json_to_sheet(rows, { origin: 'A3' });
    const colCount = Object.keys(rows[0]).length;

    ws['A1'] = { v: titleText, t: 's' };
    ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } },
    ];
    ws['A1'].s = { font: { bold: true, sz: 16, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1677FF' } }, alignment: { horizontal: 'center', vertical: 'center' } };
    ws['A2'] = { v: subtitleText, t: 's' };
    ws['A2'].s = { font: { italic: true, sz: 10, color: { rgb: '555555' } }, fill: { fgColor: { rgb: 'EBF2FF' } }, alignment: { horizontal: 'left', vertical: 'center' } };
    ws['!rows'] = [{ hpt: 28 }, { hpt: 18 }, { hpt: 22 }];

    applySheetStyle(ws, rows, '1677FF', 'F5F8FF');

    // Tên file: ThietBi_[Mode]_[DaiLy]_[KhuVuc]_dd-mm-yyyy.xlsx
    const modeSlug = { all: 'ToanBo', online: 'Online', offline: 'Offline' }[mode] || 'ToanBo';
    const distSlug = distributorName ? `_${safeName(distributorName)}` : '';
    const regSlug  = regionLabel     ? `_${safeName(regionLabel)}`     : '';
    const fileName = `ThietBi_${modeSlug}${distSlug}${regSlug}_${getTodayStr()}.xlsx`;
    const sheetName = [modeLabel, distributorName, regionLabel].filter(Boolean).join(' - ').slice(0, 31);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });
    saveAs(new Blob([buf]), fileName);
}

/**
 * Xuất Excel theo khu vực — từ map drill-down context menu.
 */
export async function exportByRegion({ devices, cruiseByImei, province, district, provinces }) {
    let filtered = devices.filter((d) => {
        const cruise = cruiseByImei[d.imei];
        if (!cruise?.lat || !cruise?.lon) return false;
        return findNearest(cruise.lat, cruise.lon, provinces)?.id === province.id;
    });

    if (district) {
        let geo;
        try { geo = await getGeoJson(); }
        catch (e) { message.error('Không tải được dữ liệu ranh giới hành chính!'); return; }
        filtered = filtered.filter((d) => {
            const cruise = cruiseByImei[d.imei];
            if (!cruise?.lat || !cruise?.lon) return false;
            const feat = findDistrictByPoint(cruise.lat, cruise.lon, geo);
            return feat?.properties?.ma_huyen === district.properties?.ma_huyen;
        });
    }

    if (!filtered.length) { message.warning('Không có thiết bị nào thuộc khu vực đã chọn có dữ liệu GPS!'); return; }

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
            'Đại lý':            getDistName(d),
            'Trạng thái':        online ? 'Online' : 'Offline',
            'Cập nhật lần cuối': lastUpdate ? new Date(lastUpdate).toLocaleString('vi-VN') : '--',
            'Vĩ độ (lat)':       cruise?.lat ?? '',
            'Kinh độ (lon)':     cruise?.lon ?? '',
            'Tốc độ (km/h)':     cruise?.vgp ?? '',
        };
    });

    const ws = XLSX.utils.json_to_sheet(rows, { origin: 'A3' });
    const colCount = Object.keys(rows[0]).length;
    ws['A1'] = { v: titleText, t: 's' };
    ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } },
    ];
    ws['A1'].s = { font: { bold: true, sz: 16, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '0F766E' } }, alignment: { horizontal: 'center', vertical: 'center' } };
    ws['A2'] = { v: subtitleText, t: 's' };
    ws['A2'].s = { font: { italic: true, sz: 10, color: { rgb: '555555' } }, fill: { fgColor: { rgb: 'CCFBF1' } }, alignment: { horizontal: 'left', vertical: 'center' } };
    ws['!rows'] = [{ hpt: 28 }, { hpt: 18 }, { hpt: 22 }];

    applySheetStyle(ws, rows, '0F766E', 'F0FDFA');

    const provSlug = safeName(province.full_name);
    const distSlug = district ? `_${safeName(district.properties?.ten_huyen || '')}` : '';
    const fileName = `KhuVuc_${provSlug}${distSlug}_${getTodayStr()}.xlsx`;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, regionLabel.slice(0, 31));
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });
    saveAs(new Blob([buf]), fileName);
}
