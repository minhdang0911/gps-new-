'use client';

import React, { useState, useEffect, useRef } from 'react';
import './MonitorPage.css';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// đổi path icon cho đúng project
import markerIcon from './assets/marker-red.png';

const MonitorPage = () => {
    const [leftTab, setLeftTab] = useState('monitor');
    const [showPopup, setShowPopup] = useState(false);
    const [detailTab, setDetailTab] = useState('status');

    // tọa độ công ty iKY
    const [lat] = useState(10.7542506);
    const [lng] = useState(106.6170202);

    const mapRef = useRef(null);
    const [markerScreenPos, setMarkerScreenPos] = useState(null);

    useEffect(() => {
        const map = L.map('iky-map', {
            center: [lat, lng],
            zoom: 16,
            zoomControl: false,
            attributionControl: false,
            dragging: true,
            scrollWheelZoom: true,
        });

        mapRef.current = map;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
        }).addTo(map);

        // icon custom
        const customIcon = L.icon({
            iconUrl: markerIcon.src,
            iconSize: [36, 36],
            iconAnchor: [18, 36],
        });

        const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);

        const updatePopupPosition = () => {
            const point = map.latLngToContainerPoint(marker.getLatLng());
            setMarkerScreenPos(point);
        };

        updatePopupPosition();

        marker.on('click', () => {
            setShowPopup(true);
        });

        // click chỗ khác trên map thì đóng popup
        map.on('click', () => {
            setShowPopup(false);
        });

        // khi pan / zoom thì cập nhật lại vị trí popup
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
    }, [lat, lng]);

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
                            <div className="iky-monitor__left-section">
                                <div className="iky-monitor__left-label">Nhập xe cần tìm</div>
                                <input
                                    className="iky-monitor__input"
                                    placeholder="Biển số / tên xe..."
                                />
                            </div>

                            <div className="iky-monitor__left-section">
                                <div className="iky-monitor__left-label">Trạng thái</div>
                                <select className="iky-monitor__select">
                                    <option>-- Chọn --</option>
                                    <option>Chạy xe</option>
                                    <option>Dừng xe</option>
                                    <option>Đỗ xe</option>
                                </select>
                            </div>

                            <div className="iky-monitor__left-section">
                                <div className="iky-monitor__left-label">Nhóm</div>
                                <select className="iky-monitor__select">
                                    <option>-- Chọn --</option>
                                    <option>Nhóm 1</option>
                                    <option>Nhóm 2</option>
                                </select>
                            </div>

                            <div className="iky-monitor__left-section">
                                <div className="iky-monitor__left-label">Danh sách xe</div>
                                <div className="iky-monitor__table-placeholder">
                                    Tạm thời mock list xe ở đây
                                </div>
                            </div>
                        </div>
                    )}

                    {leftTab === 'history' && (
                        <div className="iky-monitor__left-body">
                            <div className="iky-monitor__left-section">
                                <div className="iky-monitor__left-label">Từ ngày</div>
                                <input type="datetime-local" className="iky-monitor__input" />
                            </div>
                            <div className="iky-monitor__left-section">
                                <div className="iky-monitor__left-label">Đến ngày</div>
                                <input type="datetime-local" className="iky-monitor__input" />
                            </div>
                            <button className="iky-monitor__primary-btn">Xem lại lộ trình</button>
                        </div>
                    )}
                </div>
            </aside>

            {/* MAP AREA */}
            <section className="iky-monitor__center">
                <div className="iky-monitor__map">
                    <div id="iky-map" className="iky-monitor__map-inner" />

                    {/* Popup gắn đúng tọa độ marker */}
                    {markerScreenPos && showPopup && (
                        <div
                            className="iky-monitor__popup-wrapper"
                            style={{
                                left: markerScreenPos.x,
                                top: markerScreenPos.y,
                            }}
                        >
                            <div className="iky-monitor__popup">
                                <div className="iky-monitor__popup-tabs">
                                    <button
                                        className={
                                            'iky-monitor__popup-tab' +
                                            (detailTab === 'status'
                                                ? ' iky-monitor__popup-tab--active'
                                                : '')
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
                                            (detailTab === 'control'
                                                ? ' iky-monitor__popup-tab--active'
                                                : '')
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
                                            (detailTab === 'battery'
                                                ? ' iky-monitor__popup-tab--active'
                                                : '')
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
                                        <div className="iky-monitor__popup-col">
                                            <div>Biển số xe: test1111</div>
                                            <div>Loại xe: VinFast Feliz Neo</div>
                                            <div>Hãng sản xuất: SGC</div>
                                            <div>Tại thời điểm: 2025-10-21 11:25:04</div>
                                            <div>
                                                Vị trí hiện tại: {lat}, {lng}
                                            </div>
                                            <div>Trạng thái máy: Tắt máy</div>
                                            <div>Trạng thái xe: Đỗ xe</div>
                                            <div>Vận tốc: 0 km/h</div>
                                        </div>
                                    )}

                                    {detailTab === 'control' && (
                                        <div className="iky-monitor__popup-col">
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
                                                <button className="iky-monitor__secondary-btn">
                                                    Kiểm tra
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {detailTab === 'battery' && (
                                        <div className="iky-monitor__popup-col">
                                            <div>Điện áp: 72.00V</div>
                                            <div>Dòng sạc/xả: 0.02A</div>
                                            <div>Trạng thái sạc: 49%</div>
                                            <div>Dung lượng pin: 40Ah</div>
                                            <div>Sức khỏe pin: 100%</div>
                                            <div>Nhiệt độ: 30°C</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {showPopup && detailTab === 'battery' && (
                <aside className="iky-monitor__right">
                    <h4 className="iky-monitor__right-title">Thông tin hiển thị</h4>
                    <div className="iky-monitor__battery-box">
                        <div>Điện áp: 72.00V</div>
                        <div>Dòng sạc/xả: 0.02A</div>
                        <div>Trạng thái sạc: 49%</div>
                        <div>Dung lượng pin: 40Ah</div>
                        <div>Sức khỏe pin: 100%</div>
                        <div>Nhiệt độ: 30°C</div>
                    </div>
                </aside>
            )}
        </div>
    );
};

export default MonitorPage;
