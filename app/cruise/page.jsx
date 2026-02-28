'use client';

import React, { useEffect, useMemo, useRef, useState, memo, startTransition } from 'react';
import './cruise.css';

import markerIconImg from '../assets/xe2.webp';
import { getCruiseHistory } from '../lib/api/cruise';
import { getDevices } from '../lib/api/devices';
import cruiseCacheManager from '../lib/cache/CruiseCacheManager';

import vi from '../locales/vi.json';
import en from '../locales/en.json';
import { usePathname } from 'next/navigation';
import { formatDateFromDevice } from '../util/FormatDate';
import CruiseExportButton from '../components/CruiseExportButton';

import loading from '../assets/loading.gif';
import Image from 'next/image';
import { Select, Tabs, Modal, Tooltip, Tag, Switch } from 'antd';
import { FixedSizeList as VirtualList } from 'react-window';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip as ReTooltip, CartesianGrid } from 'recharts';

// ✅ use shared reverse geocode (multi-provider)
import { reverseGeocodeAddress } from '../lib/address/reverseGeocode';

// ✅ IMPORT ALL UTILS (2 files only)
import {
    FETCH_PAGE_LIMIT,
    VISUAL_MAX_POINTS_ON_MAP,
    MAP_MIN_SAMPLE_DIST_M,
    UI_THROTTLE_MS,
    BASE_SPEED_MPS,
    MIN_EVENT_DURATION_SEC,
    distanceMeters,
    calcTotalDistanceKm,
    getBearing,
    normalizeAngle,
    buildMapSample,
    nearestRenderIndex,
    toNum,
    getStatusType,
    buildStatusHard,
    safeTimeMs,
    formatDuration,
    buildPopupHtml,
    toInputDateTime,
    toApiDateTime,
} from '../util/cruiseUtils';
import { UpOutlined } from '@ant-design/icons';

const locales = { vi, en };

