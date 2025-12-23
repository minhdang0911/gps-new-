// features/chargingSessionReport/reportConfig.js

const round = (n, digits = 2) => {
    if (n == null || Number.isNaN(Number(n))) return null;
    const p = Math.pow(10, digits);
    return Math.round(Number(n) * p) / p;
};

const safeNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

const parseTime = (v) => {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
};

const minutesBetween = (start, end) => {
    const s = parseTime(start);
    const e = parseTime(end);
    if (!s || !e) return null;
    const ms = e.getTime() - s.getTime();
    if (ms < 0) return null;
    return ms / 60000;
};

// dùng startTime nếu có, fallback chargeTimestamp
const getSessionTime = (r) => r?.startTime || r?.chargeTimestamp || r?.createdAt || null;

// group key YYYY-MM-DD
const getDayKey = (r) => {
    const ts = getSessionTime(r);
    if (!ts) return null;
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
};

export function buildChargingSessionReportConfig({ rows = [], isEn, t }) {
    const cleanRows = (rows || []).filter((r) => !r?.__group);

    // ---------- KPI ----------
    const totalSessions = cleanRows.length;

    let sumDuration = 0;
    let cDuration = 0;

    let sumDeltaSoc = 0;
    let cDeltaSoc = 0;

    let sumTempAvg = 0;
    let cTempAvg = 0;

    let maxTempMax = null;

    let sumVoltageAvg = 0;
    let cVoltageAvg = 0;

    let sumSoh = 0;
    let cSoh = 0;

    cleanRows.forEach((r) => {
        // duration (minutes)
        const dur = minutesBetween(r?.startTime, r?.endTime);
        if (dur != null) {
            sumDuration += dur;
            cDuration += 1;
        }

        // delta SOC
        const socStart = r?.socStart;
        const socEnd = r?.socEnd;
        if (socStart != null && socEnd != null) {
            const delta = safeNum(socEnd) - safeNum(socStart);
            sumDeltaSoc += delta;
            cDeltaSoc += 1;
        }

        // temp avg / max
        if (r?.tempAvg != null) {
            sumTempAvg += safeNum(r.tempAvg);
            cTempAvg += 1;
        }
        if (r?.tempMax != null) {
            const v = safeNum(r.tempMax);
            maxTempMax = maxTempMax == null ? v : Math.max(maxTempMax, v);
        }

        // voltage avg
        if (r?.voltageAvg != null) {
            sumVoltageAvg += safeNum(r.voltageAvg);
            cVoltageAvg += 1;
        }

        // soh
        if (r?.soh != null) {
            sumSoh += safeNum(r.soh);
            cSoh += 1;
        }
    });

    const avgDuration = cDuration ? sumDuration / cDuration : null;
    const avgDeltaSoc = cDeltaSoc ? sumDeltaSoc / cDeltaSoc : null;
    const avgTempAvg = cTempAvg ? sumTempAvg / cTempAvg : null;
    const avgVoltageAvg = cVoltageAvg ? sumVoltageAvg / cVoltageAvg : null;
    const avgSoh = cSoh ? sumSoh / cSoh : null;

    // KPI items -> dùng cho ReportKpiGrid
    const kpis = [
        {
            key: 'sessions',
            title: isEn ? 'Sessions' : 'Số phiên sạc',
            value: totalSessions,
            xs: 12,
            md: 6,
            lg: 6,
        },
        {
            key: 'avgDuration',
            title: isEn ? 'Avg duration (min)' : 'Thời lượng TB (phút)',
            value: round(avgDuration, 1),
            xs: 12,
            md: 6,
            lg: 6,
        },

        {
            key: 'avgVoltage',
            title: isEn ? 'Avg voltage (V)' : 'Điện áp TB (V)',
            value: round(avgVoltageAvg, 2),
            xs: 12,
            md: 6,
            lg: 6,
        },
        {
            key: 'avgTemp',
            title: isEn ? 'Avg temp (°C)' : 'Nhiệt độ TB (°C)',
            value: round(avgTempAvg, 1),
            xs: 12,
            md: 6,
            lg: 6,
        },
        {
            key: 'maxTemp',
            title: isEn ? 'Max temp (°C)' : 'Nhiệt độ max (°C)',
            value: maxTempMax,
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

    // ---------- CHART (group by day) ----------
    const byDay = new Map();

    cleanRows.forEach((r) => {
        const day = getDayKey(r);
        if (!day) return;

        const prev = byDay.get(day) || {
            day,
            sessions: 0,
            durationMinSum: 0,
            durationMinCount: 0,
            deltaSocSum: 0,
            deltaSocCount: 0,
            tempMax: null,
            voltageAvgSum: 0,
            voltageAvgCount: 0,
            sohSum: 0,
            sohCount: 0,
        };

        prev.sessions += 1;

        const dur = minutesBetween(r?.startTime, r?.endTime);
        if (dur != null) {
            prev.durationMinSum += dur;
            prev.durationMinCount += 1;
        }

        if (r?.socStart != null && r?.socEnd != null) {
            const delta = safeNum(r.socEnd) - safeNum(r.socStart);
            prev.deltaSocSum += delta;
            prev.deltaSocCount += 1;
        }

        if (r?.tempMax != null) {
            const v = safeNum(r.tempMax);
            prev.tempMax = prev.tempMax == null ? v : Math.max(prev.tempMax, v);
        }

        if (r?.voltageAvg != null) {
            prev.voltageAvgSum += safeNum(r.voltageAvg);
            prev.voltageAvgCount += 1;
        }

        if (r?.soh != null) {
            prev.sohSum += safeNum(r.soh);
            prev.sohCount += 1;
        }

        byDay.set(day, prev);
    });

    const chartData = Array.from(byDay.values())
        .sort((a, b) => a.day.localeCompare(b.day))
        .map((d) => {
            const avgDur = d.durationMinCount ? d.durationMinSum / d.durationMinCount : null;
            const avgDelta = d.deltaSocCount ? d.deltaSocSum / d.deltaSocCount : null;
            const avgVolt = d.voltageAvgCount ? d.voltageAvgSum / d.voltageAvgCount : null;
            const avgS = d.sohCount ? d.sohSum / d.sohCount : null;

            return {
                day: d.day,
                sessions: d.sessions,
                avgDuration: round(avgDur, 1),
                avgDeltaSoc: round(avgDelta, 1),
                tempMax: d.tempMax,
                avgVoltage: round(avgVolt, 2),
                avgSoh: round(avgS, 1),
            };
        });

    const charts = [
        {
            key: 'daily',
            title: isEn ? 'Daily trend' : 'Xu hướng theo ngày',
            height: 340,
            data: chartData,
            xKey: 'day',
            yAxes: [{ id: 'left' }, { id: 'right', orientation: 'right' }],
            series: [
                { type: 'bar', dataKey: 'sessions', name: isEn ? 'Sessions' : 'Phiên', yAxisId: 'left' },
                {
                    type: 'line',
                    dataKey: 'avgDeltaSoc',
                    name: isEn ? 'Avg ΔSOC' : 'ΔSOC TB',
                    yAxisId: 'right',
                    dot: false,
                },
                {
                    type: 'line',
                    dataKey: 'avgVoltage',
                    name: isEn ? 'Avg voltage (V)' : 'Điện áp TB (V)',
                    yAxisId: 'right',
                    dot: false,
                },
                {
                    type: 'line',
                    dataKey: 'tempMax',
                    name: isEn ? 'Max temp (°C)' : 'Nhiệt độ max (°C)',
                    yAxisId: 'right',
                    dot: false,
                },
            ],
        },
    ];

    // ReportPanel expects: { kpis, charts }
    return { kpis, charts };
}
