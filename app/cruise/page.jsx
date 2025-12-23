'use client';

import React, { useState, useEffect, useRef } from 'react';
import './cruise.css';

import markerIconImg from '../assets/xe2.png';
import { getCruiseHistory } from '../lib/api/cruise';
import { getDevices } from '../lib/api/devices';
import cruiseCacheManager from '../lib/cache/CruiseCacheManager';

import vi from '../locales/vi.json';
import en from '../locales/en.json';
import { usePathname } from 'next/navigation';
import { formatDateFromDevice } from '../util/FormatDate';

import loading from '../assets/loading.gif';
import Image from 'next/image';
import { Tooltip, Select, List as AntList } from 'antd';
import { reverseGeocodeAddress } from '../lib/address/reverseGeocode';

const locales = { vi, en };

// ===============================
// 🔑 MULTI PROVIDER CONFIG
// ===============================
const GOONG_KEYS = [
    process.env.NEXT_PUBLIC_GOONG_API_KEY,
    process.env.NEXT_PUBLIC_GOONG_API_KEY1,
    process.env.NEXT_PUBLIC_GOONG_API_KEY3,
    process.env.NEXT_PUBLIC_GOONG_API_KEY4,
    process.env.NEXT_PUBLIC_GOONG_API_KEY5,
    process.env.NEXT_PUBLIC_GOONG_API_KEY6,
    process.env.NEXT_PUBLIC_GOONG_API_KEY7,
    process.env.NEXT_PUBLIC_GOONG_API_KEY8,
].filter(Boolean);

let goongKeyIndex = 0;
const getCurrentGoongKey = () => {
    if (!GOONG_KEYS.length) return null;
    return GOONG_KEYS[goongKeyIndex % GOONG_KEYS.length];
};
const moveToNextGoongKey = () => {
    if (!GOONG_KEYS.length) return;
    goongKeyIndex = (goongKeyIndex + 1) % GOONG_KEYS.length;
};

// ===============================
// ⚙️ CONFIG
// ===============================
const FETCH_PAGE_LIMIT = 1000;

// Map perf
const VISUAL_MAX_POINTS_ON_MAP = 3000;
const MAP_MIN_SAMPLE_DIST_M = 60;

// ====== GPS utils ======
const EARTH_RADIUS_M = 6371000;
const toRad = (v) => (v * Math.PI) / 180;

const distanceMeters = (a, b) => {
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lon - a.lon);

    const sinLat = Math.sin(dLat / 2);
    const sinLon = Math.sin(dLon / 2);

    const aa = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLon * sinLon;
    const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
    return EARTH_RADIUS_M * c;
};

// ✅ total distance = sum of segments (RAW)
const calcTotalDistanceKm = (points) => {
    if (!points || points.length < 2) return 0;

    let totalM = 0;
    for (let i = 1; i < points.length; i++) {
        const a = points[i - 1];
        const b = points[i];
        if (typeof a?.lat !== 'number' || typeof a?.lon !== 'number') continue;
        if (typeof b?.lat !== 'number' || typeof b?.lon !== 'number') continue;

        const d = distanceMeters({ lat: a.lat, lon: a.lon }, { lat: b.lat, lon: b.lon });
        if (d > 0 && d < 2000) totalM += d; // basic jump filter for RAW
    }
    return totalM / 1000;
};

// ===============================
// 🧭 BEARING
// ===============================
const getBearing = (lat1, lon1, lat2, lon2) => {
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

    let θ = Math.atan2(y, x);
    θ = (θ * 180) / Math.PI;
    return (θ + 360) % 360;
};

const normalizeAngle = (a) => ((a % 360) + 360) % 360;

// ===============================
// 🧠 MAP DOWNSAMPLE
// ===============================
const buildMapSample = (rawPoints, maxPoints = VISUAL_MAX_POINTS_ON_MAP, minDistM = MAP_MIN_SAMPLE_DIST_M) => {
    if (!rawPoints || rawPoints.length === 0) return { indices: [], points: [] };

    const isValid = (p) => p && typeof p.lat === 'number' && typeof p.lon === 'number';

    let first = -1;
    for (let i = 0; i < rawPoints.length; i++) {
        if (isValid(rawPoints[i])) {
            first = i;
            break;
        }
    }
    if (first === -1) return { indices: [], points: [] };

    let last = first;
    for (let i = rawPoints.length - 1; i >= 0; i--) {
        if (isValid(rawPoints[i])) {
            last = i;
            break;
        }
    }

    const kept = [first];
    let lastKept = rawPoints[first];

    for (let i = first + 1; i <= last; i++) {
        const p = rawPoints[i];
        if (!isValid(p)) continue;

        const d = distanceMeters({ lat: lastKept.lat, lon: lastKept.lon }, { lat: p.lat, lon: p.lon });
        if (d >= minDistM) {
            kept.push(i);
            lastKept = p;
        }
    }

    if (kept[kept.length - 1] !== last) kept.push(last);

    // cap max points
    if (kept.length > maxPoints) {
        const step = Math.ceil(kept.length / maxPoints);
        const down = [];
        for (let i = 0; i < kept.length; i += step) down.push(kept[i]);
        if (down[down.length - 1] !== kept[kept.length - 1]) down.push(kept[kept.length - 1]);
        return { indices: down, points: down.map((idx) => rawPoints[idx]) };
    }

    return { indices: kept, points: kept.map((idx) => rawPoints[idx]) };
};

