import * as XLSX from 'xlsx';
import { message } from 'antd';
import { formatDateTimeFactory, parseTimToDate } from '../utils';

export function useLastCruiseExcel({ processedData, isEn, t }) {
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

    const exportExcel = () => {
        if (!processedData || processedData.length === 0) {
            message.warning(isEn ? 'No data to export' : 'Không có dữ liệu để xuất');
            return;
        }

        const rows = processedData.map((item, index) => {
            const timDate = parseTimToDate(item.tim);

            return {
                [t.table.index]: index + 1,
                [t.table.dev]: item.dev,
                [isEn ? 'License plate' : 'Biển số']: item.license_plate || '',
                [t.table.fwr]: item.fwr,
                [t.table.tim]: timDate ? formatDateTime(timDate) : item.tim || '--',
                [t.table.lat]: item.lat,
                [t.table.lon]: item.lon,
                [t.table.sat]: item.sat,
                [t.table.gps]: formatGps(item.gps),
                [t.table.sos]: formatSos(item.sos),
                [t.table.acc]: formatAcc(item.acc),
                [t.table.vgp]: item.vgp,

                // ✅ ADD: mil => ODO
                [isEn ? 'ODO' : 'ODO']: item.mil ?? '',

                [t.table.createdAt]: formatDateTime(item.createdAt),
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'LastCruise');

        XLSX.writeFile(workbook, t.excel.fileName);
        message.success(isEn ? 'Export Excel successfully' : 'Xuất Excel thành công');
    };

    return { exportExcel };
}
