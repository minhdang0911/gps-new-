const round = (n, digits = 2) => {
    if (n == null || Number.isNaN(Number(n))) return null;
    const p = Math.pow(10, digits);
    return Math.round(Number(n) * p) / p;
};

export function buildUsageSessionReportConfig({ rows = [], isEn }) {
    const cleanRows = (rows || []).filter((r) => !r?.__group);

    // KPI
    const totalSessions = cleanRows.length;
    const totalDistance = cleanRows.reduce((s, r) => s + Number(r?.distanceKm || 0), 0);
    const totalKwh = cleanRows.reduce((s, r) => s + Number(r?.consumedKwh || 0), 0);
    const kwhPerKm = totalDistance > 0 ? totalKwh / totalDistance : null;

    const kpis = [
        { key: 'sessions', title: isEn ? 'Sessions' : 'Phiên', value: totalSessions },
        {
            key: 'distance',
            title: isEn ? 'Total distance (km)' : 'Tổng quãng đường (km)',
            value: round(totalDistance, 2),
        },
        { key: 'kwh', title: isEn ? 'Energy (kWh)' : 'Điện tiêu thụ (kWh)', value: round(totalKwh, 2) },
        { key: 'kwhPerKm', title: 'kWh / km', value: round(kwhPerKm, 3) },
    ];

    // Chart: group by day
    const byDay = new Map();
    cleanRows.forEach((r) => {
        const ts = r?.usageTimestamp || r?.startTime;
        if (!ts) return;
        const day = new Date(ts).toISOString().slice(0, 10);

        const prev = byDay.get(day) || { day, consumedKwh: 0, distanceKm: 0 };
        prev.consumedKwh += Number(r?.consumedKwh || 0);
        prev.distanceKm += Number(r?.distanceKm || 0);
        byDay.set(day, prev);
    });

    const chartData = Array.from(byDay.values())
        .sort((a, b) => a.day.localeCompare(b.day))
        .map((d) => ({
            ...d,
            consumedKwh: round(d.consumedKwh, 2),
            distanceKm: round(d.distanceKm, 2),
            kwhPerKm: round(d.distanceKm > 0 ? d.consumedKwh / d.distanceKm : null, 3),
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
                { type: 'bar', dataKey: 'consumedKwh', name: 'kWh', yAxisId: 'left' },
                {
                    type: 'line',
                    dataKey: 'distanceKm',
                    name: isEn ? 'Distance (km)' : 'Quãng đường (km)',
                    yAxisId: 'right',
                    dot: false,
                },
                { type: 'line', dataKey: 'kwhPerKm', name: 'kWh/km', yAxisId: 'left', dot: false },
            ],
        },
    ];

    return { kpis, charts };
}
