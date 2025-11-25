'use client';

import React, { useState, useEffect, useRef } from 'react';
import './cruise.css';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIconImg from '../assets/marker-red.png';

import { getCruiseHistory } from '../lib/api/cruise';
import { getDevices } from '../lib/api/devices';

const buildPopupHtml = (p) => `
    <div class="iky-cruise-popup">
        <div><strong>Biển số xe:</strong> ${p.licensePlate || '--'}</div>
        <div><strong>Loại xe:</strong> ${p.vehicleName || '--'}</div>
        <div><strong>Hãng:</strong> ${p.manufacturer || '--'}</div>
        <div><strong>Thời điểm:</strong> ${p.dateTime || '--'}</div>
        <div><strong>Vị trí hiện tại:</strong> ${p.lat}, ${p.lon}</div>
        <div><strong>Trạng thái máy:</strong> ${p.machineStatus || '--'}</div>
        <div><strong>Trạng thái xe:</strong> ${p.vehicleStatus || '--'}</div>
        <div><strong>Vận tốc:</strong> ${p.velocity || '--'}</div>
    </div>
`;

const CruisePage = () => {
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

    const mapRef = useRef(null);
    const polylineRef = useRef(null);
    const movingMarkerRef = useRef(null);
    const pointMarkersRef = useRef([]);
    const animationFrameRef = useRef(null);

    const animStateRef = useRef({
        segmentIndex: 0,
        t: 0,
    });

    const isPlayingRef = useRef(false);

    // Format datetime-local -> "YYYY-MM-DD HH:mm:ss"
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

    // Handle point selection from list/slider/map
    const handleSelectPoint = (idx) => {
        if (!routeData.length) return;

        setIsPlaying(false);
        isPlayingRef.current = false;
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }

        setActiveIndex(idx);
        animStateRef.current = { segmentIndex: idx, t: 0 };

        const p = routeData[idx];

        if (mapRef.current) {
            mapRef.current.panTo([p.lat, p.lon]);
        }

        if (movingMarkerRef.current) {
            movingMarkerRef.current.setLatLng([p.lat, p.lon]);
            movingMarkerRef.current.setPopupContent(buildPopupHtml(p));
            movingMarkerRef.current.openPopup();
        }
    };

    const handleSliderChange = (e) => {
        const idx = Number(e.target.value);
        handleSelectPoint(idx);
    };

    // Load device list - Fixed SSR issue
    useEffect(() => {
        // Prevent execution during server-side rendering
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

    // Load saved filter from MonitorPage - Fixed SSR issue
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
        const initialLat = 10.755937;
        const initialLon = 106.612587;

        const map = L.map('iky-cruise-map', {
            center: [initialLat, initialLon],
            zoom: 15,
            zoomControl: true,
            attributionControl: false,
            dragging: true,
            scrollWheelZoom: true,
        });

        mapRef.current = map;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
        }).addTo(map);

        map.scrollWheelZoom.enable();
        map.dragging.enable();

        const handleResize = () => {
            map.invalidateSize();
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            map.remove();
        };
    }, []);

    // Calculate total distance
    useEffect(() => {
        if (!routeData.length) {
            setTotalKm(0);
            return;
        }
        let totalMeters = 0;
        for (let i = 1; i < routeData.length; i++) {
            const p1 = routeData[i - 1];
            const p2 = routeData[i];
            const ll1 = L.latLng(p1.lat, p1.lon);
            const ll2 = L.latLng(p2.lat, p2.lon);
            totalMeters += ll1.distanceTo(ll2);
        }
        setTotalKm(totalMeters / 1000);
    }, [routeData]);

    // Render route on map
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        // Clear existing layers
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

        if (!routeData.length) return;

        const latlngs = routeData.map((p) => [p.lat, p.lon]);

        // Draw polyline
        polylineRef.current = L.polyline(latlngs, {
            color: '#f97316',
            weight: 4,
            opacity: 0.9,
        }).addTo(map);

        // Draw points with A/B markers
        pointMarkersRef.current = routeData.map((p, idx) => {
            const isStart = idx === 0;
            const isEnd = idx === routeData.length - 1;

            const marker = L.circleMarker([p.lat, p.lon], {
                radius: isStart || isEnd ? 7 : 6,
                color: isEnd ? '#ef4444' : '#22c55e',
                fillColor: isEnd ? '#ef4444' : '#22c55e',
                fillOpacity: 1,
                weight: 2,
            }).addTo(map);

            marker.bringToFront();

            if (isStart || isEnd) {
                const label = isStart ? 'A' : 'B';
                const divIcon = L.divIcon({
                    className: 'iky-cruise-ab-icon',
                    html: label,
                    iconSize: [18, 18],
                    iconAnchor: [9, 9],
                });
                L.marker([p.lat, p.lon], { icon: divIcon }).addTo(map);
            }

            marker.on('click', () => {
                if (!routeData.length) return;

                setIsPlaying(false);
                isPlayingRef.current = false;
                if (animationFrameRef.current) {
                    cancelAnimationFrame(animationFrameRef.current);
                    animationFrameRef.current = null;
                }

                const point = routeData[idx];

                setActiveIndex(idx);
                animStateRef.current = { segmentIndex: idx, t: 0 };

                if (mapRef.current) {
                    mapRef.current.panTo([point.lat, point.lon]);
                }

                if (movingMarkerRef.current) {
                    movingMarkerRef.current.setLatLng([point.lat, point.lon]);
                    movingMarkerRef.current.setPopupContent(buildPopupHtml(point));
                    movingMarkerRef.current.openPopup();
                }
            });

            return marker;
        });

        // Create moving marker
        const customIcon = L.icon({
            iconUrl: markerIconImg.src,
            iconSize: [36, 36],
            iconAnchor: [18, 36],
        });

        movingMarkerRef.current = L.marker(latlngs[0], {
            icon: customIcon,
        })
            .addTo(map)
            .bindPopup(buildPopupHtml(routeData[0]));

        // Reset animation state
        setIsPlaying(false);
        isPlayingRef.current = false;
        animStateRef.current = { segmentIndex: 0, t: 0 };

        // Fit map to route bounds
        map.fitBounds(polylineRef.current.getBounds(), { padding: [40, 40] });
        map.invalidateSize();
        map.scrollWheelZoom.enable();
        map.dragging.enable();
    }, [routeData]);

    // Sync marker position with activeIndex
    useEffect(() => {
        if (!routeData.length || !movingMarkerRef.current || !mapRef.current) return;

        const p = routeData[activeIndex];
        movingMarkerRef.current.setLatLng([p.lat, p.lon]);
        movingMarkerRef.current.setPopupContent(buildPopupHtml(p));
    }, [activeIndex, routeData]);

    // Animation loop
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

    // Load route data - Fixed SSR issue
    const handleLoadRoute = async () => {
        // Prevent execution during server-side rendering
        if (typeof window === 'undefined') return;

        const token = localStorage.getItem('accessToken');

        if (!token) {
            setError('Không tìm thấy accessToken, vui lòng kiểm tra lại đăng nhập.');
            return;
        }

        if (!selectedDeviceId || !selectedImei) {
            setError('Vui lòng chọn phương tiện.');
            return;
        }

        if (!start || !end) {
            setError('Vui lòng nhập đầy đủ thời gian bắt đầu và kết thúc.');
            return;
        }

        const currentDevice = deviceList.find((d) => d._id === selectedDeviceId);
        if (!currentDevice) {
            setError('Không tìm thấy thông tin phương tiện.');
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
                setError('Không có dữ liệu lộ trình trong khoảng thời gian này.');
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
                machineStatus: item.acc === 1 ? 'Mở máy' : 'Tắt máy',
                velocity: item.spd != null ? `${item.spd} km/h` : '0 km/h',
                vehicleStatus: item.acc === 1 ? 'Xe đang chạy' : 'Đỗ xe',
                gpsSignText: item.gps === 1 ? 'Có GPS' : '',
            }));

            setRouteData(mapped);
            setActiveIndex(0);
        } catch (e) {
            console.error(e);
            setError('Lỗi tải dữ liệu lộ trình. Vui lòng thử lại.');
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
        if (movingMarkerRef.current && mapRef.current) {
            movingMarkerRef.current.setLatLng([p.lat, p.lon]);
            movingMarkerRef.current.setPopupContent(buildPopupHtml(p));
            mapRef.current.panTo([p.lat, p.lon]);
        }
    };

    return (
        <div className="iky-cruise">
            {/* LEFT PANEL */}
            <aside className="iky-cruise__left">
                <div className="iky-cruise__left-card">
                    <div className="iky-cruise__left-header">Xem lại lộ trình</div>

                    <div className="iky-cruise__form">
                        <div className="iky-cruise__form-row">
                            <label>Chọn xe</label>
                            <select value={selectedDeviceId} onChange={handleDeviceChange} disabled={loadingDevices}>
                                {loadingDevices && <option>Đang tải...</option>}
                                {!loadingDevices && (
                                    <>
                                        <option value="">-- Chọn xe --</option>
                                        {deviceList.map((d) => (
                                            <option key={d._id} value={d._id}>
                                                {d.license_plate || 'Không rõ biển số'}
                                            </option>
                                        ))}
                                    </>
                                )}
                            </select>
                        </div>

                        <div className="iky-cruise__form-row">
                            <label>Từ ngày</label>
                            <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
                        </div>
                        <div className="iky-cruise__form-row">
                            <label>Đến ngày</label>
                            <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
                        </div>

                        <button className="iky-cruise__load-btn" onClick={handleLoadRoute} disabled={loadingRoute}>
                            {loadingRoute ? 'Đang tải...' : 'Tải lộ trình'}
                        </button>

                        {error && <div className="iky-cruise__error">{error}</div>}
                    </div>

                    {routeData.length > 0 && (
                        <>
                            <div className="iky-cruise__result">
                                <span>Kết quả</span>
                                <span>
                                    {activeIndex + 1}/{routeData.length}
                                </span>
                            </div>

                            <div className="iky-cruise__distance">
                                <span>Tổng km di chuyển:</span>
                                <span>{totalKm.toFixed(3)} km</span>
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
                                        className={
                                            'iky-cruise__list-item' +
                                            (idx === activeIndex ? ' iky-cruise__list-item--active' : '')
                                        }
                                        onClick={() => handleSelectPoint(idx)}
                                    >
                                        <div className="iky-cruise__list-time">{p.dateTime}</div>
                                        <div className="iky-cruise__list-meta">
                                            <span>{p.lat.toFixed(6)}</span>
                                            <span>{p.lon.toFixed(6)}</span>
                                            <span>{p.velocity}</span>
                                        </div>
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
