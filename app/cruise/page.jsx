'use client';

import React, { useState, useEffect, useRef } from 'react';
import './cruise.css';

import markerIconImg from '../assets/marker-red.png';

import { getCruiseHistory } from '../lib/api/cruise';
import { getDevices } from '../lib/api/devices';
import cruiseCacheManager from '../lib/cache/CruiseCacheManager';

import vi from '../locales/vi.json';
import en from '../locales/en.json';
import { usePathname } from 'next/navigation';
import { formatDateFromDevice } from '../util/FormatDate';

import { FixedSizeList as List } from 'react-window';
import loading from '../assets/loading.gif';
import Image from 'next/image';
import { Tooltip, Select } from 'antd';

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
].filter(Boolean);

const VIETMAP_KEYS = [
    process.env.NEXT_PUBLIC_VIETMAP_API_KEY,
    process.env.NEXT_PUBLIC_VIETMAP_API_KEY1,
    process.env.NEXT_PUBLIC_VIETMAP_API_KEY2,
    process.env.NEXT_PUBLIC_VIETMAP_API_KEY3,
    process.env.NEXT_PUBLIC_VIETMAP_API_KEY4,
].filter(Boolean);

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_API_KEY;
const TOMTOM_TOKEN = process.env.NEXT_PUBLIC_TOMTOM_API_KEY || process.env.NEXT_PUBLIC_TOMTOM_API_KEY_1 || '';
const TRACKASIA_KEY = process.env.NEXT_PUBLIC_TRACKASIA_API_KEY || '';
const OPENCAGE_KEY = process.env.NEXT_PUBLIC_OPENCAGE_API_KEY || '';

// ===============================
// 🔑 NHIỀU GOONG API KEY + XOAY VÒNG
// ===============================
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
// ⚙️ CẤU HÌNH
// ===============================
const FETCH_PAGE_LIMIT = 1000;
const VISUAL_MAX_POINTS_ON_MAP = 3000;

// ====== util GPS dùng chung ======
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

// 🔥 gom điểm trong bán kính ~100m
const MIN_CLUSTER_DIST_M = 100;

const compressRouteByDistance = (points, thresholdM = MIN_CLUSTER_DIST_M) => {
    if (!points || points.length === 0) return [];

    const result = [];
    let lastKept = null;

    for (let i = 0; i < points.length; i++) {
        const p = points[i];
        if (typeof p.lat !== 'number' || typeof p.lon !== 'number') {
            continue;
        }

        if (!lastKept) {
            result.push(p);
            lastKept = p;
            continue;
        }

        const d = distanceMeters({ lat: lastKept.lat, lon: lastKept.lon }, { lat: p.lat, lon: p.lon });

        // chỉ giữ nếu cách điểm trước đó >= threshold
        if (d >= thresholdM) {
            result.push(p);
            lastKept = p;
        }
    }

    return result;
};

const getVisualIndicesForMap = (list) => {
    const len = list.length;
    if (len <= VISUAL_MAX_POINTS_ON_MAP) {
        return list.map((_, idx) => idx);
    }

    const step = Math.ceil(len / VISUAL_MAX_POINTS_ON_MAP);
    const result = [];

    for (let i = 0; i < len; i += step) {
        result.push(i);
    }

    if (result[result.length - 1] !== len - 1) {
        result.push(len - 1);
    }

    return result;
};

// Chọn địa chỉ đẹp nhất từ Goong v2
const pickBestGoongV2Address = (results = []) => {
    if (!Array.isArray(results) || results.length === 0) return '';

    const poiCandidates = results.filter((r) => {
        const name = (r.name || '').trim();
        const addr = (r.address || r.formatted_address || '').trim();
        const formatted = (r.formatted_address || '').trim();
        const types = Array.isArray(r.types) ? r.types : [];

        const isHouseNumberType = types.includes('house_number');
        const startsWithDigit = /^\d/.test(name); // "38-40 Đường..." => coi là số nhà

        // POI hợp lệ:
        // - có name
        // - name không bắt đầu bằng số
        // - name khác address / formatted
        // - không phải house_number
        return name && !startsWithDigit && name !== addr && name !== formatted && !isHouseNumberType;
    });

    const chosen = poiCandidates[0] || results[0];

    const name = (chosen.name || '').trim();
    const formatted = (chosen.formatted_address || '').trim();
    const addr = (chosen.address || '').trim();

    // Nếu formatted_address đã đầy đủ thì dùng luôn
    if (formatted) return formatted;

    // Nếu không có formatted thì tự ghép
    if (name && addr) return `${name}, ${addr}`;
    if (addr) return addr;
    if (name) return name;

    return '';
};

