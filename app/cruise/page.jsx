'use client';

import React, { useEffect, useMemo, useRef, useState, memo, startTransition } from 'react';
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
import { Select } from 'antd';
import { FixedSizeList as VirtualList } from 'react-window';

// ✅ use shared reverse geocode (multi-provider)
import { reverseGeocodeAddress } from '../lib/address/reverseGeocode';

const locales = { vi, en };

// ===============================
// ⚙️ CONFIG
// ===============================
const FETCH_PAGE_LIMIT = 1000;

// Map sampling (polyline + playback)
const VISUAL_MAX_POINTS_ON_MAP = 3000;
const MAP_MIN_SAMPLE_DIST_M = 60;

// Playback/UI perf
const UI_FPS = 6;
const UI_THROTTLE_MS = Math.round(1000 / UI_FPS);
const BASE_SPEED_MPS = 15;

// ===============================
// GPS utils
// ===============================
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

const calcTotalDistanceKm = (points) => {
    if (!points || points.length < 2) return 0;
    let totalM = 0;
    for (let i = 1; i < points.length; i++) {
        const a = points[i - 1];
        const b = points[i];
        if (typeof a?.lat !== 'number' || typeof a?.lon !== 'number') continue;
        if (typeof b?.lat !== 'number' || typeof b?.lon !== 'number') continue;

        const d = distanceMeters({ lat: a.lat, lon: a.lon }, { lat: b.lat, lon: b.lon });
        if (d > 0 && d < 2000) totalM += d;
    }
    return totalM / 1000;
};

// ===============================
// Bearing
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
// 🧠 Map downsample
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

    if (kept.length > maxPoints) {
        const step = Math.ceil(kept.length / maxPoints);
        const down = [];
        for (let i = 0; i < kept.length; i += step) down.push(kept[i]);
        if (down[down.length - 1] !== kept[kept.length - 1]) down.push(kept[kept.length - 1]);
        return { indices: down, points: down.map((idx) => rawPoints[idx]) };
    }

    return { indices: kept, points: kept.map((idx) => rawPoints[idx]) };
};

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
// ✅ Popup text (hard, khỏi khai báo json)
// ===============================
const popupText = (isEn) => ({
    licensePlate: isEn ? 'License plate' : 'Biển số xe',
    vehicleType: isEn ? 'Vehicle type' : 'Loại xe',
    manufacturer: isEn ? 'Manufacturer' : 'Hãng',
    time: isEn ? 'Time' : 'Thời điểm',
    currentLocation: isEn ? 'Current location' : 'Vị trí hiện tại',
    coordinate: isEn ? 'Coordinates' : 'Tọa độ',
    machineStatus: isEn ? 'Engine status' : 'Trạng thái máy',
    vehicleStatus: isEn ? 'Vehicle status' : 'Trạng thái xe',
    speed: isEn ? 'Speed' : 'Vận tốc',

    engineOn: isEn ? 'Engine on' : 'Mở máy',
    engineOff: isEn ? 'Engine off' : 'Tắt máy',
    vehicleRunning: isEn ? 'Running' : 'Xe đang chạy',
    vehicleStopped: isEn ? 'Stopped' : 'Xe dừng',
    vehicleParking: isEn ? 'Parked' : 'Xe đỗ',

    loadingAddress: isEn ? 'Fetching address...' : 'Đang lấy địa chỉ...',
});

// ===============================
// ✅ Status logic
// acc = 1 => tắt máy => xe đỗ
// acc = 0/undefined => có speed => chạy, không speed => dừng
// ===============================
const buildStatusHard = ({ acc, spd }, isEn) => {
    const t = popupText(isEn);
    const speed = Number(spd) || 0;

    if (acc === 1) {
        return {
            machineStatus: t.engineOff,
            vehicleStatus: t.vehicleParking,
            speedText: `${speed} km/h`,
        };
    }

    if (speed > 0) {
        return {
            machineStatus: t.engineOn,
            vehicleStatus: t.vehicleRunning,
            speedText: `${speed} km/h`,
        };
    }

    return {
        machineStatus: t.engineOn,
        vehicleStatus: t.vehicleStopped,
        speedText: '0 km/h',
    };
};

