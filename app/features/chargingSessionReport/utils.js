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

export const pickTimeForSort = (row) => row?.end || row?.endTime || row?.start || row?.startTime;

export const applySortCharging = (list, sortMode) => {
    const rows = [...(list || [])];
    rows.sort((a, b) => {
        const ta = dayjs(pickTimeForSort(a)).valueOf();
        const tb = dayjs(pickTimeForSort(b)).valueOf();
        return sortMode === 'newest' ? tb - ta : ta - tb;
    });
    return rows;
};

export const buildPayload = ({ values, page, limit, plateToImeis }) => {
    const payload = { page, limit };

    if (values.chargeCode) payload.chargeCode = values.chargeCode.trim();
    if (values.soh) payload.soh = values.soh;

    // biển số -> imei
    if (values.license_plate) {
        const key = normalize(values.license_plate);
        const imeis = plateToImeis?.get(key) || [];
        payload.imei = imeis[0] || '__NO_MATCH__';
    }

    if (values.timeRange?.length === 2) {
        payload.start = values.timeRange[0].format('YYYY-MM-DD HH:mm:ss');
        payload.end = values.timeRange[1].format('YYYY-MM-DD HH:mm:ss');
    }

    return payload;
};
