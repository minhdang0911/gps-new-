'use client';

import { useMemo } from 'react';
import {
    MIN_EVENT_DURATION_SEC,
    toNum,
    getStatusType,
    safeTimeMs,
    distanceMeters,
} from '../../util/cruiseUtils';

export function useCruiseTimeline(rawRouteData, totalKm) {
    const routeTimeline = useMemo(() => {
        if (!rawRouteData?.length) return [];

        const pts = rawRouteData
            .map((p, idx) => {
                const speedNum = toNum(p.spd) ?? toNum(p.velocityNum) ?? 0;
                const type = getStatusType({ acc: p.acc, spd: speedNum });
                const timeMs = Number.isFinite(p.__timeMs) ? p.__timeMs : safeTimeMs(p);
                return Number.isFinite(timeMs)
                    ? { ...p, __idx: idx, __type: type, __timeMs: timeMs, __speedNum: speedNum }
                    : null;
            })
            .filter(Boolean);

        if (pts.length < 2) return [];

        const blocks = [];
        let s = 0;

        const blockDistanceKm = (aIdx, bIdx) => {
            let totalM = 0;
            for (let i = aIdx + 1; i <= bIdx; i++) {
                const A = pts[i - 1];
                const B = pts[i];
                if (typeof A?.lat !== 'number' || typeof A?.lon !== 'number') continue;
                if (typeof B?.lat !== 'number' || typeof B?.lon !== 'number') continue;
                const d = distanceMeters({ lat: A.lat, lon: A.lon }, { lat: B.lat, lon: B.lon });
                if (d > 0 && d < 5000) totalM += d;
            }
            return totalM / 1000;
        };

        while (s < pts.length) {
            let e = s;
            while (e + 1 < pts.length && pts[e + 1].__type === pts[s].__type) e++;

            const start = pts[s];
            const end = pts[e];
            const durationSec = Math.max(0, (end.__timeMs - start.__timeMs) / 1000);
            const distKm = start.__type === 'RUN' ? blockDistanceKm(s, e) : 0;

            blocks.push({
                type: start.__type,
                startIdx: start.__idx,
                endIdx: end.__idx,
                startTime: start.dateTime,
                endTime: end.dateTime,
                durationSec,
                distKm,
                startLat: start.lat,
                startLon: start.lon,
                endLat: end.lat,
                endLon: end.lon,
            });

            s = e + 1;
        }

        return blocks.filter((b) => b.durationSec >= 5);
    }, [rawRouteData]);

    const segments = useMemo(() => {
        if (!rawRouteData?.length) return { stop: [], park: [], maxSpeed: null };

        const points = rawRouteData.map((p, idx) => {
            const speedNum = toNum(p.spd) ?? toNum(p.vgp) ?? toNum(p.velocityNum) ?? 0;
            const type = getStatusType({ acc: p.acc, spd: speedNum });
            const timeMs = safeTimeMs(p);
            return { ...p, __idx: idx, __type: type, __timeMs: timeMs, __speedNum: speedNum };
        });

        let maxSpeed = null;
        for (const p of points) {
            const sp = p.__speedNum ?? 0;
            if (!maxSpeed || sp > maxSpeed.speed) {
                maxSpeed = { speed: sp, timeMs: p.__timeMs, idx: p.__idx, point: p };
            }
        }

        const makeEvents = (wantedType) => {
            const events = [];
            let i = 0;

            while (i < points.length) {
                const p = points[i];
                if (p.__type !== wantedType) {
                    i++;
                    continue;
                }

                const startIdx = i;
                let endIdx = i;
                while (endIdx + 1 < points.length && points[endIdx + 1].__type === wantedType) endIdx++;

                const a = points[startIdx];
                const b = points[endIdx];
                const startMs = a.__timeMs;
                const endMs = b.__timeMs;
                const durationSec =
                    Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs
                        ? (endMs - startMs) / 1000
                        : 0;

                if (durationSec >= MIN_EVENT_DURATION_SEC) {
                    events.push({
                        type: wantedType,
                        startIndex: a.__idx,
                        endIndex: b.__idx,
                        startTime: a.dateTime,
                        endTime: b.dateTime,
                        durationSec,
                        startLat: a.lat,
                        startLon: a.lon,
                        endLat: b.lat,
                        endLon: b.lon,
                    });
                }

                i = endIdx + 1;
            }

            return events;
        };

        return {
            stop: makeEvents('STOP'),
            park: makeEvents('PARK'),
            maxSpeed,
        };
    }, [rawRouteData]);

    const stats = useMemo(() => {
        const totalStopSec = segments.stop.reduce((s, e) => s + (e.durationSec || 0), 0);
        const totalParkSec = segments.park.reduce((s, e) => s + (e.durationSec || 0), 0);
        return {
            totalDistanceKm: totalKm,
            stopCount: segments.stop.length,
            parkCount: segments.park.length,
            totalStopSec,
            totalParkSec,
            maxSpeed: segments.maxSpeed?.speed ?? 0,
            maxSpeedTime: segments.maxSpeed?.point?.dateTime ?? '',
            maxSpeedRawIndex: segments.maxSpeed?.idx ?? 0,
        };
    }, [segments, totalKm]);

    return {
        routeTimeline,
        segments,
        stats,
    };
}
