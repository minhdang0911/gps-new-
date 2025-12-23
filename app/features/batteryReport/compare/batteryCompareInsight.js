export function buildBatteryInsight(rows, ctx) {
    if (!rows || rows.length < 2) return null;

    const isEn = !!ctx?.isEn;
    const toNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

    const title = (r) => r?.license_plate || r?.batteryId || r?.imei || r?.date || 'Battery';

    const pickTodayOrRealtime = (r) => {
        const consumedPercentToday = toNum(r?.consumedPercentToday ?? r?.batteryConsumedToday ?? 0);
        const consumedKwToday = toNum(r?.consumedKwToday ?? r?.wattageConsumedToday ?? 0);
        const mileageToday = toNum(r?.mileageToday ?? 0);
        const sohToday = toNum(r?.sohToday ?? 0);
        const socToday = toNum(r?.socToday ?? 0);

        const hasTodaySignal =
            consumedPercentToday > 0 || consumedKwToday > 0 || mileageToday > 0 || sohToday > 0 || socToday > 0;

        if (hasTodaySignal) {
            return {
                mode: 'today',
                consumedPercent: consumedPercentToday,
                consumedKwh: consumedKwToday,
                mileage: mileageToday,
                soh: sohToday,
                soc: socToday,
            };
        }

        // fallback realtime
        return {
            mode: 'realtime',
            consumedPercent: 0,
            consumedKwh: 0,
            mileage: 0,
            soh: toNum(r?.realtime_soh ?? 0),
            soc: toNum(r?.realtime_soc ?? 0),
            voltage: toNum(r?.realtime_voltage ?? 0),
            temperature: toNum(r?.realtime_temperature ?? 0),
        };
    };

    const items = rows.map((r) => {
        const picked = pickTodayOrRealtime(r);
        const kmPerPercent = picked.consumedPercent > 0 ? picked.mileage / picked.consumedPercent : 0;

        return {
            title: title(r),
            mode: picked.mode,
            ...picked,
            kmPerPercent,
        };
    });

    const allMode = items.every((x) => x.mode === 'realtime') ? 'realtime' : 'today';

    const byMax = (k) => items.reduce((a, b) => (b[k] > a[k] ? b : a), items[0]);
    const byMin = (k) => items.reduce((a, b) => (b[k] < a[k] ? b : a), items[0]);

    const lines = [];

    // header nói rõ đang dùng nguồn nào
    lines.push({
        text: isEn
            ? `Comparison source: ${allMode === 'today' ? 'Today fields' : 'Realtime fields (fallback)'}.`
            : `Nguồn so sánh: ${allMode === 'today' ? 'Dữ liệu Today' : 'Dữ liệu Realtime (fallback)'}.`,
    });

    if (allMode === 'today') {
        const maxConsumed = byMax('consumedPercent');
        const minConsumed = byMin('consumedPercent');

        if (maxConsumed.consumedPercent > 0) {
            lines.push({
                text: isEn
                    ? `Most battery consumed today: ${maxConsumed.title} (${maxConsumed.consumedPercent}%).`
                    : `Tiêu thụ pin nhiều nhất hôm nay: ${maxConsumed.title} (${maxConsumed.consumedPercent}%).`,
            });

            if (minConsumed.consumedPercent > 0 && maxConsumed.consumedPercent !== minConsumed.consumedPercent) {
                const maxV = maxConsumed.consumedPercent;
                const minV = minConsumed.consumedPercent;
                const pct = Math.round(((maxV - minV) / minV) * 100);

                lines.push({
                    text: isEn ? `Higher by ~${pct}% vs. the lowest.` : `Cao hơn ~${pct}% so với thấp nhất.`,
                    tooltip: {
                        formula: `(${maxV} − ${minV}) / ${minV} × 100%`,
                        value: `${pct}%`,
                        explain: isEn
                            ? 'Relative comparison against the lowest consumedPercentToday'
                            : 'So sánh tương đối so với consumedPercentToday thấp nhất',
                    },
                });
            }
        } else {
            lines.push({
                text: isEn ? 'Battery consumption: not enough today data.' : 'Tiêu thụ pin: chưa đủ dữ liệu Today.',
            });
        }

        const bestEff = byMax('kmPerPercent');
        if (bestEff.kmPerPercent > 0) {
            lines.push({
                text: isEn
                    ? `Best efficiency: ${bestEff.title} (${bestEff.kmPerPercent.toFixed(2)} km/%).`
                    : `Hiệu suất tốt nhất: ${bestEff.title} (${bestEff.kmPerPercent.toFixed(2)} km/%).`,
                tooltip: {
                    formula: `mileageToday / consumedPercentToday`,
                    value: `${bestEff.kmPerPercent.toFixed(2)} km/%`,
                    explain: isEn ? 'Higher is better' : 'Càng cao càng tốt',
                },
            });
        }

        const bestSoh = byMax('soh');
        const worstSoh = byMin('soh');
        if (bestSoh.soh > 0 || worstSoh.soh > 0) {
            lines.push({
                text: isEn
                    ? `SOH highest: ${bestSoh.title} (${bestSoh.soh}%). SOH lowest: ${worstSoh.title} (${worstSoh.soh}%).`
                    : `SOH cao nhất: ${bestSoh.title} (${bestSoh.soh}%). SOH thấp nhất: ${worstSoh.title} (${worstSoh.soh}%).`,
            });
        }
    } else {
        // realtime mode
        const bestSoc = byMax('soc');
        const worstSoc = byMin('soc');
        if (bestSoc.soc > 0 || worstSoc.soc > 0) {
            lines.push({
                text: isEn
                    ? `Realtime SOC highest: ${bestSoc.title} (${bestSoc.soc}%). Lowest: ${worstSoc.title} (${worstSoc.soc}%).`
                    : `SOC realtime cao nhất: ${bestSoc.title} (${bestSoc.soc}%). Thấp nhất: ${worstSoc.title} (${worstSoc.soc}%).`,
            });
        }

        const bestSoh = byMax('soh');
        const worstSoh = byMin('soh');
        if (bestSoh.soh > 0 || worstSoh.soh > 0) {
            lines.push({
                text: isEn
                    ? `Realtime SOH highest: ${bestSoh.title} (${bestSoh.soh}%). Lowest: ${worstSoh.title} (${worstSoh.soh}%).`
                    : `SOH realtime cao nhất: ${bestSoh.title} (${bestSoh.soh}%). Thấp nhất: ${worstSoh.title} (${worstSoh.soh}%).`,
            });
        }

        const bestVolt = byMax('voltage');
        const worstVolt = byMin('voltage');
        if ((bestVolt.voltage ?? 0) > 0 || (worstVolt.voltage ?? 0) > 0) {
            lines.push({
                text: isEn
                    ? `Realtime voltage max: ${bestVolt.title} (${bestVolt.voltage}). Min: ${worstVolt.title} (${worstVolt.voltage}).`
                    : `Điện áp realtime cao nhất: ${bestVolt.title} (${bestVolt.voltage}). Thấp nhất: ${worstVolt.title} (${worstVolt.voltage}).`,
            });
        }
    }

    return {
        headline: isEn ? 'Conclusion' : 'Kết luận',
        lines,
        warnings: [],
    };
}
