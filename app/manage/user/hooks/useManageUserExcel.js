// app/manage/user/hooks/useManageUserExcel.js
import { message } from 'antd';
import { getTodayForFileName } from '../../../util/FormatDate';

export function useManageUserExcel({ users, canExport, roleLabelMap, isEnglish, translation }) {
    const exportExcel = async () => {
        if (!canExport) return;

        if (!users || !users.length) {
            message.warning(translation.messages.exportNoData);
            return;
        }

        try {
            message.loading({
                content: isEnglish ? 'Exporting...' : 'Đang xuất file...',
                key: 'export_users',
            });
            const [xlsxModule, fileSaverModule] = await Promise.all([
                import('xlsx-js-style'),
                import('file-saver'),
            ]);
            const XLSX = xlsxModule.default || xlsxModule;
            const saveAs = fileSaverModule.saveAs || fileSaverModule.default;

            const excelRows = users.map((userItem) => {
                let distributorText = '';
                if (userItem.distributor_id) {
                    if (typeof userItem.distributor_id === 'string') {
                        distributorText = userItem.distributor_id;
                    } else {
                        distributorText = `${userItem.distributor_id?.email || ''} (${userItem.distributor_id?.username || ''})`;
                    }
                }
                return {
                    [translation.excel.columns.username]: userItem.username || '',
                    [translation.excel.columns.name]: userItem.name || '',
                    [translation.excel.columns.email]: userItem.email || '',
                    [translation.excel.columns.phone]: userItem.phone || '',
                    [translation.excel.columns.role]: roleLabelMap[userItem.position] || userItem.position || '',
                    [translation.excel.columns.distributor]: distributorText,
                    [translation.excel.columns.createdAt]: userItem.createdAt
                        ? new Date(userItem.createdAt).toLocaleString(isEnglish ? 'en-GB' : 'vi-VN')
                        : '',
                };
            });

            const worksheet = XLSX.utils.json_to_sheet(excelRows, { origin: 'A2' });
            const columnHeaders = Object.keys(excelRows[0]);

            worksheet['A1'] = { v: translation.excel.title, t: 's' };
            worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: columnHeaders.length - 1 } }];

            worksheet['A1'].s = {
                font: { bold: true, sz: 18, color: { rgb: 'FFFFFF' } },
                fill: { fgColor: { rgb: '4F81BD' } },
                alignment: { horizontal: 'center', vertical: 'center' },
            };

            worksheet['!rows'] = [{ hpt: 26 }, { hpt: 22 }];

            columnHeaders.forEach((headerKey, columnIndex) => {
                const cellRef = XLSX.utils.encode_cell({ r: 1, c: columnIndex });
                if (!worksheet[cellRef]) return;
                worksheet[cellRef].s = {
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

            const sheetRange = XLSX.utils.decode_range(worksheet['!ref']);
            for (let rowIndex = sheetRange.s.r; rowIndex <= sheetRange.e.r; rowIndex++) {
                for (let colIndex = sheetRange.s.c; colIndex <= sheetRange.e.c; colIndex++) {
                    const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
                    const cell = worksheet[cellRef];
                    if (!cell) continue;

                    cell.s = cell.s || {};
                    cell.s.alignment = { horizontal: 'center', vertical: 'center' };
                    cell.s.border = {
                        top: { style: 'thin', color: { rgb: '000000' } },
                        bottom: { style: 'thin', color: { rgb: '000000' } },
                        left: { style: 'thin', color: { rgb: '000000' } },
                        right: { style: 'thin', color: { rgb: '000000' } },
                    };

                    if (rowIndex > 1 && rowIndex % 2 === 0) {
                        cell.s.fill = cell.s.fill || {};
                        cell.s.fill.fgColor = cell.s.fill.fgColor || { rgb: 'F9F9F9' };
                    }
                }
            }

            worksheet['!cols'] = columnHeaders.map((headerKey) => {
                const maxLen = Math.max(headerKey.length, ...excelRows.map((row) => String(row[headerKey] || '').length));
                return { wch: maxLen + 4 };
            });

            worksheet['!autofilter'] = {
                ref: XLSX.utils.encode_range({
                    s: { r: 1, c: 0 },
                    e: { r: sheetRange.e.r, c: sheetRange.e.c },
                }),
            };

            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Users');

            const excelBuffer = XLSX.write(workbook, {
                bookType: 'xlsx',
                type: 'array',
                cellStyles: true,
            });

            saveAs(new Blob([excelBuffer]), `DanhSachNguoiDung_${getTodayForFileName()}.xlsx`);
            message.success(translation.messages.exportSuccess);
        } catch (error) {
            console.error('EXPORT EXCEL ERROR', error);
            message.error(translation.messages.exportFailed);
        }
    };

    return { exportExcel };
}