// Goong Geocode (xoay key)
// Goong Geocode v2 (xoay key) + ưu tiên POI (công ty, cây xăng, nhà sách...)
const callGoongWithRotation = async (lat, lon, lang = 'vi') => {
    if (!GOONG_KEYS.length) return '';

    for (let i = 0; i < GOONG_KEYS.length; i++) {
        const apiKey = getCurrentGoongKey();
        if (!apiKey) break;

        try {
            const url =
                `https://rsapi.goong.io/v2/geocode?latlng=${lat},${lon}` +
                `&api_key=${apiKey}` +
                `&limit=2` + // như bạn test: 2 là đủ 1 địa chỉ + 1 POI
                `&has_deprecated_administrative_unit=true` +
                `&language=${lang}`;

            const res = await fetch(url);

            let data = null;
            try {
                data = await res.json();
            } catch (e) {
                console.warn('Parse JSON Goong v2 fail, đổi key...');
                moveToNextGoongKey();
                continue;
            }

            // quota / forbidden
            if (res.status === 429 || res.status === 403 || data?.error_code === 429 || data?.error_code === 403) {
                console.warn('Goong v2 key bị limit/quota, đổi key...');
                moveToNextGoongKey();
                continue;
            }

            if (!res.ok) {
                console.warn('Goong v2 HTTP error', res.status);
                moveToNextGoongKey();
                continue;
            }

            const addr = pickBestGoongV2Address(data?.results || []);
            if (addr) return addr;

            // không có địa chỉ → thử key khác
            moveToNextGoongKey();
        } catch (err) {
            console.error('Goong v2 exception với key hiện tại:', err);
            moveToNextGoongKey();
        }
    }

    return '';
};

// ⭐ Goong DistanceMatrix: tính quãng đường đường bộ A→B
const getGoongRoadDistanceKm = async (startPoint, endPoint) => {
    if (!GOONG_KEYS.length) return null;
    const apiKey = getCurrentGoongKey();
    if (!apiKey) return null;

    const origins = `${startPoint.lat},${startPoint.lon}`;
    const destinations = `${endPoint.lat},${endPoint.lon}`;

    // 👉 dùng v2
    const url = `https://rsapi.goong.io/v2/distancematrix?origins=${origins}&destinations=${destinations}&vehicle=car&api_key=${apiKey}`;

    try {
        const res = await fetch(url);
        const data = await res.json().catch(() => null);

        // quota / forbidden → chuyển key
        if (res.status === 429 || res.status === 403 || data?.error_code === 429 || data?.error_code === 403) {
            console.warn('Goong DistanceMatrix v2 limit/forbidden');
            moveToNextGoongKey();
            return null;
        }

        if (!res.ok || !data) {
            console.warn('Goong DistanceMatrix v2 HTTP/body error', res.status);
            return null;
        }

        // v2 vẫn rows/elements giống v1
        const element = data?.rows?.[0]?.elements?.[0];
        const meters = element?.distance?.value;

        if (typeof meters !== 'number') return null;
        return meters / 1000; // km
    } catch (err) {
        console.error('Goong DistanceMatrix v2 exception', err);
        return null;
    }
};

