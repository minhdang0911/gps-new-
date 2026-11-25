'use client';

import React from 'react';
import { parseTimToDate, formatFixedDateTime } from '../../util/time';
import { toNumberOrNull } from '../../util/number';

export default function MonitorBatteryTab({
    liveTelemetry,
    batteryStatus,
    lastCruise,
    selectedDevice,
    isEn,
    t,
}) {
    const NA_TEXT = isEn ? 'N/A' : 'Chưa rõ';
    const src = liveTelemetry || {};
    const bs = batteryStatus || {};

    const soc = src.soc ?? bs.soc;
    const soh = src.soh ?? bs.soh;
    const voltage = src.vavg ?? src.vmax ?? src.vmin ?? bs.voltage;
    const temp = src.tavg ?? src.tmax ?? bs.temperature;
    const currentRaw = src.cur ?? bs.current;
    const chc = src.chc ?? bs.chc;

    const formatAmp = (val) => {
        const n = toNumberOrNull(val);
        if (n == null) return NA_TEXT;
        const abs = Math.abs(n);
        const s = abs.toFixed(2).replace('.', ',');
        return `${s}A`;
    };

    let mode = t.battery.unknown;
    let currentLine = t.battery.currentLineDefault;

    const cur = toNumberOrNull(currentRaw);

    if (cur == null) {
        mode = t.battery.unknown;
        currentLine = t.battery.currentLineDefault;
    } else if (cur > 0) {
        mode = t.battery.charging;
        currentLine = `${t.battery.chargeCurrent} ${formatAmp(cur)}`;
    } else if (cur < 0) {
        mode = t.battery.discharging;
        currentLine = `${t.battery.dischargeCurrent} ${formatAmp(cur)}`;
    } else {
        mode = t.battery.idle;
        currentLine = t.battery.currentIdle;
    }

    const updatedAt = src.tim
        ? parseTimToDate(src.tim)?.toLocaleString()
        : bs.updatedAt
          ? formatFixedDateTime(new Date(bs.updatedAt))
          : NA_TEXT;

    const canVal = toNumberOrNull(src.can ?? lastCruise?.can ?? bs.can);

    return (
        <>
            <div>
                {t.battery.imei} {selectedDevice?.imei || NA_TEXT}
            </div>
            <div>
                {t.battery.voltage} {voltage != null ? <>{voltage} V</> : NA_TEXT}
            </div>
            <div>{currentLine}</div>
            <div>
                {t.battery.status} {mode || NA_TEXT}
            </div>
            <div>
                {t.battery.soc} {soc != null ? `${soc}%` : NA_TEXT}
            </div>
            <div>
                {t.battery.soh} {soh != null ? `${soh}%` : NA_TEXT}
            </div>
            <div>
                {isEn ? 'Charge/Discharge cycles' : 'Chu kỳ sạc/xả'}: {chc != null ? chc : 0}
            </div>
            <div>
                {t.battery.temperature} {temp != null ? `${temp}°C` : NA_TEXT}
            </div>
            <div>
                {t.battery.updatedAt}{' '}
                <span>
                    {updatedAt}{' '}
                    {canVal === 1 && <span style={{ color: 'red', fontWeight: 600 }}>(*)</span>}
                </span>
            </div>
        </>
    );
}