// binary search nearest render index for a raw index
const nearestRenderIndex = (renderToRaw, rawIdx) => {
    if (!renderToRaw || renderToRaw.length === 0) return -1;

    let lo = 0;
    let hi = renderToRaw.length - 1;

    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const v = renderToRaw[mid];
        if (v === rawIdx) return mid;
        if (v < rawIdx) lo = mid + 1;
        else hi = mid - 1;
    }

    const a = Math.max(0, Math.min(renderToRaw.length - 1, lo));
    const b = Math.max(0, Math.min(renderToRaw.length - 1, lo - 1));
    return Math.abs(renderToRaw[a] - rawIdx) < Math.abs(renderToRaw[b] - rawIdx) ? a : b;
};

// ===============================
// Goong helpers
// ===============================
const pickBestGoongV2Address = (results = []) => {
    if (!Array.isArray(results) || results.length === 0) return '';

    const poiCandidates = results.filter((r) => {
        const name = (r.name || '').trim();
        const addr = (r.address || r.formatted_address || '').trim();
        const formatted = (r.formatted_address || '').trim();
        const types = Array.isArray(r.types) ? r.types : [];

        const isHouseNumberType = types.includes('house_number');
        const startsWithDigit = /^\d/.test(name);

        return name && !startsWithDigit && name !== addr && name !== formatted && !isHouseNumberType;
    });

    const chosen = poiCandidates[0] || results[0];

    const name = (chosen.name || '').trim();
    const formatted = (chosen.formatted_address || '').trim();
    const addr = (chosen.address || '').trim();

    if (formatted) return formatted;
    if (name && addr) return `${name}, ${addr}`;
    if (addr) return addr;
    if (name) return name;

    return '';
};

const callGoongWithRotation = async (lat, lon, lang = 'vi') => {
    if (!GOONG_KEYS.length) return '';

    for (let i = 0; i < GOONG_KEYS.length; i++) {
        const apiKey = getCurrentGoongKey();
        if (!apiKey) break;

        try {
            const url =
                `https://rsapi.goong.io/v2/geocode?latlng=${lat},${lon}` +
                `&api_key=${apiKey}` +
                `&limit=2` +
                `&has_deprecated_administrative_unit=true` +
                `&language=${lang}`;

            const res = await fetch(url);
            const data = await res.json().catch(() => null);

            if (res.status === 429 || res.status === 403 || data?.error_code === 429 || data?.error_code === 403) {
                moveToNextGoongKey();
                continue;
            }

            if (!res.ok || !data) {
                moveToNextGoongKey();
                continue;
            }

            const addr = pickBestGoongV2Address(data?.results || []);
            if (addr) return addr;

            moveToNextGoongKey();
        } catch (err) {
            moveToNextGoongKey();
        }
    }

    return '';
};

const getGoongRoadDistanceKm = async (startPoint, endPoint) => {
    if (!GOONG_KEYS.length) return null;
    const apiKey = getCurrentGoongKey();
    if (!apiKey) return null;

    const origins = `${startPoint.lat},${startPoint.lon}`;
    const destinations = `${endPoint.lat},${endPoint.lon}`;
    const url = `https://rsapi.goong.io/v2/distancematrix?origins=${origins}&destinations=${destinations}&vehicle=bike&api_key=${apiKey}`;

    try {
        const res = await fetch(url);
        const data = await res.json().catch(() => null);

        if (res.status === 429 || res.status === 403 || data?.error_code === 429 || data?.error_code === 403) {
            moveToNextGoongKey();
            return null;
        }

        if (!res.ok || !data) return null;

        const element = data?.rows?.[0]?.elements?.[0];
        const meters = element?.distance?.value;

        if (typeof meters !== 'number') return null;
        return meters / 1000;
    } catch (err) {
        return null;
    }
};

const buildPopupHtml = (p, t) => `
    <div class="iky-cruise-popup">
        <div><strong>${t.popup.licensePlate}:</strong> ${p.licensePlate || '--'}</div>
        <div><strong>${t.popup.vehicleType}:</strong> ${p.vehicleName || '--'}</div>
        <div><strong>${t.popup.manufacturer}:</strong> ${p.manufacturer || '--'}</div>
        <div><strong>${t.popup.time}:</strong> ${formatDateFromDevice(p.dateTime) || '--'}</div>
        <div><strong>${t.popup.currentLocation}:</strong> ${p.address || '--'}</div>
        <div><strong>${t.popup.coordinate}:</strong> ${p.lat}, ${p.lon}</div>
        <div><strong>${t.popup.machineStatus}:</strong> ${p.machineStatus || '--'}</div>
        <div><strong>${t.popup.vehicleStatus}:</strong> ${p.vehicleStatus || '--'}</div>
        <div><strong>${t.popup.speed}:</strong> ${p.velocity || '--'}</div>
    </div>
`;

const toInputDateTime = (date) => {
    const tzOffset = date.getTimezoneOffset() * 60000;
    const localISO = new Date(date.getTime() - tzOffset).toISOString();
    return localISO.slice(0, 16);
};

