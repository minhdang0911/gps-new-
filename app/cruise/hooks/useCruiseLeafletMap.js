'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import markerIconImg from '../../assets/xe2.webp';
import { distanceMeters, normalizeAngle } from '../../util/cruiseUtils';

export function useCruiseLeafletMap({
    externalMapRef,
    externalMovingMarkerRef,
    externalHighlightDotRef,
    mapRouteData,
    playbackRoute,
    snapToRoad,
    activeIndexRef,
    setActiveIndex,
    setSliderValue,
    segMRef,
    cumMRef,
    totalMRef,
    pendingPlayIdxRef,
    traveledMRef,
    lastBearingRef,
    applyMovingMarkerPose,
    getRouteBearing,
    getPlayIndexForRaw,
    stopPlaying,
    onPointClick,
}) {
    const [LMap, setLMap] = useState(null);
    const internalMapRef = useRef(null);
    const mapRef = externalMapRef || internalMapRef;

    const polylineRef = useRef(null), polylineCasingRef = useRef(null);
    const startMarkerRef = useRef(null), endMarkerRef = useRef(null);
    const internalMovingMarkerRef = useRef(null);
    const movingMarkerRef = externalMovingMarkerRef || internalMovingMarkerRef;
    const internalHighlightDotRef = useRef(null);
    const highlightDotRef = externalHighlightDotRef || internalHighlightDotRef;

    const pointLayerRef = useRef(null), dotRendererRef = useRef(null);
    const dotCacheRef = useRef([]), drawDotsRafRef = useRef(null);

    useEffect(() => {
        let active = true;
        const loadLeaflet = async () => {
            const LModule = await import('leaflet');
            await import('leaflet/dist/leaflet.css');
            if (active) setLMap(LModule.default || LModule);
        };
        loadLeaflet();
        return () => { active = false; };
    }, []);

    useEffect(() => {
        if (!LMap) return;
        const container = document.getElementById('iky-cruise-map');
        if (!container) return;
        if (container._leaflet_id) container._leaflet_id = null;

        const map = LMap.map(container, {
            center: [10.755937, 106.612587],
            zoom: 15,
            minZoom: 3,
            maxZoom: 20,
            preferCanvas: true,
        });

        mapRef.current = map;

        const googleTileLayer = LMap.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
            maxZoom: 20,
            subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
            keepBuffer: 6,
        });

        googleTileLayer.on('tileerror', (errorEvent) => {
            const tileImg = errorEvent.tile;
            if (!tileImg) return;
            if (!tileImg._retryAttempts) tileImg._retryAttempts = 0;
            if (tileImg._retryAttempts < 3) {
                tileImg._retryAttempts++;
                const candidateSubdomains = ['mt0', 'mt1', 'mt2', 'mt3'];
                const randomSubdomain = candidateSubdomains[Math.floor(Math.random() * 4)];
                setTimeout(() => {
                    tileImg.src = errorEvent.url.replace(/mt[0-3]/, randomSubdomain) + '&retry=' + tileImg._retryAttempts;
                }, 300 * tileImg._retryAttempts);
            }
        });

        googleTileLayer.addTo(map);

        setTimeout(() => {
            map.invalidateSize();
        }, 100);

        const dotsPane = map.createPane('cruiseDotsPane');
        dotsPane.style.zIndex = '450';
        dotsPane.style.pointerEvents = 'none';

        dotRendererRef.current = LMap.canvas({ padding: 0.5, pane: 'cruiseDotsPane' });

        return () => map.remove();
    }, [LMap]);

    const drawDots = useCallback(() => {
        if (!LMap || !mapRef.current || !mapRouteData.length) return;
        const map = mapRef.current;

        if (pointLayerRef.current) {
            map.removeLayer(pointLayerRef.current);
            pointLayerRef.current = null;
        }

        const bounds = map.getBounds();
        const zoom = map.getZoom();

        const MAX_DOTS = zoom >= 18 ? 12000 : zoom >= 16 ? 8000 : zoom >= 14 ? 5000 : zoom >= 12 ? 2500 : 1200;
        const step = Math.max(1, Math.ceil(mapRouteData.length / MAX_DOTS));
        const renderer = dotRendererRef.current || LMap.canvas({ padding: 0.5, pane: 'cruiseDotsPane' });

        const group = LMap.layerGroup();
        const cache = [];
        const dotRadius = zoom >= 20 ? 8 : zoom >= 18 ? 7 : zoom >= 16 ? 6 : zoom >= 14 ? 5 : 4;
        const dotWeight = zoom >= 18 ? 2.2 : zoom >= 15 ? 1.8 : 1.3;

        for (let i = 0; i < mapRouteData.length; i += step) {
            const rawP = mapRouteData[i];
            if (rawP?.lat == null || rawP?.lon == null) continue;

            const playIdx = playbackRoute.renderToPlayIdx?.[i];
            const p = (snapToRoad && playbackRoute.isSnapped && playIdx != null && playbackRoute.points?.[playIdx])
                ? playbackRoute.points[playIdx]
                : rawP;

            if (!bounds.contains([p.lat, p.lon])) continue;

            const isKeyPoint = i === 0 || i === mapRouteData.length - 1 || (rawP.velocityNum != null && rawP.velocityNum > 0);
            const circle = LMap.circleMarker([p.lat, p.lon], {
                renderer,
                radius: isKeyPoint ? dotRadius : Math.max(2, dotRadius - 2),
                weight: dotWeight,
                color: '#ffffff',
                fillColor: '#059669',
                fillOpacity: 0.95,
                interactive: false,
            });

            group.addLayer(circle);
            cache.push({ marker: circle, lat: p.lat, lon: p.lon, rawIndex: i });
        }

        group.addTo(map);
        pointLayerRef.current = group;
        dotCacheRef.current = cache;
    }, [LMap, mapRouteData, playbackRoute, snapToRoad]);

    const scheduleDrawDots = useCallback(() => {
        if (drawDotsRafRef.current) cancelAnimationFrame(drawDotsRafRef.current);
        drawDotsRafRef.current = requestAnimationFrame(() => {
            drawDots();
            drawDotsRafRef.current = null;
        });
    }, [drawDots]);

    useEffect(() => {
        if (!LMap || !mapRef.current) return;
        const map = mapRef.current;

        const onMove = () => scheduleDrawDots();
        const onZoom = () => {
            scheduleDrawDots();
            const el = movingMarkerRef.current?.getElement?.();
            if (el && Number.isFinite(lastBearingRef.current)) {
                el.style.transformOrigin = 'center center';
                const baseTransform = el.style.transform.replace(/rotate\([^)]*\)/g, '').trim();
                el.style.transform = `${baseTransform} rotate(${normalizeAngle(lastBearingRef.current)}deg)`;
            }
        };
        map.on('moveend', onMove);
        map.on('zoomend', onZoom);

        return () => {
            map.off('moveend', onMove);
            map.off('zoomend', onZoom);
            if (drawDotsRafRef.current) cancelAnimationFrame(drawDotsRafRef.current);
            drawDotsRafRef.current = null;
        };
    }, [LMap, mapRouteData, scheduleDrawDots, lastBearingRef]);

    useEffect(() => {
        if (!LMap || !mapRef.current) return;
        const map = mapRef.current;

        const clearLayer = (ref) => { if (ref.current) { map.removeLayer(ref.current); ref.current = null; } };
        [polylineCasingRef, polylineRef, startMarkerRef, endMarkerRef, movingMarkerRef, highlightDotRef, pointLayerRef].forEach(clearLayer);

        const pts = playbackRoute.points;
        const initialCoords = playbackRoute.coords;
        if (!pts.length || !initialCoords.length) return;

        polylineCasingRef.current = LMap.polyline(initialCoords, {
            color: '#ffffff', weight: 9, opacity: 0.9, lineCap: 'round', lineJoin: 'round', interactive: false, smoothFactor: 1.0,
        }).addTo(map);

        polylineRef.current = LMap.polyline(initialCoords, {
            color: '#1a1a2e', weight: 5, opacity: 1, lineCap: 'round', lineJoin: 'round', interactive: false, smoothFactor: 1.0,
        }).addTo(map);

        startMarkerRef.current = LMap.circleMarker(initialCoords[0], {
            radius: 9, weight: 3, color: '#ffffff', fillColor: '#16a34a', fillOpacity: 1, interactive: false, pane: 'markerPane',
        }).addTo(map);

        endMarkerRef.current = LMap.circleMarker(initialCoords[initialCoords.length - 1], {
            radius: 9, weight: 3, color: '#ffffff', fillColor: '#ea580c', fillOpacity: 1, interactive: false, pane: 'markerPane',
        }).addTo(map);

        const firstPoint = pts[0];
        const customIcon = LMap.icon({ iconUrl: markerIconImg.src, iconSize: [50, 50], iconAnchor: [25, 25] });

        movingMarkerRef.current = LMap.marker([firstPoint.lat, firstPoint.lon], { icon: customIcon }).addTo(map);
        movingMarkerRef.current.setZIndexOffset(15000);

        highlightDotRef.current = LMap.circleMarker([firstPoint.lat, firstPoint.lon], {
            pane: 'cruiseDotsPane', radius: 8, weight: 2.5, color: '#ffffff', fillColor: '#facc15', fillOpacity: 1, interactive: false,
        }).addTo(map);

        stopPlaying();
        if (pendingPlayIdxRef) pendingPlayIdxRef.current = 0;
        if (traveledMRef) traveledMRef.current = 0;
        setSliderValue(0);

        const rawIdx = playbackRoute.playToRawIdx?.[0] ?? 0;
        if (activeIndexRef) activeIndexRef.current = rawIdx;
        setActiveIndex(rawIdx);

        applyMovingMarkerPose(firstPoint.lat, firstPoint.lon, getRouteBearing(pts, 0));

        const bounds = polylineRef.current.getBounds();
        if (bounds?.isValid?.()) {
            map.fitBounds(bounds, { padding: [40, 40], maxZoom: 19 });
        }
        map.invalidateSize();
        scheduleDrawDots();
    }, [mapRouteData, LMap]);

    useEffect(() => {
        const pts = playbackRoute.points;
        const coords = playbackRoute.coords;

        if (!pts.length || pts.length < 2) {
            if (segMRef) segMRef.current = [];
            if (cumMRef) cumMRef.current = [0];
            if (totalMRef) totalMRef.current = 0;
        } else {
            const segM = [];
            const cum = [0];
            let sum = 0;
            for (let i = 0; i < pts.length - 1; i++) {
                const d = distanceMeters(pts[i], pts[i + 1]);
                const safe = d > 0 && d < 5000 ? d : 0;
                segM.push(safe);
                sum += safe;
                cum.push(sum);
            }
            if (segMRef) segMRef.current = segM;
            if (cumMRef) cumMRef.current = cum;
            if (totalMRef) totalMRef.current = sum;
        }

        if (!polylineRef.current || !polylineCasingRef.current || !pts.length) return;

        if (coords.length >= 2) {
            polylineRef.current.setLatLngs(coords);
            polylineCasingRef.current.setLatLngs(coords);
        }
        if (coords.length >= 1) {
            startMarkerRef.current?.setLatLng(coords[0]);
            endMarkerRef.current?.setLatLng(coords[coords.length - 1]);
        }

        const rawCur = activeIndexRef ? activeIndexRef.current : 0;
        const playIdx = getPlayIndexForRaw(rawCur, playbackRoute);
        if (pendingPlayIdxRef) pendingPlayIdxRef.current = playIdx;
        if (traveledMRef) traveledMRef.current = cumMRef?.current?.[playIdx] ?? 0;
        setSliderValue(playIdx);

        const pt = pts[playIdx];
        if (pt?.lat != null && pt?.lon != null) {
            applyMovingMarkerPose(pt.lat, pt.lon, getRouteBearing(pts, playIdx));
            highlightDotRef.current?.setLatLng([pt.lat, pt.lon]);
        }

        scheduleDrawDots();
    }, [playbackRoute, snapToRoad]);

    // Map click near polyline
    useEffect(() => {
        if (!LMap || !mapRef.current) return;
        const map = mapRef.current;

        const onClick = (e) => {
            const pts = playbackRoute.points;
            if (!pts.length) return;

            const clickPoint = map.latLngToLayerPoint(e.latlng);
            let closestPlayIdx = -1;
            let minDistSq = 40 * 40;

            for (let i = 0; i < pts.length; i++) {
                const p = pts[i];
                if (p?.lat == null || p?.lon == null) continue;
                const layerPoint = map.latLngToLayerPoint([p.lat, p.lon]);
                const dx = layerPoint.x - clickPoint.x;
                const dy = layerPoint.y - clickPoint.y;
                const dSq = dx * dx + dy * dy;
                if (dSq < minDistSq) {
                    minDistSq = dSq;
                    closestPlayIdx = i;
                }
            }

            if (closestPlayIdx >= 0) {
                const rawIdx = playbackRoute.playToRawIdx?.[closestPlayIdx];
                if (typeof rawIdx === 'number' && onPointClick) {
                    onPointClick(rawIdx);
                }
            }
        };

        map.on('click', onClick);
        return () => map.off('click', onClick);
    }, [LMap, playbackRoute, onPointClick]);

    return {
        LMap, mapRef, polylineRef, polylineCasingRef, startMarkerRef,
        endMarkerRef, movingMarkerRef, highlightDotRef, pointLayerRef, scheduleDrawDots,
    };
}
