import dayjs from 'dayjs';

export const normalize = (s) =>
    String(s || '')
        .trim()
        .toLowerCase();

export const getAuthToken = () => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('token') || localStorage.getItem('accessToken') || '';
};

export const parseTimToDate = (tim) => {
    if (!tim || String(tim).length !== 12) return null;
    const s = String(tim);

    const yy = parseInt(s.slice(0, 2), 10);
    const MM = parseInt(s.slice(2, 4), 10) - 1;
    const dd = parseInt(s.slice(4, 6), 10);
    const hh = parseInt(s.slice(6, 8), 10);
    const mm = parseInt(s.slice(8, 10), 10);
    const ss = parseInt(s.slice(10, 12), 10);

    const year = 2000 + yy;
    return new Date(year, MM, dd, hh, mm, ss);
};

export const formatDateTimeFactory = (isEn) => (value) => {
    if (!value) return '--';
    const d = value instanceof Date ? value : new Date(value);
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

export const attachPlateToLastCruise = (list = [], imeiToPlate) => {
    const map = imeiToPlate instanceof Map ? imeiToPlate : new Map();
    return (Array.isArray(list) ? list : []).map((item) => {
        const imei = String(item?.dev || '').trim();
        return { ...item, license_plate: map.get(imei) || '' };
    });
};

export const applyClientFilterSort = ({ rawData, filterValues, sortMode }) => {
    const values = filterValues || {};
    const { dev, license_plate, fwr, gpsStatus, sosStatus, timeRange } = values;

    let rows = Array.isArray(rawData) ? [...rawData] : [];

    if (dev) {
        const key = normalize(dev);
        rows = rows.filter((item) => normalize(item.dev).includes(key));
    }
    if (license_plate) {
        const key = normalize(license_plate);
        rows = rows.filter((item) => normalize(item.license_plate).includes(key));
    }
    if (fwr) {
        const key = normalize(fwr);
        rows = rows.filter((item) => normalize(item.fwr).includes(key));
    }

    if (gpsStatus && gpsStatus !== 'all') {
        rows = rows.filter((item) => {
            const lost = Number(item.gps) === 1;
            if (gpsStatus === 'lost') return lost;
            if (gpsStatus === 'normal') return !lost;
            return true;
        });
    }

    if (sosStatus && sosStatus !== 'all') {
        rows = rows.filter((item) => {
            const on = Number(item.sos) === 1;
            if (sosStatus === 'on') return on;
            if (sosStatus === 'off') return !on;
            return true;
        });
    }

    if (timeRange && timeRange.length === 2) {
        const start = timeRange[0].startOf('day').valueOf();
        const end = timeRange[1].endOf('day').valueOf();
        rows = rows.filter((item) => {
            const time = item.createdAt ? new Date(item.createdAt).getTime() : NaN;
            return Number.isFinite(time) && time >= start && time <= end;
        });
    }

    if (sortMode !== 'none') {
        rows.sort((a, b) => {
            const ta = (a?.createdAt && dayjs(a.createdAt).valueOf()) || (parseTimToDate(a?.tim)?.getTime() ?? 0) || 0;
            const tb = (b?.createdAt && dayjs(b.createdAt).valueOf()) || (parseTimToDate(b?.tim)?.getTime() ?? 0) || 0;
            return sortMode === 'newest' ? tb - ta : ta - tb;
        });
    }

    return rows;
};
