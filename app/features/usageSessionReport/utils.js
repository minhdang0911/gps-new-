// features/usageSessionReport/utils.js
import dayjs from 'dayjs';

export const formatDateTime = (value) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-');

// ✅ NEW: FE filter time range (BE không support)
export const filterByTimeRange = (list, timeRange) => {
    const rows = Array.isArray(list) ? list : [];

    if (!Array.isArray(timeRange) || timeRange.length !== 2 || !timeRange[0] || !timeRange[1]) return rows;

    const start = dayjs(timeRange[0]);
    const end = dayjs(timeRange[1]);

    if (!start.isValid() || !end.isValid()) return rows;

    const startMs = start.valueOf();
    const endMs = end.valueOf();

    return rows.filter((x) => {
        // ✅ ưu tiên usageTimestamp/startTime/endTime
        const t = x?.usageTimestamp || x?.startTime || x?.createdAt;
        const ms = dayjs(t).valueOf();
        if (!Number.isFinite(ms)) return false;
        return ms >= startMs && ms <= endMs;
    });
};

export const buildParams = (values, page, limit, noPagination = false) => {
    const params = {};
    if (!noPagination) {
        params.page = page;
        params.limit = limit;
    }

    // NOTE: bạn đang set usageCode từ sessionId và usageCode cùng lúc
    // => giữ y chang để không phá behavior cũ
    if (values.sessionId) params.usageCode = values.sessionId.trim();
    if (values.batteryId) params.batteryId = values.batteryId.trim();
    if (values.usageCode) params.usageCode = values.usageCode.trim();
    if (values.deviceId) params.deviceId = values.deviceId.trim();
    if (values.soh) params.soh = values.soh;

    // ❌ BE không support -> KHÔNG gửi nữa
    // if (values.timeRange?.length === 2) {
    //     params.startTime = values.timeRange[0].format('YYYY-MM-DD HH:mm:ss');
    //     params.endTime = values.timeRange[1].format('YYYY-MM-DD HH:mm:ss');
    // }

    return params;
};

export const applyClientFilterSort = (list, tableFilters, sortMode) => {
    let rows = Array.isArray(list) ? [...list] : [];

    if (tableFilters.vehicleId?.length) {
        const set = new Set(tableFilters.vehicleId);
        rows = rows.filter((x) => set.has(x.vehicleId));
    }
    if (tableFilters.batteryId?.length) {
        const set = new Set(tableFilters.batteryId);
        rows = rows.filter((x) => set.has(x.batteryId));
    }

    if (sortMode !== 'none') {
        rows.sort((a, b) => {
            const ta = dayjs(a.usageTimestamp || a.startTime).valueOf();
            const tb = dayjs(b.usageTimestamp || b.startTime).valueOf();
            return sortMode === 'newest' ? tb - ta : ta - tb;
        });
    }

    return rows;
};

export const buildGrouped = (rows, key) => {
    const groups = new Map();
    rows.forEach((r) => {
        const k = r?.[key] ?? '-';
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(r);
    });

    const sum = (arr, field) => arr.reduce((s, x) => s + Number(x?.[field] ?? 0), 0);
    const avg = (arr, field) => (arr.length ? sum(arr, field) / arr.length : 0);

    return Array.from(groups.entries()).map(([k, items]) => {
        const startMin = items.reduce((m, x) => {
            const v = dayjs(x.startTime).valueOf();
            return Number.isFinite(v) ? Math.min(m, v) : m;
        }, Infinity);

        const endMax = items.reduce((m, x) => {
            const v = dayjs(x.endTime).valueOf();
            return Number.isFinite(v) ? Math.max(m, v) : m;
        }, -Infinity);

        return {
            _id: `group-${key}-${k}`,
            __group: true,
            groupKey: k,
            usageCode: `${k} (${items.length})`,
            vehicleId: key === 'vehicleId' ? k : '-',
            batteryId: key === 'batteryId' ? k : '-',
            durationMinutes: Math.round(sum(items, 'durationMinutes')),
            distanceKm: Number(sum(items, 'distanceKm').toFixed(2)),
            consumedKwh: Number(sum(items, 'consumedKwh').toFixed(2)),
            consumedPercent: Math.round(sum(items, 'consumedPercent')),
            soh: Math.round(avg(items, 'soh')),
            socStart: Math.round(avg(items, 'socStart')),
            socEnd: Math.round(avg(items, 'socEnd')),
            startTime: Number.isFinite(startMin) ? new Date(startMin).toISOString() : null,
            endTime: Number.isFinite(endMax) ? new Date(endMax).toISOString() : null,
            children: items,
        };
    });
};
