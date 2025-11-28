'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import './MonitorPage.css';

import { getDevices, getDeviceInfo, lockDevice, unlockDevice } from './lib/api/devices';
import { getBatteryStatusByImei } from './lib/api/batteryStatus';
import { getLastCruise } from './lib/api/cruise';

import markerIcon from './assets/marker-red.png';
import { useRouter } from 'next/navigation';
import { message, Modal } from 'antd';

const { confirm } = Modal;
const GOONG_API_KEY = process.env.NEXT_PUBLIC_GOONG_API_KEY;

const toLocalDateTimeInput = (date) => {
    const pad = (n) => String(n).padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const MonitorPage = () => {
    const [leftTab, setLeftTab] = useState('monitor');
    const [showPopup, setShowPopup] = useState(false);
    const [detailTab, setDetailTab] = useState('status');
    const [LMap, setLMap] = useState(null);

    // history filter (xem lại lộ trình)
    const [historyDeviceId, setHistoryDeviceId] = useState('');
    const [historyStart, setHistoryStart] = useState('');
    const [historyEnd, setHistoryEnd] = useState('');
    const [historyMessage, setHistoryMessage] = useState('');
    const [historyMessageType, setHistoryMessageType] = useState(''); // 'error' | 'success'

    const [deviceList, setDeviceList] = useState([]);
    const [loadingDevices, setLoadingDevices] = useState(false);

    const [searchText, setSearchText] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // all | online | offline

    // device đang chọn
    const [selectedDevice, setSelectedDevice] = useState(null);

    // battery status của device đang chọn
    const [batteryStatus, setBatteryStatus] = useState(null);
    const [loadingBattery, setLoadingBattery] = useState(false);

    // thêm: thông tin device detail + last cruise
    const [deviceInfo, setDeviceInfo] = useState(null);
    const [loadingDeviceInfo, setLoadingDeviceInfo] = useState(false);

    const [lastCruise, setLastCruise] = useState(null);
    const [loadingCruise, setLoadingCruise] = useState(false);
    const [cruiseError, setCruiseError] = useState(null);

    // lock / unlock
    const [lockLoading, setLockLoading] = useState(false);
    const [lockError, setLockError] = useState(null);

    // địa chỉ từ Goong
    const [address, setAddress] = useState('');
    const [loadingAddress, setLoadingAddress] = useState(false);
    const [addressError, setAddressError] = useState(null);

    const [lat] = useState(10.7542506);
    const [lng] = useState(106.6170202);

    useEffect(() => {
        const loadLeaflet = async () => {
            const L = await import('leaflet');
            await import('leaflet/dist/leaflet.css');
            setLMap(L);
        };
        loadLeaflet();
    }, []);

    const mapRef = useRef(null);
    const markerRef = useRef(null);
    const [markerScreenPos, setMarkerScreenPos] = useState(null);
    const router = useRouter();

    // INIT MAP
    useEffect(() => {
        if (!LMap) return; // Đợi Leaflet load xong

        const map = LMap.map('iky-map', {
            center: [lat, lng],
            zoom: 16,
            zoomControl: false,
            attributionControl: false,
            dragging: true,
            scrollWheelZoom: true,
        });

        mapRef.current = map;

        LMap.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
        }).addTo(map);

        const customIcon = LMap.icon({
            iconUrl: markerIcon.src,
            iconSize: [36, 36],
            iconAnchor: [18, 36],
        });

        const marker = LMap.marker([lat, lng], { icon: customIcon }).addTo(map);
        markerRef.current = marker;

        const updatePopupPosition = () => {
            const point = map.latLngToContainerPoint(marker.getLatLng());
            setMarkerScreenPos(point);
        };

        updatePopupPosition();

        marker.on('click', () => {
            setShowPopup(true);
        });

        map.on('click', () => {
            setShowPopup(false);
        });

        map.on('move zoom', updatePopupPosition);

        const handleResize = () => {
            map.invalidateSize();
            updatePopupPosition();
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            map.off('move', updatePopupPosition);
            map.off('zoom', updatePopupPosition);
            map.remove();
        };
    }, [LMap, lat, lng]);

    // LOAD LIST DEVICE
    useEffect(() => {
        const token = localStorage.getItem('accessToken');
        if (!token) return;

        const fetchDevices = async () => {
            try {
                setLoadingDevices(true);
                const res = await getDevices(token, { limit: 50 });
                setDeviceList(res.devices || []);
            } catch (err) {
                console.error('Load devices error:', err);
            } finally {
                setLoadingDevices(false);
            }
        };

        fetchDevices();
    }, []);

    // KHI CÓ DANH SÁCH XE -> AUTO CHỌN XE ĐẦU TIÊN
    useEffect(() => {
        if (deviceList.length > 0 && !selectedDevice) {
            handleSelectDevice(deviceList[0]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [deviceList]);

    // PREFILL history tab: luôn default hôm nay, KHÔNG đọc từ localStorage
    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!deviceList.length) return;

        // luôn chọn xe đầu tiên nếu chưa có
        if (!historyDeviceId && deviceList[0]) {
            setHistoryDeviceId(deviceList[0]._id);
        }

        // luôn set khoảng thời gian là hôm nay nếu chưa có
        if (!historyStart || !historyEnd) {
            const now = new Date();

            const start = new Date(now);
            start.setHours(0, 0, 0, 0);

            const end = new Date(now);
            end.setHours(23, 59, 0, 0);

            setHistoryStart(toLocalDateTimeInput(start));
            setHistoryEnd(toLocalDateTimeInput(end));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [deviceList]);

    // FETCH ĐỊA CHỈ GOONG
    const fetchAddressFromGoong = async (latVal, lonVal) => {
        if (latVal == null || lonVal == null) return;
        if (!GOONG_API_KEY) {
            console.warn('Missing NEXT_PUBLIC_GOONG_API_KEY for Goong');
            return;
        }

        try {
            setLoadingAddress(true);
            setAddressError(null);

            const res = await fetch(
                `https://rsapi.goong.io/Geocode?latlng=${latVal},${lonVal}&api_key=${GOONG_API_KEY}`,
            );
            if (!res.ok) {
                throw new Error('Goong API error');
            }
            const data = await res.json();
            const addr = data?.results?.[0]?.formatted_address || '';
            setAddress(addr);
        } catch (err) {
            console.error('Fetch address error:', err);
            setAddressError('Không lấy được địa chỉ.');
        } finally {
            setLoadingAddress(false);
        }
    };

    // FILTER DEVICE
    const filteredDevices = useMemo(() => {
        const keyword = searchText.trim().toLowerCase();

        return deviceList.filter((d) => {
            const plate = (d.license_plate || '').toLowerCase();
            const imei = (d.imei || '').toLowerCase();
            const phone = (d.phone_number || '').toLowerCase();

            const matchSearch =
                !keyword || plate.includes(keyword) || imei.includes(keyword) || phone.includes(keyword);

            const isOnline = d.status === 10;
            let matchStatus = true;
            if (statusFilter === 'online') matchStatus = isOnline;
            if (statusFilter === 'offline') matchStatus = !isOnline;

            return matchSearch && matchStatus;
        });
    }, [deviceList, searchText, statusFilter]);

    // CLICK 1 XE -> chọn device + gọi API pin + device info + last cruise
    const handleSelectDevice = async (device) => {
        setSelectedDevice(device);
        setShowPopup(true);
        setDetailTab('battery'); // nhảy thẳng sang tab pin

        const token = localStorage.getItem('accessToken');
        if (!token || !device?.imei) {
            setBatteryStatus(null);
            setDeviceInfo(null);
            setLastCruise(null);
            setCruiseError('Thiếu token hoặc IMEI để tải dữ liệu');
            return;
        }

        // reset state
        setBatteryStatus(null);
        setDeviceInfo(null);
        setLastCruise(null);
        setCruiseError(null);
        setAddress('');
        setAddressError(null);

        // LOAD PIN
        try {
            setLoadingBattery(true);
            const res = await getBatteryStatusByImei(token, device.imei);
            setBatteryStatus(res?.batteryStatus || null);
        } catch (err) {
            console.error('Load battery status error:', err);
            setBatteryStatus(null);
        } finally {
            setLoadingBattery(false);
        }

        // LOAD DEVICE INFO
        try {
            setLoadingDeviceInfo(true);
            const info = await getDeviceInfo(token, device._id);
            setDeviceInfo(info || null);
        } catch (err) {
            console.error('Load device info error:', err);
            setDeviceInfo(null);
        } finally {
            setLoadingDeviceInfo(false);
        }

        // LOAD LAST CRUISE
        try {
            setLoadingCruise(true);
            const cruise = await getLastCruise(token, device.imei);

            if (!cruise || cruise.error) {
                setLastCruise(null);
                setCruiseError('Không có dữ liệu hành trình');
            } else {
                setLastCruise(cruise);
                setCruiseError(null);

                // cập nhật map theo lat / lon
                if (mapRef.current && markerRef.current && cruise.lat && cruise.lon) {
                    const newLatLng = LMap.latLng(cruise.lat, cruise.lon);
                    markerRef.current.setLatLng(newLatLng);
                    mapRef.current.setView(newLatLng, 16);
                }

                // gọi Goong lấy địa chỉ
                if (cruise.lat != null && cruise.lon != null) {
                    fetchAddressFromGoong(cruise.lat, cruise.lon);
                }
            }
        } catch (err) {
            console.error('Load last cruise error:', err);
            setLastCruise(null);
            setCruiseError('Không thể tải dữ liệu hành trình');
        } finally {
            setLoadingCruise(false);
        }
    };

    // ===== LOCK / UNLOCK HANDLER =====
    const handleLockDevice = async () => {
        if (!selectedDevice) return;
        const token = localStorage.getItem('accessToken');
        if (!token) {
            setLockError('Không tìm thấy accessToken, vui lòng đăng nhập lại.');
            return;
        }

        try {
            setLockLoading(true);
            setLockError(null);

            const res = await lockDevice(token, selectedDevice._id);

            message.success('Khoá thiết bị thành công');

            const updated = res?.device || selectedDevice;

            // update state
            setSelectedDevice((prev) => ({ ...prev, ...updated }));
            setDeviceInfo((prev) => ({ ...(prev || {}), ...updated }));
            setDeviceList((prev) => prev.map((d) => (d._id === updated._id ? { ...d, ...updated } : d)));
        } catch (err) {
            console.error('Lock device error:', err);
            setLockError(err?.message || 'Khoá thiết bị thất bại.');
            message.error(err?.message || 'Khoá thiết bị thất bại.');
        } finally {
            setLockLoading(false);
        }
    };

    const handleUnlockDevice = async () => {
        if (!selectedDevice) return;
        const token = localStorage.getItem('accessToken');
        if (!token) {
            setLockError('Không tìm thấy accessToken, vui lòng đăng nhập lại.');
            return;
        }

        try {
            setLockLoading(true);
            setLockError(null);

            const res = await unlockDevice(token, selectedDevice._id);

            const msg = res?.message || 'Mở khoá thiết bị thành công.';
            message.success(msg);

            const updated = res?.device || selectedDevice;

            setSelectedDevice((prev) => ({ ...prev, ...updated }));
            setDeviceInfo((prev) => ({ ...(prev || {}), ...updated }));
            setDeviceList((prev) => prev.map((d) => (d._id === updated._id ? { ...d, ...updated } : d)));
        } catch (err) {
            console.error('Unlock device error:', err);
            setLockError(err?.message || 'Mở khoá thiết bị thất bại.');
            message.error(err?.message || 'Mở khoá thiết bị thất bại.');
        } finally {
            setLockLoading(false);
        }
    };

    // popup confirm khoá
    const handleConfirmLock = () => {
        if (!selectedDevice || selectedDevice.status === 5) return;
        const plate = selectedDevice.license_plate || selectedDevice.imei || 'thiết bị';

        confirm({
            title: 'Xác nhận khoá thiết bị',
            content: `Bạn có chắc chắn muốn khoá ${plate}?`,
            okText: 'Khoá',
            cancelText: 'Huỷ',
            onOk: () => handleLockDevice(),
        });
    };

    // popup confirm mở khoá
    const handleConfirmUnlock = () => {
        if (!selectedDevice || selectedDevice.status !== 5) return;
        const plate = selectedDevice.license_plate || selectedDevice.imei || 'thiết bị';

        confirm({
            title: 'Xác nhận mở khoá thiết bị',
            content: `Bạn có chắc chắn muốn mở khoá ${plate}?`,
            okText: 'Mở khoá',
            cancelText: 'Huỷ',
            onOk: () => handleUnlockDevice(),
        });
    };

    const isLocked = selectedDevice?.status === 5;

    // TÍNH MODE SẠC/XẢ DỰA VÀO current
    const getChargeModeFromCurrent = (currentRaw) => {
        if (currentRaw == null) return '--';
        const currentNumber =
            typeof currentRaw === 'number' ? currentRaw : Number(String(currentRaw).replace(',', '.'));

        if (Number.isNaN(currentNumber)) return '--';

        if (currentNumber > 0) return 'Đang sạc';
        if (currentNumber < 0) return 'Đang xả';
        return 'Đang chờ';
    };

    const renderBatteryInfo = () => {
        if (loadingBattery) return <div>Đang tải trạng thái pin...</div>;
        if (!batteryStatus) return <div>Không có dữ liệu pin cho thiết bị này.</div>;

        const bs = batteryStatus; // alias cho gọn
        const chargeMode = getChargeModeFromCurrent(bs.current);

        return (
            <>
                <div>IMEI: {bs.imei || selectedDevice?.imei}</div>
                <div>Điện áp: {bs.voltage ?? '--'} V</div>
                {/* Không hiển thị số A, chỉ hiển thị trạng thái sạc/xả/chờ */}
                <div>Dòng sạc/xả: {chargeMode}</div>
                <div>Trạng thái sạc (SOC): {bs.soc ?? '--'}%</div>
                <div>Dung lượng pin: {bs.capacityAh ?? '--'} Ah</div>
                <div>Sức khỏe pin (SOH): {bs.soh ?? '--'}%</div>
                <div>Nhiệt độ: {bs.temperature ?? '--'}°C</div>
                {/* Trạng thái cũng dựa trên current */}
                <div>Trạng thái: {chargeMode}</div>
                <div>Cập nhật lúc: {bs.updatedAt ? new Date(bs.updatedAt).toLocaleString() : '--'}</div>
            </>
        );
    };

    const renderStatusInfo = () => {
        if (!selectedDevice) return <div>Vui lòng chọn xe bên trái.</div>;

        if (loadingDeviceInfo || loadingCruise) {
            return <div>Đang tải dữ liệu trạng thái...</div>;
        }

        const info = deviceInfo || selectedDevice;

        const plate = info?.license_plate || '---';
        const vehicleType = info?.vehicle_category_id?.name || info?.vehicle_category_id?.model || '---';
        const manufacturer = info?.device_category_id?.name || info?.device_category_id?.code || '---';

        let timeStr = '--';
        if (lastCruise?.created) {
            timeStr = new Date(lastCruise.created).toLocaleString();
        } else if (lastCruise?.updated) {
            timeStr = new Date(lastCruise.updated).toLocaleString();
        }

        const latVal = lastCruise?.lat;
        const lonVal = lastCruise?.lon;

        let addressText = '--';
        if (loadingAddress) {
            addressText = 'Đang lấy địa chỉ...';
        } else if (address) {
            addressText = address;
        } else if (addressError) {
            addressText = addressError;
        }

        return (
            <>
                <div>Biển số xe: {plate}</div>
                <div>Loại xe: {vehicleType}</div>
                <div>Hãng sản xuất: {manufacturer}</div>
                <div>Tại thời điểm: {timeStr}</div>

                {lastCruise && (
                    <>
                        <div>Vị trí hiện tại: {latVal != null && lonVal != null ? `${latVal}, ${lonVal}` : '--'}</div>
                        <div>Tọa độ: {latVal != null && lonVal != null ? `${latVal}, ${lonVal}` : '--'}</div>
                    </>
                )}

                {/* Địa chỉ hiện tại lấy từ Goong */}
                <div>Địa chỉ hiện tại: {addressText}</div>

                {cruiseError && <div className="iky-monitor__error">{cruiseError}</div>}
            </>
        );
    };

    // Lưu filter lịch sử sang localStorage + validate
    const handleSaveHistoryFilter = () => {
        setHistoryMessage('');
        setHistoryMessageType('');

        if (!historyDeviceId || !historyStart || !historyEnd) {
            setHistoryMessage('Vui lòng chọn xe và nhập đầy đủ "Từ ngày" / "Đến ngày".');
            setHistoryMessageType('error');
            return;
        }

        const startDate = new Date(historyStart);
        const endDate = new Date(historyEnd);

        if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
            setHistoryMessage('Định dạng thời gian không hợp lệ. Vui lòng chọn lại.');
            setHistoryMessageType('error');
            return;
        }

        if (endDate < startDate) {
            setHistoryMessage('Thời gian "Đến ngày" không được nhỏ hơn "Từ ngày".');
            setHistoryMessageType('error');
            return;
        }

        const filter = {
            deviceId: historyDeviceId,
            imei: deviceList.find((d) => d._id === historyDeviceId)?.imei || '',
            start: historyStart,
            end: historyEnd,
        };
        try {
            localStorage.setItem('iky_cruise_filter', JSON.stringify(filter));
            router.push('/cruise');
            setHistoryMessage('Đã lưu bộ lọc lộ trình. Vào trang "Hành trình" để tải lộ trình.');
            setHistoryMessageType('success');
        } catch (e) {
            console.error('Save iky_cruise_filter error', e);
            setHistoryMessage('Không thể lưu bộ lọc. Vui lòng thử lại.');
            setHistoryMessageType('error');
        }
    };

    const STATUS_MAP = {
        5: { text: 'Đã khoá', class: 'iky-monitor__tag-red' },
        10: { text: 'Đang hoạt động', class: 'iky-monitor__tag-green' },
    };

    const curStatus = selectedDevice?.status;
    const deviceStatusText = STATUS_MAP[curStatus]?.text || 'Không rõ';
    const deviceStatusClass = STATUS_MAP[curStatus]?.class || 'iky-monitor__tag-gray';

    return (
        <div className="iky-monitor">
            {/* LEFT PANEL */}
            <aside className="iky-monitor__left">
                <div className="iky-monitor__left-card">
                    <div className="iky-monitor__left-tabs">
                        <button
                            className={
                                'iky-monitor__left-tab' +
                                (leftTab === 'monitor' ? ' iky-monitor__left-tab--active' : '')
                            }
                            onClick={() => setLeftTab('monitor')}
                        >
                            Giám sát xe
                        </button>
                        <button
                            className={
                                'iky-monitor__left-tab' +
                                (leftTab === 'history' ? ' iky-monitor__left-tab--active' : '')
                            }
                            onClick={() => setLeftTab('history')}
                        >
                            Xem lại lộ trình
                        </button>
                    </div>

                    {leftTab === 'monitor' && (
                        <div className="iky-monitor__left-body">
                            {/* SEARCH */}
                            <div className="iky-monitor__left-section">
                                <div className="iky-monitor__left-label">Nhập xe cần tìm</div>
                                <input
                                    className="iky-monitor__input"
                                    placeholder="Biển số / tên xe / IMEI..."
                                    value={searchText}
                                    onChange={(e) => setSearchText(e.target.value)}
                                />
                            </div>

                            {/* FILTER STATUS */}
                            <div className="iky-monitor__left-section">
                                <div className="iky-monitor__left-label">Trạng thái</div>
                                <select
                                    className="iky-monitor__select"
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                >
                                    <option value="all">-- Tất cả --</option>
                                    <option value="online">Online</option>
                                    <option value="offline">Offline</option>
                                </select>
                            </div>

                            {/* DANH SÁCH XE */}
                            <div className="iky-monitor__left-section">
                                <div className="iky-monitor__left-label">Danh sách xe</div>
                                <div className="iky-monitor__device-list">
                                    {loadingDevices && <div className="iky-loading">Đang tải...</div>}

                                    {!loadingDevices && filteredDevices.length === 0 && (
                                        <div className="iky-monitor__empty">Không có xe phù hợp</div>
                                    )}

                                    {!loadingDevices &&
                                        filteredDevices.map((d) => {
                                            const isOnline = d.status === 10;
                                            const isActive = selectedDevice?._id === d._id;
                                            return (
                                                <div
                                                    key={d._id}
                                                    className={
                                                        'iky-monitor__device-item' +
                                                        (isActive ? ' iky-monitor__device-item--active' : '')
                                                    }
                                                    onClick={() => handleSelectDevice(d)}
                                                >
                                                    <div className="plate">{d.license_plate || 'Không rõ biển số'}</div>
                                                    <div className="imei">IMEI: {d.imei}</div>
                                                    <div className="phone">SĐT: {d.phone_number}</div>
                                                    <div className="status">
                                                        Trạng thái:{' '}
                                                        <span className={isOnline ? 'online' : 'offline'}>
                                                            {isOnline ? 'Online' : 'Offline'}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                        </div>
                    )}

                    {leftTab === 'history' && (
                        <div className="iky-monitor__left-body">
                            {/* CHỌN XE TỪ getDevices */}
                            <div className="iky-monitor__left-section">
                                <div className="iky-monitor__left-label">Chọn xe</div>
                                <select
                                    className="iky-monitor__select"
                                    value={historyDeviceId}
                                    onChange={(e) => setHistoryDeviceId(e.target.value)}
                                >
                                    <option value="">-- Chọn xe --</option>
                                    {deviceList.map((d) => (
                                        <option key={d._id} value={d._id}>
                                            {(d.license_plate || d.imei || 'Không rõ').trim()}
                                            {d.phone_number ? ` - ${d.phone_number}` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="iky-monitor__left-section">
                                <div className="iky-monitor__left-label">Từ ngày</div>
                                <input
                                    type="datetime-local"
                                    className="iky-monitor__input"
                                    value={historyStart}
                                    onChange={(e) => setHistoryStart(e.target.value)}
                                />
                            </div>

                            <div className="iky-monitor__left-section">
                                <div className="iky-monitor__left-label">Đến ngày</div>
                                <input
                                    type="datetime-local"
                                    className="iky-monitor__input"
                                    value={historyEnd}
                                    onChange={(e) => setHistoryEnd(e.target.value)}
                                />
                            </div>

                            <button className="iky-monitor__primary-btn" onClick={handleSaveHistoryFilter}>
                                Lưu bộ lọc lộ trình
                            </button>

                            {historyMessage && (
                                <div
                                    className={
                                        'iky-monitor__alert ' +
                                        (historyMessageType === 'error'
                                            ? 'iky-monitor__alert--error'
                                            : 'iky-monitor__alert--success')
                                    }
                                >
                                    {historyMessage}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </aside>

            {/* MAP */}
            <section className="iky-monitor__center">
                <div className="iky-monitor__map">
                    <div id="iky-map" className="iky-monitor__map-inner" />

                    {/* POPUP */}
                    {markerScreenPos && showPopup && (
                        <div
                            className="iky-monitor__popup-wrapper"
                            style={{ left: markerScreenPos.x, top: markerScreenPos.y }}
                        >
                            <div className="iky-monitor__popup">
                                <div className="iky-monitor__popup-tabs">
                                    <button
                                        className={
                                            'iky-monitor__popup-tab' +
                                            (detailTab === 'status' ? ' iky-monitor__popup-tab--active' : '')
                                        }
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setDetailTab('status');
                                        }}
                                    >
                                        Trạng thái
                                    </button>
                                    <button
                                        className={
                                            'iky-monitor__popup-tab' +
                                            (detailTab === 'control' ? ' iky-monitor__popup-tab--active' : '')
                                        }
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setDetailTab('control');
                                        }}
                                    >
                                        Điều khiển
                                    </button>
                                    <button
                                        className={
                                            'iky-monitor__popup-tab' +
                                            (detailTab === 'battery' ? ' iky-monitor__popup-tab--active' : '')
                                        }
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setDetailTab('battery');
                                        }}
                                    >
                                        Trạng thái Pin
                                    </button>
                                </div>

                                <div className="iky-monitor__popup-body">
                                    {detailTab === 'status' && (
                                        <div className="iky-monitor__popup-col">{renderStatusInfo()}</div>
                                    )}

                                    {detailTab === 'control' && (
                                        <div className="iky-monitor__popup-col">
                                            <div className="iky-monitor__control-row">
                                                <span>Trạng thái thiết bị</span>
                                                <span className={deviceStatusClass}>{deviceStatusText}</span>
                                            </div>

                                            <div className="iky-monitor__control-row">
                                                <span>Khoá thiết bị</span>
                                                <button
                                                    className="iky-monitor__secondary-btn"
                                                    onClick={handleConfirmLock}
                                                    disabled={selectedDevice?.status === 5}
                                                >
                                                    {lockLoading ? 'Đang xử lý...' : 'Khoá'}
                                                </button>
                                            </div>

                                            <div className="iky-monitor__control-row">
                                                <span>Mở khoá thiết bị</span>
                                                <button
                                                    className="iky-monitor__secondary-btn"
                                                    onClick={handleConfirmUnlock}
                                                    disabled={selectedDevice?.status !== 5}
                                                >
                                                    {lockLoading ? 'Đang xử lý...' : 'Mở khoá'}
                                                </button>
                                            </div>

                                            <div className="iky-monitor__control-row">
                                                <span>Bảo vệ</span>
                                                <button className="iky-monitor__toggle-btn iky-monitor__toggle-btn--off">
                                                    Tắt
                                                </button>
                                            </div>
                                            <div className="iky-monitor__control-row">
                                                <span>Tắt xe khẩn cấp</span>
                                                <button className="iky-monitor__toggle-btn iky-monitor__toggle-btn--off">
                                                    Tắt
                                                </button>
                                            </div>
                                            <div className="iky-monitor__control-row">
                                                <span>Kết nối</span>
                                                <span className="iky-monitor__dot" />
                                            </div>
                                            <div className="iky-monitor__control-row">
                                                <span>Số dư tài khoản</span>
                                                <button className="iky-monitor__secondary-btn">Kiểm tra</button>
                                            </div>

                                            {lockError && (
                                                <div className="iky-monitor__error" style={{ marginTop: 8 }}>
                                                    {lockError}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {detailTab === 'battery' && (
                                        <div className="iky-monitor__popup-col">{renderBatteryInfo()}</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {/* BOX BÊN PHẢI – TRẠNG THÁI PIN */}
            {showPopup && detailTab === 'battery' && (
                <aside className="iky-monitor__right">
                    <h4 className="iky-monitor__right-title">Thông tin hiển thị</h4>
                    <div className="iky-monitor__battery-box">{renderBatteryInfo()}</div>
                </aside>
            )}
        </div>
    );
};

export default MonitorPage;
