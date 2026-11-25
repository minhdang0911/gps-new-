/**
 * @file useLeafletOverviewMap.js
 * @description Hook khởi tạo và quản lý vòng đời bản đồ Leaflet cho trang Overview.
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import * as turf from '@turf/turf';

const VIETNAM_BOUNDS = [[8.18, 102.14], [23.39, 109.46]];
let _cachedVnGeo = null;

export function useLeafletOverviewMap(mapContainerRef) {
    const [L, setL] = useState(null);
    const leafletLibRef = useRef(null);
    const leafletMapRef = useRef(null);
    const markersLayerRef = useRef(null);
    const labelsLayerRef = useRef(null);
    const geoLayerRef = useRef(null);
    const maskLayerRef = useRef(null);
    const tileLayerRef = useRef(null);
    const [containerWidth, setContainerWidth] = useState(800);

    useEffect(() => {
        const container = mapContainerRef.current?.parentElement;
        if (!container) return;
        const ro = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setContainerWidth(entry.contentRect.width);
            }
        });
        ro.observe(container);
        setContainerWidth(container.offsetWidth);
        return () => ro.disconnect();
    }, [mapContainerRef]);

    useEffect(() => {
        let isCancelled = false;

        const initMap = async () => {
            if (leafletMapRef.current || !mapContainerRef.current) return;
            const Lf = (await import('leaflet')).default;
            await import('leaflet/dist/leaflet.css');
            if (isCancelled || !mapContainerRef.current) return;

            if (mapContainerRef.current._leaflet_id) {
                mapContainerRef.current._leaflet_id = null;
            }

            const map = Lf.map(mapContainerRef.current, {
                center: [16.5, 107.5],
                zoom: 6,
                minZoom: 4,
                maxZoom: 19,
                zoomControl: false,
                attributionControl: false,
                boxZoom: false,
                wheelPxPerZoomLevel: 80,
                zoomSnap: 0.5,
            });

            let isRecentering = false;
            map.on('moveend zoomend', () => {
                if (isRecentering) return;
                const [[s, w], [n, e]] = VIETNAM_BOUNDS;
                const vp = map.getBounds();
                const outOfView =
                    vp.getSouth() > n ||
                    vp.getNorth() < s ||
                    vp.getWest() > e ||
                    vp.getEast() < w;

                if (outOfView) {
                    isRecentering = true;
                    map.fitBounds(VIETNAM_BOUNDS, { padding: [10, 10], animate: true });
                    setTimeout(() => { isRecentering = false; }, 600);
                }
            });

            leafletMapRef.current = map;
            maskLayerRef.current = Lf.layerGroup().addTo(map);
            markersLayerRef.current = Lf.layerGroup().addTo(map);
            labelsLayerRef.current = Lf.layerGroup().addTo(map);

            setTimeout(() => {
                if (!isCancelled && map && !map._removed) {
                    map.invalidateSize({ animate: false });
                    map.dragging.enable();
                    map.scrollWheelZoom.enable();
                }
            }, 50);

            // Google Maps Tile layer (ẩn ở level toàn quốc, hiện ở level quận/thiết bị)
            const tile = Lf.tileLayer(
                'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
                {
                    maxZoom: 20,
                    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
                    opacity: 0,
                    zIndex: 1,
                }
            ).addTo(map);
            tileLayerRef.current = tile;

            // Nạp hình thể Việt Nam (vn_geo.json: 63 tỉnh thành)
            try {
                let vnGeoData = _cachedVnGeo;
                if (!vnGeoData) {
                    const res = await fetch('/vn_geo.json');
                    vnGeoData = await res.json();
                    _cachedVnGeo = vnGeoData;
                }

                if (!isCancelled && map && !map._removed) {
                    if (labelsLayerRef.current) labelsLayerRef.current.clearLayers();

                    geoLayerRef.current = Lf.geoJSON(vnGeoData, {
                        style: { color: '#60a5fa', weight: 1, fillColor: '#dbeafe', fillOpacity: 0.5 },
                        interactive: false,
                        onEachFeature: (feature, layer) => {
                            const name = feature.properties?.oldName || feature.properties?.name || '';
                            let labelLat, labelLng;
                            try {
                                const pt = turf.pointOnFeature(feature);
                                [labelLng, labelLat] = pt.geometry.coordinates;
                            } catch (_) {
                                const center = layer.getBounds().getCenter();
                                labelLat = center.lat;
                                labelLng = center.lng;
                            }

                            const labelMarker = Lf.marker([labelLat, labelLng], {
                                icon: Lf.divIcon({
                                    className: 'vn-prov-label',
                                    html: name,
                                    iconSize: [130, 16],
                                    iconAnchor: [65, 8],
                                }),
                                interactive: false,
                                keyboard: false,
                                zIndexOffset: -1000,
                            });
                            labelsLayerRef.current.addLayer(labelMarker);
                        },
                    }).addTo(map);

                    map.fitBounds(geoLayerRef.current.getBounds(), { padding: [8, 8], animate: false });

                    const toggleLabels = () => {
                        const z = map?.getZoom() ?? 5.5;
                        if (labelsLayerRef.current) {
                            labelsLayerRef.current.eachLayer((l) => {
                                if (l._icon) l._icon.style.display = z >= 4 ? '' : 'none';
                            });
                        }
                    };
                    map.on('zoomend', toggleLabels);
                    toggleLabels();
                }
            } catch (err) {
                console.warn('[useLeafletOverviewMap] Failed to load vn_geo.json:', err);
            }

            leafletLibRef.current = Lf;
            setL(Lf);
        };

        initMap();

        return () => {
            isCancelled = true;
            if (leafletMapRef.current) {
                leafletMapRef.current.remove();
                leafletMapRef.current = null;
            }
        };
    }, [mapContainerRef]);

    const showTileLayer = useCallback(() => {
        if (tileLayerRef.current) tileLayerRef.current.setOpacity(1);
        if (leafletMapRef.current && geoLayerRef.current && leafletMapRef.current.hasLayer(geoLayerRef.current)) {
            leafletMapRef.current.removeLayer(geoLayerRef.current);
        }
        if (labelsLayerRef.current) {
            labelsLayerRef.current.eachLayer((l) => { if (l._icon) l._icon.style.display = 'none'; });
        }
    }, []);

    const focusProvince = useCallback((province) => {
        if (tileLayerRef.current) tileLayerRef.current.setOpacity(1);
        if (leafletMapRef.current && geoLayerRef.current && leafletMapRef.current.hasLayer(geoLayerRef.current)) {
            leafletMapRef.current.removeLayer(geoLayerRef.current);
        }
        if (labelsLayerRef.current) {
            labelsLayerRef.current.eachLayer((l) => { if (l._icon) l._icon.style.display = 'none'; });
        }
        if (!province) return null;
        if (maskLayerRef.current) maskLayerRef.current.clearLayers();

        const clean = (s) => (s || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[đĐ]/g, 'd')
            .replace(/^(tinh|thanh pho|tp\.?)\s+/g, '')
            .replace(/\s+/g, '');

        const target1 = clean(province.name);
        const target2 = clean(province.full_name);

        let matchedFeature = null;
        let matchedBounds = null;

        if (geoLayerRef.current) {
            geoLayerRef.current.eachLayer((layer) => {
                const props = layer.feature?.properties;
                const n1 = clean(props?.name);
                const n2 = clean(props?.oldName);
                const isMatch = (target1 && (n1 === target1 || n2 === target1)) ||
                                (target2 && (n1 === target2 || n2 === target2));

                if (isMatch && !matchedFeature) {
                    matchedFeature = layer.feature;
                    matchedBounds = layer.getBounds();
                }
            });
        }

        const Lf = leafletLibRef.current;
        if (matchedFeature && Lf && maskLayerRef.current) {
            const borderLayer = Lf.geoJSON(matchedFeature, {
                style: { color: '#2563eb', weight: 2, opacity: 0.85, fill: false },
                interactive: false,
            });
            maskLayerRef.current.addLayer(borderLayer);
        }

        return matchedBounds;
    }, []);

    const hideTileLayer = useCallback(() => {
        if (tileLayerRef.current) tileLayerRef.current.setOpacity(0);
        if (maskLayerRef.current) maskLayerRef.current.clearLayers();
        if (leafletMapRef.current && geoLayerRef.current && !leafletMapRef.current.hasLayer(geoLayerRef.current)) {
            leafletMapRef.current.addLayer(geoLayerRef.current);
        }
        if (labelsLayerRef.current) {
            labelsLayerRef.current.eachLayer((l) => { if (l._icon) l._icon.style.display = ''; });
        }
    }, []);

    const fitToVietnam = useCallback(() => {
        if (leafletMapRef.current) {
            const bounds = geoLayerRef.current ? geoLayerRef.current.getBounds() : VIETNAM_BOUNDS;
            try {
                leafletMapRef.current.fitBounds(bounds, { padding: [10, 10], animate: true });
            } catch (_) {}
        }
    }, []);

    return {
        L,
        leafletMap: leafletMapRef.current,
        markersLayer: markersLayerRef.current,
        labelsLayer: labelsLayerRef.current,
        geoLayerRef,
        containerWidth,
        isMobile: containerWidth < 480,
        showTileLayer,
        hideTileLayer,
        fitToVietnam,
        focusProvince,
    };
}
