// features/tripReport/reportConfig.js

const round = (n, digits = 2) => {
    if (n == null || Number.isNaN(Number(n))) return null;
    const p = Math.pow(10, digits);
    return Math.round(Number(n) * p) / p;
};

const getDayKey = (r) => {
    const ts = r?.date || r?.createdAt || null;
    if (!ts) return null;
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
};

export function buildTripReportReportConfig({ rows = [], isEn, t }) {
    const cleanRows = (rows || []).filter((r) => !r?.__group);

    // ======================
    // KPI
    // ======================
    const totalRecords = cleanRows.length;

    const sumTrips = cleanRows.reduce((s, r) => s + Number(r?.numberOfTrips || 0), 0);
    const sumMileage = cleanRows.reduce((s, r) => s + Number(r?.mileageToday || 0), 0);
    const sumRidingHours = cleanRows.reduce((s, r) => s + Number(r?.ridingHours || 0), 0);
    const sumKwh = cleanRows.reduce((s, r) => s + Number(r?.wattageConsumedToday || 0), 0);

    const maxSpeed = cleanRows.reduce((m, r) => {
        const v = r?.speedMaxToday;
        if (v == null) return m;
        const nv = Number(v);
        return m == null ? nv : Math.max(m, nv);
    }, null);

    const onlineCount = cleanRows.reduce((c, r) => c + (r?.connectionStatus === 'online' ? 1 : 0), 0);
    const offlineCount = cleanRows.reduce((c, r) => c + (r?.connectionStatus === 'offline' ? 1 : 0), 0);

    const kpis = [
        { key: 'records', title: isEn ? 'Records' : 'Bản ghi', value: totalRecords, xs: 12, md: 6, lg: 6 },
        { key: 'trips', title: isEn ? 'Trips' : 'Số chuyến', value: sumTrips, xs: 12, md: 6, lg: 6 },
        {
            key: 'mileage',
            title: isEn ? 'Mileage (km)' : 'Quãng đường (km)',
            value: round(sumMileage, 2),
            xs: 12,
            md: 6,
            lg: 6,
        },
        {
            key: 'hours',
            title: isEn ? 'Riding hours (h)' : 'Giờ chạy (h)',
            value: round(sumRidingHours, 2),
            xs: 12,
            md: 6,
            lg: 6,
        },
        {
            key: 'kwh',
            title: isEn ? 'Energy (kWh)' : 'Điện tiêu thụ (kWh)',
            value: round(sumKwh, 2),
            xs: 12,
            md: 6,
            lg: 6,
        },
        { key: 'maxSpeed', title: isEn ? 'Max speed' : 'Tốc độ max', value: maxSpeed, xs: 12, md: 6, lg: 6 },
        { key: 'online', title: isEn ? 'Online' : 'Online', value: onlineCount, xs: 12, md: 6, lg: 6 },
        { key: 'offline', title: isEn ? 'Offline' : 'Offline', value: offlineCount, xs: 12, md: 6, lg: 6 },
    ];

    // ======================
    // CHART: group by day
    // ======================
    const byDay = new Map();

    cleanRows.forEach((r) => {
        const day = getDayKey(r);
        if (!day) return;

        const prev = byDay.get(day) || {
            day,
            trips: 0,
            mileage: 0,
            ridingHours: 0,
            kwh: 0,
            speedMax: null,
            online: 0,
            offline: 0,
            count: 0,
        };

        prev.count += 1;
        prev.trips += Number(r?.numberOfTrips || 0);
        prev.mileage += Number(r?.mileageToday || 0);
        prev.ridingHours += Number(r?.ridingHours || 0);
        prev.kwh += Number(r?.wattageConsumedToday || 0);

        const sp = r?.speedMaxToday;
        if (sp != null) {
            const nsp = Number(sp);
            prev.speedMax = prev.speedMax == null ? nsp : Math.max(prev.speedMax, nsp);
        }

        if (r?.connectionStatus === 'online') prev.online += 1;
        if (r?.connectionStatus === 'offline') prev.offline += 1;

        byDay.set(day, prev);
    });

    const chartData = Array.from(byDay.values())
        .sort((a, b) => a.day.localeCompare(b.day))
        .map((d) => ({
            day: d.day,
            trips: d.trips,
            mileage: round(d.mileage, 2),
            kwh: round(d.kwh, 2),
            ridingHours: round(d.ridingHours, 2),
            speedMax: d.speedMax,
            online: d.online,
            offline: d.offline,
        }));

    const charts = [
        {
            key: 'daily',
            title: isEn ? 'Daily trend' : 'Xu hướng theo ngày',
            height: 340,
            data: chartData,
            xKey: 'day',
            yAxes: [{ id: 'left' }, { id: 'right', orientation: 'right' }],
            series: [
                { type: 'bar', dataKey: 'trips', name: isEn ? 'Trips' : 'Số chuyến', yAxisId: 'left' },
                {
                    type: 'line',
                    dataKey: 'mileage',
                    name: isEn ? 'Mileage (km)' : 'Quãng đường (km)',
                    yAxisId: 'right',
                    dot: false,
                },
                {
                    type: 'line',
                    dataKey: 'kwh',
                    name: isEn ? 'Energy (kWh)' : 'Điện (kWh)',
                    yAxisId: 'right',
                    dot: false,
                },
                {
                    type: 'line',
                    dataKey: 'speedMax',
                    name: isEn ? 'Max speed' : 'Tốc độ max',
                    yAxisId: 'right',
                    dot: false,
                },
            ],
        },
    ];

    return { kpis, charts };
}
