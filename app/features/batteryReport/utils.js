import dayjs from 'dayjs';

export const normalize = (s) =>
    String(s || '')
        .trim()
        .toLowerCase();

export const getAuthToken = () => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('token') || localStorage.getItem('accessToken') || '';
};

export const safeToNumber = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

export const sortByDate = ({ rows, sortMode }) => {
    if (sortMode === 'none') return rows;

    const list = [...rows];
    list.sort((a, b) => {
        const ta = dayjs(a?.date || a?.last_update || a?.createdAt || 0).valueOf() || 0;
        const tb = dayjs(b?.date || b?.last_update || b?.createdAt || 0).valueOf() || 0;
        return sortMode === 'newest' ? tb - ta : ta - tb;
    });
    return list;
};
