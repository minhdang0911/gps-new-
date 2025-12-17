import { message } from 'antd';
import * as XLSX from 'xlsx';
import { formatDateTime } from '../utils';

export function useChargingSessionExcel({ isEn, t }) {
    const exportExcel = (source) => {
        if (!source || source.length === 0) {
            message.warning(isEn ? 'No data to export' : 'Không có dữ liệu để xuất');
            return;
        }

        const rows = source.map((item, index) => ({
            [t.table.index]: index + 1,
            IMEI: item.imei || '',
            [isEn ? 'License plate' : 'Biển số']: item.license_plate || '',
            [t.table.chargeCode]: item.chargeCode || '',
            [t.table.soh]: item.soh ?? '',
            [t.table.socStart]: item.socStart ?? '',
            [t.table.socEnd]: item.socEnd ?? '',
            [t.table.tempMax]: item.tempMax ?? '',
            [t.table.tempMin]: item.tempMin ?? '',
            [t.table.tempAvg]: item.tempAvg ?? '',
            [t.table.voltageMax]: item.voltageMax ?? '',
            [t.table.voltageMin]: item.voltageMin ?? '',
            [t.table.voltageAvg]: item.voltageAvg ?? '',
            [t.table.chargeLat]: item.chargeLat ?? '',
            [t.table.chargeLng]: item.chargeLng ?? '',
            [t.table.startTime]: formatDateTime(item.start || item.startTime),
            [t.table.endTime]: formatDateTime(item.end || item.endTime),
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, 'ChargingSession');

        const fileName = isEn ? `charging-session-report-${Date.now()}.xlsx` : `bao-cao-sac-${Date.now()}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    return { exportExcel };
}
