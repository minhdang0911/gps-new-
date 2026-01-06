import * as XLSX from 'xlsx-js-style';
import { saveAs } from 'file-saver';
import { getTodayForFileName } from '@/app/util/FormatDate';

export function exportCustomerDevicesExcel({ t, customers, currentCustomerId, devices }) {
    if (!currentCustomerId) return { ok: false, reason: 'NEED_CUSTOMER' };
    if (!devices?.length) return { ok: false, reason: 'NO_DEVICES' };

    const customer = (customers || []).find((c) => c._id === currentCustomerId);
    const customerLabel =
        customer?.username || customer?.phone || customer?.email || customer?._id || t.customerFallback;

    const excelData = devices.map((item) => ({
        [t.columns.imei]: item.imei || '',
        [t.excel.colPlate]: item.license_plate || '',
        [t.excel.colDeviceCategory]: item.device_category_id?.name || item.device_category_id?.code || '',
        [t.excel.colStatus]: item.status === 10 ? t.status.online : t.status.offline,
    }));

    const ws = XLSX.utils.json_to_sheet(excelData, { origin: 'A3' });
    const headers = Object.keys(excelData[0]);

    // Title row 1
    const title = t.excel.title;
    ws['A1'] = { v: title, t: 's' };
    ws['!merges'] = ws['!merges'] || [];
    ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } });
    ws['A1'].s = {
        font: { bold: true, sz: 18, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '4F81BD' } },
        alignment: { horizontal: 'center', vertical: 'center' },
    };

    // Row 2: customer info
    const infoText = `${t.excel.customerPrefix}${customerLabel}`;
    ws['A2'] = { v: infoText, t: 's' };
    ws['!merges'].push({ s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } });
    ws['A2'].s = {
        font: { italic: true, sz: 11, color: { rgb: '333333' } },
        alignment: { horizontal: 'left', vertical: 'center' },
    };

    ws['!rows'] = [{ hpt: 26 }, { hpt: 20 }, { hpt: 22 }];

    // Header row (row 3 index = 2)
    headers.forEach((h, idx) => {
        const ref = XLSX.utils.encode_cell({ r: 2, c: idx });
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

    // Style data
    const range = XLSX.utils.decode_range(ws['!ref']);
    const statusColIndex = headers.indexOf(t.excel.colStatus);

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

            // zebra stripe row > header (R > 2)
            if (R > 2 && R % 2 === 1) {
                cell.s.fill = cell.s.fill || {};
                cell.s.fill.fgColor = cell.s.fill.fgColor || { rgb: 'F9F9F9' };
            }

            // status online highlight
            if (R > 2 && C === statusColIndex && String(cell.v).trim() === t.status.online) {
                cell.s.fill = { fgColor: { rgb: 'E2F0D9' } };
            }
        }
    }

    ws['!cols'] = headers.map((key) => {
        const maxLen = Math.max(key.length, ...excelData.map((row) => String(row[key] || '').length));
        return { wch: maxLen + 4 };
    });

    ws['!autofilter'] = {
        ref: XLSX.utils.encode_range({ s: { r: 2, c: 0 }, e: { r: range.e.r, c: range.e.c } }),
    };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'CustomerDevices');

    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });
    saveAs(new Blob([excelBuffer]), `ThietBiKhachHang_${getTodayForFileName()}.xlsx`);

    return { ok: true };
}
