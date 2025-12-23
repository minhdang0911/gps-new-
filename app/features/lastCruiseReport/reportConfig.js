// features/lastCruiseReport/reportConfig.js

const round = (n, digits = 2) => {
    if (n == null || Number.isNaN(Number(n))) return null;
    const p = Math.pow(10, digits);
    return Math.round(Number(n) * p) / p;
};

const getDayKey = (r) => {
    const ts = r?.updatedAt || r?.createdAt || null;
    if (!ts) return null;
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
};

export function buildLastCruiseReportConfig({ rows = [], isEn, t }) {
    const cleanRows = (rows || []).filter((r) => !r?.__group);

    const total = cleanRows.length;
    const gpsOn = cleanRows.reduce((c, r) => c + (Number(r?.gps) === 1 ? 1 : 0), 0);
    const gpsOff = total - gpsOn;

    const sosOn = cleanRows.reduce((c, r) => c + (Number(r?.sos) === 1 ? 1 : 0), 0);
    const sosOff = total - sosOn;

    const gpsSatAvg = (() => {
        let s = 0;
        let c = 0;
        cleanRows.forEach((r) => {
            if (r?.sat == null) return;
            s += Number(r.sat);
            c += 1;
        });
        return c ? s / c : null;
    })();

    const maxVgp = cleanRows.reduce((m, r) => {
        const v = r?.vgp;
        if (v == null) return m;
        const nv = Number(v);
        return m == null ? nv : Math.max(m, nv);
    }, null);

    const kpis = [
        { key: 'records', title: isEn ? 'Records' : 'Bản ghi', value: total, xs: 12, md: 6, lg: 6 },
        { key: 'gpsOn', title: isEn ? 'GPS ON' : 'GPS bật', value: gpsOn, xs: 12, md: 6, lg: 6 },
        { key: 'gpsOff', title: isEn ? 'GPS OFF' : 'GPS tắt', value: gpsOff, xs: 12, md: 6, lg: 6 },
        { key: 'sosOn', title: isEn ? 'SOS ON' : 'SOS bật', value: sosOn, xs: 12, md: 6, lg: 6 },
        { key: 'sosOff', title: isEn ? 'SOS OFF' : 'SOS tắt', value: sosOff, xs: 12, md: 6, lg: 6 },
        {
            key: 'satAvg',
            title: isEn ? 'Avg satellites' : 'Số vệ tinh TB',
            value: round(gpsSatAvg, 1),
            xs: 12,
            md: 6,
            lg: 6,
        },
    ];

    // ===== chart: daily counts + gps/sos ratio
    const byDay = new Map();

    cleanRows.forEach((r) => {
        const day = getDayKey(r);
        if (!day) return;

        const prev = byDay.get(day) || {
            day,
            records: 0,
            gpsOn: 0,
            sosOn: 0,
            satSum: 0,
            satCount: 0,
            vgpMax: null,
        };

        prev.records += 1;
        if (Number(r?.gps) === 1) prev.gpsOn += 1;
        if (Number(r?.sos) === 1) prev.sosOn += 1;

        if (r?.sat != null) {
            prev.satSum += Number(r.sat);
            prev.satCount += 1;
        }

        if (r?.vgp != null) {
            const nv = Number(r.vgp);
            prev.vgpMax = prev.vgpMax == null ? nv : Math.max(prev.vgpMax, nv);
        }

        byDay.set(day, prev);
    });

    const chartData = Array.from(byDay.values())
        .sort((a, b) => a.day.localeCompare(b.day))
        .map((d) => ({
            day: d.day,
            records: d.records,
            gpsOn: d.gpsOn,
            sosOn: d.sosOn,
            satAvg: round(d.satCount ? d.satSum / d.satCount : null, 1),
            vgpMax: d.vgpMax,
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
                { type: 'bar', dataKey: 'records', name: isEn ? 'Records' : 'Bản ghi', yAxisId: 'left' },
                { type: 'line', dataKey: 'gpsOn', name: isEn ? 'GPS ON' : 'GPS bật', yAxisId: 'right', dot: false },
                { type: 'line', dataKey: 'sosOn', name: isEn ? 'SOS ON' : 'SOS bật', yAxisId: 'right', dot: false },
                {
                    type: 'line',
                    dataKey: 'satAvg',
                    name: isEn ? 'Sat avg' : 'Vệ tinh TB',
                    yAxisId: 'right',
                    dot: false,
                },
            ],
        },
    ];

    return { kpis, charts };
}
