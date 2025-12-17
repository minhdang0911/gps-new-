import dayjs from 'dayjs';

export const normalize = (s) =>
    String(s || '')
        .trim()
        .toLowerCase();

export const getAuthToken = () => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('token') || localStorage.getItem('accessToken') || '';
};

export const formatDateTime = (value) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '--');

export const formatDuration = (start, end) => {
    if (!start || !end) return '--';
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    if (Number.isNaN(s) || Number.isNaN(e) || e < s) return '--';

    const diff = Math.floor((e - s) / 1000);
    const hh = String(Math.floor(diff / 3600)).padStart(2, '0');
    const mm = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
    const ss = String(diff % 60).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
};

export const applySortTrip = (list, sortMode) => {
    const rows = Array.isArray(list) ? [...list] : [];
    if (sortMode === 'none') return rows;

    rows.sort((a, b) => {
        const ta = dayjs(a?.endTime || a?.startTime).valueOf();
        const tb = dayjs(b?.endTime || b?.startTime).valueOf();
        return sortMode === 'newest' ? tb - ta : ta - tb;
    });
    return rows;
};

export const buildParams = ({ values, page, limit, plateToImeis }) => {
    const params = { page, limit };

    if (values.sessionId) params.sessionId = values.sessionId.trim();
    if (values.tripCode) params.tripCode = values.tripCode.trim();
    if (values.deviceId) params.deviceId = values.deviceId.trim();

    // license_plate -> imei (priority)
    if (values.license_plate) {
        const key = normalize(values.license_plate);
        const imeis = plateToImeis?.get(key) || [];
        params.imei = imeis[0] || '__NO_MATCH__';
    } else if (values.imei) {
        params.imei = values.imei.trim();
    }

    if (values.soh) params.soh = values.soh;

    if (values.timeRange?.length === 2) {
        params.startTime = values.timeRange[0].format('YYYY-MM-DD HH:mm:ss');
        params.endTime = values.timeRange[1].format('YYYY-MM-DD HH:mm:ss');
    }

    return params;
};
