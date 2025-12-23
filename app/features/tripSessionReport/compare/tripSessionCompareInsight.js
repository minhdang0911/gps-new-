export function buildTripSessionInsight(rows, ctx) {
    if (!rows || rows.length < 2) return null;

    const isEn = !!ctx?.isEn;
    const toNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    const title = (r) => r?.tripCode || r?._id || r?.sessionId || 'Trip';

    // common trip fields (fallback theo nhiều naming)
    const getDistance = (r) => toNum(r?.distanceKm ?? r?.distance ?? r?.km ?? 0);
    const getDurationMin = (r) => toNum(r?.durationMinutes ?? r?.durationMin ?? r?.duration ?? 0);
    const getConsumedPercent = (r) => toNum(r?.consumedPercent ?? r?.socDrop ?? 0);
    const getSpeedAvg = (r) => toNum(r?.speedAvg ?? r?.avgSpeed ?? 0);
    const getSoh = (r) => toNum(r?.soh ?? 0);

    const items = rows.map((r) => {
        const distance = getDistance(r);
        const consumedPercent = getConsumedPercent(r);
        const durationMinutes = getDurationMin(r);

        return {
            title: title(r),
            distance,
            consumedPercent,
            durationMinutes,
            speedAvg: getSpeedAvg(r),
            soh: getSoh(r),
            effKmPerPercent: consumedPercent > 0 ? distance / consumedPercent : 0,
            kmPerMin: durationMinutes > 0 ? distance / durationMinutes : 0,
        };
    });

    const byMax = (k) => items.reduce((a, b) => (b[k] > a[k] ? b : a), items[0]);
    const byMin = (k) => items.reduce((a, b) => (b[k] < a[k] ? b : a), items[0]);

    const maxDist = byMax('distance');
    const maxSpeed = byMax('speedAvg');

    const maxConsumed = byMax('consumedPercent');
    const minConsumed = byMin('consumedPercent');

    const bestEff = byMax('effKmPerPercent');
    const worstEff = byMin('effKmPerPercent');

    const bestSoh = byMax('soh');
    const worstSoh = byMin('soh');

    const lines = [];

    if (maxDist.distance > 0) {
        lines.push({
            text: isEn
                ? `Longest trip: ${maxDist.title} (${maxDist.distance} km).`
                : `Chuyến dài nhất: ${maxDist.title} (${maxDist.distance} km).`,
        });
    }

    if (maxSpeed.speedAvg > 0) {
        lines.push({
            text: isEn
                ? `Highest avg speed: ${maxSpeed.title} (${maxSpeed.speedAvg}).`
                : `Tốc độ TB cao nhất: ${maxSpeed.title} (${maxSpeed.speedAvg}).`,
        });
    }

    if (maxConsumed.consumedPercent > 0) {
        lines.push({
            // KHÔNG cần tooltip
            text: isEn
                ? `Most battery used: ${maxConsumed.title} (${maxConsumed.consumedPercent}%).`
                : `Hao pin nhiều nhất: ${maxConsumed.title} (${maxConsumed.consumedPercent}%).`,
        });

        // tooltip chỉ cho so sánh tương đối
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
                        ? 'Relative comparison vs. lowest battery usage'
                        : 'So sánh tương đối so với thấp nhất',
                },
            });
        }
    }

    if (bestEff.effKmPerPercent > 0) {
        lines.push({
            text: isEn
                ? `Best efficiency: ${bestEff.title} (${bestEff.effKmPerPercent.toFixed(2)} km/%).`
                : `Hiệu suất tốt nhất: ${bestEff.title} (${bestEff.effKmPerPercent.toFixed(2)} km/%).`,
        });
        lines.push({
            text: isEn
                ? `Lowest efficiency: ${worstEff.title} (${worstEff.effKmPerPercent.toFixed(2)} km/%).`
                : `Hiệu suất thấp nhất: ${worstEff.title} (${worstEff.effKmPerPercent.toFixed(2)} km/%).`,
        });
    }

    if (bestSoh.soh > 0) {
        lines.push({
            text: isEn
                ? `Best SOH: ${bestSoh.title} (${bestSoh.soh}%). Lowest SOH: ${worstSoh.title} (${worstSoh.soh}%).`
                : `SOH tốt nhất: ${bestSoh.title} (${bestSoh.soh}%). SOH thấp nhất: ${worstSoh.title} (${worstSoh.soh}%).`,
        });
    }

    return {
        headline: isEn ? 'Conclusion' : 'Kết luận',
        lines,
        warnings: [],
    };
}
