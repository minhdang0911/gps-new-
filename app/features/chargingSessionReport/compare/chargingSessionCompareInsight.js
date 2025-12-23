export function buildChargingSessionInsight(rows, ctx) {
    if (!rows || rows.length < 2) return null;

    const isEn = !!ctx?.isEn;
    const toNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    const title = (r) => r?.chargeCode || r?._id || r?.sessionId || 'Session';

    // NOTE: tuỳ API field năng lượng có thể khác nhau
    const getEnergy = (r) => toNum(r?.chargedEnergy ?? r?.energyKwh ?? r?.chargedKwh ?? r?.consumedKwh ?? 0);

    const pickMax = (arr, key) => arr.reduce((a, b) => (b[key] > a[key] ? b : a), arr[0]);
    const pickMin = (arr, key) => arr.reduce((a, b) => (b[key] < a[key] ? b : a), arr[0]);

    const safePct = (hi, lo) => (lo > 0 ? Math.round(((hi - lo) / lo) * 100) : null);

    const items = rows.map((r) => {
        const energy = getEnergy(r);
        const durationMinutes = toNum(r?.durationMinutes ?? r?.duration ?? 0);
        const socStart = toNum(r?.socStart ?? 0);
        const socEnd = toNum(r?.socEnd ?? 0);

        const avgPower = energy > 0 && durationMinutes > 0 ? +(energy / (durationMinutes / 60)).toFixed(2) : 0;

        return {
            title: title(r),
            energy,
            durationMinutes,
            avgPower, // kW
            deltaSoc: socEnd - socStart,
            soh: toNum(r?.soh ?? 0),

            tempAvg: toNum(r?.tempAvg ?? 0),
            tempMax: toNum(r?.tempMax ?? 0),
            tempMin: toNum(r?.tempMin ?? 0),

            voltageAvg: toNum(r?.voltageAvg ?? 0),
            voltageMax: toNum(r?.voltageMax ?? 0),
            voltageMin: toNum(r?.voltageMin ?? 0),

            startTime: r?.startTime || r?.chargeTimestamp || r?.createdAt || null,
            endTime: r?.endTime || null,
        };
    });

    const lines = [];
    const warnings = [];

    // 1) Energy max/min + tooltip %
    const maxEnergy = pickMax(items, 'energy');
    const minEnergy = pickMin(items, 'energy');

    if (maxEnergy.energy > 0) {
        lines.push({
            text: isEn
                ? `Highest charged energy: ${maxEnergy.title} (${maxEnergy.energy} kWh).`
                : `Sạc nhiều nhất: ${maxEnergy.title} (${maxEnergy.energy} kWh).`,
        });

        if (minEnergy.energy > 0 && maxEnergy.energy !== minEnergy.energy) {
            const pct = safePct(maxEnergy.energy, minEnergy.energy);
            if (pct !== null) {
                lines.push({
                    text: isEn ? `Higher by ~${pct}% vs. the lowest.` : `Cao hơn ~${pct}% so với thấp nhất.`,
                    tooltip: {
                        formula: `(${maxEnergy.energy} − ${minEnergy.energy}) / ${minEnergy.energy} × 100%`,
                        value: `${pct}%`,
                        explain: isEn ? 'Relative comparison of charged energy' : 'So sánh tương đối năng lượng sạc',
                    },
                });
            }
        }
    }

    // 2) Duration max/min + tooltip %
    const maxDur = pickMax(items, 'durationMinutes');
    const minDur = pickMin(items, 'durationMinutes');

    if (maxDur.durationMinutes > 0) {
        lines.push({
            text: isEn
                ? `Longest charging duration: ${maxDur.title} (${maxDur.durationMinutes} min).`
                : `Thời lượng sạc lâu nhất: ${maxDur.title} (${maxDur.durationMinutes} phút).`,
        });

        if (minDur.durationMinutes > 0 && maxDur.durationMinutes !== minDur.durationMinutes) {
            const pct = safePct(maxDur.durationMinutes, minDur.durationMinutes);
            if (pct !== null) {
                lines.push({
                    text: isEn ? `Longer by ~${pct}% vs. the shortest.` : `Lâu hơn ~${pct}% so với ngắn nhất.`,
                    tooltip: {
                        formula: `(${maxDur.durationMinutes} − ${minDur.durationMinutes}) / ${minDur.durationMinutes} × 100%`,
                        value: `${pct}%`,
                        explain: isEn ? 'Relative comparison of duration' : 'So sánh tương đối thời lượng',
                    },
                });
            }
        }
    }

    // 3) Avg power max/min + tooltip %
    const maxP = pickMax(items, 'avgPower');
    const minP = pickMin(items, 'avgPower');

    if (maxP.avgPower > 0) {
        lines.push({
            text: isEn
                ? `Fastest average charging power: ${maxP.title} (~${maxP.avgPower} kW).`
                : `Công suất sạc TB cao nhất: ${maxP.title} (~${maxP.avgPower} kW).`,
        });

        if (minP.avgPower > 0 && maxP.avgPower !== minP.avgPower) {
            const pct = safePct(maxP.avgPower, minP.avgPower);
            if (pct !== null) {
                lines.push({
                    text: isEn ? `Higher by ~${pct}% vs. the slowest.` : `Cao hơn ~${pct}% so với thấp nhất.`,
                    tooltip: {
                        formula: `(${maxP.avgPower} − ${minP.avgPower}) / ${minP.avgPower} × 100%`,
                        value: `${pct}%`,
                        explain: isEn ? 'Relative comparison of average power' : 'So sánh tương đối công suất TB',
                    },
                });
            }
        }
    }

    // 5) SOH best/worst
    const bestSoh = pickMax(items, 'soh');
    const worstSoh = pickMin(items, 'soh');

    if (bestSoh.soh > 0) {
        lines.push({
            text: isEn
                ? `Best SOH: ${bestSoh.title} (${bestSoh.soh}%). Lowest SOH: ${worstSoh.title} (${worstSoh.soh}%).`
                : `SOH tốt nhất: ${bestSoh.title} (${bestSoh.soh}%). SOH thấp nhất: ${worstSoh.title} (${worstSoh.soh}%).`,
        });
    }

    // 6) Temperature hottest + warning threshold
    const hottest = pickMax(items, 'tempMax');
    if (hottest.tempMax > 0) {
        lines.push({
            text: isEn
                ? `Hottest session: ${hottest.title} (max ${hottest.tempMax}°C, avg ${hottest.tempAvg}°C).`
                : `Phiên nóng nhất: ${hottest.title} (max ${hottest.tempMax}°C, TB ${hottest.tempAvg}°C).`,
        });

        // ngưỡng tuỳ bạn chỉnh
        if (hottest.tempMax >= 45) {
            warnings.push(
                isEn
                    ? `High temperature detected (max ${hottest.tempMax}°C). Consider checking cooling/charging conditions.`
                    : `Nhiệt độ cao (max ${hottest.tempMax}°C). Nên kiểm tra điều kiện làm mát/điều kiện sạc.`,
            );
        }
    }

    // 7) Voltage spread (dao động)
    const widestV = items.reduce((best, cur) => {
        const spread = cur.voltageMax - cur.voltageMin;
        const bestSpread = best.voltageMax - best.voltageMin;
        return spread > bestSpread ? cur : best;
    }, items[0]);

    const vSpread = widestV.voltageMax - widestV.voltageMin || 0;
    if (widestV.voltageMax > 0 && widestV.voltageMin > 0) {
        lines.push({
            text: isEn
                ? `Largest voltage fluctuation: ${widestV.title} (~${vSpread.toFixed(2)} V).`
                : `Dao động điện áp lớn nhất: ${widestV.title} (~${vSpread.toFixed(2)} V).`,
            tooltip: {
                formula: `${widestV.voltageMax} − ${widestV.voltageMin}`,
                value: `${vSpread.toFixed(2)} V`,
                explain: isEn ? 'Voltage fluctuation within a session' : 'Mức dao động điện áp trong một phiên',
            },
        });

        // ngưỡng tuỳ hệ của bạn
        if (vSpread >= 3) {
            warnings.push(
                isEn
                    ? `Voltage fluctuation is high (~${vSpread.toFixed(2)} V).`
                    : `Dao động điện áp khá cao (~${vSpread.toFixed(2)} V).`,
            );
        }
    }

    return {
        headline: isEn ? 'Conclusion' : 'Kết luận',
        lines,
        warnings,
    };
}
