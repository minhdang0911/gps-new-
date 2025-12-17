// features/usageSessionReport/hooks/useUsageSessionExcel.js
import { useState } from 'react';
import { message } from 'antd';
import * as XLSX from 'xlsx';
import { buildParams, formatDateTime } from '../utils';

export function useUsageSessionExcel({ form, getUsageSessions, t, isEn }) {
    const [exporting, setExporting] = useState(false);

    const exportExcel = async () => {
        try {
            setExporting(true);
            const values = form.getFieldsValue();
            const params = buildParams(values, 1, 100000);
            const res = await getUsageSessions(params);
            const list = res.data || [];

            if (!list.length) {
                message.warning(t.excel?.noData || (!isEn ? 'Không có dữ liệu để xuất' : 'No data to export'));
                return;
            }

            const rows = list.map((item, index) => ({
                [t.table.index]: index + 1,
                [t.table.sessionId]: item.usageCode,
                [t.table.vehicleId]: item.vehicleId,
                [t.table.batteryId]: item.batteryId,
                [t.table.usageCode]: item.usageCode,
                [t.table.durationMinutes]: item.durationMinutes,
                [t.table.soh]: item.soh,
                [t.table.socStart]: item.socStart,
                [t.table.socEnd]: item.socEnd,
                [t.table.tempMax]: item.tempMax,
                [t.table.tempMin]: item.tempMin,
                [t.table.tempAvg]: item.tempAvg,
                [t.table.distanceKm]: item.distanceKm,
                [t.table.speedMax]: item.speedMax,
                [t.table.speedAvg]: item.speedAvg,
                [t.table.consumedPercent]: item.consumedPercent,
                [t.table.consumedKwh]: item.consumedKwh,
                [t.table.startTime]: formatDateTime(item.startTime),
                [t.table.endTime]: formatDateTime(item.endTime),
                [t.table.startLat]: item.startLat,
                [t.table.startLng]: item.startLng,
                [t.table.endLat]: item.endLat,
                [t.table.endLng]: item.endLng,
            }));

            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'UsageSessions');

            XLSX.writeFile(
                wb,
                t.excel?.fileName || (!isEn ? 'bao_cao_usage_session.xlsx' : 'usage_session_report.xlsx'),
            );
            message.success(t.excel?.success || (!isEn ? 'Xuất Excel thành công' : 'Export Excel successfully'));
        } catch (err) {
            console.error(err);
            message.error(t.excel?.failed || (!isEn ? 'Xuất Excel thất bại' : 'Export Excel failed'));
        } finally {
            setExporting(false);
        }
    };

    return { exporting, exportExcel };
}
