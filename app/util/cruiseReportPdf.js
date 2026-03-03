import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/* =======================
   HELPERS
======================= */
const pad2 = (n) => String(n).padStart(2, '0');
const safeStr = (v) => (v == null ? '' : String(v));

const arrayBufferToBase64 = (buffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i += 1) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
};

const ensureVietnameseFont = async (doc) => {
    // load 2 font files từ public
    const [regBuf, boldBuf] = await Promise.all([
        fetch('/fonts/Roboto-Regular.ttf').then((r) => r.arrayBuffer()),
        fetch('/fonts/Roboto-Bold.ttf').then((r) => r.arrayBuffer()),
    ]);

    const regB64 = arrayBufferToBase64(regBuf);
    const boldB64 = arrayBufferToBase64(boldBuf);

    // add vào VFS + register font
    doc.addFileToVFS('Roboto-Regular.ttf', regB64);
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');

    doc.addFileToVFS('Roboto-Bold.ttf', boldB64);
    doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');

    doc.setFont('Roboto', 'normal');
};

const formatPdfTime = (input) => {
    if (!input) return '';
    const str = String(input).trim();
    const numOnlyMatch = str.match(/^(\d{12}|\d{14})$/);
    if (numOnlyMatch) {
        let YY, MM, DD, HH, mi, ss;
        if (str.length === 12) {
            YY = '20' + str.slice(0, 2);
            MM = str.slice(2, 4);
            DD = str.slice(4, 6);
            HH = str.slice(6, 8);
            mi = str.slice(8, 10);
            ss = str.slice(10, 12);
        } else {
            YY = str.slice(0, 4);
            MM = str.slice(4, 6);
            DD = str.slice(6, 8);
            HH = str.slice(8, 10);
            mi = str.slice(10, 12);
            ss = str.slice(12, 14);
        }
        return `${HH}:${mi}:${ss} ${DD}/${MM}/${YY}`;
    }

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

const reducePointsForExport = (points, distanceMetersFn, maxPoints = 2000) => {
    if (!Array.isArray(points) || points.length <= maxPoints) return points;
    if (typeof distanceMetersFn !== 'function') return points.slice(0, maxPoints);

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

    if (best.length > maxPoints) return best.slice(0, maxPoints);
    return best;
};

/* =======================
   I18N
======================= */
const I18N = {
    vi: {
        title: 'BÁO CÁO LỘ TRÌNH',
        meta: {
            vehicle: 'Phương tiện',
            imei: 'IMEI',
            plate: 'Biển số',
            timeRange: 'Khoảng thời gian',
        },
        cols: ['STT', 'Thời gian', 'Vĩ độ', 'Kinh độ', 'Tốc độ', 'Trạng thái máy'],
        acc: { on: 'Mở máy', off: 'Tắt máy' },
        fileName: 'BaoCaoLoTrinh',
    },
    en: {
        title: 'CRUISE REPORT',
        meta: {
            vehicle: 'Vehicle',
            imei: 'IMEI',
            plate: 'Plate',
            timeRange: 'Time range',
        },
        cols: ['#', 'Time', 'Latitude', 'Longitude', 'Speed', 'Engine'],
        acc: { on: 'On', off: 'Off' },
        fileName: 'CruiseReport',
    },
};

/* =======================
   MAIN EXPORT PDF (ASYNC)
======================= */
export const exportCruiseRouteOnlyPdf = async ({
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

    const exportPoints = reducePointsForExport(rawRouteData, distanceMetersFn, maxExportRecords);

    const plate = safeStr(device?.license_plate || '');
    const imei = safeStr(device?.imei || '');
    const vehicleName = safeStr(device?.vehicle_category_id?.name || '');
    const timeRange = `${formatPdfTime(startText)} → ${formatPdfTime(endText)}`;

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

    // ✅ embed unicode font (fix tiếng Việt)
    await ensureVietnameseFont(doc);

    // Title
    doc.setFont('Roboto', 'bold');
    doc.setFontSize(16);
    doc.text(T.title, 40, 40);

    // Meta
    doc.setFont('Roboto', 'normal');
    doc.setFontSize(10);

    const metaLines = [
        `${T.meta.vehicle}: ${vehicleName || '-'}`,
        `${T.meta.plate}: ${plate || '-'}`,
        `${T.meta.imei}: ${imei || '-'}`,
        `${T.meta.timeRange}: ${timeRange}`,
        `${isEn ? 'Records' : 'Số điểm'}: ${exportPoints.length} / ${maxExportRecords}`,
    ];

    let y = 62;
    metaLines.forEach((line) => {
        doc.text(line, 40, y);
        y += 14;
    });

    const body = exportPoints.map((p, idx) => {
        const speedNum = Number(p?.spd ?? p?.velocityNum ?? 0) || 0;
        const accOn = Number(p?.acc ?? 0) === 0;
        const accText = accOn ? T.acc.on : T.acc.off;

        return [idx + 1, formatPdfTime(p?.dateTime), p?.lat ?? '', p?.lon ?? '', speedNum, accText];
    });

    autoTable(doc, {
        startY: y + 8,
        head: [T.cols],
        body,
        styles: { font: 'Roboto', fontSize: 9, cellPadding: 4 },
        headStyles: { fillColor: [31, 41, 55], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        margin: { left: 40, right: 40 },
        tableLineColor: [203, 213, 225],
        tableLineWidth: 0.5,
    });

    const now = new Date();
    const DD = pad2(now.getDate());
    const MM = pad2(now.getMonth() + 1);
    const YYYY = now.getFullYear();
    const HH = pad2(now.getHours());
    const MI = pad2(now.getMinutes());
    const SS = pad2(now.getSeconds());

    const plateSafe = (plate || 'vehicle').replace(/[^\w\-]+/g, '_').replace(/_+/g, '_');
    const fileName = `${T.fileName}_${plateSafe}_${DD}-${MM}-${YYYY}_${HH}${MI}${SS}.pdf`;

    doc.save(fileName);
};
