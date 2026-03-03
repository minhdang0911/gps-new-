import * as XLSX from 'xlsx-js-style';

/* =======================
   STYLES
======================= */
const STYLES = {
    title: {
        font: { bold: true, sz: 16, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '1677FF' } },
        alignment: { horizontal: 'center', vertical: 'center' },
    },
    label: {
        font: { bold: true, color: { rgb: '111827' } },
        fill: { fgColor: { rgb: 'E5E7EB' } },
        alignment: { horizontal: 'left', vertical: 'center' },
        border: {
            top: { style: 'thin', color: { rgb: 'E5E7EB' } },
            bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
            left: { style: 'thin', color: { rgb: 'E5E7EB' } },
            right: { style: 'thin', color: { rgb: 'E5E7EB' } },
        },
    },
    value: {
        alignment: { horizontal: 'left', vertical: 'center', wrapText: false },
        border: {
            top: { style: 'thin', color: { rgb: 'E5E7EB' } },
            bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
            left: { style: 'thin', color: { rgb: 'E5E7EB' } },
            right: { style: 'thin', color: { rgb: 'E5E7EB' } },
        },
    },
    header: {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '1F2937' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: {
            top: { style: 'thin', color: { rgb: 'CBD5E1' } },
            bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
            left: { style: 'thin', color: { rgb: 'CBD5E1' } },
            right: { style: 'thin', color: { rgb: 'CBD5E1' } },
        },
    },
    cell: {
        alignment: { vertical: 'center', wrapText: false },
        border: {
            top: { style: 'thin', color: { rgb: 'E5E7EB' } },
            bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
            left: { style: 'thin', color: { rgb: 'E5E7EB' } },
            right: { style: 'thin', color: { rgb: 'E5E7EB' } },
        },
    },
    num: {
        alignment: { vertical: 'center', horizontal: 'right' },
        border: {
            top: { style: 'thin', color: { rgb: 'E5E7EB' } },
            bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
            left: { style: 'thin', color: { rgb: 'E5E7EB' } },
            right: { style: 'thin', color: { rgb: 'E5E7EB' } },
        },
    },
};

/* =======================
   HELPERS
======================= */
const pad2 = (n) => String(n).padStart(2, '0');
const mkCell = (v, s, t) => ({ v, t: t || (typeof v === 'number' ? 'n' : 's'), s });
const safeStr = (v) => (v == null ? '' : String(v));

const setColWidths = (ws, widths) => {
    ws['!cols'] = widths.map((wch) => ({ wch }));
};

const setMerges = (ws, merges) => {
    ws['!merges'] = merges;
};

const setFreeze = (ws, row = 0, col = 0) => {
    ws['!freeze'] = { xSplit: col, ySplit: row };
};

const setAutoFilter = (ws, ref) => {
    ws['!autofilter'] = { ref };
};

const rangeA1 = (r1, c1, r2, c2) => {
    const s = XLSX.utils.encode_cell({ r: r1, c: c1 });
    const e = XLSX.utils.encode_cell({ r: r2, c: c2 });
    return `${s}:${e}`;
};

const formatExcelTime = (input) => {
    if (!input) return '';

    // Xử lý dạng số YYMMDDHHmmss hoặc YYYYMMDDHHmmss (ví dụ: 260227115744)
    const str = String(input).trim();
    const numOnlyMatch = str.match(/^(\d{12}|\d{14})$/);
    if (numOnlyMatch) {
        let YY, MM, DD, HH, mi, ss;
        if (str.length === 12) {
            // YYMMDDHHmmss
            YY = '20' + str.slice(0, 2);
            MM = str.slice(2, 4);
            DD = str.slice(4, 6);
            HH = str.slice(6, 8);
            mi = str.slice(8, 10);
            ss = str.slice(10, 12);
        } else {
            // YYYYMMDDHHmmss
            YY = str.slice(0, 4);
            MM = str.slice(4, 6);
            DD = str.slice(6, 8);
            HH = str.slice(8, 10);
            mi = str.slice(10, 12);
            ss = str.slice(12, 14);
        }
        return `${HH}:${mi}:${ss} ${DD}/${MM}/${YY}`;
    }

    // Fallback: parse như Date bình thường
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) return safeStr(input);

    const hh = pad2(d.getHours());
    const mm = pad2(d.getMinutes());
    const ss2 = pad2(d.getSeconds());
    const DD2 = pad2(d.getDate());
    const MM2 = pad2(d.getMonth() + 1);
    const YYYY = d.getFullYear();

    return `${hh}:${mm}:${ss2} ${DD2}/${MM2}/${YYYY}`;
};

