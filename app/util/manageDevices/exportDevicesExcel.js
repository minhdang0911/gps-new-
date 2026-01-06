export async function exportDevicesExcel({ getDevices, total, filters, t, isEn, getTodayForFileName }) {
    // 1) fetch all
    const resAll = await getDevices({
        page: 1,
        limit: total || 999999,
        ...filters,
    });

    const allDevices = resAll?.devices || [];
    if (!allDevices.length) {
        return { ok: false, reason: 'NO_DATA' };
    }

    const XLSX = await import('xlsx-js-style');
    const { saveAs } = await import('file-saver');

    const excelData = allDevices.map((d) => ({
        IMEI: d.imei,
        'Loại thiết bị': d.device_category_id?.name || '-',
        'Số ĐT': d.phone_number || '-',
        'Biển số': d.license_plate || '-',
        KháchHàng: d.user_id?.email || 'Chưa gán',
        ĐạiLý: d.distributor_id?.username || '-',
        Active: d.active ? 'Có' : 'Không',
        NgàyTạo: new Date(d.createdAt).toLocaleString('vi-VN'),
        Driver: d.driver || '-',
    }));

    const ws = XLSX.utils.json_to_sheet(excelData, { origin: 'A2' });
    const headers = Object.keys(excelData[0]);

    const title = 'Báo cáo danh sách thiết bị';
    ws['A1'] = { v: title, t: 's' };
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }];

    ws['A1'].s = {
        font: { bold: true, sz: 18, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '4F81BD' } },
        alignment: { horizontal: 'center', vertical: 'center' },
    };

    ws['!rows'] = [{ hpt: 28 }, { hpt: 22 }];

    headers.forEach((h, idx) => {
        const cellRef = XLSX.utils.encode_cell({ r: 1, c: idx });
        if (!ws[cellRef]) return;

        ws[cellRef].s = {
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
    const activeCol = headers.indexOf('Active');
    const khCol = headers.indexOf('KháchHàng');

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

            if (R > 1) {
                if (R % 2 === 0) {
                    cell.s.fill = cell.s.fill || {};
                    cell.s.fill.fgColor = cell.s.fill.fgColor || { rgb: 'F9F9F9' };
                }
                if (C === activeCol && String(cell.v).trim() === 'Không') {
                    cell.s.fill = { fgColor: { rgb: 'FFC7CE' } };
                }
                if (C === khCol && String(cell.v).trim() === 'Chưa gán') {
                    cell.s.fill = { fgColor: { rgb: 'FFF2CC' } };
                }
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
    XLSX.utils.book_append_sheet(wb, ws, 'Devices');

    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });
    saveAs(new Blob([excelBuffer]), `DanhSachThietBi_${getTodayForFileName()}.xlsx`);

    return { ok: true };
}
