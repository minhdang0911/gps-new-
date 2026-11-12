import { message } from 'antd';
import { formatDateTimeFactory, parseTimToDate } from '../utils';
import {
    reverseGeocodeBatch,
    getCachedAddressSync,
    getCoordCacheKey,
    isValidGeocodeCoord,
} from '../../../lib/address/reverseGeocode';

export function useLastCruiseExcel({ processedData, isEn, t }) {
    const lang = isEn ? 'en' : 'vi';
    const formatDateTime = formatDateTimeFactory(isEn);

    const formatGps = (gps) => {
        const lost = Number(gps) === 1;
        return lost
            ? t?.table?.gpsLost || (isEn ? 'GPS lost' : 'Mất GPS')
            : t?.table?.gpsNormal || (isEn ? 'GPS normal' : 'GPS bình thường');
    };

    const formatSos = (sos) => {
        const on = Number(sos) === 1;
        return on
            ? t?.table?.sosOn || (isEn ? 'SOS on' : 'Bật SOS')
            : t?.table?.sosOff || (isEn ? 'SOS off' : 'Tắt SOS');
    };

    const formatAcc = (acc) => {
        const locked = Number(acc) === 1;
        if (isEn) return locked ? 'Vehicle locked' : 'Vehicle unlocked';
        return locked ? 'Khóa xe tắt' : 'Khóa xe mở';
    };

    const exportExcel = async () => {
        if (!processedData || processedData.length === 0) {
            message.warning(isEn ? 'No data to export' : 'Không có dữ liệu để xuất');
            return;
        }

        const resolvedByKey = new Map();
        const uncachedCoords = new Map();

        for (const item of processedData) {
            if (!item || item.address) continue;
            if (!isValidGeocodeCoord(item.lat, item.lon)) continue;

            const key = getCoordCacheKey(item.lat, item.lon, lang);
            if (resolvedByKey.has(key) || uncachedCoords.has(key)) continue;

            const cached = getCachedAddressSync(item.lat, item.lon, { lang, isEn });
            if (cached?.address) {
                resolvedByKey.set(key, cached.address);
            } else {
                uncachedCoords.set(key, { lat: Number(item.lat), lon: Number(item.lon) });
            }
        }

        if (uncachedCoords.size > 0) {
            const hideLoading = message.loading(
                isEn ? 'Resolving remaining addresses for Excel...' : 'Đang lấy địa chỉ còn thiếu để xuất Excel...',
                0,
            );
            try {
                const batchMap = await reverseGeocodeBatch(
                    Array.from(uncachedCoords.values()).map((c) => ({ ...c, lang })),
                    { lang, isEn },
                );
                for (const key of uncachedCoords.keys()) {
                    resolvedByKey.set(key, batchMap?.[key]?.address || '');
                }
            } finally {
                hideLoading?.();
            }
        }

        const rows = processedData.map((item, index) => {
            const timDate = parseTimToDate(item.tim);
            let addressText = item.address || '';
            if (!addressText && isValidGeocodeCoord(item.lat, item.lon)) {
                const key = getCoordCacheKey(item.lat, item.lon, lang);
                addressText = resolvedByKey.get(key) || getCachedAddressSync(item.lat, item.lon, { lang, isEn })?.address || '';
            }

            return {
                [t.table.index]: index + 1,
                [t.table.dev]: item.dev,
                [isEn ? 'License plate' : 'Biển số']: item.license_plate || '',
                [t.table.fwr]: item.fwr,
                [t.table.tim]: timDate ? formatDateTime(timDate) : item.tim || '--',
                [t.table.lat]: item.lat,
                [t.table.lon]: item.lon,
                [t.table.sat]: addressText || '--',
                [t.table.gps]: formatGps(item.gps),
                [t.table.sos]: formatSos(item.sos),
                [t.table.acc]: formatAcc(item.acc),
                [t.table.vgp]: item.vgp,

                // ✅ ADD: mil => ODO
                [isEn ? 'ODO' : 'ODO']: item.mil ?? '',

                [t.table.createdAt]: formatDateTime(item.createdAt),
            };
        });

        const xlsxMod = await import('xlsx-js-style');
        const XLSX = xlsxMod?.default || xlsxMod;
        const worksheet = XLSX.utils.json_to_sheet(rows);

        const headers = Object.keys(rows[0] || {});
        const addressHeader = t.table.sat;

        worksheet['!cols'] = headers.map((key) => {
            const maxLen = Math.max(
                String(key).length,
                ...rows.map((r) => String(r[key] ?? '').length),
            );
            if (key === addressHeader) {
                return { wch: Math.min(Math.max(maxLen + 4, 55), 95) };
            }
            return { wch: Math.min(Math.max(maxLen + 4, 8), 45) };
        });

        const range = worksheet['!ref'] ? XLSX.utils.decode_range(worksheet['!ref']) : null;
        if (range) {
            const addressColIdx = headers.indexOf(addressHeader);
            worksheet['!rows'] = [{ hpt: 24 }];

            for (let C = range.s.c; C <= range.e.c; C++) {
                const headerRef = XLSX.utils.encode_cell({ r: 0, c: C });
                if (worksheet[headerRef]) {
                    worksheet[headerRef].s = {
                        font: { bold: true },
                        fill: { fgColor: { rgb: 'F1F5F9' } },
                        alignment: { horizontal: 'center', vertical: 'center' },
                    };
                }
            }

            if (addressColIdx >= 0) {
                for (let R = 1; R <= range.e.r; R++) {
                    const addrRef = XLSX.utils.encode_cell({ r: R, c: addressColIdx });
                    if (worksheet[addrRef]) {
                        worksheet[addrRef].s = {
                            alignment: { vertical: 'center', wrapText: true },
                        };
                    }
                }
            }
        }

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'LastCruise');

        XLSX.writeFile(workbook, t.excel.fileName);
        message.success(isEn ? 'Export Excel successfully' : 'Xuất Excel thành công');
    };

    return { exportExcel };
}
