'use client';

import React, { useState, useEffect, useRef } from 'react';
import './cruise.css';

import markerIconImg from '../assets/marker-red.png';

import { getCruiseHistory } from '../lib/api/cruise';
import { getDevices } from '../lib/api/devices';

// 🔥 i18n giống Monitor / StatusBar
import vi from '../locales/vi.json';
import en from '../locales/en.json';
import { usePathname } from 'next/navigation';

const locales = { vi, en };

const GOONG_API_KEY = process.env.NEXT_PUBLIC_GOONG_API_KEY;

// ===============================
// 🔑 NHIỀU GOONG API KEY + XOAY VÒNG
// ===============================
const GOONG_KEYS = [
    process.env.NEXT_PUBLIC_GOONG_API_KEY,
    process.env.NEXT_PUBLIC_GOONG_API_KEY1,
    process.env.NEXT_PUBLIC_GOONG_API_KEY3,
    process.env.NEXT_PUBLIC_GOONG_API_KEY4,
    process.env.NEXT_PUBLIC_GOONG_API_KEY5,
    process.env.NEXT_PUBLIC_GOONG_API_KEY6,
].filter(Boolean); // bỏ undefined / null

let goongKeyIndex = 0;

const getCurrentGoongKey = () => {
    if (!GOONG_KEYS.length) return null;
    return GOONG_KEYS[goongKeyIndex % GOONG_KEYS.length];
};

const moveToNextGoongKey = () => {
    if (!GOONG_KEYS.length) return;
    goongKeyIndex = (goongKeyIndex + 1) % GOONG_KEYS.length;
};

// Hàm gọi Goong Geocode có xoay vòng key + nhận diện limit qua HTTP status & body
const callGoongWithRotation = async (lat, lon) => {
    if (!GOONG_KEYS.length) return '';

    for (let i = 0; i < GOONG_KEYS.length; i++) {
        const apiKey = getCurrentGoongKey();
        if (!apiKey) break;

        try {
            const res = await fetch(`https://rsapi.goong.io/Geocode?latlng=${lat},${lon}&api_key=${apiKey}`);

            let data = null;
            try {
                data = await res.json();
            } catch (e) {
                // nếu parse json lỗi thì coi như key này lỗi
                moveToNextGoongKey();
                continue;
            }

            // 1. HTTP 429 / 403 -> chắc chắn bị limit/forbidden
            if (res.status === 429 || res.status === 403) {
                moveToNextGoongKey();
                continue;
            }

            // 2. Kiểm tra trong body có status limit/denied không
            const status = data?.status || data?.error || data?.error_code;
            if (status === 'OVER_QUERY_LIMIT' || status === 'REQUEST_DENIED' || status === 'PERMISSION_DENIED') {
                moveToNextGoongKey();
                continue;
            }

            // 3. Các lỗi HTTP khác
            if (!res.ok) {
                moveToNextGoongKey();
                continue;
            }

            const addr = data?.results?.[0]?.formatted_address || '';

            if (addr) {
                return addr;
            }

            // không có địa chỉ → thử key khác
            moveToNextGoongKey();
        } catch (e) {
            // lỗi mạng, lỗi fetch → thử key tiếp theo
            moveToNextGoongKey();
        }
    }

    return '';
};