const isValidPoint = (p) => typeof p?.lat === 'number' && typeof p?.lon === 'number';

/* =======================
   REDUCE POINTS
======================= */
const reducePointsForExcel = (points, distanceMetersFn, maxPoints = 2000) => {
    if (!Array.isArray(points) || points.length <= maxPoints) return points;

    if (typeof distanceMetersFn !== 'function') {
        return points.slice(0, maxPoints);
    }

    const filterByDist = (thresholdM) => {
        const out = [];
        let last = null;

        for (let i = 0; i < points.length; i++) {
            const p = points[i];
            if (!isValidPoint(p)) continue;

            if (!last) {
                out.push(p);
                last = p;
                continue;
            }

            const d = distanceMetersFn({ lat: last.lat, lon: last.lon }, { lat: p.lat, lon: p.lon });

            if (d >= thresholdM) {
                out.push(p);
                last = p;
            }
        }

        const lastValid = [...points].reverse().find(isValidPoint);
        if (lastValid && out[out.length - 1] !== lastValid) out.push(lastValid);

        return out;
    };

    let lo = 0;
    let hi = 2000;

    while (filterByDist(hi).length > maxPoints && hi < 100000) hi *= 2;

    let best = filterByDist(hi);

    for (let i = 0; i < 22; i++) {
        const mid = (lo + hi) / 2;
        const filtered = filterByDist(mid);
        if (filtered.length <= maxPoints) {
            best = filtered;
            hi = mid;
        } else {
            lo = mid;
        }
    }

    if (best.length > maxPoints) {
        return best.slice(0, maxPoints);
    }

    return best;
};

/* =======================
   I18N
======================= */
const I18N = {
    vi: {
        sheet: 'Lộ trình',
        title: 'BÁO CÁO LỘ TRÌNH',
        meta: {
            vehicle: 'Phương tiện',
            imei: 'IMEI',
            plate: 'Biển số',
            timeRange: 'Khoảng thời gian',
        },
        cols: {
            idx: 'STT',
            time: 'Thời gian',
            lat: 'Vĩ độ',
            lon: 'Kinh độ',
            speed: 'Tốc độ',
            acc: 'Trạng thái máy',
        },
        acc: { on: 'Mở máy', off: 'Tắt máy' },
        fileName: 'BaoCaoLoTrinh',
    },
    en: {
        sheet: 'Route',
        title: 'CRUISE REPORT',
        meta: {
            vehicle: 'Vehicle',
            imei: 'IMEI',
            plate: 'Plate',
            timeRange: 'Time range',
        },
        cols: {
            idx: '#',
            time: 'Time',
            lat: 'Latitude',
            lon: 'Longitude',
            speed: 'Speed',
            acc: 'Engine',
        },
        acc: { on: 'On', off: 'Off' },
        fileName: 'CruiseReport',
    },
};

