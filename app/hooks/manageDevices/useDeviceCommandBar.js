'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getDevices } from '../../lib/api/devices';

export function useDeviceCommandBar({
    isEn,
    canAddDevice,
    viewMode,
    selectedDevice,
    onExportExcel,
    onOpenAdd,
    onGoBack,
}) {
    const [cmdOpen, setCmdOpen] = useState(false);
    const [cmdQuery, setCmdQuery] = useState('');
    const [cmdLoading, setCmdLoading] = useState(false);
    const [deviceHits, setDeviceHits] = useState([]);

    const debounceRef = useRef(null);

    /* ===============================
       Global Ctrl + K
    =============================== */
    useEffect(() => {
        const onKeyDown = (e) => {
            const isK = e.key.toLowerCase() === 'k';
            const isCmdK = (e.ctrlKey || e.metaKey) && isK;

            if (isCmdK) {
                e.preventDefault();
                setCmdOpen(true);
                setCmdQuery('');
            }

            if (e.key === 'Escape') {
                setCmdOpen(false);
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    /* ===============================
       Smart Query Parser
    =============================== */
    const parseQuery = (q) => {
        const text = (q || '').trim();
        const lower = text.toLowerCase();

        const mImei = lower.match(/^imei:(.*)$/);
        const mPlate = lower.match(/^plate:(.*)$/);

        if (mImei) return { imei: mImei[1].trim() };
        if (mPlate) return { license_plate: mPlate[1].trim() };

        // 🔥 Auto detect IMEI (toàn số ≥ 6 ký tự)
        if (/^\d{6,}$/.test(text)) {
            return { imei: text };
        }

        return {
            phone_number: text,
            license_plate: text,
            driver: text,
            imei: text,
        };
    };

    /* ===============================
       Debounced API Search
    =============================== */
    useEffect(() => {
        if (!cmdOpen) return;

        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        debounceRef.current = setTimeout(async () => {
            try {
                setCmdLoading(true);

                const params = parseQuery(cmdQuery);

                const res = await getDevices({
                    ...params,
                    page: 1,
                    limit: 20, // 🔥 chỉ lấy 20 kết quả
                });

                setDeviceHits(res?.devices || []);
            } catch (err) {
                console.error('Command search error:', err);
                setDeviceHits([]);
            } finally {
                setCmdLoading(false);
            }
        }, 300); // debounce 300ms

        return () => clearTimeout(debounceRef.current);
    }, [cmdQuery, cmdOpen]);

    /* ===============================
       Command Actions
    =============================== */
    const cmdActions = useMemo(() => {
        const acts = [];

        acts.push({
            type: 'action',
            key: 'export',
            title: isEn ? 'Export Excel' : 'Xuất Excel',
            hint: 'export',
            run: () => onExportExcel?.(),
        });

        if (canAddDevice) {
            acts.push({
                type: 'action',
                key: 'add',
                title: isEn ? 'Add device' : 'Thêm thiết bị',
                hint: 'add',
                run: () => onOpenAdd?.(),
            });
        }

        if (viewMode === 'detail' && selectedDevice) {
            acts.push({
                type: 'action',
                key: 'back',
                title: isEn ? 'Back to list' : 'Quay lại danh sách',
                hint: 'back',
                run: () => onGoBack?.(),
            });
        }

        return acts;
    }, [isEn, canAddDevice, viewMode, selectedDevice, onExportExcel, onOpenAdd, onGoBack]);

    const open = () => {
        setCmdOpen(true);
        setCmdQuery('');
        setDeviceHits([]);
    };

    const close = () => setCmdOpen(false);

    return {
        cmdOpen,
        cmdQuery,
        cmdLoading,
        cmdResults: {
            actions: cmdActions,
            deviceHits,
        },
        setCmdQuery,
        open,
        close,
        setCmdOpen,
    };
}
