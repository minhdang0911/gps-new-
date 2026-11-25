'use client';

import { useState, useRef, useEffect, useMemo, useCallback, startTransition } from 'react';
import {
    BASE_SPEED_MPS,
    UI_THROTTLE_MS,
    distanceMeters,
    getBearing,
    normalizeAngle,
    buildPlaybackRoute,
    nearestRenderIndex,
} from '../../util/cruiseUtils';

export function useCruisePlayback({
    rawRouteData,
    mapRouteData,
    mapToRawIndexRef,
    snappedPolyline,
    snapToRoad,
    mapRef,
    movingMarkerRef,
    highlightDotRef,
    openInfoPopup,
}) {
    const [playbackRate, setPlaybackRate] = useState(1);
    const [activeIndex, setActiveIndex] = useState(0);
    const [sliderValue, setSliderValue] = useState(0);
    const [followMode, setFollowMode] = useState(true);
    const [isPlaying, setIsPlaying] = useState(false);

    const isPlayingRef = useRef(false);
    const playbackRateRef = useRef(playbackRate);
    const followModeRef = useRef(followMode);
    const activeIndexRef = useRef(0);
    const lastBearingRef = useRef(0);
    const animationFrameRef = useRef(null);
    const pendingPlayIdxRef = useRef(0);

    const segMRef = useRef([]);
    const cumMRef = useRef([0]);
    const totalMRef = useRef(0);
    const traveledMRef = useRef(0);

    const vlistRef = useRef(null);
    const lastScrollRef = useRef(-1);

    useEffect(() => { playbackRateRef.current = playbackRate; }, [playbackRate]);
    useEffect(() => { followModeRef.current = followMode; }, [followMode]);
    useEffect(() => { activeIndexRef.current = activeIndex; }, [activeIndex]);

    const playbackRoute = useMemo(
        () => buildPlaybackRoute(mapRouteData, mapToRawIndexRef.current, snappedPolyline, snapToRoad),
        [mapRouteData, mapToRawIndexRef, snappedPolyline, snapToRoad],
    );

    const getRouteBearing = useCallback((points, idx) => {
        if (!points || points.length < 2) return lastBearingRef.current;
        const curr = points[idx];
        if (!curr) return lastBearingRef.current;
        for (let j = idx + 1; j < points.length; j++) {
            const next = points[j];
            if (distanceMeters(curr, next) >= 0.5) {
                return getBearing(curr.lat, curr.lon, next.lat, next.lon);
            }
        }
        for (let j = idx - 1; j >= 0; j--) {
            const prev = points[j];
            if (distanceMeters(prev, curr) >= 0.5) {
                return getBearing(prev.lat, prev.lon, curr.lat, curr.lon);
            }
        }
        return lastBearingRef.current;
    }, []);

    const applyMovingMarkerPose = useCallback((lat, lon, bearing) => {
        if (lat == null || lon == null) return;
        movingMarkerRef.current?.setLatLng([lat, lon]);
        highlightDotRef.current?.setLatLng([lat, lon]);
        if (typeof bearing === 'number' && Number.isFinite(bearing)) {
            lastBearingRef.current = bearing;
            const el = movingMarkerRef.current?.getElement?.();
            if (el) {
                el.style.transformOrigin = 'center center';
                const baseTransform = el.style.transform.replace(/rotate\([^)]*\)/g, '').trim();
                el.style.transform = `${baseTransform} rotate(${normalizeAngle(bearing)}deg)`;
            }
        }
    }, [movingMarkerRef, highlightDotRef]);

    const stopPlaying = useCallback(() => {
        setIsPlaying(false);
        isPlayingRef.current = false;
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
    }, []);

    const getPlayIndexForRaw = useCallback((rawIdx, route = playbackRoute) => {
        const pts = route?.points || [];
        if (!pts.length) return 0;
        const rIdx = nearestRenderIndex(mapToRawIndexRef.current, rawIdx);
        if (rIdx < 0) return 0;
        const mappedPlay = route.renderToPlayIdx?.[rIdx] ?? rIdx;
        return Math.max(0, Math.min(pts.length - 1, mappedPlay));
    }, [playbackRoute, mapToRawIndexRef]);

    const handlePointClickRaw = useCallback((rawIdx) => {
        if (!rawRouteData.length) return;
        stopPlaying();
        activeIndexRef.current = rawIdx;
        setActiveIndex(rawIdx);
        const pts = playbackRoute.points;
        let popupAnchor = null;
        if (pts.length > 0) {
            const playIdx = getPlayIndexForRaw(rawIdx);
            pendingPlayIdxRef.current = playIdx;
            traveledMRef.current = cumMRef.current?.[playIdx] ?? 0;
            setSliderValue(playIdx);
            const p = pts[playIdx];
            if (p?.lat != null && p?.lon != null) {
                applyMovingMarkerPose(p.lat, p.lon, getRouteBearing(pts, playIdx));
                highlightDotRef.current?.setLatLng([p.lat, p.lon]);
                mapRef.current?.panTo([p.lat, p.lon], { animate: true, duration: 0.25 });
                popupAnchor = [p.lat, p.lon];
            }
        }
        const pRaw = rawRouteData[rawIdx];
        if (pRaw && openInfoPopup) openInfoPopup(pRaw, popupAnchor);
        vlistRef.current?.scrollToItem(rawIdx, 'center');
    }, [rawRouteData, playbackRoute, stopPlaying, getPlayIndexForRaw, applyMovingMarkerPose, getRouteBearing, highlightDotRef, mapRef, openInfoPopup]);

    // Loop animation
    useEffect(() => {
        const pts = playbackRoute.points;
        if (!pts.length || pts.length < 2 || !movingMarkerRef.current) return;
        isPlayingRef.current = isPlaying;
        if (!isPlaying) {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
            return;
        }

        const totalM = totalMRef.current || 0;
        if (traveledMRef.current >= totalM) traveledMRef.current = 0;
        const initCum = cumMRef.current;
        let segIdx = 0;
        while (segIdx < initCum.length - 2 && traveledMRef.current >= initCum[segIdx + 1]) segIdx++;

        let lastTime = performance.now(), lastUi = 0, lastFollow = 0;
        const step = (now) => {
            if (!isPlayingRef.current) return;
            const dtMs = Math.min(Math.max(0, now - lastTime), 100);
            lastTime = now;
            const nextTraveled = traveledMRef.current + (dtMs / 1000) * (BASE_SPEED_MPS * playbackRateRef.current);
            traveledMRef.current = nextTraveled;
            const routeTotalM = totalMRef.current || 0;

            if (routeTotalM <= 0 || nextTraveled >= routeTotalM) {
                const last = pts.length - 1, pLast = pts[last];
                if (pLast?.lat != null && pLast?.lon != null) {
                    applyMovingMarkerPose(pLast.lat, pLast.lon, getRouteBearing(pts, last));
                    if (followModeRef.current && mapRef.current) {
                        mapRef.current.panTo([pLast.lat, pLast.lon], { animate: true, duration: 0.25 });
                    }
                }
                pendingPlayIdxRef.current = last;
                const rawLast = playbackRoute.playToRawIdx?.[last];
                if (typeof rawLast === 'number') activeIndexRef.current = rawLast;
                startTransition(() => {
                    setSliderValue(last);
                    if (typeof rawLast === 'number') setActiveIndex(rawLast);
                });
                setIsPlaying(false);
                isPlayingRef.current = false;
                return;
            }

            const cum = cumMRef.current;
            while (segIdx < cum.length - 2 && nextTraveled >= cum[segIdx + 1]) segIdx++;
            let segLen = segMRef.current?.[segIdx] || 0;
            while (segIdx < pts.length - 2 && segLen <= 0) { segIdx++; segLen = segMRef.current?.[segIdx] || 0; }
            const a = pts[segIdx], b = pts[segIdx + 1];
            if (!a || !b || segLen <= 0) { animationFrameRef.current = requestAnimationFrame(step); return; }

            const t01 = Math.max(0, Math.min(1, (nextTraveled - cum[segIdx]) / segLen));
            const curLat = a.lat + (b.lat - a.lat) * t01, curLon = a.lon + (b.lon - a.lon) * t01;
            const bearing = distanceMeters(a, b) >= 0.5 ? getBearing(a.lat, a.lon, b.lat, b.lon) : lastBearingRef.current;
            applyMovingMarkerPose(curLat, curLon, bearing);

            if (followModeRef.current && now - lastFollow >= 1000 && mapRef.current) {
                lastFollow = now;
                mapRef.current.panTo([curLat, curLon], { animate: true, duration: 0.8 });
            }

            if (now - lastUi >= UI_THROTTLE_MS) {
                lastUi = now;
                const curPlayIdx = t01 >= 0.5 ? segIdx + 1 : segIdx;
                pendingPlayIdxRef.current = curPlayIdx;
                const rawIndex = playbackRoute.playToRawIdx?.[curPlayIdx] ?? mapToRawIndexRef.current?.[curPlayIdx];
                if (typeof rawIndex === 'number' && rawIndex !== activeIndexRef.current) {
                    activeIndexRef.current = rawIndex;
                    startTransition(() => { setSliderValue(curPlayIdx); setActiveIndex(rawIndex); });
                } else {
                    setSliderValue(curPlayIdx);
                }
            }
            animationFrameRef.current = requestAnimationFrame(step);
        };
        animationFrameRef.current = requestAnimationFrame(step);
        return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); animationFrameRef.current = null; };
    }, [isPlaying, playbackRoute, mapRef, movingMarkerRef, applyMovingMarkerPose, getRouteBearing, mapToRawIndexRef]);

    // Auto scroll virtual table
    useEffect(() => {
        if (!isPlaying || !vlistRef.current) return;
        if (lastScrollRef.current === activeIndex) return;
        lastScrollRef.current = activeIndex;
        vlistRef.current.scrollToItem(activeIndex, 'center');
    }, [activeIndex, isPlaying]);

    const handleStart = useCallback(() => {
        const pts = playbackRoute.points;
        if (pts.length < 2) return;
        const lastIdx = pts.length - 1;
        const totalM = totalMRef.current || 0;
        if (pendingPlayIdxRef.current >= lastIdx || (totalM > 0 && traveledMRef.current >= totalM - 0.1)) {
            pendingPlayIdxRef.current = 0;
            traveledMRef.current = 0;
            setSliderValue(0);
            const rawIdx = playbackRoute.playToRawIdx?.[0] ?? 0;
            activeIndexRef.current = rawIdx;
            setActiveIndex(rawIdx);
            applyMovingMarkerPose(pts[0].lat, pts[0].lon, getRouteBearing(pts, 0));
        }
        setIsPlaying(true);
        isPlayingRef.current = true;
    }, [playbackRoute, applyMovingMarkerPose, getRouteBearing]);

    const handlePause = useCallback(() => stopPlaying(), [stopPlaying]);

    const handleReset = useCallback(() => {
        const pts = playbackRoute.points;
        if (!pts.length) return;
        stopPlaying();

        const idx = 0;
        pendingPlayIdxRef.current = idx;
        traveledMRef.current = 0;
        setSliderValue(idx);

        const rawIdx = playbackRoute.playToRawIdx?.[idx] ?? mapToRawIndexRef.current?.[idx] ?? 0;
        activeIndexRef.current = rawIdx;
        setActiveIndex(rawIdx);

        const p = pts[idx];
        if (p?.lat != null && p?.lon != null) {
            applyMovingMarkerPose(p.lat, p.lon, getRouteBearing(pts, idx));
            mapRef.current?.panTo([p.lat, p.lon], { animate: true, duration: 0.25 });
        }

        vlistRef.current?.scrollToItem(rawIdx, 'center');
    }, [playbackRoute, stopPlaying, mapToRawIndexRef, applyMovingMarkerPose, getRouteBearing, mapRef]);

    const handleSliderChange = useCallback((e) => {
        const val = Number(e.target.value);
        setSliderValue(val);
        pendingPlayIdxRef.current = val;
        stopPlaying();

        const pts = playbackRoute.points;
        const p = pts[val];
        if (p?.lat != null && p?.lon != null) {
            applyMovingMarkerPose(p.lat, p.lon, getRouteBearing(pts, val));
            highlightDotRef.current?.setLatLng([p.lat, p.lon]);
        }
        traveledMRef.current = cumMRef.current?.[val] ?? 0;
        const rawIdx = playbackRoute.playToRawIdx?.[val] ?? mapToRawIndexRef.current?.[val];
        if (typeof rawIdx === 'number') {
            activeIndexRef.current = rawIdx;
            setActiveIndex(rawIdx);
            vlistRef.current?.scrollToItem(rawIdx, 'center');
        }
    }, [playbackRoute, stopPlaying, applyMovingMarkerPose, getRouteBearing, highlightDotRef, mapToRawIndexRef]);

    const commitSlider = useCallback(() => {
        const playIdx = pendingPlayIdxRef.current;
        const pts = playbackRoute.points;
        const p = pts[playIdx];
        if (p?.lat != null && p?.lon != null) {
            mapRef.current?.panTo([p.lat, p.lon], { animate: true, duration: 0.25 });
        }
    }, [playbackRoute, mapRef]);

    return {
        playbackRate,
        setPlaybackRate,
        activeIndex,
        activeIndexRef,
        setActiveIndex,
        sliderValue,
        setSliderValue,
        followMode,
        setFollowMode,
        isPlaying,
        isPlayingRef,
        playbackRoute,
        vlistRef,
        pendingPlayIdxRef,
        traveledMRef,
        segMRef,
        cumMRef,
        totalMRef,
        lastBearingRef,
        getRouteBearing,
        applyMovingMarkerPose,
        getPlayIndexForRaw,
        stopPlaying,
        handleStart,
        handlePause,
        handleReset,
        handleSliderChange,
        commitSlider,
        handlePointClickRaw,
    };
}