/* =======================
   MAIN EXPORT
======================= */
export const exportCruiseRouteOnlyExcel = ({
    isEn,
    device,
    startText,
    endText,
    rawRouteData,
    distanceMetersFn,
    maxExportRecords = 2000,
}) => {
    const T = isEn ? I18N.en : I18N.vi;
    if (!rawRouteData?.length) return;

    const exportPoints = reducePointsForExcel(rawRouteData, distanceMetersFn, maxExportRecords);

    const plate = safeStr(device?.license_plate || '');
    const imei = safeStr(device?.imei || '');
    const vehicleName = safeStr(device?.vehicle_category_id?.name || '');

    const timeRange = `${formatExcelTime(startText)} → ${formatExcelTime(endText)}`;

    const wb = XLSX.utils.book_new();
    const ws = {};
    const COLS = 8;

    // Title
    ws[XLSX.utils.encode_cell({ r: 0, c: 0 })] = mkCell(T.title, STYLES.title);
    for (let c = 1; c < COLS; c++) {
        ws[XLSX.utils.encode_cell({ r: 0, c })] = mkCell('', STYLES.title);
    }

    setMerges(ws, [{ s: { r: 0, c: 0 }, e: { r: 0, c: COLS - 1 } }]);

    // Meta
    const metaRows = [
        {
            Lk: T.meta.vehicle,
            Lv: vehicleName || '-',
            Rk: T.meta.plate,
            Rv: plate || '-',
        },
        {
            Lk: T.meta.imei,
            Lv: imei || '-',
            Rk: T.meta.timeRange,
            Rv: timeRange,
        },
    ];

    let r = 2;
    for (const m of metaRows) {
        ws[XLSX.utils.encode_cell({ r, c: 0 })] = mkCell(m.Lk, STYLES.label);
        ws[XLSX.utils.encode_cell({ r, c: 1 })] = mkCell(m.Lv, STYLES.value);

        ws[XLSX.utils.encode_cell({ r, c: 3 })] = mkCell(m.Rk, STYLES.label);
        ws[XLSX.utils.encode_cell({ r, c: 4 })] = mkCell(m.Rv, STYLES.value);
        r++;
    }

    // Header
    const headerRow = 7;
    const headers = [T.cols.idx, T.cols.time, T.cols.lat, T.cols.lon, T.cols.speed, T.cols.acc];

    headers.forEach((h, c) => {
        ws[XLSX.utils.encode_cell({ r: headerRow, c })] = mkCell(h, STYLES.header);
    });

    // Data
    for (let i = 0; i < exportPoints.length; i++) {
        const p = exportPoints[i];
        const row = headerRow + 1 + i;

        const speedNum = Number(p?.spd ?? p?.velocityNum ?? 0) || 0;
        const accOn = Number(p?.acc ?? 0) === 0;
        const accText = accOn ? T.acc.on : T.acc.off;

        ws[XLSX.utils.encode_cell({ r: row, c: 0 })] = mkCell(i + 1, STYLES.num, 'n');
        ws[XLSX.utils.encode_cell({ r: row, c: 1 })] = mkCell(formatExcelTime(p?.dateTime), STYLES.cell);
        ws[XLSX.utils.encode_cell({ r: row, c: 2 })] = mkCell(p.lat, STYLES.num, 'n');
        ws[XLSX.utils.encode_cell({ r: row, c: 3 })] = mkCell(p.lon, STYLES.num, 'n');
        ws[XLSX.utils.encode_cell({ r: row, c: 4 })] = mkCell(speedNum, STYLES.num, 'n');
        ws[XLSX.utils.encode_cell({ r: row, c: 5 })] = mkCell(accText, STYLES.cell);
    }

    ws['!ref'] = rangeA1(0, 0, headerRow + exportPoints.length + 1, 5);

    setColWidths(ws, [6, 24, 13, 13, 10, 16]);
    setFreeze(ws, headerRow + 1, 0);
    setAutoFilter(ws, rangeA1(headerRow, 0, headerRow, 5));

    ws['!rows'] = [];
    ws['!rows'][0] = { hpt: 26 };
    ws['!rows'][headerRow] = { hpt: 22 };

    XLSX.utils.book_append_sheet(wb, ws, T.sheet);

    const now = new Date();

    const DD = pad2(now.getDate());
    const MM = pad2(now.getMonth() + 1);
    const YYYY = now.getFullYear();
    const HH = pad2(now.getHours());
    const MI = pad2(now.getMinutes());
    const SS = pad2(now.getSeconds());

    // làm sạch biển số cho an toàn tên file
    const plateSafe = (plate || 'vehicle').replace(/[^\w\-]+/g, '_').replace(/_+/g, '_');

    const fileName = `${T.fileName}_${plateSafe}_${DD}-${MM}-${YYYY}_${HH}${MI}${SS}.xlsx`;
    XLSX.writeFile(wb, fileName);
};
