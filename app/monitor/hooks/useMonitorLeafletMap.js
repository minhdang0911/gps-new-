'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import markerIconStop from '../../assets/marker-red.webp';
import { createHeadingAwareIcon } from '../../lib/map/smoothMarkerHelper';

export function useMonitorLeafletMap({ lat = 10.7542506, lng = 106.6170202 }) {
    const [LMap, setLMap] = useState(null);
    const [showPopup, setShowPopup] = useState(true);

    const mapRef = useRef(null);
    const markerRef = useRef(null);
    const popupWrapperRef = useRef(null);
    const popupRafRef = useRef(null);

    const currentHeadingRef = useRef(0);
    const makeIconRef = useRef(null);
    const isMobileNowRef = useRef(() => false);
    const currentMarkerAssetRef = useRef(markerIconStop);

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

    const updatePopupPosition = useCallback((immediate = false) => {
        if (!markerRef.current || !mapRef.current) return;
        const doUpdate = () => {
            const map = mapRef.current;
            const marker = markerRef.current;
            const popup = popupWrapperRef.current;

            if (popup && marker && map && map._loaded && !map._removed && map._mapPane) {
                try {
                    const latlng = marker.getLatLng();
                    if (!latlng || latlng.lat == null || latlng.lng == null) return;
                    const point = map.latLngToContainerPoint(latlng);
                    if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) {
                        popup.style.left = `${point.x}px`;
                        popup.style.top = `${point.y}px`;
                    }
                } catch {}
            }
        };

        if (immediate) {
            if (popupRafRef.current) cancelAnimationFrame(popupRafRef.current);
            popupRafRef.current = null;
            doUpdate();
            return;
        }

        if (popupRafRef.current) cancelAnimationFrame(popupRafRef.current);
        popupRafRef.current = requestAnimationFrame(() => {
            doUpdate();
            popupRafRef.current = null;
        });
    }, []);

    useEffect(() => {
        if (showPopup) {
            updatePopupPosition(true);
        }
    }, [showPopup, updatePopupPosition]);

    useEffect(() => {
        if (!LMap) return;

        const map = LMap.map('iky-map', {
            center: [lat, lng],
            zoom: 16,
            zoomControl: false,
            attributionControl: false,
            dragging: true,
            scrollWheelZoom: true,
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

        const isMobileNow = () =>
            typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 768px)').matches;

        isMobileNowRef.current = isMobileNow;

        const makeIcon = (asset, isMobile, heading = currentHeadingRef.current) =>
            createHeadingAwareIcon(LMap, asset, heading, isMobile);

        makeIconRef.current = makeIcon;
        currentMarkerAssetRef.current = markerIconStop;

        const marker = LMap.marker([lat, lng], {
            icon: makeIcon(markerIconStop, isMobileNow(), 0),
        }).addTo(map);
        markerRef.current = marker;

        updatePopupPosition(true);

        marker.on('click', () => {
            setShowPopup(true);
            updatePopupPosition(true);
        });
        map.on('click', () => setShowPopup(false));
        map.on('move zoom', () => updatePopupPosition(false));

        map.on('zoomend', () => {
            if (markerRef.current) {
                const pos = markerRef.current.getLatLng();
                map.setView(pos, map.getZoom(), { animate: false });
                updatePopupPosition(true);
            }
        });

        let lastIsMobile = isMobileNow();

        const handleResize = () => {
            map.invalidateSize();
            updatePopupPosition(true);

            const nowIsMobile = isMobileNow();
            if (nowIsMobile !== lastIsMobile) {
                lastIsMobile = nowIsMobile;
                const asset = currentMarkerAssetRef.current || markerIconStop;
                markerRef.current?.setIcon(makeIcon(asset, nowIsMobile));
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            if (popupRafRef.current) {
                cancelAnimationFrame(popupRafRef.current);
                popupRafRef.current = null;
            }
            window.removeEventListener('resize', handleResize);
            map.off('move zoom');
            map.off('zoomend');
            map.remove();
        };
    }, [LMap, lat, lng, updatePopupPosition]);

    return {
        LMap,
        mapRef,
        markerRef,
        popupWrapperRef,
        showPopup,
        setShowPopup,
        updatePopupPosition,
        currentHeadingRef,
        makeIconRef,
        isMobileNowRef,
        currentMarkerAssetRef,
    };
}
