// features/tripSessionReport/reportConfig.js

const round = (n, digits = 2) => {
    if (n == null || Number.isNaN(Number(n))) return null;
    const p = Math.pow(10, digits);
    return Math.round(Number(n) * p) / p;
};

const safeNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

const getTripTime = (r) => r?.tripTimestamp || r?.startTime || r?.createdAt || null;

const getDayKey = (r) => {
    const ts = getTripTime(r);
    if (!ts) return null;
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
};

export function buildTripSessionReportConfig({ rows = [], isEn, t }) {
    const cleanRows = (rows || []).filter((r) => !r?.__group);

    // ======================
    // KPI CALCULATION
    // ======================
    const totalTrips = cleanRows.length;

    let sumTempAvg = 0;
    let cTempAvg = 0;

    let maxTemp = null;

    let sumSoh = 0;
    let cSoh = 0;

    const uniqueImeis = new Set();
    const uniquePlates = new Set();

    cleanRows.forEach((r) => {
        // temp avg
        if (r?.tempAvg != null) {
            sumTempAvg += Number(r.tempAvg);
            cTempAvg += 1;
        }

        // temp max
        if (r?.tempMax != null) {
            const v = Number(r.tempMax);
            maxTemp = maxTemp == null ? v : Math.max(maxTemp, v);
        }

        // soh
        if (r?.soh != null) {
            sumSoh += Number(r.soh);
            cSoh += 1;
        }

        if (r?.imei) uniqueImeis.add(r.imei);
        if (r?.license_plate) uniquePlates.add(r.license_plate);
    });

    const avgTemp = cTempAvg ? sumTempAvg / cTempAvg : null;
    const avgSoh = cSoh ? sumSoh / cSoh : null;

    const kpis = [
        {
            key: 'totalTrips',
            title: isEn ? 'Trips' : 'Số chuyến',
            value: totalTrips,
            xs: 12,
            md: 6,
            lg: 6,
        },
        {
            key: 'vehicles',
            title: isEn ? 'Vehicles' : 'Số xe',
            value: uniquePlates.size || uniqueImeis.size,
            xs: 12,
            md: 6,
            lg: 6,
        },
        {
            key: 'avgTemp',
            title: isEn ? 'Avg temp (°C)' : 'Nhiệt độ TB (°C)',
            value: round(avgTemp, 1),
            xs: 12,
            md: 6,
            lg: 6,
        },
        {
            key: 'maxTemp',
            title: isEn ? 'Max temp (°C)' : 'Nhiệt độ max (°C)',
            value: maxTemp,
            xs: 12,
            md: 6,
            lg: 6,
        },
        {
            key: 'avgSoh',
            title: isEn ? 'Avg SOH' : 'SOH TB',
            value: round(avgSoh, 1),
            xs: 12,
            md: 6,
            lg: 6,
        },
    ];

    // ======================
    // CHART: GROUP BY DAY
    // ======================
    const byDay = new Map();

    cleanRows.forEach((r) => {
        const day = getDayKey(r);
        if (!day) return;

        const prev = byDay.get(day) || {
            day,
            trips: 0,
            tempAvgSum: 0,
            tempAvgCount: 0,
            tempMax: null,
            sohSum: 0,
            sohCount: 0,
        };

        prev.trips += 1;

        if (r?.tempAvg != null) {
            prev.tempAvgSum += Number(r.tempAvg);
            prev.tempAvgCount += 1;
        }

        if (r?.tempMax != null) {
            const v = Number(r.tempMax);
            prev.tempMax = prev.tempMax == null ? v : Math.max(prev.tempMax, v);
        }

        if (r?.soh != null) {
            prev.sohSum += Number(r.soh);
            prev.sohCount += 1;
        }

        byDay.set(day, prev);
    });

    const chartData = Array.from(byDay.values())
        .sort((a, b) => a.day.localeCompare(b.day))
        .map((d) => ({
            day: d.day,
            trips: d.trips,
            avgTemp: round(d.tempAvgCount ? d.tempAvgSum / d.tempAvgCount : null, 1),
            maxTemp: d.tempMax,
            avgSoh: round(d.sohCount ? d.sohSum / d.sohCount : null, 1),
        }));

    const charts = [
        {
            key: 'daily',
            title: isEn ? 'Daily trip trend' : 'Xu hướng chuyến theo ngày',
            height: 340,
            data: chartData,
            xKey: 'day',
            yAxes: [{ id: 'left' }, { id: 'right', orientation: 'right' }],
            series: [
                {
                    type: 'bar',
                    dataKey: 'trips',
                    name: isEn ? 'Trips' : 'Số chuyến',
                    yAxisId: 'left',
                },
                {
                    type: 'line',
                    dataKey: 'avgTemp',
                    name: isEn ? 'Avg temp (°C)' : 'Nhiệt độ TB (°C)',
                    yAxisId: 'right',
                    dot: false,
                },
                {
                    type: 'line',
                    dataKey: 'avgSoh',
                    name: isEn ? 'Avg SOH' : 'SOH TB',
                    yAxisId: 'right',
                    dot: false,
                },
            ],
        },
    ];

    return { kpis, charts };
}
