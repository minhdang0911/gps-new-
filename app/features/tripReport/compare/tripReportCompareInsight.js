export function buildTripReportInsight(rows, ctx) {
    if (!rows || rows.length < 2) return null;
    const isEn = !!ctx?.isEn;

    const toNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    const title = (r) => r?.license_plate || r?.imei || r?.motorcycleId || r?.date || 'Report';

    const items = rows.map((r) => {
        const mileage = toNum(r?.mileageToday ?? 0);
        const trips = toNum(r?.numberOfTrips ?? 0);
        const battery = toNum(r?.batteryConsumedToday ?? 0);
        const watt = toNum(r?.wattageConsumedToday ?? 0);

        return {
            title: title(r),
            mileage,
            trips,
            battery,
            watt,
            avgKmPerTrip: trips > 0 ? mileage / trips : 0,
        };
    });

    const byMax = (k) => items.reduce((a, b) => (b[k] > a[k] ? b : a), items[0]);
    const byMin = (k) => items.reduce((a, b) => (b[k] < a[k] ? b : a), items[0]);

    const maxMileage = byMax('mileage');
    const maxTrips = byMax('trips');
    const maxBattery = byMax('battery');
    const minBattery = byMin('battery');
    const bestAvg = byMax('avgKmPerTrip');

    const lines = [];

    if (maxMileage.mileage > 0) {
        lines.push({
            text: isEn
                ? `Highest mileage today: ${maxMileage.title} (${maxMileage.mileage} km).`
                : `Quãng đường cao nhất hôm nay: ${maxMileage.title} (${maxMileage.mileage} km).`,
        });
    }

    if (maxTrips.trips > 0) {
        lines.push({
            text: isEn
                ? `Most trips: ${maxTrips.title} (${maxTrips.trips}).`
                : `Nhiều chuyến nhất: ${maxTrips.title} (${maxTrips.trips}).`,
        });
    }

    if (maxBattery.battery > 0) {
        lines.push({
            text: isEn
                ? `Most battery consumed: ${maxBattery.title} (${maxBattery.battery}).`
                : `Tiêu thụ pin nhiều nhất: ${maxBattery.title} (${maxBattery.battery}).`,
        });

        if (minBattery.battery > 0 && maxBattery.battery !== minBattery.battery) {
            const maxV = maxBattery.battery;
            const minV = minBattery.battery;
            const pct = Math.round(((maxV - minV) / minV) * 100);

            lines.push({
                text: isEn ? `Higher by ~${pct}% vs. the lowest.` : `Cao hơn ~${pct}% so với thấp nhất.`,
                tooltip: {
                    formula: `(${maxV} − ${minV}) / ${minV} × 100%`,
                    value: `${pct}%`,
                    explain: isEn
                        ? 'Relative comparison vs. lowest battery consumption'
                        : 'So sánh tương đối so với thấp nhất',
                },
            });
        }
    }

    // if (bestAvg.avgKmPerTrip > 0) {
    //     lines.push({
    //         text: isEn
    //             ? `Best avg km/trip: ${bestAvg.title} (${bestAvg.avgKmPerTrip.toFixed(2)} km/trip).`
    //             : `TB km/chuyến tốt nhất: ${bestAvg.title} (${bestAvg.avgKmPerTrip.toFixed(2)} km/chuyến).`,
    //     });
    // }

    return {
        headline: isEn ? 'Conclusion' : 'Kết luận',
        lines,
        warnings: [],
    };
}
