import * as XLSX from 'xlsx';
import { message } from 'antd';

export function useBatteryReportExcel({ processedData, isEn, t, formatDateTime, formatStatus }) {
    const exportExcel = () => {
        if (!processedData || processedData.length === 0) {
            message.warning(isEn ? 'No data to export' : 'Không có dữ liệu để xuất');
            return;
        }

        const rows = processedData.map((item) => {
            const lastLocation =
                item.realtime_lat && item.realtime_lon ? `${item.realtime_lat},${item.realtime_lon}` : '';

            return {
                [isEn ? 'License plate' : 'Biển số']: item.license_plate || '',
                [t.table.batteryId]: item.batteryId || '',
                [t.table.last_update]: formatDateTime(item.last_update, isEn),
                [t.table.connectionStatus]: formatStatus(item.connectionStatus, 'connection', isEn),
                [t.table.utilization]: formatStatus(item.utilization, 'utilization', isEn),

                [t.table.currentBatteryPower]: item.realtime_soc ?? '',
                [t.table.socToday]: item.socToday ?? '',
                [t.table.sohToday]: item.sohToday ?? '',
                [t.table.currentMaxPower]: item.realtime_voltage ?? '',

                [t.table.voltageMaxToday]: item.voltageMaxToday ?? '',
                [t.table.voltageMinToday]: item.voltageMinToday ?? '',
                [t.table.voltageAvgToday]: item.voltageAvgToday ?? '',

                [t.table.tempMaxToday]: item.tempMaxToday ?? '',
                [t.table.tempMinToday]: item.tempMinToday ?? '',
                [t.table.tempAvgToday]: item.tempAvgToday ?? '',

                [t.table.batteryUsageToday]: item.usageDurationToday ?? '',
                [t.table.usageDurationToday]: item.usageDurationToday ?? '',

                [t.table.batteryConsumedToday]: item.consumedPercentToday ?? '',
                [t.table.wattageConsumedToday]: item.consumedKwToday ?? '',

                [t.table.mileageToday]: item.mileageToday ?? '',
                [t.table.speedMaxToday]: item.speedMaxToday ?? '',
                [t.table.numberOfChargingToday]: item.numberOfChargingToday ?? '',
                [t.table.chargingDurationToday]: item.chargingDurationToday ?? '',

                [t.table.lastLocation]: lastLocation,
            };
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'BatteryReport');

        XLSX.writeFile(wb, isEn ? 'battery_report.xlsx' : 'bao_cao_pin.xlsx');
    };

    return { exportExcel };
}
