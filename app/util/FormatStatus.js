export const formatStatus = (value, type, isEn) => {
    if (!value) return '--';
    if (isEn) return value;

    const v = String(value).toLowerCase();

    switch (type) {
        case 'connection': {
            if (v === 'online') return 'Online';
            if (v === 'offline') return 'Offline';
            return value;
        }
        case 'utilization': {
            if (v === 'running') return 'Đang chạy';
            if (v === 'stop') return 'Dừng';
            return value;
        }
        case 'realtime': {
            if (v === 'idle') return 'Đang chờ';
            if (v === 'charging') return 'Đang sạc';
            if (v === 'discharging') return 'Đang xả';
            return value;
        }
        default:
            return value;
    }
};
