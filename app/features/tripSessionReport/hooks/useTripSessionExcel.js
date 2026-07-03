// features/tripSessionReport/hooks/useTripSessionExcel.js
//
// ✅ Export Excel từ ALL data đã load, lấy 1000 records gần nhất
//    (sort theo startTime desc, slice 1000 đầu)

import { message } from 'antd';
import * as XLSX from 'xlsx';
import { formatDateTime, formatDuration } from '../utils';

export function useTripSessionExcel({ isEn, t }) {
    /**
     * exportExcel
     * @param {object} opts
     * @param {any[]}  opts.allData   - toàn bộ records đã fetch về FE
     * @param {object} opts.pagination - { current, pageSize, total }
     */
    const exportExcel = ({ allData, pagination }) => {
        if (!allData || allData.length === 0) {
            message.warning(isEn ? 'No data to export' : 'Không có dữ liệu để xuất');
            return;
        }

        // Lấy 1000 records gần nhất (sort theo startTime mới nhất trước)
        const EXPORT_LIMIT = 1000;
        const sorted = [...allData].sort((a, b) => {
            const ta = a.startTime ? new Date(a.startTime).getTime() : 0;
            const tb = b.startTime ? new Date(b.startTime).getTime() : 0;
            return tb - ta; // DESC — mới nhất trước
        });
        const exportRows = sorted.slice(0, EXPORT_LIMIT);

        const rows = exportRows.map((item, index) => ({
            [t.table.index]: index + 1,
            [t.table.tripCode]: item.tripCode || '',
            [isEn ? 'License plate' : 'Biển số']: item.license_plate || '',
            [t.table.imei]: item.imei || '',
            [t.table.batteryId]: item.batteryId || '',
            [t.table.soh]: item.soh ?? '',
            [isEn ? 'Start time' : 'Thời gian bắt đầu']: formatDateTime(item.startTime),
            [isEn ? 'End time'   : 'Thời gian kết thúc']: formatDateTime(item.endTime),
            [isEn ? 'Duration'   : 'Thời lượng']: formatDuration(item.startTime, item.endTime),
            [t.table.distanceKm]: item.distanceKm ?? '',
            [t.table.consumedKw]: item.consumedKw ?? '',
            [t.table.socEnd]: item.socEnd ?? '',
            [t.table.endLat]: item.endLat ?? '',
            [t.table.endLng]: item.endLng ?? '',
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, 'TripSession');

        const fileName = isEn
            ? `trip-session-report-${Date.now()}.xlsx`
            : `bao-cao-phien-hanh-trinh-${Date.now()}.xlsx`;

        XLSX.writeFile(wb, fileName);

        if (allData.length > EXPORT_LIMIT) {
            message.info(
                isEn
                    ? `Exported ${EXPORT_LIMIT} most recent records (total: ${allData.length.toLocaleString()})`
                    : `Đã xuất ${EXPORT_LIMIT} bản ghi gần nhất (tổng: ${allData.length.toLocaleString()})`,
            );
        }
    };

    return { exportExcel };
}
