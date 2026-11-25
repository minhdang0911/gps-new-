'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
    reverseGeocodeAddress,
    getCachedAddressSync,
    getCoordCacheKey,
    isValidGeocodeCoord,
} from '../../lib/address/reverseGeocode';
import { buildPopupHtml } from '../../util/cruiseUtils';

export function useCruiseAddress({ activeIndex, rawRouteData, isEn, LMap, mapRef, isPlayingRef }) {
    const [currentAddr, setCurrentAddr] = useState('');
    const currentAddrKeyRef = useRef('');
    const addressCacheRef = useRef(new Map());
    const inflightRef = useRef(new Map());
    const popupRef = useRef(null);
    const currentPopupPointRef = useRef(null);

    const ensureAddress = useCallback(async (lat, lon) => {
        if (!isValidGeocodeCoord(lat, lon)) return '';
        const lang = isEn ? 'en' : 'vi';
        const key = getCoordCacheKey(lat, lon, lang);

        if (addressCacheRef.current.has(key)) {
            return addressCacheRef.current.get(key);
        }

        const syncCached = getCachedAddressSync(lat, lon, { lang, isEn });
        if (syncCached?.address) {
            addressCacheRef.current.set(key, syncCached.address);
            return syncCached.address;
        }

        if (inflightRef.current.has(key)) {
            return inflightRef.current.get(key);
        }

        const p = reverseGeocodeAddress(lat, lon, { lang, isEn })
            .then((res) => {
                const addr = res?.address || '';
                if (addr) addressCacheRef.current.set(key, addr);
                return addr;
            })
            .catch(() => '')
            .finally(() => {
                inflightRef.current.delete(key);
            });

        inflightRef.current.set(key, p);
        return p;
    }, [isEn]);

    useEffect(() => {
        const p = rawRouteData?.[activeIndex];
        if (!p || !isValidGeocodeCoord(p.lat, p.lon)) {
            setCurrentAddr('');
            currentAddrKeyRef.current = '';
            return;
        }

        const lang = isEn ? 'en' : 'vi';
        const key = getCoordCacheKey(p.lat, p.lon, lang);
        if (currentAddrKeyRef.current === key) return;

        currentAddrKeyRef.current = key;
        const instant =
            addressCacheRef.current.get(key) ||
            getCachedAddressSync(p.lat, p.lon, { lang, isEn })?.address ||
            '';

        if (instant) {
            addressCacheRef.current.set(key, instant);
            setCurrentAddr(instant);
            return;
        }

        setCurrentAddr('');
        let cancelled = false;
        const delayMs = isPlayingRef.current ? 250 : 0;

        const timerId = setTimeout(async () => {
            const addr = await ensureAddress(p.lat, p.lon);
            if (!cancelled && currentAddrKeyRef.current === key) {
                setCurrentAddr(addr || '');
            }
        }, delayMs);

        return () => {
            cancelled = true;
            clearTimeout(timerId);
        };
    }, [activeIndex, isEn, rawRouteData, ensureAddress, isPlayingRef]);

    const openInfoPopup = useCallback(async (p, anchorLatLng = null) => {
        if (!LMap || !mapRef.current) return;
        if (!p || p.lat == null || p.lon == null) return;

        const targetLatLng = anchorLatLng || [p.lat, p.lon];
        currentPopupPointRef.current = { point: p, anchorLatLng: targetLatLng };

        if (!popupRef.current) {
            popupRef.current = LMap.popup({ closeButton: true, autoPan: true });
        }

        popupRef.current.setLatLng(targetLatLng).setContent(buildPopupHtml(p, isEn)).openOn(mapRef.current);

        const addr = await ensureAddress(p.lat, p.lon);
        if (!addr) return;
        if (currentPopupPointRef.current?.point !== p) return;

        const updated = { ...p, address: addr };
        currentPopupPointRef.current = { point: updated, anchorLatLng: targetLatLng };
        popupRef.current.setLatLng(targetLatLng).setContent(buildPopupHtml(updated, isEn)).openOn(mapRef.current);
    }, [LMap, mapRef, isEn, ensureAddress]);

    useEffect(() => {
        if (!popupRef.current || !mapRef.current) return;
        const entry = currentPopupPointRef.current;
        const p = entry?.point || entry;
        if (!p || p.lat == null || p.lon == null) return;

        const targetLatLng = entry?.anchorLatLng || [p.lat, p.lon];
        popupRef.current.setLatLng(targetLatLng).setContent(buildPopupHtml(p, isEn)).openOn(mapRef.current);

        (async () => {
            const addr = await ensureAddress(p.lat, p.lon);
            if (!addr) return;
            const current = currentPopupPointRef.current?.point || currentPopupPointRef.current;
            if (current !== p) return;
            const updated = { ...p, address: addr };
            currentPopupPointRef.current = { point: updated, anchorLatLng: targetLatLng };
            popupRef.current?.setLatLng(targetLatLng).setContent(buildPopupHtml(updated, isEn)).openOn(mapRef.current);
        })();
    }, [isEn, ensureAddress, mapRef]);

    return {
        currentAddr,
        currentAddrKeyRef,
        popupRef,
        currentPopupPointRef,
        ensureAddress,
        openInfoPopup,
    };
}