// ===============================
// Popup HTML
// ===============================
const buildPopupHtml = (p, isEn) => {
    const t = popupText(isEn);
    const status = buildStatusHard({ acc: p.acc, spd: p.spd ?? p.velocity }, isEn);

    return `
    <div class="iky-cruise-popup">
      <div><strong>${t.licensePlate}:</strong> ${p.licensePlate || '--'}</div>
      <div><strong>${t.vehicleType}:</strong> ${p.vehicleName || '--'}</div>
      <div><strong>${t.manufacturer}:</strong> ${p.manufacturer || '--'}</div>
      <div><strong>${t.time}:</strong> ${formatDateFromDevice(p.dateTime) || '--'}</div>
      <div><strong>${t.currentLocation}:</strong> ${p.address || t.loadingAddress}</div>
      <div><strong>${t.coordinate}:</strong> ${p.lat}, ${p.lon}</div>
      <div><strong>${t.machineStatus}:</strong> ${status.machineStatus}</div>
      <div><strong>${t.vehicleStatus}:</strong> ${status.vehicleStatus}</div>
      <div><strong>${t.speed}:</strong> ${status.speedText}</div>
    </div>
  `;
};

const toInputDateTime = (date) => {
    const tzOffset = date.getTimezoneOffset() * 60000;
    const localISO = new Date(date.getTime() - tzOffset).toISOString();
    return localISO.slice(0, 16);
};

// ===============================
// Virtual Row
// ===============================
const Row = memo(function Row({ index, style, data }) {
    const { items, activeIndex, onClick } = data;
    const p = items[index];
    const isActive = index === activeIndex;

    return (
        <div
            style={style}
            className={'iky-cruise__table-row' + (isActive ? ' iky-cruise__table-row--active' : '')}
            onClick={() => onClick(index)}
        >
            <div className="iky-cruise__table-cell iky-cruise__table-cell--time">
                {formatDateFromDevice(p.dateTime)}
            </div>
            <div className="iky-cruise__table-cell">{typeof p.lat === 'number' ? p.lat.toFixed(6) : ''}</div>
            <div className="iky-cruise__table-cell">{typeof p.lon === 'number' ? p.lon.toFixed(6) : ''}</div>
            <div className="iky-cruise__table-cell">{p?.velocity}</div>
        </div>
    );
});

