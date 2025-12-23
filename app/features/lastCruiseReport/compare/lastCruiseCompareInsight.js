export function buildLastCruiseInsight(rows, ctx) {
    if (!rows || rows.length < 2) return null;

    const isEn = !!ctx?.isEn;
    const title = (r) => r?.license_plate || r?.dev || r?.imei || 'Device';

    const toNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

    const toBool = (v) => {
        if (v === true) return true;
        if (v === false) return false;

        if (typeof v === 'number') return v !== 0;
        if (typeof v === 'string') {
            const s = v.trim().toLowerCase();
            if (['1', 'true', 'on', 'yes', 'enable', 'enabled'].includes(s)) return true;
            if (['0', 'false', 'off', 'no', 'disable', 'disabled', ''].includes(s)) return false;
        }
        return false;
    };

    // RULE: gpsStatus = 1 => LOST ; 0/null/'' => NORMAL
    const getGpsLost = (r) => toBool(r?.gpsStatus ?? r?.gps ?? r?.gps_lost);

    // SOS: 1 => ON
    const getSosOn = (r) => toBool(r?.sosStatus ?? r?.sos ?? r?.sos_on);

    const items = rows.map((r) => {
        const sat = toNum(r?.sat ?? r?.satellite ?? 0);
        const vgp = toNum(r?.vgp ?? r?.gpsVoltage ?? 0); // sample có vgp: 8.35
        const tim = r?.tim ?? r?.time ?? r?.updatedAt ?? r?.createdAt ?? null;

        return {
            title: title(r),
            gpsLost: getGpsLost(r),
            sosOn: getSosOn(r),

            sat,
            vgp,
            tim,

            lat: toNum(r?.lat ?? 0),
            lon: toNum(r?.lon ?? r?.lng ?? 0),
            fwr: r?.fwr ?? null,
        };
    });

    const total = items.length;

    const gpsLostCount = items.filter((x) => x.gpsLost).length;
    const gpsOkCount = total - gpsLostCount;
    const sosOnCount = items.filter((x) => x.sosOn).length;

    // Extra comparisons
    const pickMax = (arr, key) => arr.reduce((a, b) => (b[key] > a[key] ? b : a), arr[0]);
    const pickMin = (arr, key) => arr.reduce((a, b) => (b[key] < a[key] ? b : a), arr[0]);

    const maxSat = pickMax(items, 'sat');
    const minSat = pickMin(items, 'sat');

    const maxVgp = pickMax(items, 'vgp');
    const minVgp = pickMin(items, 'vgp');

    const lines = [
        {
            text: isEn
                ? `GPS lost: ${gpsLostCount}/${total}. GPS normal: ${gpsOkCount}/${total}.`
                : `GPS mất: ${gpsLostCount}/${total}. GPS bình thường: ${gpsOkCount}/${total}.`,
        },
        {
            text: isEn ? `SOS ON: ${sosOnCount}/${total}.` : `SOS bật: ${sosOnCount}/${total}.`,
        },
    ];

    // Satellite insight (chất lượng bắt GPS)
    if (maxSat.sat > 0) {
        lines.push({
            text: isEn
                ? `Best satellite count: ${maxSat.title} (${maxSat.sat}). Lowest: ${minSat.title} (${minSat.sat}).`
                : `Số vệ tinh cao nhất: ${maxSat.title} (${maxSat.sat}). Thấp nhất: ${minSat.title} (${minSat.sat}).`,
            tooltip:
                maxSat.sat !== minSat.sat
                    ? {
                          formula: `maxSat − minSat`,
                          value: `${maxSat.sat - minSat.sat}`,
                          explain: isEn
                              ? 'Satellite count spread (GPS signal quality)'
                              : 'Độ chênh số vệ tinh (chất lượng tín hiệu GPS)',
                      }
                    : undefined,
        });
    }

    // GPS voltage insight (vgp)
    if (maxVgp.vgp > 0) {
        lines.push({
            text: isEn
                ? `GPS voltage (vgp) highest: ${maxVgp.title} (${maxVgp.vgp} V). Lowest: ${minVgp.title} (${minVgp.vgp} V).`
                : `Điện áp GPS (vgp) cao nhất: ${maxVgp.title} (${maxVgp.vgp} V). Thấp nhất: ${minVgp.title} (${minVgp.vgp} V).`,
            tooltip:
                maxVgp.vgp !== minVgp.vgp
                    ? {
                          formula: `${maxVgp.vgp} − ${minVgp.vgp}`,
                          value: `${(maxVgp.vgp - minVgp.vgp).toFixed(2)} V`,
                          explain: isEn ? 'Voltage spread across devices' : 'Độ chênh điện áp giữa các thiết bị',
                      }
                    : undefined,
        });
    }

    const warnings = [];

    // Warnings theo trạng thái
    // if (gpsLostCount > 0) {
    //     warnings.push(isEn ? 'Some selected devices are GPS-lost.' : 'Có thiết bị đang mất GPS.');
    // }
    // if (sosOnCount > 0) {
    //     warnings.push(isEn ? 'Some selected devices have SOS ON.' : 'Có thiết bị đang bật SOS.');
    // }

    // Warning theo chất lượng tín hiệu
    // const lowSatDevices = items.filter((x) => x.sat > 0 && x.sat < 4);
    // if (lowSatDevices.length > 0) {
    //     warnings.push(
    //         isEn
    //             ? `Low satellite count detected on ${lowSatDevices.length}/${total} device(s) (<4).`
    //             : `Phát hiện số vệ tinh thấp ở ${lowSatDevices.length}/${total} thiết bị (<4).`,
    //     );
    // }

    // // Warning theo điện áp GPS (tuỳ ngưỡng bạn chỉnh)
    // const lowVgpDevices = items.filter((x) => x.vgp > 0 && x.vgp < 7.0);
    // if (lowVgpDevices.length > 0) {
    //     warnings.push(
    //         isEn
    //             ? `Low GPS voltage (vgp) detected on ${lowVgpDevices.length}/${total} device(s) (<7.0V).`
    //             : `Phát hiện điện áp GPS (vgp) thấp ở ${lowVgpDevices.length}/${total} thiết bị (<7.0V).`,
    //     );
    // }

    // Optional: list top offenders (ngắn gọn)
    // if (gpsLostCount > 0) {
    //     const offenders = items
    //         .filter((x) => x.gpsLost)
    //         .slice(0, 3)
    //         .map((x) => x.title);
    //     lines.push({
    //         text: isEn
    //             ? `Examples of GPS-lost devices: ${offenders.join(', ')}${gpsLostCount > 3 ? ', …' : ''}.`
    //             : `Ví dụ thiết bị mất GPS: ${offenders.join(', ')}${gpsLostCount > 3 ? ', …' : ''}.`,
    //     });
    // }

    return {
        headline: isEn ? 'Conclusion' : 'Kết luận',
        lines,
        warnings,
    };
}