const CruisePage = () => {
    const pathname = usePathname() || '/';
    const [isEn, setIsEn] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);
    const listWrapRef = useRef(null);

    useEffect(() => {
        const segments = pathname.split('/').filter(Boolean);
        const last = segments[segments.length - 1];
        const isEnFromPath = last === 'en';

        if (typeof window === 'undefined') return;

        if (isEnFromPath) {
            setIsEn(true);
            localStorage.setItem('iky_lang', 'en');
        } else {
            const saved = localStorage.getItem('iky_lang');
            setIsEn(saved === 'en');
        }
    }, [pathname]);

    const t = isEn ? locales.en.cruise : locales.vi.cruise;

    // ✅ RAW = full response
    const [rawRouteData, setRawRouteData] = useState([]);

    // ✅ MAP = downsample only for render + marker playback
    const [mapRouteData, setMapRouteData] = useState([]);
    const mapToRawIndexRef = useRef([]); // renderIdx -> rawIdx

    const [activeIndex, setActiveIndex] = useState(0); // RAW index (table)
    const [activeRenderIndex, setActiveRenderIndex] = useState(0); // MAP index (slider/playback)
    const [isPlaying, setIsPlaying] = useState(false);

    const [totalKm, setTotalKm] = useState(0);
    const [deviceSearchText, setDeviceSearchText] = useState('');

    const [roadKm, setRoadKm] = useState(null);
    const [roadKmLoading, setRoadKmLoading] = useState(false);
    const [roadKmError, setRoadKmError] = useState(null);

    const [deviceList, setDeviceList] = useState([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState('');
    const [selectedImei, setSelectedImei] = useState('');

    const [start, setStart] = useState('');
    const [end, setEnd] = useState('');

    const [loadingRoute, setLoadingRoute] = useState(false);
    const [loadingDevices, setLoadingDevices] = useState(false);
    const [error, setError] = useState(null);

    const [LMap, setLMap] = useState(null);
    const [loadingAddress, setLoadingAddress] = useState(false);
    const [addressError, setAddressError] = useState(null);

    const mapRef = useRef(null);
    const polylineRef = useRef(null);
    const movingMarkerRef = useRef(null);
    const pointMarkersRef = useRef([]); // renderIdx
    const animationFrameRef = useRef(null);
    const popupRef = useRef(null);
    const highlightedMarkerRef = useRef(null);
    const abLabelMarkersRef = useRef([]);

    const isPlayingRef = useRef(false);

    const addressCacheRef = useRef({});

    // ✅ Precompute for smooth animation by meters
    const segMRef = useRef([]); // segment distances (m)
    const cumMRef = useRef([0]); // cumulative distances (m)
    const totalMRef = useRef(0);

    // load leaflet
    useEffect(() => {
        const loadLeaflet = async () => {
            const L = await import('leaflet');
            await import('leaflet/dist/leaflet.css');
            setLMap(L);
        };
        loadLeaflet();
    }, []);

    // cleanup cache
    useEffect(() => {
        const cleanup = async () => {
            try {
                const deleted = await cruiseCacheManager.cleanupOldCache();
                console.log(`🧹 Cleaned up ${deleted} old cache entries`);
            } catch (e) {
                console.error('Cache cleanup error:', e);
            }
        };
        cleanup();
    }, []);

    // Build segment distances for MAP
    useEffect(() => {
        if (!mapRouteData?.length || mapRouteData.length < 2) {
            segMRef.current = [];
            cumMRef.current = [0];
            totalMRef.current = 0;
            return;
        }

        const segM = [];
        const cum = [0];
        let sum = 0;

        for (let i = 0; i < mapRouteData.length - 1; i++) {
            const a = mapRouteData[i];
            const b = mapRouteData[i + 1];

            if (
                typeof a?.lat !== 'number' ||
                typeof a?.lon !== 'number' ||
                typeof b?.lat !== 'number' ||
                typeof b?.lon !== 'number'
            ) {
                segM.push(0);
                cum.push(sum);
                continue;
            }

            const d = distanceMeters({ lat: a.lat, lon: a.lon }, { lat: b.lat, lon: b.lon });

            // tránh spike cực lớn làm "nhảy"
            const safe = d > 0 && d < 5000 ? d : 0;

            segM.push(safe);
            sum += safe;
            cum.push(sum);
        }

        segMRef.current = segM;
        cumMRef.current = cum;
        totalMRef.current = sum;
    }, [mapRouteData]);

    const toApiDateTime = (value) => {
        if (!value) return '';
        const [date, timeRaw] = value.split('T');
        if (!timeRaw) return date;
        const time = timeRaw.slice(0, 8);
        if (time.length === 5) return `${date} ${time}:00`;
        return `${date} ${time}`;
    };

    const handlePresetRange = (hours) => {
        const now = new Date();
        const startDate = new Date(now.getTime() - hours * 60 * 60 * 1000);
        setEnd(toInputDateTime(now));
        setStart(toInputDateTime(startDate));
    };

    const openInfoPopup = (p) => {
        if (!LMap || !mapRef.current) return;
        if (!p || p.lat == null || p.lon == null) return;

        if (!popupRef.current) {
            popupRef.current = LMap.popup({
                closeButton: true,
                autoPan: true,
            });
        }

        popupRef.current.setLatLng([p.lat, p.lon]).setContent(buildPopupHtml(p, t)).openOn(mapRef.current);
    };

    // options cho Select
    const deviceOptions = React.useMemo(() => {
        const keyword = deviceSearchText.trim().toLowerCase();

        const highlightText = (text) => {
            if (!keyword) return text;
            const lower = text.toLowerCase();
            const index = lower.indexOf(keyword);
            if (index === -1) return text;
            const before = text.slice(0, index);
            const match = text.slice(index, index + keyword.length);
            const after = text.slice(index + keyword.length);
            return (
                <>
                    {before}
                    <span className="iky-select-highlight">{match}</span>
                    {after}
                </>
            );
        };

        return deviceList.map((d) => {
            const plate = (d.license_plate || t.common.unknownPlate).trim();
            const imei = d.imei || '---';
            const phone = d.phone_number || '';
            const rawLabel = `${plate} – ${imei}${phone ? '' : ''}`;

            return {
                value: d._id,
                searchable: rawLabel.toLowerCase(),
                label: highlightText(rawLabel),
            };
        });
    }, [deviceList, t, deviceSearchText]);

    const smoothScrollToItem = (idx) => {
        const el = document.getElementById(`cruise-item-${idx}`);
        if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    };

    // highlight marker theo renderIdx
    const highlightRenderMarker = (renderIdx) => {
        if (!pointMarkersRef.current.length) return;

        if (highlightedMarkerRef.current) {
            highlightedMarkerRef.current.setStyle({
                radius: 4,
                weight: 2,
                color: '#ffffff',
                fillColor: '#22c55e',
            });
        }

        const mk = pointMarkersRef.current[renderIdx];
        if (!mk) return;

        mk.setStyle({
            radius: 7,
            weight: 2,
            color: '#ffffff',
            fillColor: '#facc15',
        });

        highlightedMarkerRef.current = mk;
    };

    // raw idx -> render idx nearest (sync click table)
    const syncRenderFromRaw = (rawIdx) => {
        const rIdx = nearestRenderIndex(mapToRawIndexRef.current, rawIdx);
        if (rIdx >= 0) setActiveRenderIndex(rIdx);
    };

    // fetch address theo RAW
    const fetchAddressForPoint = async (idx) => {
        if (!rawRouteData.length) return;

        const point = rawRouteData[idx];
        if (!point || point.address || point.lat == null || point.lon == null) return;

        const key = `${point.lat.toFixed(6)},${point.lon.toFixed(6)}`;
        if (addressCacheRef.current[key]) {
            setRawRouteData((prev) => {
                const clone = [...prev];
                clone[idx] = { ...clone[idx], address: addressCacheRef.current[key] };
                return clone;
            });
            return;
        }

        setLoadingAddress(true);

        const res = await reverseGeocodeAddress(point.lat, point.lon, {
            lang: isEn ? 'en' : 'vi',
            isEn,
        });

        const addr = res?.address || '';
        addressCacheRef.current[key] = addr;

        setRawRouteData((prev) => {
            const clone = [...prev];
            clone[idx] = { ...clone[idx], address: addr };
            return clone;
        });

        setLoadingAddress(false);
    };

    // stop playing helper
    const stopPlaying = () => {
        setIsPlaying(false);
        isPlayingRef.current = false;
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
    };

    // ✅ click table -> set RAW + sync render
    const handlePointClickRaw = (rawIdx) => {
        if (!rawRouteData.length) return;

        setActiveIndex(rawIdx);
        syncRenderFromRaw(rawIdx);

        stopPlaying();

        const rIdx = nearestRenderIndex(mapToRawIndexRef.current, rawIdx);
        if (rIdx >= 0) {
            const p = mapRouteData[rIdx];
            if (p?.lat != null && p?.lon != null && movingMarkerRef.current) {
                movingMarkerRef.current.setLatLng([p.lat, p.lon]);
            }
            if (mapRef.current && p?.lat != null && p?.lon != null) {
                mapRef.current.panTo([p.lat, p.lon]);
            }
        }

        const pRaw = rawRouteData[rawIdx];
        if (pRaw) openInfoPopup(pRaw);
    };

    // ✅ slider thay đổi theo render idx
    const handleSliderChange = (e) => {
        const renderIdx = Number(e.target.value);
        const rawIdx = mapToRawIndexRef.current?.[renderIdx];

        setActiveRenderIndex(renderIdx);
        if (typeof rawIdx === 'number') setActiveIndex(rawIdx);

        stopPlaying();

        const p = mapRouteData[renderIdx];
        if (p?.lat != null && p?.lon != null && movingMarkerRef.current) {
            movingMarkerRef.current.setLatLng([p.lat, p.lon]);
        }
        if (mapRef.current && p?.lat != null && p?.lon != null) mapRef.current.panTo([p.lat, p.lon]);
    };

    // Load device list
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const token = localStorage.getItem('accessToken');
        if (!token) return;

        const fetchDevices = async () => {
            try {
                setLoadingDevices(true);
                const res = await getDevices(token);
                setDeviceList(res.devices || []);
                if (res.devices && res.devices.length > 0) {
                    setSelectedDeviceId(res.devices[0]._id);
                    setSelectedImei(res.devices[0].imei || '');
                }
            } catch (err) {
                console.error('Load devices error:', err);
            } finally {
                setLoadingDevices(false);
            }
        };

        fetchDevices();
    }, []);

    // Init map
    useEffect(() => {
        if (!LMap) return;

        const initialLat = 10.755937;
        const initialLon = 106.612587;

        const map = LMap.map('iky-cruise-map', {
            center: [initialLat, initialLon],
            zoom: 15,
            minZoom: 3,
            maxZoom: 22,
        });

        mapRef.current = map;

        LMap.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxNativeZoom: 19,
            maxZoom: 22,
        }).addTo(map);

        return () => map.remove();
    }, [LMap]);

    // fetch address when not playing (raw)
    useEffect(() => {
        if (!rawRouteData.length) return;
        if (isPlayingRef.current) return;
        fetchAddressForPoint(activeIndex);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeIndex, rawRouteData]);

    // scroll list on activeIndex
    useEffect(() => {
        if (!rawRouteData.length) return;
        smoothScrollToItem(activeIndex);
    }, [activeIndex, rawRouteData]);

    // highlight marker on map using activeRenderIndex
    useEffect(() => {
        if (!mapRouteData.length) return;
        highlightRenderMarker(activeRenderIndex);
    }, [activeRenderIndex, mapRouteData]);

    // update popup when raw changes
    useEffect(() => {
        if (!popupRef.current || !rawRouteData.length) return;
        const p = rawRouteData[activeIndex];
        if (!p || p.lat == null || p.lon == null) return;
        popupRef.current.setLatLng([p.lat, p.lon]).setContent(buildPopupHtml(p, t));
    }, [rawRouteData, activeIndex, t]);

    // ===============================
    // Render route on map (mapRouteData)
    // ===============================
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !LMap) return;

        if (polylineRef.current) {
            map.removeLayer(polylineRef.current);
            polylineRef.current = null;
        }
        if (movingMarkerRef.current) {
            map.removeLayer(movingMarkerRef.current);
            movingMarkerRef.current = null;
        }

        pointMarkersRef.current.forEach((m) => m && map.removeLayer(m));
        pointMarkersRef.current = [];

        abLabelMarkersRef.current.forEach((m) => m && map.removeLayer(m));
        abLabelMarkersRef.current = [];

        highlightedMarkerRef.current = null;

        if (!mapRouteData.length) return;

        const isValidPoint = (p) => p && typeof p.lat === 'number' && typeof p.lon === 'number';

        const firstRenderIdx = mapRouteData.findIndex(isValidPoint);
        if (firstRenderIdx === -1) return;

        let lastRenderIdx = firstRenderIdx;
        for (let i = mapRouteData.length - 1; i >= 0; i--) {
            if (isValidPoint(mapRouteData[i])) {
                lastRenderIdx = i;
                break;
            }
        }

        const hasMultiPoints = firstRenderIdx !== lastRenderIdx;

        const latlngs = [];

        for (let renderIdx = 0; renderIdx < mapRouteData.length; renderIdx++) {
            const p = mapRouteData[renderIdx];
            if (!isValidPoint(p)) continue;

            const isStart = renderIdx === firstRenderIdx;
            const isEnd = renderIdx === lastRenderIdx;

            latlngs.push([p.lat, p.lon]);

            const marker = LMap.circleMarker([p.lat, p.lon], {
                radius: isStart || isEnd ? 6 : 4,
                weight: 2,
                color: '#ffffff',
                fillColor: isEnd ? '#ef4444' : '#22c55e',
                fillOpacity: 1,
            }).addTo(map);

            marker.bringToFront();
            pointMarkersRef.current[renderIdx] = marker;

            marker.on('click', () => {
                const rawIdx = mapToRawIndexRef.current?.[renderIdx];
                if (typeof rawIdx === 'number') handlePointClickRaw(rawIdx);
            });

            if (hasMultiPoints && (isStart || isEnd)) {
                const label = isStart ? 'A' : 'B';
                const divIcon = LMap.divIcon({
                    className: 'iky-cruise-ab-icon',
                    html: `<span>${label}</span>`,
                    iconSize: [28, 28],
                    iconAnchor: [14, 14],
                });

                const abMarker = LMap.marker([p.lat, p.lon], {
                    icon: divIcon,
                    zIndexOffset: 2000,
                }).addTo(map);

                abLabelMarkersRef.current.push(abMarker);

                abMarker.on('click', () => {
                    const rawIdx = mapToRawIndexRef.current?.[renderIdx];
                    if (typeof rawIdx === 'number') handlePointClickRaw(rawIdx);
                });
            }
        }

        if (!latlngs.length) return;

        polylineRef.current = LMap.polyline(latlngs, {
            color: '#f97316',
            weight: 2,
            opacity: 0.6,
            lineCap: 'round',
            lineJoin: 'round',
            interactive: false,
        }).addTo(map);

        polylineRef.current.bringToBack();

        const firstPoint = mapRouteData[firstRenderIdx];
        if (!firstPoint || firstPoint.lat == null || firstPoint.lon == null) return;

        const customIcon = LMap.icon({
            iconUrl: markerIconImg.src,
            iconSize: [50, 50],
            iconAnchor: [24, 24],
        });

        movingMarkerRef.current = LMap.marker([firstPoint.lat, firstPoint.lon], { icon: customIcon }).addTo(map);
        movingMarkerRef.current.setZIndexOffset(15000);

        stopPlaying();

        setActiveRenderIndex(firstRenderIdx);
        const rawIdx = mapToRawIndexRef.current?.[firstRenderIdx];
        if (typeof rawIdx === 'number') setActiveIndex(rawIdx);

        const bounds = polylineRef.current.getBounds();
        map.fitBounds(bounds, {
            padding: [40, 40],
            maxZoom: 19,
        });

        map.invalidateSize();
        map.scrollWheelZoom.enable();
        map.dragging.enable();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mapRouteData, LMap]);

    // ===============================
    // ✅ Smooth animation loop (constant speed by meters)
    // ===============================
    useEffect(() => {
        if (!mapRouteData.length || !movingMarkerRef.current) return;

        isPlayingRef.current = isPlaying;

        if (!isPlaying) {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
            return;
        }

        // tốc độ theo mét/giây (bạn chỉnh cho hợp)
        const BASE_SPEED_MPS = 15; // ~28.8 km/h
        const speedMps = BASE_SPEED_MPS * playbackRate;

        // resume từ vị trí slider hiện tại: traveledM = cum[activeRenderIndex]
        let traveledM = cumMRef.current?.[activeRenderIndex] ?? 0;

        // segment index bắt đầu gần đó
        let segIdx = Math.max(0, Math.min(mapRouteData.length - 2, activeRenderIndex));
        let lastTime = performance.now();

        // throttle UI update để table không giật
        const UI_THROTTLE_MS = 800;
        let lastUi = 0;

        const step = (now) => {
            if (!isPlayingRef.current) return;

            const dtMs = now - lastTime;
            lastTime = now;

            traveledM += (dtMs / 1000) * speedMps;

            const totalM = totalMRef.current || 0;
            if (totalM <= 0 || traveledM >= totalM) {
                const last = mapRouteData.length - 1;
                const pLast = mapRouteData[last];
                if (pLast?.lat != null && pLast?.lon != null) {
                    movingMarkerRef.current.setLatLng([pLast.lat, pLast.lon]);
                }
                setActiveRenderIndex(last);
                const rawLast = mapToRawIndexRef.current?.[last];
                if (typeof rawLast === 'number') setActiveIndex(rawLast);

                setIsPlaying(false);
                isPlayingRef.current = false;
                return;
            }

            // tìm segment: cum[segIdx] <= traveled < cum[segIdx+1]
            const cum = cumMRef.current;
            while (segIdx < cum.length - 2 && traveledM > cum[segIdx + 1]) segIdx++;

            const segLen = segMRef.current?.[segIdx] || 0;
            const a = mapRouteData[segIdx];
            const b = mapRouteData[segIdx + 1];

            if (!a || !b || segLen <= 0 || a.lat == null || a.lon == null || b.lat == null || b.lon == null) {
                animationFrameRef.current = requestAnimationFrame(step);
                return;
            }

            const segStart = cum[segIdx];
            const t01 = (traveledM - segStart) / segLen;

            const lat = a.lat + (b.lat - a.lat) * t01;
            const lon = a.lon + (b.lon - a.lon) * t01;
            movingMarkerRef.current.setLatLng([lat, lon]);

            const bearing = getBearing(a.lat, a.lon, b.lat, b.lon);
            const el = movingMarkerRef.current.getElement();
            if (el) {
                el.style.transformOrigin = 'center center';
                const baseTransform = el.style.transform.replace(/rotate\([^)]*\)/g, '');
                el.style.transform = `${baseTransform} rotate(${normalizeAngle(bearing)}deg)`;
            }

            // throttle sync UI
            if (now - lastUi > UI_THROTTLE_MS) {
                lastUi = now;

                const renderIdx = segIdx; // sync theo segment đang chạy
                setActiveRenderIndex(renderIdx);

                const rawIdx = mapToRawIndexRef.current?.[renderIdx];
                if (typeof rawIdx === 'number') setActiveIndex(rawIdx);
            }

            animationFrameRef.current = requestAnimationFrame(step);
        };

        animationFrameRef.current = requestAnimationFrame(step);

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
        };
    }, [isPlaying, mapRouteData, playbackRate, activeRenderIndex]);

    // LOAD ROUTE
    const handleLoadRoute = async () => {
        if (typeof window === 'undefined') return;

        const token = localStorage.getItem('accessToken');

        if (!token) {
            setError(t.error.noToken);
            return;
        }

        if (!selectedDeviceId || !selectedImei) {
            setError(t.error.noVehicle);
            return;
        }

        if (!start || !end) {
            setError(t.error.missingTime);
            return;
        }

        const currentDevice = deviceList.find((d) => d._id === selectedDeviceId);
        if (!currentDevice) {
            setError(t.error.noVehicleInfo);
            return;
        }

        try {
            setLoadingRoute(true);
            setError(null);

            stopPlaying();

            addressCacheRef.current = {};
            setRoadKm(null);
            setRoadKmError(null);
            setAddressError(null);

            setRawRouteData([]);
            setMapRouteData([]);
            mapToRawIndexRef.current = [];
            setTotalKm(0);
            setActiveIndex(0);
            setActiveRenderIndex(0);

            const apiStart = toApiDateTime(start);
            const apiEnd = toApiDateTime(end);

            const fetchPageFn = async (page, limit) => {
                return await getCruiseHistory(token, {
                    imei: selectedImei,
                    start: apiStart,
                    end: apiEnd,
                    page,
                    limit,
                });
            };

            const result = await cruiseCacheManager.smartLoadRoute(
                selectedImei,
                apiStart,
                apiEnd,
                fetchPageFn,
                FETCH_PAGE_LIMIT,
            );

            const allData = result.data;

            if (!allData || allData.length === 0) {
                setRawRouteData([]);
                setMapRouteData([]);
                setError(t.error.noData);
                return;
            }

            const plate = currentDevice.license_plate || '';
            const vehicleName =
                currentDevice.vehicle_category_id?.name || currentDevice.vehicle_category_id?.model || '';
            const manufacturer = currentDevice.device_category_id?.name || currentDevice.device_category_id?.code || '';

            const mapped = allData.map((item) => ({
                lat: item.lat,
                lon: item.lon,
                licensePlate: plate,
                vehicleName,
                manufacturer,
                selector: item._id,
                duration: 0,
                dateTime: item.tim || item.created || '',
                machineStatus: item.acc === 1 ? t.status.engineOn : t.status.engineOff,
                velocity: item.spd != null ? `${item.spd} km/h` : `0 km/h`,
                vehicleStatus: item.acc === 1 ? t.status.vehicleRunning : t.status.vehicleParking,
                gpsSignText: item.gps === 1 ? t.status.gpsAvailable : '',
                address: '',
            }));

            // RAW
            setRawRouteData(mapped);
            setActiveIndex(0);
            setTotalKm(calcTotalDistanceKm(mapped));

            // MAP sample
            const sample = buildMapSample(mapped, VISUAL_MAX_POINTS_ON_MAP, MAP_MIN_SAMPLE_DIST_M);
            mapToRawIndexRef.current = sample.indices;
            setMapRouteData(sample.points);

            // Goong road (A->B)
            const valid = mapped.filter((p) => typeof p.lat === 'number' && typeof p.lon === 'number');
            if (valid.length >= 2) {
                setRoadKmLoading(true);
                const startPoint = valid[0];
                const endPoint = valid[valid.length - 1];
                const km = await getGoongRoadDistanceKm(startPoint, endPoint);
                if (km != null) setRoadKm(km);
                else setRoadKmError('Không lấy được quãng đường đường bộ từ Goong');
            }
        } catch (e) {
            console.error(e);
            setError(t.error.loadFailed);
        } finally {
            setLoadingRoute(false);
            setRoadKmLoading(false);
        }
    };

    const handleStart = () => {
        if (!mapRouteData.length) return;
        setIsPlaying(true);
        isPlayingRef.current = true;
    };

    const handlePause = () => stopPlaying();

    const handleReset = () => {
        if (!mapRouteData.length) return;

        stopPlaying();

        setActiveRenderIndex(0);
        const rawIdx = mapToRawIndexRef.current?.[0] ?? 0;
        setActiveIndex(rawIdx);

        const p = mapRouteData[0];
        if (movingMarkerRef.current && mapRef.current && p?.lat != null && p?.lon != null) {
            movingMarkerRef.current.setLatLng([p.lat, p.lon]);
            mapRef.current.panTo([p.lat, p.lon]);
        }
        highlightRenderMarker(0);
    };

    return (
        <div className="iky-cruise">
            {/* LEFT PANEL */}
            <aside className="iky-cruise__left">
                <div className="iky-cruise__left-card">
                    <div className="iky-cruise__left-header">{t.title}</div>

                    <div className="iky-cruise__form">
                        <div className="iky-cruise__form-row">
                            <label>{t.form.selectVehicle}</label>

                            <Select
                                showSearch
                                style={{ width: '100%' }}
                                placeholder={t.form.searchVehiclePlaceholder || 'Nhập biển số / IMEI / SĐT'}
                                loading={loadingDevices}
                                value={selectedDeviceId || undefined}
                                onSearch={(value) => setDeviceSearchText(value)}
                                onChange={(value) => {
                                    setSelectedDeviceId(value);
                                    const device = deviceList.find((d) => d._id === value);
                                    setSelectedImei(device?.imei || '');
                                }}
                                filterOption={(input, option) => option?.searchable?.includes(input.toLowerCase())}
                                options={deviceOptions}
                            />
                        </div>

                        <div className="iky-cruise__form-row iky-cruise__quick-row">
                            <div className="iky-cruise__quick-group">
                                <button
                                    type="button"
                                    className="iky-cruise__quick-btn"
                                    onClick={() => handlePresetRange(1)}
                                >
                                    {t.quick.oneHour}
                                </button>
                                <button
                                    type="button"
                                    className="iky-cruise__quick-btn"
                                    onClick={() => handlePresetRange(8)}
                                >
                                    {t.quick.eightHours}
                                </button>
                                <button
                                    type="button"
                                    className="iky-cruise__quick-btn"
                                    onClick={() => handlePresetRange(24)}
                                >
                                    {t.quick.twentyFourHours}
                                </button>
                            </div>
                        </div>

                        <div className="iky-cruise__form-row">
                            <label>{t.form.from}</label>
                            <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
                        </div>
                        <div className="iky-cruise__form-row">
                            <label>{t.form.to}</label>
                            <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
                        </div>

                        <button className="iky-cruise__load-btn" onClick={handleLoadRoute} disabled={loadingRoute}>
                            {loadingRoute ? t.form.loadingRoute : t.form.loadRoute}
                        </button>

                        {error && <div className="iky-cruise__error">{error}</div>}
                        {addressError && rawRouteData.length > 0 && (
                            <div className="iky-cruise__error" style={{ marginTop: 4 }}>
                                {addressError}
                            </div>
                        )}
                        {roadKmError && (
                            <div className="iky-cruise__error" style={{ marginTop: 4 }}>
                                {roadKmError}
                            </div>
                        )}
                    </div>

                    {rawRouteData.length > 0 && (
                        <>
                            <div className="iky-cruise__result">
                                <span>{t.result.label}</span>
                                <span>
                                    {activeIndex + 1}/{rawRouteData.length}
                                </span>
                            </div>

                            <div className="iky-cruise__distance">
                                <span>{t.result.totalDistance}</span>
                                <span>
                                    {totalKm.toFixed(3)} {t.result.unitKm || 'km'}
                                </span>
                            </div>

                            {/* {roadKmLoading ? (
                                <div className="iky-cruise__distance">
                                    <span>Road (Goong)</span>
                                    <span>...</span>
                                </div>
                            ) : roadKm != null ? (
                                <div className="iky-cruise__distance">
                                    <span>Road (Goong)</span>
                                    <span>{roadKm.toFixed(3)} km</span>
                                </div>
                            ) : null} */}

                            <div className="iky-cruise__controls">
                                <button onClick={handleStart} disabled={isPlaying || !mapRouteData.length}>
                                    ▶
                                </button>
                                <button onClick={handlePause} disabled={!isPlaying}>
                                    ⏸
                                </button>
                                <button onClick={handleReset} disabled={!mapRouteData.length}>
                                    ⏹
                                </button>

                                <select
                                    value={playbackRate}
                                    onChange={(e) => setPlaybackRate(Number(e.target.value))}
                                    className="iky-cruise__rate"
                                >
                                    <option value={0.5}>0.5x</option>
                                    <option value={1}>1x</option>
                                    <option value={1.5}>1.5x</option>
                                    <option value={2}>2x</option>
                                </select>

                                {/* ✅ slider chạy theo MAP points */}
                                <input
                                    type="range"
                                    min={0}
                                    max={Math.max(0, mapRouteData.length - 1)}
                                    value={activeRenderIndex}
                                    onChange={handleSliderChange}
                                />
                            </div>

                            <div className="iky-cruise__list">
                                <div className="iky-cruise__table">
                                    <div className="iky-cruise__table-header">
                                        <div className="iky-cruise__table-cell iky-cruise__table-cell--time">
                                            {t.table?.time || 'Thời gian'}
                                        </div>
                                        <div className="iky-cruise__table-cell">{t.table?.lat || 'Vĩ độ'}</div>
                                        <div className="iky-cruise__table-cell">{t.table?.lon || 'Kinh độ'}</div>
                                        <div className="iky-cruise__table-cell">{t.table?.speed || 'V (GPS)'}</div>
                                    </div>

                                    {/* TABLE = RAW FULL */}
                                    <div className="iky-cruise__table-body" ref={listWrapRef}>
                                        <AntList
                                            size="small"
                                            dataSource={rawRouteData}
                                            split={false}
                                            renderItem={(p, index) => {
                                                const isActive = index === activeIndex;
                                                return (
                                                    <AntList.Item
                                                        key={p?.selector || index}
                                                        id={`cruise-item-${index}`}
                                                        className={
                                                            'iky-cruise__table-row' +
                                                            (isActive ? ' iky-cruise__table-row--active' : '')
                                                        }
                                                        onClick={() => handlePointClickRaw(index)}
                                                    >
                                                        <Tooltip title={formatDateFromDevice(p.dateTime)}>
                                                            <div className="iky-cruise__table-cell iky-cruise__table-cell--time">
                                                                {formatDateFromDevice(p.dateTime)}
                                                            </div>
                                                        </Tooltip>

                                                        <Tooltip
                                                            title={`Vĩ độ: ${
                                                                typeof p.lat === 'number' ? p.lat.toFixed(6) : 'N/A'
                                                            }`}
                                                        >
                                                            <div className="iky-cruise__table-cell">
                                                                {typeof p.lat === 'number' ? p.lat.toFixed(6) : ''}
                                                            </div>
                                                        </Tooltip>

                                                        <Tooltip
                                                            title={`Kinh độ: ${
                                                                typeof p.lon === 'number' ? p.lon.toFixed(6) : 'N/A'
                                                            }`}
                                                        >
                                                            <div className="iky-cruise__table-cell">
                                                                {typeof p.lon === 'number' ? p.lon.toFixed(6) : ''}
                                                            </div>
                                                        </Tooltip>

                                                        <Tooltip title={`Vận tốc: ${p?.velocity || 'N/A'}`}>
                                                            <div className="iky-cruise__table-cell">{p?.velocity}</div>
                                                        </Tooltip>
                                                    </AntList.Item>
                                                );
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </aside>

            {/* MAP */}
            <div className="iky-cruise__map">
                <div id="iky-cruise-map" className="iky-cruise__map-inner" />
                {loadingRoute && (
                    <div className="iky-cruise__map-overlay">
                        <Image
                            width={600}
                            height={600}
                            src={typeof loading === 'string' ? loading : loading.src}
                            alt="Loading route"
                            className="iky-cruise__loading-gif"
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default CruisePage;