// ===============================
// MAIN
// ===============================
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

    const [playbackRate, setPlaybackRate] = useState(1);

    const [deviceList, setDeviceList] = useState([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState('');
    const [selectedImei, setSelectedImei] = useState('');
    const [deviceSearchText, setDeviceSearchText] = useState('');

    const [start, setStart] = useState('');
    const [end, setEnd] = useState('');

    const [loadingRoute, setLoadingRoute] = useState(false);
    const [loadingDevices, setLoadingDevices] = useState(false);
    const [error, setError] = useState(null);

    const [rawRouteData, setRawRouteData] = useState([]);
    const [mapRouteData, setMapRouteData] = useState([]);
    const mapToRawIndexRef = useRef([]);

    const [activeIndex, setActiveIndex] = useState(0);
    const [activeRenderIndex, setActiveRenderIndex] = useState(0);
    const [sliderValue, setSliderValue] = useState(0);

    const [isPlaying, setIsPlaying] = useState(false);
    const isPlayingRef = useRef(false);

    const [totalKm, setTotalKm] = useState(0);

    // leaflet
    const [LMap, setLMap] = useState(null);
    const mapRef = useRef(null);

    const polylineRef = useRef(null);
    const movingMarkerRef = useRef(null);
    const highlightDotRef = useRef(null);

    // dots canvas layer
    const pointLayerRef = useRef(null);
    const dotRendererRef = useRef(null);
    const dotCacheRef = useRef([]);
    const drawDotsRafRef = useRef(null);

    // playback meters
    const segMRef = useRef([]);
    const cumMRef = useRef([0]);
    const totalMRef = useRef(0);

    const animationFrameRef = useRef(null);
    const pendingRenderIdxRef = useRef(0);

    const vlistRef = useRef(null);
    const popupRef = useRef(null);

    // ✅ address cache + inflight (cache theo ngôn ngữ)
    const addressCacheRef = useRef(new Map());
    const inflightRef = useRef(new Map());

    // ✅ giữ point đang mở popup để rerender khi đổi ngôn ngữ
    const currentPopupPointRef = useRef(null);

    // ✅ FIX: auto scroll table theo activeIndex khi đang play
    const lastScrollRef = useRef(-1);
    useEffect(() => {
        if (!isPlaying) return;
        if (!vlistRef.current) return;

        if (lastScrollRef.current === activeIndex) return;
        lastScrollRef.current = activeIndex;

        vlistRef.current.scrollToItem(activeIndex, 'center');
    }, [activeIndex, isPlaying]);

    // load leaflet
    useEffect(() => {
        const loadLeaflet = async () => {
            const L = await import('leaflet');
            await import('leaflet/dist/leaflet.css');
            setLMap(L);
        };
        loadLeaflet();
    }, []);

    // cleanup cache manager
    useEffect(() => {
        const cleanup = async () => {
            try {
                await cruiseCacheManager.cleanupOldCache();
            } catch (e) {
                console.error('Cache cleanup error:', e);
            }
        };
        cleanup();
    }, []);

    // Load devices
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const token = localStorage.getItem('accessToken');
        if (!token) return;

        const fetchDevices = async () => {
            try {
                setLoadingDevices(true);
                const res = await getDevices(token);
                const devices = res.devices || [];
                setDeviceList(devices);
                if (devices.length > 0) {
                    setSelectedDeviceId(devices[0]._id);
                    setSelectedImei(devices[0].imei || '');
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

        const map = LMap.map('iky-cruise-map', {
            center: [10.755937, 106.612587],
            zoom: 15,
            minZoom: 3,
            maxZoom: 22,
            preferCanvas: true,
        });

        mapRef.current = map;

        LMap.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxNativeZoom: 19,
            maxZoom: 22,
        }).addTo(map);

        dotRendererRef.current = LMap.canvas({ padding: 0.5 });

        return () => map.remove();
    }, [LMap]);

    // options for Select
    const deviceOptions = useMemo(() => {
        const keyword = deviceSearchText.trim().toLowerCase();

        const highlightText = (text) => {
            if (!keyword) return text;
            const lower = text.toLowerCase();
            const idx = lower.indexOf(keyword);
            if (idx === -1) return text;
            const before = text.slice(0, idx);
            const match = text.slice(idx, idx + keyword.length);
            const after = text.slice(idx + keyword.length);
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
            return { value: d._id, searchable: rawLabel.toLowerCase(), label: highlightText(rawLabel) };
        });
    }, [deviceList, t, deviceSearchText]);

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

    const stopPlaying = () => {
        setIsPlaying(false);
        isPlayingRef.current = false;
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
    };

    // ✅ fetch address lazily + cache (CACHE THEO NGÔN NGỮ) - dùng multi-provider
    const ensureAddress = async (lat, lon) => {
        if (lat == null || lon == null) return '';

        const lang = isEn ? 'en' : 'vi';
        const key = `${lang}:${lat.toFixed(6)},${lon.toFixed(6)}`;

        const cached = addressCacheRef.current.get(key);
        if (cached) return cached;

        if (inflightRef.current.has(key)) return inflightRef.current.get(key);

        const p = (async () => {
            const res = await reverseGeocodeAddress(lat, lon, { lang, isEn });
            const addr = res?.address || '';
            if (addr) addressCacheRef.current.set(key, addr);
            inflightRef.current.delete(key);
            return addr;
        })();

        inflightRef.current.set(key, p);
        return p;
    };

    // ✅ popup: show ngay -> update khi có address
    const openInfoPopup = async (p) => {
        if (!LMap || !mapRef.current) return;
        if (!p || p.lat == null || p.lon == null) return;

        // ✅ lưu point để khi đổi isEn thì rerender popup
        currentPopupPointRef.current = p;

        if (!popupRef.current) {
            popupRef.current = LMap.popup({ closeButton: true, autoPan: true });
        }

        // ✅ show ngay (đúng EN/VI)
        popupRef.current.setLatLng([p.lat, p.lon]).setContent(buildPopupHtml(p, isEn)).openOn(mapRef.current);

        // ✅ load address
        const addr = await ensureAddress(p.lat, p.lon);
        if (!addr) return;

        // ✅ update content (đúng EN/VI + có address)
        const updated = { ...p, address: addr };
        popupRef.current.setLatLng([p.lat, p.lon]).setContent(buildPopupHtml(updated, isEn)).openOn(mapRef.current);

        // ✅ giữ lại bản updated để đổi ngôn ngữ không mất address
        currentPopupPointRef.current = updated;
    };

    // ✅ Khi đổi ngôn ngữ: rerender popup đang mở (Leaflet popup không tự rerender)
    useEffect(() => {
        if (!popupRef.current || !mapRef.current) return;
        const p = currentPopupPointRef.current;
        if (!p || p.lat == null || p.lon == null) return;

        // update ngay label theo ngôn ngữ mới
        popupRef.current.setLatLng([p.lat, p.lon]).setContent(buildPopupHtml(p, isEn)).openOn(mapRef.current);

        // rồi lấy lại address theo ngôn ngữ mới (nếu có)
        (async () => {
            const addr = await ensureAddress(p.lat, p.lon);
            if (!addr) return;
            const updated = { ...p, address: addr };
            currentPopupPointRef.current = updated;
            popupRef.current
                ?.setLatLng([p.lat, p.lon])
                .setContent(buildPopupHtml(updated, isEn))
                .openOn(mapRef.current);
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isEn]);

    const syncRenderFromRaw = (rawIdx) => {
        const rIdx = nearestRenderIndex(mapToRawIndexRef.current, rawIdx);
        if (rIdx >= 0) {
            pendingRenderIdxRef.current = rIdx;
            setActiveRenderIndex(rIdx);
            setSliderValue(rIdx);
        }
        return rIdx;
    };

    // TABLE click: giữ behavior cũ (nhảy marker + pan + popup)
    const handlePointClickRaw = (rawIdx) => {
        if (!rawRouteData.length) return;
        stopPlaying();

        setActiveIndex(rawIdx);
        const rIdx = syncRenderFromRaw(rawIdx);

        if (rIdx >= 0) {
            const p = mapRouteData[rIdx];
            if (p?.lat != null && p?.lon != null) {
                movingMarkerRef.current?.setLatLng([p.lat, p.lon]);
                highlightDotRef.current?.setLatLng([p.lat, p.lon]);
                mapRef.current?.panTo([p.lat, p.lon], { animate: true, duration: 0.25 });
            }
        }

        const pRaw = rawRouteData[rawIdx];
        if (pRaw) openInfoPopup(pRaw);

        vlistRef.current?.scrollToItem(rawIdx, 'center');
    };

    // build segment distances for playback
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
            const safe = d > 0 && d < 5000 ? d : 0;
            segM.push(safe);
            sum += safe;
            cum.push(sum);
        }

        segMRef.current = segM;
        cumMRef.current = cum;
        totalMRef.current = sum;
    }, [mapRouteData]);

    // Dots render (canvas + viewport + adaptive step)
    const drawDots = () => {
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
        const renderer = dotRendererRef.current || LMap.canvas({ padding: 0.5 });

        const group = LMap.layerGroup();
        const cache = [];

        for (let i = 0; i < mapRouteData.length; i += step) {
            const p = mapRouteData[i];
            if (p?.lat == null || p?.lon == null) continue;
            if (!bounds.contains([p.lat, p.lon])) continue;

            const ll = LMap.latLng(p.lat, p.lon);
            const cp = map.latLngToContainerPoint(ll);

            cache.push({ x: cp.x, y: cp.y, renderIdx: i });

            LMap.circleMarker([p.lat, p.lon], {
                renderer,
                radius: 3,
                weight: 1,
                color: '#ffffff',
                fillColor: '#22c55e',
                fillOpacity: 0.9,
                interactive: false,
            }).addTo(group);
        }

        dotCacheRef.current = cache;
        pointLayerRef.current = group.addTo(map);
    };

    const scheduleDrawDots = () => {
        if (drawDotsRafRef.current) cancelAnimationFrame(drawDotsRafRef.current);
        drawDotsRafRef.current = requestAnimationFrame(() => {
            drawDotsRafRef.current = null;
            drawDots();
        });
    };

    const pickNearestDot = (containerPoint) => {
        const list = dotCacheRef.current;
        if (!list || !list.length) return -1;

        const x = containerPoint.x;
        const y = containerPoint.y;

        const R = 12;
        const R2 = R * R;

        let best = -1;
        let bestD2 = Infinity;

        for (let i = 0; i < list.length; i++) {
            const dx = list[i].x - x;
            const dy = list[i].y - y;
            const d2 = dx * dx + dy * dy;
            if (d2 <= R2 && d2 < bestD2) {
                bestD2 = d2;
                best = list[i].renderIdx;
            }
        }
        return best;
    };

    // ✅ click map: CHỈ mở popup (không nhảy marker)
    useEffect(() => {
        if (!mapRef.current) return;
        const map = mapRef.current;

        const onClick = (e) => {
            if (!mapRouteData.length || !rawRouteData.length) return;
            if (map.dragging && map.dragging._draggable && map.dragging._draggable._moving) return;

            const cp = map.latLngToContainerPoint(e.latlng);
            const renderIdx = pickNearestDot(cp);
            if (renderIdx < 0) return;

            const rawIdx = mapToRawIndexRef.current?.[renderIdx];
            if (typeof rawIdx !== 'number') return;

            const pRaw = rawRouteData[rawIdx];
            if (!pRaw) return;

            // optional highlight: chấm vàng nhảy theo điểm click (marker xe không nhảy)
            if (pRaw.lat != null && pRaw.lon != null) {
                highlightDotRef.current?.setLatLng([pRaw.lat, pRaw.lon]);
            }

            openInfoPopup(pRaw);
        };

        map.on('click', onClick);
        return () => map.off('click', onClick);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mapRouteData, rawRouteData, isEn]);

    // Render route on map (polyline + moving + highlight)
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
        if (highlightDotRef.current) {
            map.removeLayer(highlightDotRef.current);
            highlightDotRef.current = null;
        }
        if (pointLayerRef.current) {
            map.removeLayer(pointLayerRef.current);
            pointLayerRef.current = null;
        }

        popupRef.current = null;
        currentPopupPointRef.current = null;

        if (!mapRouteData.length) return;

        const isValidPoint = (p) => p && typeof p.lat === 'number' && typeof p.lon === 'number';
        const firstRenderIdx = mapRouteData.findIndex(isValidPoint);
        if (firstRenderIdx === -1) return;

        const latlngs = [];
        for (let i = 0; i < mapRouteData.length; i++) {
            const p = mapRouteData[i];
            if (!isValidPoint(p)) continue;
            latlngs.push([p.lat, p.lon]);
        }
        if (!latlngs.length) return;

        polylineRef.current = LMap.polyline(latlngs, {
            color: '#f97316',
            weight: 3,
            opacity: 0.7,
            lineCap: 'round',
            lineJoin: 'round',
            interactive: false,
        }).addTo(map);

        const firstPoint = mapRouteData[firstRenderIdx];

        const customIcon = LMap.icon({
            iconUrl: markerIconImg.src,
            iconSize: [50, 50],
            iconAnchor: [24, 24],
        });

        movingMarkerRef.current = LMap.marker([firstPoint.lat, firstPoint.lon], { icon: customIcon }).addTo(map);
        movingMarkerRef.current.setZIndexOffset(15000);

        highlightDotRef.current = LMap.circleMarker([firstPoint.lat, firstPoint.lon], {
            radius: 7,
            weight: 2,
            color: '#ffffff',
            fillColor: '#facc15',
            fillOpacity: 1,
            interactive: false,
        }).addTo(map);

        stopPlaying();

        pendingRenderIdxRef.current = firstRenderIdx;
        setActiveRenderIndex(firstRenderIdx);
        setSliderValue(firstRenderIdx);

        const rawIdx = mapToRawIndexRef.current?.[firstRenderIdx] ?? 0;
        setActiveIndex(rawIdx);

        const bounds = polylineRef.current.getBounds();
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 19 });
        map.invalidateSize();

        scheduleDrawDots();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mapRouteData, LMap]);

    // redraw dots when map move/zoom end
    useEffect(() => {
        if (!LMap || !mapRef.current) return;
        const map = mapRef.current;

        const onMove = () => scheduleDrawDots();
        map.on('moveend', onMove);
        map.on('zoomend', onMove);

        return () => {
            map.off('moveend', onMove);
            map.off('zoomend', onMove);
            if (drawDotsRafRef.current) cancelAnimationFrame(drawDotsRafRef.current);
            drawDotsRafRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [LMap, mapRouteData]);

    // Playback loop
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

        const speedMps = BASE_SPEED_MPS * playbackRate;
        let traveledM = cumMRef.current?.[activeRenderIndex] ?? 0;
        let segIdx = Math.max(0, Math.min(mapRouteData.length - 2, activeRenderIndex));
        let lastTime = performance.now();
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
                    highlightDotRef.current?.setLatLng([pLast.lat, pLast.lon]);
                }

                startTransition(() => {
                    setActiveRenderIndex(last);
                    setSliderValue(last);
                    const rawLast = mapToRawIndexRef.current?.[last];
                    if (typeof rawLast === 'number') setActiveIndex(rawLast);
                });

                setIsPlaying(false);
                isPlayingRef.current = false;
                return;
            }

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
            highlightDotRef.current?.setLatLng([lat, lon]);

            const bearing = getBearing(a.lat, a.lon, b.lat, b.lon);
            const el = movingMarkerRef.current.getElement();
            if (el) {
                el.style.transformOrigin = 'center center';
                const baseTransform = el.style.transform.replace(/rotate\([^)]*\)/g, '');
                el.style.transform = `${baseTransform} rotate(${normalizeAngle(bearing)}deg)`;
            }

            if (now - lastUi > UI_THROTTLE_MS) {
                lastUi = now;
                const renderIdx = segIdx;
                pendingRenderIdxRef.current = renderIdx;

                startTransition(() => {
                    setActiveRenderIndex(renderIdx);
                    setSliderValue(renderIdx);
                    const rawIdx = mapToRawIndexRef.current?.[renderIdx];
                    if (typeof rawIdx === 'number') setActiveIndex(rawIdx);
                });
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

    // Slider behavior
    const handleSliderChange = (e) => {
        const renderIdx = Number(e.target.value);
        pendingRenderIdxRef.current = renderIdx;
        setSliderValue(renderIdx);

        const p = mapRouteData[renderIdx];
        if (p?.lat != null && p?.lon != null) {
            movingMarkerRef.current?.setLatLng([p.lat, p.lon]);
            highlightDotRef.current?.setLatLng([p.lat, p.lon]);
        }
    };

    const commitSlider = () => {
        stopPlaying();
        const renderIdx = pendingRenderIdxRef.current;
        const rawIdx = mapToRawIndexRef.current?.[renderIdx];

        setActiveRenderIndex(renderIdx);
        setSliderValue(renderIdx);
        if (typeof rawIdx === 'number') setActiveIndex(rawIdx);

        const p = mapRouteData[renderIdx];
        if (p?.lat != null && p?.lon != null) {
            mapRef.current?.panTo([p.lat, p.lon], { animate: true, duration: 0.25 });
        }
        if (typeof rawIdx === 'number') vlistRef.current?.scrollToItem(rawIdx, 'center');
    };

    // ===============================
    // LOAD ROUTE
    // ===============================
    const handleLoadRoute = async () => {
        if (typeof window === 'undefined') return;

        const token = localStorage.getItem('accessToken');
        if (!token) return setError(t.error.noToken);
        if (!selectedDeviceId || !selectedImei) return setError(t.error.noVehicle);
        if (!start || !end) return setError(t.error.missingTime);

        const currentDevice = deviceList.find((d) => d._id === selectedDeviceId);
        if (!currentDevice) return setError(t.error.noVehicleInfo);

        try {
            setLoadingRoute(true);
            setError(null);

            stopPlaying();

            addressCacheRef.current.clear();
            inflightRef.current.clear();
            currentPopupPointRef.current = null;

            setRawRouteData([]);
            setMapRouteData([]);
            mapToRawIndexRef.current = [];
            setTotalKm(0);
            setActiveIndex(0);
            setActiveRenderIndex(0);
            setSliderValue(0);

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
            if (!allData || allData.length === 0) return setError(t.error.noData);

            const plate = currentDevice.license_plate || '';
            const vehicleName =
                currentDevice.vehicle_category_id?.name || currentDevice.vehicle_category_id?.model || '';
            const manufacturer = currentDevice.device_category_id?.name || currentDevice.device_category_id?.code || '';

            const mapped = allData.map((item) => {
                const { speedText } = buildStatusHard({ acc: item.acc, spd: item.vgp }, isEn);

                return {
                    lat: item.lat,
                    lon: item.lon,
                    licensePlate: plate,
                    vehicleName,
                    manufacturer,
                    selector: item._id,
                    dateTime: item.tim || item.created || item.createdAt || '',
                    velocity: speedText,
                    acc: item.acc,
                    spd: item.vgp,
                    address: '',
                };
            });

            setRawRouteData(mapped);
            setTotalKm(calcTotalDistanceKm(mapped));

            const sample = buildMapSample(mapped, VISUAL_MAX_POINTS_ON_MAP, MAP_MIN_SAMPLE_DIST_M);
            mapToRawIndexRef.current = sample.indices;
            setMapRouteData(sample.points);

            // warm cache điểm đầu tiên
            const firstValid = mapped.find((p) => typeof p.lat === 'number' && typeof p.lon === 'number');
            if (firstValid) ensureAddress(firstValid.lat, firstValid.lon);
        } catch (e) {
            console.error(e);
            setError(t.error.loadFailed);
        } finally {
            setLoadingRoute(false);
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

        const idx = 0;
        pendingRenderIdxRef.current = idx;
        setActiveRenderIndex(idx);
        setSliderValue(idx);

        const rawIdx = mapToRawIndexRef.current?.[idx] ?? 0;
        setActiveIndex(rawIdx);

        const p = mapRouteData[idx];
        if (p?.lat != null && p?.lon != null) {
            movingMarkerRef.current?.setLatLng([p.lat, p.lon]);
            highlightDotRef.current?.setLatLng([p.lat, p.lon]);
            mapRef.current?.panTo([p.lat, p.lon], { animate: true, duration: 0.25 });
        }

        vlistRef.current?.scrollToItem(rawIdx, 'center');
    };

    const VLIST_HEIGHT = 460;
    const ROW_HEIGHT = 40;

    return (
        <div className="iky-cruise">
            {/* LEFT */}
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

                                <input
                                    type="range"
                                    min={0}
                                    max={Math.max(0, mapRouteData.length - 1)}
                                    value={sliderValue}
                                    onChange={handleSliderChange}
                                    onMouseUp={commitSlider}
                                    onTouchEnd={commitSlider}
                                />
                            </div>

                            <div className="iky-cruise__list">
                                <div className="iky-cruise__table">
                                    <div className="iky-cruise__table-header">
                                        <div className="iky-cruise__table-cell iky-cruise__table-cell--time">
                                            {t.table?.time || 'Time'}
                                        </div>
                                        <div className="iky-cruise__table-cell">{t.table?.lat || 'Latitude'}</div>
                                        <div className="iky-cruise__table-cell">{t.table?.lon || 'Longitude'}</div>
                                        <div className="iky-cruise__table-cell">{t.table?.speed || 'Speed'}</div>
                                    </div>

                                    <div className="iky-cruise__table-body">
                                        <VirtualList
                                            ref={vlistRef}
                                            height={VLIST_HEIGHT}
                                            itemCount={rawRouteData.length}
                                            itemSize={ROW_HEIGHT}
                                            width="100%"
                                            overscanCount={12}
                                            itemData={{
                                                items: rawRouteData,
                                                activeIndex,
                                                onClick: handlePointClickRaw,
                                            }}
                                        >
                                            {Row}
                                        </VirtualList>
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