// ===============================
// Virtual Row (lộ trình)
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
    const [navOpen, setNavOpen] = useState(true);

    const [isPlaying, setIsPlaying] = useState(false);
    const isPlayingRef = useRef(false);

    const [totalKm, setTotalKm] = useState(0);

    // ✅ NEW: follow mode
    const [followMode, setFollowMode] = useState(true);

    // ✅ NEW: fixed info panel address state
    const [currentAddr, setCurrentAddr] = useState('');
    const currentAddrKeyRef = useRef('');

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

    // ✅ TAB UI/UX
    const [activeTab, setActiveTab] = useState('route');
    const [statsOpen, setStatsOpen] = useState(false);

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

    const routeTimeline = useMemo(() => {
        if (!rawRouteData?.length) return [];

        const pts = rawRouteData
            .map((p, idx) => {
                const speedNum = toNum(p.spd) ?? toNum(p.velocityNum) ?? 0;
                const type = getStatusType({ acc: p.acc, spd: speedNum }); // PARK/RUN/STOP
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

    const RouteDetail = () => {
        const labelType = (tp) => {
            if (tp === 'RUN') return isEn ? 'Moving' : 'Di chuyển';
            if (tp === 'PARK') return isEn ? 'Parking' : 'Đỗ';
            return isEn ? 'Stop' : 'Dừng';
        };

        return (
            <div className="iky-cruise__events">
                <div className="iky-cruise__events-header">
                    <div className="iky-cruise__events-title">{isEn ? 'Route details' : 'Lộ trình chi tiết'}</div>
                    <div className="iky-cruise__events-sub">
                        {isEn ? 'Blocks' : 'Số đoạn'}: <b>{routeTimeline.length}</b>
                    </div>
                </div>

                <div className="iky-cruise__events-table">
                    <div className="iky-cruise__events-head iky-cruise__route-head">
                        <div className="iky-cruise__events-cell iky-cruise__events-cell--stt">#</div>
                        <div className="iky-cruise__events-cell">{isEn ? 'Type' : 'Loại'}</div>
                        <div className="iky-cruise__events-cell">{isEn ? 'Duration' : 'Thời gian'}</div>
                        <div className="iky-cruise__events-cell">{isEn ? 'Time range' : 'Khoảng thời gian'}</div>
                        <div className="iky-cruise__events-cell">{isEn ? 'Start coord' : 'Tọa độ bắt đầu'}</div>
                        <div className="iky-cruise__events-cell">{isEn ? 'End coord' : 'Tọa độ kết thúc'}</div>
                        <div className="iky-cruise__events-cell">{isEn ? 'Distance' : 'Quãng đường'}</div>
                        <div className="iky-cruise__events-cell iky-cruise__events-cell--action">
                            {isEn ? 'Go' : 'Tới'}
                        </div>
                    </div>

                    <div className="iky-cruise__events-body">
                        {routeTimeline.length === 0 ? (
                            <div className="iky-cruise__empty">{isEn ? 'No data' : 'Không có dữ liệu'}</div>
                        ) : (
                            routeTimeline.map((b, idx) => (
                                <div
                                    key={`${b.type}-${b.startIdx}-${b.endIdx}`}
                                    className="iky-cruise__events-row iky-cruise__route-row"
                                >
                                    <div className="iky-cruise__events-cell iky-cruise__events-cell--stt">
                                        {idx + 1}
                                    </div>
                                    <div className="iky-cruise__events-cell">{labelType(b.type)}</div>
                                    <div className="iky-cruise__events-cell">{formatDuration(b.durationSec)}</div>
                                    <Tooltip
                                        title={`${formatDateFromDevice(b.startTime)} → ${formatDateFromDevice(
                                            b.endTime,
                                        )}`}
                                    >
                                        <div className="iky-cruise__events-cell">
                                            {formatDateFromDevice(b.startTime)} → {formatDateFromDevice(b.endTime)}
                                        </div>
                                    </Tooltip>
                                    <div className="iky-cruise__events-cell">
                                        {typeof b.startLat === 'number' ? `${b.startLat},${b.startLon}` : '--'}
                                    </div>
                                    <div className="iky-cruise__events-cell">
                                        {typeof b.endLat === 'number' ? `${b.endLat},${b.endLon}` : '--'}
                                    </div>
                                    <div className="iky-cruise__events-cell">
                                        {b.type === 'RUN' ? `${b.distKm.toFixed(2)} km` : '--'}
                                    </div>
                                    <div className="iky-cruise__events-cell iky-cruise__events-cell--action">
                                        <button
                                            className="iky-cruise__mini-btn"
                                            onClick={() => goToRawIndex(b.startIdx)}
                                        >
                                            {isEn ? 'Go' : 'Tới'}
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        );
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

    // ✅ fetch address lazily + cache
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

    // ✅ NEW: update fixed info address when activeIndex changes
    useEffect(() => {
        const p = rawRouteData?.[activeIndex];
        if (!p || p.lat == null || p.lon == null) {
            setCurrentAddr('');
            currentAddrKeyRef.current = '';
            return;
        }

        const lang = isEn ? 'en' : 'vi';
        const key = `${lang}:${Number(p.lat).toFixed(6)},${Number(p.lon).toFixed(6)}`;
        if (currentAddrKeyRef.current === key) return;

        currentAddrKeyRef.current = key;
        setCurrentAddr('');

        (async () => {
            const addr = await ensureAddress(p.lat, p.lon);
            if (currentAddrKeyRef.current === key) setCurrentAddr(addr || '');
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeIndex, isEn, rawRouteData]);

    // ✅ popup: show ngay -> update khi có address
    const openInfoPopup = async (p) => {
        if (!LMap || !mapRef.current) return;
        if (!p || p.lat == null || p.lon == null) return;

        currentPopupPointRef.current = p;

        if (!popupRef.current) {
            popupRef.current = LMap.popup({ closeButton: true, autoPan: true });
        }

        popupRef.current.setLatLng([p.lat, p.lon]).setContent(buildPopupHtml(p, isEn)).openOn(mapRef.current);

        const addr = await ensureAddress(p.lat, p.lon);
        if (!addr) return;

        const updated = { ...p, address: addr };
        popupRef.current.setLatLng([p.lat, p.lon]).setContent(buildPopupHtml(updated, isEn)).openOn(mapRef.current);

        currentPopupPointRef.current = updated;
    };

    // ✅ When language changes: rerender popup
    useEffect(() => {
        if (!popupRef.current || !mapRef.current) return;
        const p = currentPopupPointRef.current;
        if (!p || p.lat == null || p.lon == null) return;

        popupRef.current.setLatLng([p.lat, p.lon]).setContent(buildPopupHtml(p, isEn)).openOn(mapRef.current);

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

    // ===============================
    // ✅ Build STOP/PARK segments + stats (fixed time)
    // ===============================
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

    const goToRawIndex = (rawIdx) => {
        if (!rawRouteData.length) return;
        handlePointClickRaw(rawIdx);
    };

    // ===============================
    // build segment distances for playback
    // ===============================
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

    // Dots render
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

    // ✅ click map: CHỈ mở popup
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
            color: '#1677ff',
            weight: 4,
            opacity: 0.8,
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
        let lastFollow = 0;

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

                    // ✅ follow at end
                    if (followMode && mapRef.current) {
                        mapRef.current.panTo([pLast.lat, pLast.lon], { animate: true, duration: 0.25 });
                    }
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

            if (!a || !b || segLen <= 0) {
                animationFrameRef.current = requestAnimationFrame(step);
                return;
            }

            const segStart = cum[segIdx];
            const t01 = (traveledM - segStart) / segLen;

            const lat = a.lat + (b.lat - a.lat) * t01;
            const lon = a.lon + (b.lon - a.lon) * t01;

            movingMarkerRef.current.setLatLng([lat, lon]);
            highlightDotRef.current?.setLatLng([lat, lon]);

            // ✅ follow mode (throttle)
            if (followMode && mapRef.current && now - lastFollow > 180) {
                lastFollow = now;
                mapRef.current.panTo([lat, lon], { animate: true, duration: 0.18 });
            }

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
    }, [isPlaying, mapRouteData, playbackRate, activeRenderIndex, followMode]);

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
            setCurrentAddr('');
            currentAddrKeyRef.current = '';

            setRawRouteData([]);
            setMapRouteData([]);
            mapToRawIndexRef.current = [];
            setTotalKm(0);
            setActiveIndex(0);
            setActiveRenderIndex(0);
            setSliderValue(0);

            setActiveTab('route');
            setStatsOpen(false);

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
                const speedNum = toNum(item.vgp) ?? 0;
                const status = buildStatusHard({ acc: item.acc, spd: speedNum }, isEn);

                const timRaw = item.tim;
                const createdAt = item.createdAt;
                const dateTime = item.tim || item.createdAt || item.created || '';

                return {
                    lat: item.lat,
                    lon: item.lon,

                    gps: item.gps,
                    sat: item.sat,
                    mil: item.mil,

                    timRaw,
                    createdAt,

                    licensePlate: plate,
                    vehicleName,
                    manufacturer,
                    selector: item._id,

                    dateTime,
                    velocity: status.speedText,
                    velocityNum: status.speedNum,

                    acc: item.acc,
                    spd: item.vgp,

                    address: '',
                    __timeMs: safeTimeMs({ timRaw, dateTime, createdAt }),
                };
            });

            setRawRouteData(mapped);
            setTotalKm(calcTotalDistanceKm(mapped));

            const sample = buildMapSample(mapped, VISUAL_MAX_POINTS_ON_MAP, MAP_MIN_SAMPLE_DIST_M);
            mapToRawIndexRef.current = sample.indices;
            setMapRouteData(sample.points);

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

    // ===============================
    // Speed series
    // ===============================
    const speedSeries = useMemo(() => {
        if (!rawRouteData?.length) return [];

        const pts = rawRouteData
            .map((p, i) => {
                const tms = Number.isFinite(p.__timeMs) ? p.__timeMs : safeTimeMs(p);
                const v = toNum(p.spd) ?? toNum(p.velocityNum) ?? 0;
                return Number.isFinite(tms) ? { i, tms, v } : null;
            })
            .filter(Boolean);

        const MAX = 1200;
        if (pts.length <= MAX) return pts;
        const step = Math.ceil(pts.length / MAX);
        const out = [];
        for (let k = 0; k < pts.length; k += step) out.push(pts[k]);
        if (out[out.length - 1] !== pts[pts.length - 1]) out.push(pts[pts.length - 1]);
        return out;
    }, [rawRouteData]);

    // ✅ ACC series (step chart)
    const accSeries = useMemo(() => {
        if (!rawRouteData?.length) return [];
        const pts = rawRouteData
            .map((p, i) => {
                const tms = Number.isFinite(p.__timeMs) ? p.__timeMs : safeTimeMs(p);
                if (!Number.isFinite(tms)) return null;
                const acc = Number(p.acc ?? 0) ? 1 : 0;
                return { i, tms, acc };
            })
            .filter(Boolean);

        const MAX = 1500;
        if (pts.length <= MAX) return pts;
        const step = Math.ceil(pts.length / MAX);
        const out = [];
        for (let k = 0; k < pts.length; k += step) out.push(pts[k]);
        if (out[out.length - 1] !== pts[pts.length - 1]) out.push(pts[pts.length - 1]);
        return out;
    }, [rawRouteData]);

    const SpeedChart = () => {
        if (!speedSeries.length) return <div className="iky-cruise__empty">No data</div>;

        const formatTime = (ms) => {
            const d = new Date(ms);
            const hh = String(d.getHours()).padStart(2, '0');
            const mm = String(d.getMinutes()).padStart(2, '0');
            return `${hh}:${mm}`;
        };

        return (
            <div className="iky-cruise__chart">
                <div className="iky-cruise__chart-head">
                    <div className="iky-cruise__chart-title">{isEn ? 'Speed chart' : 'Đồ thị vận tốc'}</div>
                    <div className="iky-cruise__chart-sub">
                        {isEn ? 'Max speed' : 'Tốc độ lớn nhất'}: <b>{stats.maxSpeed} km/h</b>{' '}
                        {stats.maxSpeedTime ? (
                            <span>
                                ({isEn ? 'at' : 'lúc'} {formatDateFromDevice(stats.maxSpeedTime)})
                            </span>
                        ) : null}
                    </div>
                </div>

                <div className="iky-cruise__chart-box">
                    <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={speedSeries} margin={{ top: 10, right: 18, left: 6, bottom: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                                dataKey="tms"
                                tickFormatter={formatTime}
                                minTickGap={24}
                                type="number"
                                domain={['dataMin', 'dataMax']}
                            />
                            <YAxis dataKey="v" width={40} tickFormatter={(v) => `${v}`} domain={[0, 'auto']} />
                            <ReTooltip
                                labelFormatter={(ms) => `${isEn ? 'Time' : 'Thời gian'}: ${formatTime(ms)}`}
                                formatter={(value) => [`${value} km/h`, isEn ? 'Speed' : 'Vận tốc']}
                            />
                            <Line type="monotone" dataKey="v" dot={false} strokeWidth={2} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                <div className="iky-cruise__chart-actions">
                    <button
                        type="button"
                        className="iky-cruise__mini-btn"
                        onClick={() => goToRawIndex(stats.maxSpeedRawIndex)}
                    >
                        {isEn ? 'Go to max-speed point' : 'Tới điểm tốc độ lớn nhất'}
                    </button>
                </div>
            </div>
        );
    };

    const AccChart = () => {
        if (!accSeries.length) return <div className="iky-cruise__empty">No data</div>;

        const formatTime = (ms) => {
            const d = new Date(ms);
            const hh = String(d.getHours()).padStart(2, '0');
            const mm = String(d.getMinutes()).padStart(2, '0');
            return `${hh}:${mm}`;
        };

        // Chuẩn hóa data: acc = 1 là TẮT, còn lại (0, null, undefined) là BẬT
        const normalizedData = accSeries.map((item) => ({
            ...item,
            accValue: item.acc === 1 ? 0 : 1, // Đảo ngược: 1->0 (tắt), còn lại->1 (bật)
            accOriginal: item.acc, // Giữ giá trị gốc để debug nếu cần
        }));

        return (
            <div className="iky-cruise__chart">
                <div className="iky-cruise__chart-head">
                    <div className="iky-cruise__chart-title">
                        {isEn ? 'ACC (engine) chart' : 'Đồ thị trạng thái máy'}
                    </div>
                    {/* <div className="iky-cruise__chart-sub">
                        {isEn ? 'Step chart: 1 = ON, 0 = OFF' : 'Dạng bậc thang: 1 = BẬT, 0 = TẮT'}
                    </div> */}
                </div>

                <div className="iky-cruise__chart-box">
                    <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={normalizedData} margin={{ top: 10, right: 18, left: 6, bottom: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                                dataKey="tms"
                                tickFormatter={formatTime}
                                minTickGap={28}
                                type="number"
                                domain={['dataMin', 'dataMax']}
                            />
                            <YAxis
                                dataKey="accValue"
                                width={40}
                                domain={[-0.05, 1.05]}
                                ticks={[0, 1]}
                                tickFormatter={(value) => (value === 1 ? (isEn ? 'ON' : 'BẬT') : isEn ? 'OFF' : 'TẮT')}
                            />
                            <ReTooltip
                                labelFormatter={(ms) => `${isEn ? 'Time' : 'Thời gian'}: ${formatTime(ms)}`}
                                formatter={(value, name) => [
                                    value === 1 ? (isEn ? 'ON' : 'Mở máy') : isEn ? 'OFF' : 'Tắt máy',
                                    'Trạng thái máy',
                                ]}
                            />
                            <Line
                                type="stepAfter"
                                dataKey="accValue"
                                dot={false}
                                strokeWidth={2}
                                isAnimationActive={false}
                                stroke="#8884d8"
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        );
    };
    // ===============================
    // Event tables (Dừng/Đỗ)
    // ===============================
    const EventTable = ({ items, kind }) => {
        const isStop = kind === 'STOP';
        const title = isStop ? (isEn ? 'Stops' : 'Dừng xe') : isEn ? 'Parking' : 'Đỗ xe';

        const color = isStop ? 'gold' : 'blue';
        const tagText = isStop ? (isEn ? 'STOP' : 'DỪNG') : isEn ? 'PARK' : 'ĐỖ';

        return (
            <div className="iky-cruise__events">
                <div className="iky-cruise__events-header">
                    <div className="iky-cruise__events-title">
                        {title} <Tag color={color}>{tagText}</Tag>
                    </div>
                </div>

                <div className="iky-cruise__events-table">
                    <div className="iky-cruise__events-head">
                        <div className="iky-cruise__events-cell iky-cruise__events-cell--stt">#</div>
                        <div className="iky-cruise__events-cell">{isEn ? 'Start' : 'Bắt đầu'}</div>
                        <div className="iky-cruise__events-cell">{isEn ? 'End' : 'Kết thúc'}</div>
                        <div className="iky-cruise__events-cell">{isEn ? 'Duration' : 'Thời gian'}</div>
                        <div className="iky-cruise__events-cell">{isEn ? 'Start coord' : 'Tọa độ bắt đầu'}</div>
                        <div className="iky-cruise__events-cell">{isEn ? 'End coord' : 'Tọa độ kết thúc'}</div>
                        <div className="iky-cruise__events-cell iky-cruise__events-cell--action">
                            {isEn ? 'Action' : 'Thao tác'}
                        </div>
                    </div>

                    <div className="iky-cruise__events-body">
                        {items.length === 0 ? (
                            <div className="iky-cruise__empty">{isEn ? 'No events' : 'Không có dữ liệu'}</div>
                        ) : (
                            items.map((e, idx) => (
                                <div key={`${e.type}-${e.startIndex}-${e.endIndex}`} className="iky-cruise__events-row">
                                    <div className="iky-cruise__events-cell iky-cruise__events-cell--stt">
                                        {idx + 1}
                                    </div>
                                    <div className="iky-cruise__events-cell">{formatDateFromDevice(e.startTime)}</div>
                                    <div className="iky-cruise__events-cell">{formatDateFromDevice(e.endTime)}</div>
                                    <div className="iky-cruise__events-cell">{formatDuration(e.durationSec)}</div>
                                    <div className="iky-cruise__events-cell">
                                        {typeof e.startLat === 'number' ? `${e.startLat},${e.startLon}` : '--'}
                                    </div>
                                    <div className="iky-cruise__events-cell">
                                        {typeof e.endLat === 'number' ? `${e.endLat},${e.endLon}` : '--'}
                                    </div>
                                    <div className="iky-cruise__events-cell iky-cruise__events-cell--action">
                                        <Tooltip title={isEn ? 'Go to start point' : 'Tới điểm bắt đầu'}>
                                            <button
                                                type="button"
                                                className="iky-cruise__mini-btn"
                                                onClick={() => goToRawIndex(e.startIndex)}
                                            >
                                                {isEn ? 'Go' : 'Tới'}
                                            </button>
                                        </Tooltip>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // ✅ Current info panel data
    const currentPoint = rawRouteData?.[activeIndex] || null;
    const currentInfo = useMemo(() => {
        if (!currentPoint) return null;
        const speed = toNum(currentPoint.spd) ?? toNum(currentPoint.velocityNum) ?? 0;
        const acc = Number(currentPoint.acc ?? 0) ? 1 : 0;
        const gpsLost = Number(currentPoint.gps ?? 0) === 1;
        const sat = typeof currentPoint.sat === 'number' ? currentPoint.sat : null;
        return {
            time: currentPoint.dateTime,
            lat: currentPoint.lat,
            lon: currentPoint.lon,
            speed,
            acc,
            gpsLost,
            sat,
            velocityText: currentPoint.velocity,
            plate: currentPoint.licensePlate || '',
        };
    }, [currentPoint]);

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

                        <CruiseExportButton
                            isEn={isEn}
                            disabled={loadingRoute || rawRouteData.length === 0}
                            rawRouteData={rawRouteData}
                            stats={stats}
                            segments={segments}
                            device={deviceList.find((d) => d._id === selectedDeviceId)}
                            startText={start}
                            endText={end}
                            distanceMetersFn={(a, b) => distanceMeters(a, b)}
                            formatDateFn={(dt) => formatDateFromDevice(dt)}
                            formatDurationFn={(sec) => formatDuration(sec)}
                            // ✅ nếu bạn muốn cố gắng điền address vào excel (giới hạn 120 điểm để không chậm):
                            ensureAddressFn={ensureAddress}
                        />

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

                                {/* ✅ Follow toggle */}
                                <div className="iky-cruise__follow">
                                    <Tooltip
                                        title={
                                            isEn
                                                ? 'Follow marker (auto pan while playing)'
                                                : 'Bám theo xe (tự pan khi chạy)'
                                        }
                                    >
                                        <span className="iky-cruise__follow-label">{isEn ? 'Follow' : 'Bám'}</span>
                                    </Tooltip>
                                    <Switch size="small" checked={followMode} onChange={(v) => setFollowMode(v)} />
                                </div>

                                <select
                                    value={playbackRate}
                                    onChange={(e) => setPlaybackRate(Number(e.target.value))}
                                    className="iky-cruise__rate"
                                >
                                    <option value={0.5}>0.5x</option>
                                    <option value={1}>1x</option>
                                    <option value={1.5}>1.5x</option>
                                    <option value={2}>2x</option>
                                    <option value={3}>3x</option>
                                    <option value={5}>5x</option>
                                    <option value={10}>10x</option>
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

                {/* ✅ Fixed current point info panel */}
                {rawRouteData.length > 0 && currentInfo && (
                    <div className="iky-cruise__infobox">
                        <div className="iky-cruise__infobox-title">{isEn ? 'Current point' : 'Điểm hiện tại'}</div>

                        <div className="iky-cruise__infobox-row">
                            <span className="iky-cruise__infobox-k">{isEn ? 'Time' : 'Thời gian'}</span>
                            <span className="iky-cruise__infobox-v">
                                <b>{formatDateFromDevice(currentInfo.time)}</b>
                            </span>
                        </div>

                        <div className="iky-cruise__infobox-row">
                            <span className="iky-cruise__infobox-k">{isEn ? 'Speed' : 'Tốc độ'}</span>
                            <span className="iky-cruise__infobox-v">
                                <b>{currentInfo.speed}</b> km/h{' '}
                            </span>
                        </div>

                        <div className="iky-cruise__infobox-row">
                            <span className="iky-cruise__infobox-k">Trạng thái máy</span>
                            <span className="iky-cruise__infobox-v">
                                <Tag color={Number(currentInfo.acc) === 1 ? 'default' : 'green'}>
                                    {Number(currentInfo.acc) === 1
                                        ? isEn
                                            ? 'Off'
                                            : 'Tắt máy'
                                        : isEn
                                          ? 'On'
                                          : 'Mở máy'}
                                </Tag>
                            </span>
                        </div>

                        {/* 
                        <div className="iky-cruise__infobox-row">
                            <span className="iky-cruise__infobox-k">GPS</span>
                            <span className="iky-cruise__infobox-v">
                                <Tag color={currentInfo.gpsLost ? 'red' : 'green'}>
                                    {currentInfo.gpsLost ? (isEn ? 'LOST' : 'MẤT') : isEn ? 'OK' : 'TỐT'}
                                </Tag>
                                {typeof currentInfo.sat === 'number' ? (
                                    <span className="iky-cruise__infobox-sub">
                                        SAT: <b>{currentInfo.sat}</b>
                                    </span>
                                ) : null}
                            </span>
                        </div> */}

                        <div className="iky-cruise__infobox-row">
                            <span className="iky-cruise__infobox-k">{isEn ? 'Coord' : 'Tọa độ'}</span>
                            <span className="iky-cruise__infobox-v">
                                {typeof currentInfo.lat === 'number'
                                    ? `${currentInfo.lat.toFixed(6)}, ${currentInfo.lon.toFixed(6)}`
                                    : '--'}
                            </span>
                        </div>

                        <div className="iky-cruise__infobox-row">
                            <span className="iky-cruise__infobox-k">{isEn ? 'Address' : 'Địa chỉ'}</span>
                            <span className="iky-cruise__infobox-v">
                                {currentAddrKeyRef.current && !currentAddr ? (
                                    <i>{isEn ? 'Loading…' : 'Đang tải…'}</i>
                                ) : currentAddr ? (
                                    currentAddr
                                ) : (
                                    '--'
                                )}
                            </span>
                        </div>
                    </div>
                )}

                {/* dữ liệu đang làm theo trang tài xế công nghệ sẽ phát triển thêm trong tương lại ,tạm thời ẩn đi */}
                {/* {rawRouteData.length > 0 && (
                    <>
                        {navOpen && (
                            <div className="iky-cruise__bottomnav">
                                <div className="iky-cruise__bottomnav-top">
                                    <div className="iky-cruise__bottomnav-tabs">
                                        <Tabs
                                            activeKey={activeTab}
                                            onChange={(k) => {
                                                setActiveTab(k);
                                                if (k === 'stats') setStatsOpen(true);
                                            }}
                                            size="small"
                                            items={[
                                                { key: 'route', label: isEn ? 'Route detail' : 'Lộ trình chi tiết' },
                                                { key: 'stop', label: isEn ? 'Stop' : 'Dừng' },
                                                { key: 'park', label: isEn ? 'Park' : 'Đỗ' },
                                                { key: 'speed', label: isEn ? 'Speed' : 'Đồ thị vận tốc' },
                                                { key: 'acc', label: 'Bật/tắt máy' }, // ✅ NEW
                                                { key: 'stats', label: isEn ? 'Stats' : 'Thống kê' },
                                            ]}
                                        />
                                    </div>

                                    <button
                                        type="button"
                                        className="iky-cruise__bottomnav-close"
                                        onClick={() => setNavOpen(false)}
                                        aria-label="Close"
                                        title={isEn ? 'Close' : 'Đóng'}
                                    >
                                        ✕
                                    </button>
                                </div>

                                {activeTab !== 'stats' && (
                                    <div className="iky-cruise__bottomnav-body">
                                        {activeTab === 'route' && <RouteDetail />}
                                        {activeTab === 'stop' && <EventTable items={segments.stop} kind="STOP" />}
                                        {activeTab === 'park' && <EventTable items={segments.park} kind="PARK" />}
                                        {activeTab === 'speed' && <SpeedChart />}
                                        {activeTab === 'acc' && <AccChart />}
                                    </div>
                                )}
                            </div>
                        )}

                        {!navOpen && (
                            <button
                                type="button"
                                className="iky-cruise__bottomnav-open"
                                onClick={() => setNavOpen(true)}
                                title={isEn ? 'View details' : 'Xem thông tin chi tiết'}
                            >
                                <span className="iky-cruise__double-up">
                                    <UpOutlined />
                                    <UpOutlined />
                                </span>
                                <span className="iky-cruise__bottomnav-open-text">
                                    {isEn ? 'View details' : 'Xem thông tin chi tiết'}
                                </span>
                            </button>
                        )}
                    </>
                )} */}

                <Modal
                    open={statsOpen}
                    title={isEn ? 'Statistics' : 'Thống kê'}
                    onCancel={() => {
                        setStatsOpen(false);
                        if (activeTab === 'stats') setActiveTab('route');
                    }}
                    footer={null}
                    width={720}
                >
                    <div className="iky-cruise__stats">
                        <div className="iky-cruise__stats-row">
                            <div className="iky-cruise__stats-k">{isEn ? 'Total distance' : 'Tổng quãng đường'}</div>
                            <div className="iky-cruise__stats-v">
                                <b>{stats.totalDistanceKm.toFixed(3)} km</b>
                            </div>
                        </div>

                        <div className="iky-cruise__stats-row">
                            <div className="iky-cruise__stats-k">{isEn ? 'Stop count' : 'Tổng số lần dừng'}</div>
                            <div className="iky-cruise__stats-v">
                                <b>{stats.stopCount}</b>
                            </div>
                        </div>

                        <div className="iky-cruise__stats-row">
                            <div className="iky-cruise__stats-k">
                                {isEn ? 'Total stop time' : 'Tổng thời gian dừng'}
                            </div>
                            <div className="iky-cruise__stats-v">
                                <b>{formatDuration(stats.totalStopSec)}</b>
                            </div>
                        </div>

                        <div className="iky-cruise__stats-row">
                            <div className="iky-cruise__stats-k">{isEn ? 'Parking count' : 'Tổng số lần đỗ'}</div>
                            <div className="iky-cruise__stats-v">
                                <b>{stats.parkCount}</b>
                            </div>
                        </div>

                        <div className="iky-cruise__stats-row">
                            <div className="iky-cruise__stats-k">
                                {isEn ? 'Total parking time' : 'Tổng thời gian đỗ'}
                            </div>
                            <div className="iky-cruise__stats-v">
                                <b>{formatDuration(stats.totalParkSec)}</b>
                            </div>
                        </div>

                        <div className="iky-cruise__stats-row">
                            <div className="iky-cruise__stats-k">{isEn ? 'Max speed' : 'Tốc độ lớn nhất'}</div>
                            <div className="iky-cruise__stats-v">
                                <b>{stats.maxSpeed} km/h</b>{' '}
                                {stats.maxSpeedTime ? (
                                    <span>
                                        ({isEn ? 'at' : 'lúc'} {formatDateFromDevice(stats.maxSpeedTime)})
                                    </span>
                                ) : null}
                            </div>
                        </div>

                        <div className="iky-cruise__stats-actions">
                            <button
                                type="button"
                                className="iky-cruise__mini-btn"
                                onClick={() => goToRawIndex(stats.maxSpeedRawIndex)}
                            >
                                {isEn ? 'Go to max-speed point' : 'Tới điểm tốc độ lớn nhất'}
                            </button>
                        </div>
                    </div>
                </Modal>

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
