'use client';

import { useEffect, useMemo, useState } from 'react';

export function useDeviceCommandBar({
    devices,
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
    const [fuse, setFuse] = useState(null);

    useEffect(() => {
        const onKeyDown = (e) => {
            const isK = e.key.toLowerCase() === 'k';
            const isCmdK = (e.ctrlKey || e.metaKey) && isK;
            if (isCmdK) {
                e.preventDefault();
                setCmdOpen(true);
                setCmdQuery('');
            }
            if (e.key === 'Escape') setCmdOpen(false);
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    useEffect(() => {
        const build = async () => {
            try {
                setCmdLoading(true);
                const mod = await import('fuse.js');
                const Fuse = mod.default || mod;
                const f = new Fuse(devices, {
                    keys: [
                        'imei',
                        'license_plate',
                        'phone_number',
                        'driver',
                        'device_category_id.name',
                        'user_id.email',
                    ],
                    threshold: 0.35,
                    ignoreLocation: true,
                });
                setFuse(f);
            } catch {
                setFuse(null);
            } finally {
                setCmdLoading(false);
            }
        };

        if (cmdOpen && devices?.length) build();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cmdOpen, devices]);

    const cmdActions = useMemo(() => {
        const acts = [];

        acts.push({
            type: 'action',
            key: 'export',
            title: isEn ? 'Export Excel' : 'Xuất Excel',
            hint: 'export',
            run: () => onExportExcel(),
        });

        if (canAddDevice) {
            acts.push({
                type: 'action',
                key: 'add',
                title: isEn ? 'Add device' : 'Thêm thiết bị',
                hint: 'add',
                run: () => onOpenAdd(),
            });
        }

        if (viewMode === 'detail' && selectedDevice) {
            acts.push({
                type: 'action',
                key: 'back',
                title: isEn ? 'Back to list' : 'Quay lại danh sách',
                hint: 'back',
                run: () => onGoBack(),
            });
        }

        return acts;
    }, [isEn, canAddDevice, viewMode, selectedDevice, onExportExcel, onOpenAdd, onGoBack]);

    const parsePrefixedQuery = (q) => {
        const text = (q || '').trim();
        const lower = text.toLowerCase();

        const mImei = lower.match(/^imei:(.*)$/);
        const mPlate = lower.match(/^plate:(.*)$/);

        if (mImei) return { mode: 'imei', term: (mImei[1] || '').trim() };
        if (mPlate) return { mode: 'plate', term: (mPlate[1] || '').trim() };

        return { mode: 'any', term: text };
    };

    const cmdResults = useMemo(() => {
        const { mode, term } = parsePrefixedQuery(cmdQuery);

        const actions = cmdActions.filter((a) => {
            if (!term) return true;
            const t0 = (a.title || '').toLowerCase();
            const h0 = (a.hint || '').toLowerCase();
            return t0.includes(term.toLowerCase()) || h0.includes(term.toLowerCase());
        });

        let deviceHits = [];

        if (!term) {
            deviceHits = devices.slice(0, 8);
        } else if (mode === 'imei') {
            deviceHits = devices.filter((d) => (d.imei || '').toLowerCase().includes(term.toLowerCase())).slice(0, 10);
        } else if (mode === 'plate') {
            deviceHits = devices
                .filter((d) => (d.license_plate || '').toLowerCase().includes(term.toLowerCase()))
                .slice(0, 10);
        } else {
            if (fuse) {
                deviceHits = fuse
                    .search(term)
                    .map((r) => r.item)
                    .slice(0, 10);
            } else {
                const t1 = term.toLowerCase();
                deviceHits = devices
                    .filter((d) => {
                        return (
                            (d.imei || '').toLowerCase().includes(t1) ||
                            (d.license_plate || '').toLowerCase().includes(t1) ||
                            (d.phone_number || '').toLowerCase().includes(t1) ||
                            (d.driver || '').toLowerCase().includes(t1) ||
                            (d.user_id?.email || '').toLowerCase().includes(t1)
                        );
                    })
                    .slice(0, 10);
            }
        }

        return { actions, deviceHits };
    }, [cmdQuery, cmdActions, devices, fuse]);

    const open = () => {
        setCmdOpen(true);
        setCmdQuery('');
    };

    const close = () => setCmdOpen(false);

    return {
        cmdOpen,
        cmdQuery,
        cmdLoading,
        cmdResults,
        setCmdQuery,
        open,
        close,
        setCmdOpen,
    };
}
