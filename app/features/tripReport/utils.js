import dayjs from 'dayjs';

export const normalize = (s) =>
    String(s || '')
        .trim()
        .toLowerCase();

export const getAuthToken = () => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('token') || localStorage.getItem('accessToken') || '';
};

// keep old behavior (locale formatting)
export const formatDateTime = (value, isEn = false) => {
    if (!value) return '--';
    const d = new Date(value);
    return d.toLocaleString(isEn ? 'en-US' : 'vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });
};

export const formatStatus = (value, type, isEn) => {
    if (!value) return '--';
    if (isEn) return value;

    const v = String(value).toLowerCase();

    switch (type) {
        case 'connection':
            if (v === 'online') return 'Online';
            if (v === 'offline') return 'Offline';
            return value;

        case 'movement':
            if (v === 'running') return 'Đang chạy';
            if (v === 'stop') return 'Dừng';
            return value;

        case 'lock':
            if (v === 'lock') return 'Khoá';
            if (v === 'unlock') return 'Mở khoá';
            return value;

        default:
            return value;
    }
};

export const applyFilterSortTripReport = ({ rawData, filterValues, sortMode }) => {
    const values = filterValues || {};
    const { imei, license_plate, motorcycleId, connectionStatus, movementStatus, lockStatus, timeRange } = values;

    let rows = Array.isArray(rawData) ? [...rawData] : [];

    if (license_plate) {
        const key = normalize(license_plate);
        rows = rows.filter((item) => normalize(item.license_plate).includes(key));
    }
    if (imei) {
        const key = normalize(imei);
        rows = rows.filter((item) => normalize(item.imei).includes(key));
    }
    if (motorcycleId) {
        const key = normalize(motorcycleId);
        rows = rows.filter((item) => normalize(item.Motorcycle_id).includes(key));
    }

    if (connectionStatus) rows = rows.filter((item) => item.connectionStatus === connectionStatus);
    if (movementStatus) rows = rows.filter((item) => item.movementStatus === movementStatus);
    if (lockStatus) rows = rows.filter((item) => item.lockStatus === lockStatus);

    if (timeRange && timeRange.length === 2) {
        const start = dayjs(timeRange[0]).startOf('day').valueOf();
        const end = dayjs(timeRange[1]).endOf('day').valueOf();

        rows = rows.filter((item) => {
            const d = dayjs(item?.date).valueOf();
            return Number.isFinite(d) && d >= start && d <= end;
        });
    }

    if (sortMode !== 'none') {
        rows.sort((a, b) => {
            const ta = dayjs(a?.date || a?.last_update || a?.createdAt).valueOf();
            const tb = dayjs(b?.date || b?.last_update || b?.createdAt).valueOf();
            return sortMode === 'newest' ? tb - ta : ta - tb;
        });
    }

    return rows;
};