// 🔥 Hàm gọi Goong Trip API để lấy tổng quãng đường (meters) với xoay key
const callGoongTripWithRotation = async (points) => {
    if (!GOONG_KEYS.length) return null;

    const coords = points.filter((p) => typeof p.lat === 'number' && typeof p.lon === 'number');
    if (coords.length < 2) return null;

    const origin = `${coords[0].lat},${coords[0].lon}`;
    const destination = `${coords[coords.length - 1].lat},${coords[coords.length - 1].lon}`;
    const mid = coords.slice(1, -1);
    const waypointsStr = mid.map((p) => `${p.lat},${p.lon}`).join(';');

    for (let i = 0; i < GOONG_KEYS.length; i++) {
        const apiKey = getCurrentGoongKey();
        if (!apiKey) break;

        try {
            const url =
                `https://rsapi.goong.io/v2/trip?origin=${origin}` +
                (waypointsStr ? `&waypoints=${waypointsStr}` : '') +
                `&destination=${destination}&api_key=${apiKey}`;

            const res = await fetch(url);

            let data = null;
            try {
                data = await res.json();
            } catch (e) {
                moveToNextGoongKey();
                continue;
            }

            // limit / forbidden
            if (res.status === 429 || res.status === 403) {
                moveToNextGoongKey();
                continue;
            }

            const status = data?.code || data?.status || data?.error || data?.error_code;
            if (status === 'OVER_QUERY_LIMIT' || status === 'REQUEST_DENIED' || status === 'PERMISSION_DENIED') {
                moveToNextGoongKey();
                continue;
            }

            if (!res.ok && status && status !== 'Ok' && status !== 'OK') {
                moveToNextGoongKey();
                continue;
            }

            const trip = data?.trips?.[0];
            const dist = trip?.distance;

            if (typeof dist === 'number') {
                return dist; // meters
            }

            moveToNextGoongKey();
        } catch (e) {
            moveToNextGoongKey();
        }
    }

    return null;
};

// thêm t vào để popup dùng đa ngôn ngữ
const buildPopupHtml = (p, t) => `
    <div class="iky-cruise-popup">
        <div><strong>${t.popup.licensePlate}:</strong> ${p.licensePlate || '--'}</div>
        <div><strong>${t.popup.vehicleType}:</strong> ${p.vehicleName || '--'}</div>
        <div><strong>${t.popup.manufacturer}:</strong> ${p.manufacturer || '--'}</div>
        <div><strong>${t.popup.time}:</strong> ${p.dateTime || '--'}</div>
        <div><strong>${t.popup.currentLocation}:</strong> ${p.address || '--'}</div>
        <div><strong>${t.popup.coordinate}:</strong> ${p.lat}, ${p.lon}</div>
        <div><strong>${t.popup.machineStatus}:</strong> ${p.machineStatus || '--'}</div>
        <div><strong>${t.popup.vehicleStatus}:</strong> ${p.vehicleStatus || '--'}</div>
        <div><strong>${t.popup.speed}:</strong> ${p.velocity || '--'}</div>
    </div>
`;

// format Date -> "YYYY-MM-DDTHH:mm" cho input datetime-local (giữ đúng giờ local)
const toInputDateTime = (date) => {
    const tzOffset = date.getTimezoneOffset() * 60000; // ms
    const localISO = new Date(date.getTime() - tzOffset).toISOString();
    return localISO.slice(0, 16); // "YYYY-MM-DDTHH:mm"
};