// popup HTML
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

    const [routeData, setRouteData] = useState([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [totalKm, setTotalKm] = useState(0);
    const [deviceSearchText, setDeviceSearchText] = useState('');

    // ⭐ quãng đường đường bộ (Goong)
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
    const pointMarkersRef = useRef([]);
    const animationFrameRef = useRef(null);
    const popupRef = useRef(null);
    const highlightedMarkerRef = useRef(null);
    const abLabelMarkersRef = useRef([]); // marker A/B

    const animStateRef = useRef({
        segmentIndex: 0,
        t: 0,
    });

    const isPlayingRef = useRef(false);
    const listRef = useRef(null);

    const addressCacheRef = useRef({});

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

    const toApiDateTime = (value) => {
        if (!value) return '';

        const [date, timeRaw] = value.split('T');
        if (!timeRaw) return date;

        const time = timeRaw.slice(0, 8);
        if (time.length === 5) {
            return `${date} ${time}:00`;
        }

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

    // 🔍 build options cho Select + highlight text trùng
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

            const rawLabel = `${plate} – ${imei}${phone ? ' – ' + phone : ''}`;

            return {
                value: d._id,
                // dùng để filterOption
                searchable: rawLabel.toLowerCase(),
                // label hiển thị, có highlight
                label: highlightText(rawLabel),
            };
        });
    }, [deviceList, t, deviceSearchText]);

    const highlightMarker = (idx) => {
        if (!pointMarkersRef.current.length) return;

        if (highlightedMarkerRef.current) {
            highlightedMarkerRef.current.setStyle({
                radius: 4,
                weight: 2,
                color: '#ffffff',
                fillColor: '#22c55e',
            });
        }

        const mk = pointMarkersRef.current[idx];
        if (!mk) return;

        mk.setStyle({
            radius: 7,
            weight: 2,
            color: '#ffffff',
            fillColor: '#facc15',
        });

        highlightedMarkerRef.current = mk;
    };

    const smoothScrollToItem = (idx) => {
        if (!listRef.current) return;
        listRef.current.scrollToItem(idx, 'center');
    };

    // fetch address + cache
    // fetch address + cache
    // fetch address + cache
    const fetchAddressForPoint = async (idx) => {
        if (!routeData.length) return;
        const point = routeData[idx];
        if (!point) return;

        const { lat, lon, address } = point;
        if (lat == null || lon == null) return;
        if (address) return;

        const latNum = Number(lat);
        const lonNum = Number(lon);
        if (Number.isNaN(latNum) || Number.isNaN(lonNum)) return;

        const key = `${latNum.toFixed(6)},${lonNum.toFixed(6)}`;

        const cachedAddr = addressCacheRef.current[key];
        if (cachedAddr) {
            setRouteData((prev) => {
                const clone = [...prev];
                clone[idx] = { ...clone[idx], address: cachedAddr };
                return clone;
            });
            return;
        }

        setLoadingAddress(true);
        setAddressError(null);

        const lang = isEn ? 'en' : 'vi';

        // ================================
        // PROVIDERS (CÓ LANGUAGE)
        // ================================

        // 1️⃣ Goong
        const tryGoong = async () => {
            try {
                return (await callGoongWithRotation(latNum, lonNum, lang)) || '';
            } catch {
                return '';
            }
        };

        // 2️⃣ VietMap (không hỗ trợ language)
        const tryVietMap = async () => {
            for (let i = 0; i < VIETMAP_KEYS.length; i++) {
                const keyVm = VIETMAP_KEYS[i];
                const url = `https://api.vnmap.com.vn/geocoding?latlng=${latNum},${lonNum}&key=${keyVm}`;
                try {
                    const res = await fetch(url);
                    if (res.status === 403 || res.status === 429) continue;
                    if (!res.ok) continue;
                    const data = await res.json();
                    const addr = data?.results?.[0]?.formatted_address || '';
                    if (addr) return addr;
                } catch {}
            }
            return '';
        };

        // 3️⃣ TrackAsia (không hỗ trợ language)
        const tryTrackAsia = async () => {
            if (!TRACKASIA_KEY) return '';
            const url = `https://maps.track-asia.com/api/v2/geocode/json?latlng=${latNum},${lonNum}&key=${TRACKASIA_KEY}`;
            try {
                const res = await fetch(url);
                if (!res.ok) return '';
                const data = await res.json();
                return data?.results?.[0]?.formatted_address || '';
            } catch {
                return '';
            }
        };

        // 4️⃣ OpenCage (CÓ language)
        const tryOpenCage = async () => {
            if (!OPENCAGE_KEY) return '';
            const url = `https://api.opencagedata.com/geocode/v1/json?q=${latNum}+${lonNum}&language=${lang}&key=${OPENCAGE_KEY}`;
            try {
                const res = await fetch(url);
                if (!res.ok) return '';
                const data = await res.json();
                return data?.results?.[0]?.formatted || '';
            } catch {
                return '';
            }
        };

        // 5️⃣ TomTom (CÓ language)
        const tryTomTom = async () => {
            if (!TOMTOM_TOKEN) return '';
            const ttLang = lang === 'en' ? 'en-US' : 'vi-VN';
            const url = `https://api.tomtom.com/search/2/reverseGeocode/${latNum},${lonNum}.json?language=${ttLang}&key=${TOMTOM_TOKEN}`;
            try {
                const res = await fetch(url);
                if (!res.ok) return '';
                const data = await res.json();
                return data?.addresses?.[0]?.address?.freeformAddress || '';
            } catch {
                return '';
            }
        };

        // 6️⃣ Mapbox (CÓ language)
        const tryMapbox = async () => {
            if (!MAPBOX_TOKEN) return '';
            const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lonNum},${latNum}.json?language=${lang}&limit=1&access_token=${MAPBOX_TOKEN}`;
            try {
                const res = await fetch(url);
                if (!res.ok) return '';
                const data = await res.json();
                return data?.features?.[0]?.place_name || '';
            } catch {
                return '';
            }
        };

        // 7️⃣ Nominatim (CÓ language)
        const tryNominatim = async () => {
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latNum}&lon=${lonNum}&zoom=18&addressdetails=1&accept-language=${lang}`;
            try {
                const res = await fetch(url);
                if (!res.ok) return '';
                const data = await res.json();
                return data?.display_name || '';
            } catch {
                return '';
            }
        };

        // ===========================
        // THỰC THI TUẦN TỰ ƯU TIÊN
        // ===========================
        const providers = [tryGoong, tryVietMap, tryTrackAsia, tryOpenCage, tryTomTom, tryMapbox, tryNominatim];

        let addr = '';

        for (const fn of providers) {
            addr = await fn();
            if (addr) break;
        }

        if (!addr) {
            setAddressError(t.error.addressFailed);
        }

        addressCacheRef.current[key] = addr;

        setRouteData((prev) => {
            const clone = [...prev];
            clone[idx] = { ...clone[idx], address: addr };
            return clone;
        });

        setLoadingAddress(false);
    };

    const handleSelectPoint = (idx) => {
        if (!routeData.length) return;

        const p = routeData[idx];

        setActiveIndex(idx);

        if (p.lat == null || p.lon == null) {
            setIsPlaying(false);
            isPlayingRef.current = false;
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
            return;
        }

        setIsPlaying(false);
        isPlayingRef.current = false;
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }

        animStateRef.current = { segmentIndex: idx, t: 0 };

        if (mapRef.current) {
            mapRef.current.panTo([p.lat, p.lon]);
        }
    };

    const handlePointClick = (idx) => {
        if (!routeData.length) return;

        const p = routeData[idx];

        setActiveIndex(idx);
        handleSelectPoint(idx);

        if (p) {
            openInfoPopup(p);
        }
    };

    const handleSliderChange = (e) => {
        const idx = Number(e.target.value);
        handlePointClick(idx);
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

    // Load saved filter
    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!deviceList.length) return;

        const saved = localStorage.getItem('iky_cruise_filter');
        if (!saved) return;

        try {
            const parsed = JSON.parse(saved);

            if (parsed.deviceId) {
                const exists = deviceList.some((d) => d._id === parsed.deviceId);
                if (exists) {
                    setSelectedDeviceId(parsed.deviceId);
                }
            }
            if (parsed.start) setStart(parsed.start);
            if (parsed.end) setEnd(parsed.end);
            if (parsed.imei) setSelectedImei(parsed.imei);
        } catch (e) {
            console.warn('Parse iky_cruise_filter error', e);
        }
    }, [deviceList]);

    const handleDeviceChange = (e) => {
        const deviceId = e.target.value;
        setSelectedDeviceId(deviceId);

        const device = deviceList.find((d) => d._id === deviceId);
        if (device) {
            setSelectedImei(device.imei || '');
        } else {
            setSelectedImei('');
        }
    };

    // ===============================
    // Init map  ⭐ FIX NỀN XÁM  ⭐
    // ===============================
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

    // Distance A→Z (Haversine, trên route đã nén)
    useEffect(() => {
        if (routeData.length < 2) {
            setTotalKm(0);
            return;
        }

        const coords = routeData.filter((p) => typeof p.lat === 'number' && typeof p.lon === 'number');
        if (coords.length < 2) {
            setTotalKm(0);
            return;
        }

        const A = coords[0];
        const Z = coords[coords.length - 1];

        const meters = distanceMeters({ lat: A.lat, lon: A.lon }, { lat: Z.lat, lon: Z.lon });

        setTotalKm(meters / 1000);
    }, [routeData]);

    // ===============================
    // Render route on map
    // ===============================
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !LMap) return;

        // cleanup polyline + moving marker
        if (polylineRef.current) {
            map.removeLayer(polylineRef.current);
            polylineRef.current = null;
        }
        if (movingMarkerRef.current) {
            map.removeLayer(movingMarkerRef.current);
            movingMarkerRef.current = null;
        }

        // cleanup point markers
        pointMarkersRef.current.forEach((m) => m && map.removeLayer(m));
        pointMarkersRef.current = [];

        // cleanup A/B markers
        abLabelMarkersRef.current.forEach((m) => m && map.removeLayer(m));
        abLabelMarkersRef.current = [];

        highlightedMarkerRef.current = null;

        if (!routeData.length) return;

        const isValidPoint = (p) => p && typeof p.lat === 'number' && typeof p.lon === 'number';

        const firstIdx = routeData.findIndex(isValidPoint);
        if (firstIdx === -1) return;

        let lastIdx = firstIdx;
        for (let i = routeData.length - 1; i >= 0; i--) {
            if (isValidPoint(routeData[i])) {
                lastIdx = i;
                break;
            }
        }

        const hasMultiPoints = firstIdx !== lastIdx;

        let visualIndices = getVisualIndicesForMap(routeData);
        if (!visualIndices.includes(firstIdx)) visualIndices.unshift(firstIdx);
        if (!visualIndices.includes(lastIdx)) visualIndices.push(lastIdx);
        visualIndices = [...new Set(visualIndices)].sort((a, b) => a - b);

        const latlngs = [];

        visualIndices.forEach((idx) => {
            const p = routeData[idx];
            if (!isValidPoint(p)) return;

            const isStart = idx === firstIdx;
            const isEnd = idx === lastIdx;

            latlngs.push([p.lat, p.lon]);

            const marker = LMap.circleMarker([p.lat, p.lon], {
                radius: isStart || isEnd ? 6 : 4,
                weight: 2,
                color: '#ffffff',
                fillColor: isEnd ? '#ef4444' : '#22c55e',
                fillOpacity: 1,
            }).addTo(map);

            marker.bringToFront();
            pointMarkersRef.current[idx] = marker;

            // chỉ vẽ A/B nếu có ít nhất 2 điểm hợp lệ
            if (hasMultiPoints && (isStart || isEnd)) {
                const label = isStart ? 'A' : 'B';
                const divIcon = LMap.divIcon({
                    className: 'iky-cruise-ab-icon',
                    html: label,
                    iconSize: [18, 18],
                    iconAnchor: [9, 9],
                });

                const abMarker = LMap.marker([p.lat, p.lon], {
                    icon: divIcon,
                }).addTo(map);
                abLabelMarkersRef.current.push(abMarker);

                if (abMarker.setZIndexOffset) {
                    abMarker.setZIndexOffset(1000);
                }

                abMarker.on('click', () => {
                    handlePointClick(idx);
                });
            }

            marker.on('click', () => {
                handlePointClick(idx);
            });
        });

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

        const firstPoint = routeData[firstIdx];
        if (!firstPoint || firstPoint.lat == null || firstPoint.lon == null) return;

        const customIcon = LMap.icon({
            iconUrl: markerIconImg.src,
            iconSize: [36, 36],
            iconAnchor: [18, 36],
        });

        movingMarkerRef.current = LMap.marker([firstPoint.lat, firstPoint.lon], { icon: customIcon }).addTo(map);

        setIsPlaying(false);
        isPlayingRef.current = false;
        animStateRef.current = { segmentIndex: firstIdx, t: 0 };
        const bounds = polylineRef.current.getBounds();

        map.fitBounds(bounds, {
            padding: [40, 40],
            maxZoom: 19,
        });

        map.invalidateSize();
        map.scrollWheelZoom.enable();
        map.dragging.enable();
    }, [routeData, LMap]);

    // update popup khi address/activeIndex đổi
    useEffect(() => {
        if (!popupRef.current || !routeData.length) return;

        const p = routeData[activeIndex];
        if (!p || p.lat == null || p.lon == null) return;

        popupRef.current.setLatLng([p.lat, p.lon]).setContent(buildPopupHtml(p, t));
    }, [routeData, activeIndex, t]);

    // fetch address point active khi không play
    useEffect(() => {
        if (!routeData.length) return;
        if (isPlayingRef.current) return;

        fetchAddressForPoint(activeIndex);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeIndex, routeData]);

    // scroll list + highlight marker
    useEffect(() => {
        if (!routeData.length) return;
        smoothScrollToItem(activeIndex);
        highlightMarker(activeIndex);
    }, [activeIndex, routeData]);

    // animation loop
    useEffect(() => {
        if (!routeData.length || !movingMarkerRef.current) return;

        isPlayingRef.current = isPlaying;

        if (!isPlaying) {
            if (animationFrameRef.current !== null) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
            return;
        }

        if (animationFrameRef.current !== null) {
            cancelAnimationFrame(animationFrameRef.current);
        }

        const speed = 0.0015;
        let lastTime = performance.now();

        const step = (now) => {
            if (!isPlayingRef.current) return;

            const dt = now - lastTime;
            lastTime = now;

            let { segmentIndex, t } = animStateRef.current;

            if (segmentIndex >= routeData.length - 1) {
                setIsPlaying(false);
                isPlayingRef.current = false;
                return;
            }

            t += dt * speed;

            while (t >= 1 && segmentIndex < routeData.length - 1) {
                t -= 1;
                segmentIndex += 1;
                setActiveIndex(segmentIndex);
            }

            if (segmentIndex >= routeData.length - 1) {
                setIsPlaying(false);
                isPlayingRef.current = false;
                return;
            }

            animStateRef.current = { segmentIndex, t };

            const pA = routeData[segmentIndex];
            const pB = routeData[segmentIndex + 1];

            if (pA.lat == null || pA.lon == null || pB.lat == null || pB.lon == null) {
                animationFrameRef.current = requestAnimationFrame(step);
                return;
            }

            const lat = pA.lat + (pB.lat - pA.lat) * t;
            const lon = pA.lon + (pB.lon - pA.lon) * t;

            movingMarkerRef.current.setLatLng([lat, lon]);

            animationFrameRef.current = requestAnimationFrame(step);
        };

        animationFrameRef.current = requestAnimationFrame(step);

        return () => {
            if (animationFrameRef.current !== null) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
        };
    }, [isPlaying, routeData]);

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
            setIsPlaying(false);
            isPlayingRef.current = false;
            addressCacheRef.current = {};
            setRoadKm(null);
            setRoadKmError(null);

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
                setRouteData([]);
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

            // ⭐ NÉN ĐIỂM: gom các điểm lệch trong bán kính ~100m thành 1 điểm
            const compressed = compressRouteByDistance(mapped, MIN_CLUSTER_DIST_M);

            if (!compressed || compressed.length === 0) {
                setRouteData([]);
                setError(t.error.noData);
                return;
            }

            setRouteData(compressed);
            setActiveIndex(0);

            // ⭐ gọi Goong DistanceMatrix tính quãng đường đường bộ A→B
            const valid = compressed.filter((p) => typeof p.lat === 'number' && typeof p.lon === 'number');
            if (valid.length >= 2) {
                setRoadKmLoading(true);
                const startPoint = valid[0];
                const endPoint = valid[valid.length - 1];
                const km = await getGoongRoadDistanceKm(startPoint, endPoint);
                if (km != null) {
                    setRoadKm(km);
                } else {
                    setRoadKmError('Không lấy được quãng đường đường bộ từ Goong');
                }
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
        if (!routeData.length) return;
        setIsPlaying(true);
    };

    const handlePause = () => {
        setIsPlaying(false);
    };

    const handleReset = () => {
        if (!routeData.length) return;
        setIsPlaying(false);
        isPlayingRef.current = false;
        setActiveIndex(0);
        animStateRef.current = { segmentIndex: 0, t: 0 };
        const p = routeData[0];
        if (movingMarkerRef.current && mapRef.current && p.lat != null && p.lon != null) {
            movingMarkerRef.current.setLatLng([p.lat, p.lon]);
            mapRef.current.panTo([p.lat, p.lon]);
        }
        highlightMarker(0);
    };

    const RowItem = ({ index, style }) => {
        const p = routeData[index];

        if (!p) return null;

        const isActive = index === activeIndex;

        return (
            <div
                style={style}
                className={'iky-cruise__table-row' + (isActive ? ' iky-cruise__table-row--active' : '')}
                id={`cruise-item-${index}`}
                onClick={() => handlePointClick(index)}
            >
                <Tooltip title={formatDateFromDevice(p.dateTime)}>
                    <div className="iky-cruise__table-cell iky-cruise__table-cell--time">
                        {formatDateFromDevice(p.dateTime)}
                    </div>
                </Tooltip>

                <Tooltip title={`Vĩ độ: ${typeof p.lat === 'number' ? p.lat.toFixed(6) : 'N/A'}`}>
                    <div className="iky-cruise__table-cell">{typeof p.lat === 'number' ? p.lat.toFixed(6) : ''}</div>
                </Tooltip>

                <Tooltip title={`Kinh độ: ${typeof p.lon === 'number' ? p.lon.toFixed(6) : 'N/A'}`}>
                    <div className="iky-cruise__table-cell">{typeof p.lon === 'number' ? p.lon.toFixed(6) : ''}</div>
                </Tooltip>

                <Tooltip title={`Vận tốc: ${p?.velocity || 'N/A'}`}>
                    <div className="iky-cruise__table-cell">{p?.velocity}</div>
                </Tooltip>
            </div>
        );
    };

    const itemKey = (index) => routeData[index]?.selector || index;

    return (
        <div className="iky-cruise">
            {/* LEFT PANEL */}
            <aside className="iky-cruise__left">
                <div className="iky-cruise__left-card">
                    <div className="iky-cruise__left-header">{t.title}</div>

                    <div className="iky-cruise__form">
                        {/* Search xe */}
                        <div className="iky-cruise__form-row">
                            <label>{t.form.selectVehicle}</label>

                            <Select
                                showSearch
                                style={{ width: '100%' }}
                                placeholder={t.form.searchVehiclePlaceholder || 'Nhập biển số / IMEI / SĐT'}
                                loading={loadingDevices}
                                value={selectedDeviceId || undefined}
                                // cập nhật text đang gõ để highlight
                                onSearch={(value) => setDeviceSearchText(value)}
                                // khi chọn 1 xe
                                onChange={(value) => {
                                    setSelectedDeviceId(value);
                                    const device = deviceList.find((d) => d._id === value);
                                    setSelectedImei(device?.imei || '');
                                }}
                                // filter theo label (biển / imei / sđt)
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
                        {addressError && routeData.length > 0 && (
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

                    {routeData.length > 0 && (
                        <>
                            <div className="iky-cruise__result">
                                <span>{t.result.label}</span>
                                <span>
                                    {activeIndex + 1}/{routeData.length}
                                </span>
                            </div>

                            {/* Khoảng cách đường thẳng A→B (Haversine) */}
                            {/* <div className="iky-cruise__distance">
                                <span>{t.result.totalDistance}</span>
                                <span>
                                    {totalKm.toFixed(3)} {t.result.unitKm}
                                </span>
                            </div> */}

                            <div className="iky-cruise__distance">
                                <span>{t.result.totalDistance}</span>
                                <span>{roadKm?.toFixed(3)} km</span>
                            </div>

                            <div className="iky-cruise__controls">
                                <button onClick={handleStart} disabled={isPlaying || !routeData.length}>
                                    ▶
                                </button>
                                <button onClick={handlePause} disabled={!isPlaying}>
                                    ⏸
                                </button>
                                <button onClick={handleReset} disabled={!routeData.length}>
                                    ⏹
                                </button>
                                <input
                                    type="range"
                                    min={0}
                                    max={routeData.length - 1}
                                    value={activeIndex}
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

                                    <List
                                        height={350}
                                        itemCount={routeData.length}
                                        itemSize={32}
                                        width="100%"
                                        ref={listRef}
                                        itemKey={itemKey}
                                    >
                                        {RowItem}
                                    </List>
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
