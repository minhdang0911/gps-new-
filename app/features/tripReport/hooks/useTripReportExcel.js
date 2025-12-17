import { message } from 'antd';
import * as XLSX from 'xlsx';
import { formatDateTime, formatStatus } from '../utils';

export function useTripReportExcel({ isEn, t, getDistributorLabel }) {
    const exportExcel = (processedData) => {
        if (!processedData || processedData.length === 0) {
            message.warning(isEn ? 'No data to export' : 'Không có dữ liệu để xuất');
            return;
        }

        const rows = processedData.map((item, index) => ({
            [t.table.index]: index + 1,
            [t.table.date]: formatDateTime(item.date, isEn),
            [t.table.imei]: item.imei || '',
            [t.table.licensePlate]: item.license_plate || '',
            [t.table.motorcycleId]: item.Motorcycle_id ?? '',

            [t.table.mileageToday]: item.mileageToday ?? '',
            [t.table.numberOfTrips]: item.numberOfTrips ?? '',
            [t.table.ridingHours]: item.ridingHours ?? '',
            [t.table.speedMaxToday]: item.speedMaxToday ?? '',

            [t.table.batteryConsumedToday]: item.batteryConsumedToday ?? '',
            [t.table.wattageConsumedToday]: item.wattageConsumedToday ?? '',

            [t.table.connectionStatus]: formatStatus(item.connectionStatus, 'connection', isEn),
            [t.table.movementStatus]: formatStatus(item.movementStatus, 'movement', isEn),
            [t.table.lockStatus]: formatStatus(item.lockStatus, 'lock', isEn),

            [t.table.realtime_lat]: item.realtime_lat ?? '',
            [t.table.realtime_lon]: item.realtime_lon ?? '',

            [t.table.distributor_id]: getDistributorLabel(item.distributor_id),
            [t.table.createdAt]: formatDateTime(item.createdAt, isEn),
            [t.table.last_update]: formatDateTime(item.last_update, isEn),
        }));

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'TripReport');

        const fileName = isEn ? 'trip_report.xlsx' : 'bao_cao_chuyen.xlsx';
        XLSX.writeFile(wb, fileName);
    };

    return { exportExcel };
}
