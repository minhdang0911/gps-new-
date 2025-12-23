export function buildUsageSessionInsight(rows, ctx) {
    if (!rows || rows.length < 2) return null;

    const isEn = !!ctx?.isEn;
    const toNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    const title = (r) => r?.usageCode || r?._id || 'Row';

    const items = rows.map((r) => ({
        title: title(r),
        consumedPercent: toNum(r?.consumedPercent),
        distanceKm: toNum(r?.distanceKm),
        soh: toNum(r?.soh),
    }));

    const max = items.reduce((a, b) => (b.consumedPercent > a.consumedPercent ? b : a), items[0]);
    const min = items.reduce((a, b) => (b.consumedPercent < a.consumedPercent ? b : a), items[0]);

    const maxV = max.consumedPercent;
    const minV = min.consumedPercent;
    const pctMore = minV > 0 ? Math.round(((maxV - minV) / minV) * 100) : 0;

    const eff = items.map((x) => ({
        ...x,
        kmPerPercent: x.consumedPercent > 0 ? x.distanceKm / x.consumedPercent : 0,
    }));
    const bestEff = eff.reduce((a, b) => (b.kmPerPercent > a.kmPerPercent ? b : a), eff[0]);
    const worstEff = eff.reduce((a, b) => (b.kmPerPercent < a.kmPerPercent ? b : a), eff[0]);

    const bestSoh = items.reduce((a, b) => (b.soh > a.soh ? b : a), items[0]);
    const worstSoh = items.reduce((a, b) => (b.soh < a.soh ? b : a), items[0]);

    const lines = [];

    // ✅ dòng này: KHÔNG tooltip
    lines.push({
        text: isEn ? `Most battery usage: ${max.title} (${maxV}%).` : `Hao pin nhiều nhất: ${max.title} (${maxV}%).`,
    });

    // ✅ tooltip chỉ cho số tương đối
    if (pctMore) {
        lines.push({
            text: isEn ? `Higher by ~${pctMore}% vs. the lowest.` : `Cao hơn ~${pctMore}% so với thấp nhất.`,
            tooltip: {
                formula: `(${maxV} − ${minV}) / ${minV} × 100%`,
                value: `${pctMore}%`,
                explain: isEn
                    ? 'Relative increase vs. the lowest battery usage'
                    : 'So sánh tương đối so với session tiêu thụ pin thấp nhất',
            },
        });
    }

    if (bestEff.kmPerPercent > 0) {
        lines.push({
            text: isEn
                ? `Best efficiency: ${bestEff.title} (${bestEff.kmPerPercent.toFixed(2)} km/%).`
                : `Hiệu suất tốt nhất: ${bestEff.title} (${bestEff.kmPerPercent.toFixed(2)} km/%).`,
        });
        lines.push({
            text: isEn
                ? `Lowest efficiency: ${worstEff.title} (${worstEff.kmPerPercent.toFixed(2)} km/%).`
                : `Hiệu suất thấp nhất: ${worstEff.title} (${worstEff.kmPerPercent.toFixed(2)} km/%).`,
        });
    }

    if (bestSoh.soh > 0) {
        lines.push({
            text: isEn
                ? `Best SOH: ${bestSoh.title} (${bestSoh.soh}%). Worst SOH: ${worstSoh.title} (${worstSoh.soh}%).`
                : `SOH tốt nhất: ${bestSoh.title} (${bestSoh.soh}%). SOH thấp nhất: ${worstSoh.title} (${worstSoh.soh}%).`,
        });
    }

    return {
        headline: isEn ? 'Conclusion' : 'Kết luận',
        lines,
        warnings: [],
    };
}
