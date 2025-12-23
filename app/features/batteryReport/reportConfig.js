// features/batteryReport/reportConfig.js

const round = (n, digits = 2) => {
    if (n == null || Number.isNaN(Number(n))) return null;
    const p = Math.pow(10, digits);
    return Math.round(Number(n) * p) / p;
};

const getDayKey = (r) => {
    const ts = r?.date || r?.updatedAt || r?.createdAt || null;
    if (!ts) return null;
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
};

export function buildBatteryReportConfig({ rows = [], isEn, t }) {
    const cleanRows = (rows || []).filter((r) => !r?.__group);

    const total = cleanRows.length;

    const online = cleanRows.reduce((c, r) => c + (r?.connectionStatus === 'online' ? 1 : 0), 0);
    const offline = cleanRows.reduce((c, r) => c + (r?.connectionStatus === 'offline' ? 1 : 0), 0);

    const running = cleanRows.reduce((c, r) => c + (r?.utilization === 'RUNNING' ? 1 : 0), 0);
    const stop = cleanRows.reduce((c, r) => c + (r?.utilization === 'STOP' ? 1 : 0), 0);

    const sumMileage = cleanRows.reduce((s, r) => s + Number(r?.mileageToday || 0), 0);
    const sumKwh = cleanRows.reduce((s, r) => s + Number(r?.consumedKwToday || r?.wattageConsumedToday || 0), 0);
    const sumConsumedPct = cleanRows.reduce(
        (s, r) => s + Number(r?.consumedPercentToday || r?.batteryConsumedToday || 0),
        0,
    );

    const avgTemp = (() => {
        let s = 0;
        let c = 0;
        cleanRows.forEach((r) => {
            const v = r?.tempAvgToday;
            if (v == null) return;
            s += Number(v);
            c += 1;
        });
        return c ? s / c : null;
    })();

    const avgRealtimeSoc = (() => {
        let s = 0;
        let c = 0;
        cleanRows.forEach((r) => {
            const v = r?.realtime_soc;
            if (v == null) return;
            s += Number(v);
            c += 1;
        });
        return c ? s / c : null;
    })();

    const avgRealtimeSoh = (() => {
        let s = 0;
        let c = 0;
        cleanRows.forEach((r) => {
            const v = r?.realtime_soh;
            if (v == null) return;
            s += Number(v);
            c += 1;
        });
        return c ? s / c : null;
    })();

    const maxVoltage = cleanRows.reduce((m, r) => {
        const v = r?.voltageMaxToday ?? r?.realtime_voltage ?? null;
        if (v == null) return m;
        const nv = Number(v);
        return m == null ? nv : Math.max(m, nv);
    }, null);

    const kwhPerKm = sumMileage > 0 ? sumKwh / sumMileage : null;

    const kpis = [
        { key: 'records', title: isEn ? 'Records' : 'Bản ghi', value: total, xs: 12, md: 6, lg: 6 },

        { key: 'running', title: isEn ? 'RUNNING' : 'RUNNING', value: running, xs: 12, md: 6, lg: 6 },
        { key: 'stop', title: isEn ? 'STOP' : 'STOP', value: stop, xs: 12, md: 6, lg: 6 },

        {
            key: 'mileage',
            title: isEn ? 'Mileage (km)' : 'Quãng đường (km)',
            value: round(sumMileage, 2),
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
        { key: 'kwhPerKm', title: isEn ? 'kWh / km' : 'kWh / km', value: round(kwhPerKm, 3), xs: 12, md: 6, lg: 6 },
        {
            key: 'pct',
            title: isEn ? 'Consumed (%)' : 'Tiêu thụ (%)',
            value: round(sumConsumedPct, 0),
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
            key: 'soc',
            title: isEn ? 'Avg SOC realtime' : 'SOC realtime TB',
            value: round(avgRealtimeSoc, 1),
            xs: 12,
            md: 6,
            lg: 6,
        },
        {
            key: 'soh',
            title: isEn ? 'Avg SOH realtime' : 'SOH realtime TB',
            value: round(avgRealtimeSoh, 1),
            xs: 12,
            md: 6,
            lg: 6,
        },
        { key: 'vmax', title: isEn ? 'Max voltage' : 'Điện áp max', value: maxVoltage, xs: 12, md: 6, lg: 6 },
    ];

    // ===== chart: group by day
    const byDay = new Map();

    cleanRows.forEach((r) => {
        const day = getDayKey(r);
        if (!day) return;

        const prev = byDay.get(day) || {
            day,
            records: 0,
            mileage: 0,
            kwh: 0,
            consumedPct: 0,
            chargingCount: 0,
            online: 0,
            offline: 0,
            tempSum: 0,
            tempCount: 0,
        };

        prev.records += 1;
        prev.mileage += Number(r?.mileageToday || 0);
        prev.kwh += Number(r?.consumedKwToday || r?.wattageConsumedToday || 0);
        prev.consumedPct += Number(r?.consumedPercentToday || r?.batteryConsumedToday || 0);
        prev.chargingCount += Number(r?.numberOfChargingToday || 0);

        if (r?.connectionStatus === 'online') prev.online += 1;
        if (r?.connectionStatus === 'offline') prev.offline += 1;

        if (r?.tempAvgToday != null) {
            prev.tempSum += Number(r.tempAvgToday);
            prev.tempCount += 1;
        }

        byDay.set(day, prev);
    });

    const chartData = Array.from(byDay.values())
        .sort((a, b) => a.day.localeCompare(b.day))
        .map((d) => ({
            day: d.day,
            records: d.records,
            mileage: round(d.mileage, 2),
            kwh: round(d.kwh, 2),
            consumedPct: round(d.consumedPct, 0),
            chargingCount: d.chargingCount,
            tempAvg: round(d.tempCount ? d.tempSum / d.tempCount : null, 1),
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
                { type: 'bar', dataKey: 'kwh', name: isEn ? 'Energy (kWh)' : 'Điện (kWh)', yAxisId: 'left' },
                {
                    type: 'line',
                    dataKey: 'mileage',
                    name: isEn ? 'Mileage (km)' : 'Quãng đường (km)',
                    yAxisId: 'right',
                    dot: false,
                },
                {
                    type: 'line',
                    dataKey: 'consumedPct',
                    name: isEn ? 'Consumed (%)' : 'Tiêu thụ (%)',
                    yAxisId: 'right',
                    dot: false,
                },
                {
                    type: 'line',
                    dataKey: 'tempAvg',
                    name: isEn ? 'Avg temp' : 'Nhiệt độ TB',
                    yAxisId: 'right',
                    dot: false,
                },
            ],
        },
    ];

    return { kpis, charts };
}
