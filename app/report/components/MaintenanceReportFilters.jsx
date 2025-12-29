'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button, Col, Input, Row, Select, Space, Typography } from 'antd';
import { useMaintenanceDeviceMap } from '../../hooks/useMaintenanceDeviceMap';

const { Text } = Typography;

const LS_KEY = 'maintenance_report_filter:v2';

function safeReadLS() {
    if (typeof window === 'undefined') return { imei: '', plate: '' };
    try {
        const raw = localStorage.getItem(LS_KEY);
        const obj = raw ? JSON.parse(raw) : null;
        return {
            imei: String(obj?.imei || '').trim(),
            plate: String(obj?.plate || '').trim(),
        };
    } catch {
        return { imei: '', plate: '' };
    }
}

function safeWriteLS({ imei, plate }) {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(LS_KEY, JSON.stringify({ imei: (imei || '').trim(), plate: (plate || '').trim() }));
    } catch {}
}

export default function MaintenanceReportFilters({ onSearch, onClear, onReload }) {
    const { plateToImeis, loadingDeviceMap } = useMaintenanceDeviceMap();

    // ✅ init từ localStorage cho “nhớ filter”
    const init = useMemo(() => safeReadLS(), []);
    const [imeiInput, setImeiInput] = useState(init.imei);
    const [plateSelected, setPlateSelected] = useState(init.plate);

    // persist
    useEffect(() => {
        safeWriteLS({ imei: imeiInput, plate: plateSelected });
    }, [imeiInput, plateSelected]);

    const plateOptions = useMemo(() => {
        const plates = Array.from(plateToImeis.keys()).filter(Boolean);
        plates.sort((a, b) => a.localeCompare(b));
        return plates.map((p) => ({ value: p, label: p }));
    }, [plateToImeis]);

    const resolveImeiFromCurrentFilter = () => {
        const imei = (imeiInput || '').trim();
        if (imei) return imei;

        const plate = (plateSelected || '').trim();
        if (!plate) return '';

        const imeis = plateToImeis.get(plate) || [];
        return imeis[0] || '';
    };

    const handleSearch = () => {
        const imeiToSearch = resolveImeiFromCurrentFilter();
        if (typeof onSearch === 'function') onSearch(imeiToSearch);
    };

    const handleClear = () => {
        setImeiInput('');
        setPlateSelected('');
        if (typeof onClear === 'function') onClear();
    };

    const handleReload = () => {
        if (typeof onReload === 'function') onReload(resolveImeiFromCurrentFilter());
    };

    return (
        <div style={{ marginBottom: 12 }}>
            <Row gutter={[10, 10]} align="middle" wrap>
                <Col flex="none">
                    <Text strong>Tìm kiếm:</Text>
                </Col>

                {/* IMEI input: KHÔNG auto fill từ biển số */}
                <Col flex="300px">
                    <Input
                        value={imeiInput}
                        onChange={(e) => setImeiInput(e.target.value)}
                        placeholder="IMEI..."
                        allowClear
                        onPressEnter={handleSearch}
                    />
                </Col>

                {/* Plate select: KHÔNG auto fill từ IMEI */}
                <Col flex="240px">
                    <Select
                        style={{ width: '100%' }}
                        showSearch
                        allowClear
                        loading={loadingDeviceMap}
                        placeholder="Biển số..."
                        value={plateSelected || undefined}
                        options={plateOptions}
                        optionFilterProp="label"
                        dropdownMatchSelectWidth
                        onChange={(plate) => {
                            setPlateSelected(plate || '');
                        }}
                    />
                </Col>

                <Col flex="none">
                    <Space>
                        <Button type="primary" onClick={handleSearch}>
                            Tìm
                        </Button>
                        <Button onClick={handleClear}>Xóa lọc</Button>
                        <Button onClick={handleReload}>Tải lại</Button>
                    </Space>
                </Col>
            </Row>
        </div>
    );
}
