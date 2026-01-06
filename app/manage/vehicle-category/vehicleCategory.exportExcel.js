import * as XLSX from 'xlsx-js-style';
import { saveAs } from 'file-saver';
import { getTodayForFileName } from '../../util/FormatDate';

export function exportVehicleCategoriesExcel({ data, t, getManufacturerLabel, getMifLabel, getDeviceTypeLabel }) {
    if (!data?.length) return { ok: false, reason: 'NO_DATA' };

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
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }];

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
        ref: XLSX.utils.encode_range({ s: { r: 1, c: 0 }, e: { r: range.e.r, c: range.e.c } }),
    };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'VehicleCategories');

    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });
    saveAs(new Blob([excelBuffer]), `DanhSachDongXe_${getTodayForFileName()}.xlsx`);

    return { ok: true };
}
