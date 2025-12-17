import { message } from 'antd';
import * as XLSX from 'xlsx';
import { formatDateTime, formatDuration } from '../utils';

export function useTripSessionExcel({ isEn, t }) {
    const exportExcel = ({ pagedData, pagination }) => {
        if (!pagedData || pagedData.length === 0) {
            message.warning(isEn ? 'No data to export' : 'Không có dữ liệu để xuất');
            return;
        }

        const rows = pagedData.map((item, index) => ({
            [t.table.index]: (pagination.current - 1) * pagination.pageSize + index + 1,
            [t.table.tripCode]: item.tripCode || '',
            [isEn ? 'License plate' : 'Biển số']: item.license_plate || '',
            [t.table.imei]: item.imei || '',
            [t.table.batteryId]: item.batteryId || '',
            [t.table.soh]: item.soh ?? '',
            [isEn ? 'Start time' : 'Thời gian bắt đầu']: formatDateTime(item.startTime),
            [isEn ? 'End time' : 'Thời gian kết thúc']: formatDateTime(item.endTime),
            [isEn ? 'Duration' : 'Thời lượng']: formatDuration(item.startTime, item.endTime),
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
    };

    return { exportExcel };
}