const CruisePage = () => {
    // 🔥 LANG giống MonitorPage
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

    // leaflet refs
    const mapRef = useRef(null);
    const polylineRef = useRef(null);
    const movingMarkerRef = useRef(null);
    const pointMarkersRef = useRef([]); // index = index của routeData
    const animationFrameRef = useRef(null);
    const popupRef = useRef(null);

    const highlightedMarkerRef = useRef(null);

    // list refs
    const itemRefs = useRef([]);

    const animStateRef = useRef({
        segmentIndex: 0,
        t: 0,
    });

    const isPlayingRef = useRef(false);

    // ===== LOAD LEAFLET =====
    useEffect(() => {
        const loadLeaflet = async () => {
            const L = await import('leaflet');
            await import('leaflet/dist/leaflet.css');
            setLMap(L);
        };
        loadLeaflet();
    }, []);

    // Format datetime-local -> "YYYY-MM-DD HH:mm:ss" cho API
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

    // handler cho 3 nút nhanh: 1 giờ / 8 giờ / 24 giờ
    const handlePresetRange = (hours) => {
        const now = new Date();
        const startDate = new Date(now.getTime() - hours * 60 * 60 * 1000);

        setEnd(toInputDateTime(now));
        setStart(toInputDateTime(startDate));
    };

    // mở popup thông tin tại point p (dùng popupRef chung)
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

    // highlight marker đang chọn
    const highlightMarker = (idx) => {
        if (!pointMarkersRef.current.length) return;

        // bỏ highlight cũ
        if (highlightedMarkerRef.current) {
            highlightedMarkerRef.current.setStyle({
                radius: 6,
                weight: 2,
                color: '#22c55e',
                fillColor: '#22c55e',
            });
        }

        const mk = pointMarkersRef.current[idx];
        if (!mk) return;

        mk.setStyle({
            radius: 10,
            weight: 4,
            color: '#facc15',
            fillColor: '#facc15',
        });

        highlightedMarkerRef.current = mk;
    };

    // scroll list bên trái tới item index (dùng scrollIntoView cho chắc)
    const smoothScrollToItem = (idx) => {
        const item = itemRefs.current[idx];
        if (!item) return;

        item.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
        });
    };

    // 🔥 reverse geocode cho 1 point trong routeData (index) với multi-key Goong
    const fetchAddressForPoint = async (idx) => {
        if (!routeData.length) return;
        const point = routeData[idx];
        if (!point) return;

        const { lat, lon, address } = point;
        if (lat == null || lon == null) return;
        if (address) return; // đã có thì khỏi gọi nữa

        const latNum = Number(lat);
        const lonNum = Number(lon);
        if (Number.isNaN(latNum) || Number.isNaN(lonNum)) return;

        setLoadingAddress(true);
        setAddressError(null);

        const tryGoong = async () => {
            const addr = await callGoongWithRotation(latNum, lonNum);
            return addr;
        };

        const tryNominatim = async () => {
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latNum}&lon=${lonNum}&zoom=18&addressdetails=1`;
            const res = await fetch(url);
            if (!res.ok) throw new Error('Nominatim error');
            const data = await res.json();
            return data?.display_name || '';
        };

        try {
            let addr = '';

            // 1. thử Goong với nhiều key
            try {
                addr = await tryGoong();
            } catch (e) {
                console.error('Goong failed (all keys), fallback Nominatim:', e);
            }

            // 2. fallback OSM nếu Goong toang / hết key
            if (!addr) {
                try {
                    addr = await tryNominatim();
                } catch (e2) {
                    console.error('Nominatim failed:', e2);
                }
            }

            if (!addr) {
                setAddressError(t.error.addressFailed);
                return;
            }

            // update address vào routeData[idx]
            setRouteData((prev) => {
                if (!prev || !prev[idx]) return prev;
                const clone = [...prev];
                clone[idx] = { ...clone[idx], address: addr };
                return clone;
            });
        } catch (err) {
            console.error('Fetch address error (cruise):', err);
            setAddressError(t.error.addressFailed);
        } finally {
            setLoadingAddress(false);
        }
    };

    // chọn 1 point (từ list/slider/map), không di chuyển marker đỏ
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

    // click point (từ list / map / slider)
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
                const res = await getDevices(token, { limit: 100 });
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

    // Load saved filter from MonitorPage
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

    // Auto-update IMEI when device is selected
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

    // Initialize map
    useEffect(() => {
        if (!LMap) return;

        const initialLat = 10.755937;
        const initialLon = 106.612587;

        const map = LMap.map('iky-cruise-map', {
            center: [initialLat, initialLon],
            zoom: 15,
        });

        mapRef.current = map;

        LMap.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

        return () => map.remove();
    }, [LMap]);

    // 🔥 Tính tổng quãng đường:
    // - Ưu tiên dùng Goong Trip API (đường thực tế qua /v2/trip)
    // - Nếu lỗi / hết quota / không có key → fallback Haversine giữa các điểm
    // 🔥 Tính tổng quãng đường đã di chuyển theo track (A→B + B→C + …)
    useEffect(() => {
        if (routeData.length < 2) {
            setTotalKm(0);
            return;
        }

        // lọc điểm có tọa độ chuẩn
        const coords = routeData.filter((p) => typeof p.lat === 'number' && typeof p.lon === 'number');

        if (coords.length < 2) {
            setTotalKm(0);
            return;
        }

        const toRad = (v) => (v * Math.PI) / 180;
        const R = 6371000;

        const A = coords[0];
        const Z = coords[coords.length - 1];

        const dLat = toRad(Z.lat - A.lat);
        const dLon = toRad(Z.lon - A.lon);

        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(A.lat)) * Math.cos(toRad(Z.lat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        const km = (R * c) / 1000;

        setTotalKm(km); // chỉ A→Z
    }, [routeData]);

    // Render route on map (polyline + chấm xanh + marker đỏ)
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !LMap) return;

        // clear cũ
        if (polylineRef.current) {
            map.removeLayer(polylineRef.current);
            polylineRef.current = null;
        }
        if (movingMarkerRef.current) {
            map.removeLayer(movingMarkerRef.current);
            movingMarkerRef.current = null;
        }
        pointMarkersRef.current.forEach((m) => map.removeLayer(m));
        pointMarkersRef.current = [];
        highlightedMarkerRef.current = null;

        if (!routeData.length) return;

        const validIndices = routeData
            .map((p, idx) => (typeof p.lat === 'number' && typeof p.lon === 'number' ? idx : null))
            .filter((idx) => idx !== null);

        if (!validIndices.length) return;

        const latlngs = validIndices.map((idx) => {
            const p = routeData[idx];
            return [p.lat, p.lon];
        });

        polylineRef.current = LMap.polyline(latlngs, {
            color: '#f97316',
            weight: 4,
            opacity: 0.9,
        }).addTo(map);

        const firstIdx = validIndices[0];
        const lastIdx = validIndices[validIndices.length - 1];

        // tạo chấm xanh
        validIndices.forEach((idx) => {
            const p = routeData[idx];
            const isStart = idx === firstIdx;
            const isEnd = idx === lastIdx;

            const marker = LMap.circleMarker([p.lat, p.lon], {
                radius: isStart || isEnd ? 7 : 6,
                color: isEnd ? '#ef4444' : '#22c55e',
                fillColor: isEnd ? '#ef4444' : '#22c55e',
                fillOpacity: 1,
                weight: 2,
            }).addTo(map);

            marker.bringToFront();

            if (isStart || isEnd) {
                const label = isStart ? 'A' : 'B';
                const divIcon = LMap.divIcon({
                    className: 'iky-cruise-ab-icon',
                    html: label,
                    iconSize: [18, 18],
                    iconAnchor: [9, 9],
                });
                LMap.marker([p.lat, p.lon], { icon: divIcon }).addTo(map);
            }

            pointMarkersRef.current[idx] = marker;

            marker.on('click', () => {
                handlePointClick(idx);
            });
        });

        const firstPoint = routeData[firstIdx];

        const customIcon = LMap.icon({
            iconUrl: markerIconImg.src,
            iconSize: [36, 36],
            iconAnchor: [18, 36],
        });

        movingMarkerRef.current = LMap.marker([firstPoint.lat, firstPoint.lon], {
            icon: customIcon,
        }).addTo(map);

        setIsPlaying(false);
        isPlayingRef.current = false;
        animStateRef.current = { segmentIndex: 0, t: 0 };

        map.fitBounds(polylineRef.current.getBounds(), { padding: [40, 40] });
        map.invalidateSize();
        map.scrollWheelZoom.enable();
        map.dragging.enable();
    }, [routeData, LMap]);

    // khi address/activeIndex đổi, nếu popup đang mở thì update nội dung
    useEffect(() => {
        if (!popupRef.current || !routeData.length) return;

        const p = routeData[activeIndex];
        if (!p || p.lat == null || p.lon == null) return;

        popupRef.current.setLatLng([p.lat, p.lon]).setContent(buildPopupHtml(p, t));
    }, [routeData, activeIndex, t]);

    // 🔥 Fetch địa chỉ cho point đang active (chỉ khi không play để đỡ spam API)
    useEffect(() => {
        if (!routeData.length) return;
        if (isPlayingRef.current) return;

        fetchAddressForPoint(activeIndex);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeIndex, routeData]);

    // 🔥 Đồng bộ: mỗi khi activeIndex đổi -> scroll list + highlight marker
    useEffect(() => {
        if (!routeData.length) return;
        smoothScrollToItem(activeIndex);
        highlightMarker(activeIndex);
    }, [activeIndex, routeData]);

    // Animation loop cho marker đỏ
    useEffect(() => {
        if (!routeData.length || !movingMarkerRef.current) return;

        isPlayingRef.current = isPlaying;

        if (!isPlaying) {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
            return;
        }

        if (animationFrameRef.current) {
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
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
        };
    }, [isPlaying, routeData]);

    // Load route data
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

            const apiStart = toApiDateTime(start);
            const apiEnd = toApiDateTime(end);

            const res = await getCruiseHistory(token, {
                imei: selectedImei,
                start: apiStart,
                end: apiEnd,
                page: 0,
                limit: '',
            });

            const list = res?.data || [];

            if (!list.length) {
                setRouteData([]);
                setError(t.error.noData);
                return;
            }

            const plate = currentDevice.license_plate || '';
            const vehicleName =
                currentDevice.vehicle_category_id?.name || currentDevice.vehicle_category_id?.model || '';
            const manufacturer = currentDevice.device_category_id?.name || currentDevice.device_category_id?.code || '';

            const mapped = list.map((item) => ({
                lat: item.lat,
                lon: item.lon,
                licensePlate: plate,
                vehicleName,
                manufacturer,
                selector: item._id,
                duration: 0,
                dateTime: item.created ? new Date(item.created).toLocaleString() : item.tim || '',
                machineStatus: item.acc === 1 ? t.status.engineOn : t.status.engineOff,
                velocity: item.spd != null ? `${item.spd} km/h` : `0 km/h`,
                vehicleStatus: item.acc === 1 ? t.status.vehicleRunning : t.status.vehicleParking,
                gpsSignText: item.gps === 1 ? t.status.gpsAvailable : '',
                address: '',
            }));

            setRouteData(mapped);
            setActiveIndex(0);
        } catch (e) {
            console.error(e);
            setError(t.error.loadFailed);
        } finally {
            setLoadingRoute(false);
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

    return (
        <div className="iky-cruise">
            {/* LEFT PANEL */}
            <aside className="iky-cruise__left">
                <div className="iky-cruise__left-card">
                    <div className="iky-cruise__left-header">{t.title}</div>

                    <div className="iky-cruise__form">
                        <div className="iky-cruise__form-row">
                            <label>{t.form.selectVehicle}</label>
                            <select value={selectedDeviceId} onChange={handleDeviceChange} disabled={loadingDevices}>
                                {loadingDevices && <option>{t.form.loadingDevices}</option>}
                                {!loadingDevices && (
                                    <>
                                        <option value="">{t.form.selectVehiclePlaceholder}</option>
                                        {deviceList.map((d) => (
                                            <option key={d._id} value={d._id}>
                                                {d.license_plate || t.common.unknownPlate}
                                            </option>
                                        ))}
                                    </>
                                )}
                            </select>
                        </div>

                        {/* Nút chọn nhanh 1 / 8 / 24 giờ */}
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
                    </div>

                    {routeData.length > 0 && (
                        <>
                            <div className="iky-cruise__result">
                                <span>{t.result.label}</span>
                                <span>
                                    {activeIndex + 1}/{routeData.length}
                                </span>
                            </div>

                            <div className="iky-cruise__distance">
                                <span>{t.result.totalDistance}</span>
                                <span>
                                    {totalKm.toFixed(3)} {t.result.unitKm}
                                </span>
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
                                {routeData.map((p, idx) => (
                                    <div
                                        key={p.selector || idx}
                                        ref={(el) => (itemRefs.current[idx] = el)}
                                        className={
                                            'iky-cruise__list-item' +
                                            (idx === activeIndex ? ' iky-cruise__list-item--active' : '')
                                        }
                                        id={`cruise-item-${idx}`}
                                        onClick={() => handlePointClick(idx)}
                                    >
                                        <div className="iky-cruise__list-time">{p.dateTime}</div>
                                        <div className="iky-cruise__list-meta">
                                            <span>{typeof p.lat === 'number' ? p.lat.toFixed(6) : ''}</span>
                                            <span>{typeof p.lon === 'number' ? p.lon.toFixed(6) : ''}</span>
                                            <span>{p?.velocity}</span>
                                        </div>
                                        {p.address && <div className="iky-cruise__list-address">{p.address}</div>}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </aside>

            {/* MAP */}
            <section className="iky-cruise__center">
                <div className="iky-cruise__map">
                    <div id="iky-cruise-map" className="iky-cruise__map-inner" />
                </div>
            </section>
        </div>
    );
};

export default CruisePage;
