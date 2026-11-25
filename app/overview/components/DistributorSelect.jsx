/**
 * @file DistributorSelect.jsx
 * @description Dropdown chọn và tìm kiếm đại lý phân phối dành cho quyền Quản trị viên (Admin).
 */

'use client';

import React, { useState, useRef, useMemo, useCallback } from 'react';
import { useClickOutside } from '../../hooks/useClickOutside';
import {
    FleetDistributorIcon,
    IconSearchOptic,
    IconCloseMini,
    IconChevronDownCustom,
} from '../OverviewIcons';

export default function DistributorSelect({ value, onChange, options = [], isEn }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const ref = useRef(null);

    useClickOutside(ref, useCallback(() => setOpen(false), []), open);

    const selectedOption = useMemo(() => options.find((o) => o.value === value), [options, value]);
    const filteredOptions = useMemo(() => {
        if (!search.trim()) return options;
        const q = search.toLowerCase();
        return options.filter((o) => o.label?.toLowerCase().includes(q));
    }, [options, search]);

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                className="ov-refresh-btn"
                style={{
                    height: 34,
                    padding: '0 12px',
                    borderColor: value ? '#7dd3fc' : '#cbd5e1',
                    background: value ? '#f0f9ff' : '#ffffff',
                    color: value ? '#0369a1' : '#334155',
                    fontWeight: value ? 600 : 500,
                    gap: 8,
                }}
            >
                <FleetDistributorIcon size={16} color={value ? '#0284c7' : '#64748b'} />
                <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>
                    {selectedOption ? selectedOption.label : (isEn ? 'All Distributors' : 'Tất cả đại lý')}
                </span>
                {value ? (
                    <span
                        onClick={(e) => {
                            e.stopPropagation();
                            onChange(null);
                        }}
                        title={isEn ? 'Clear' : 'Bỏ chọn'}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 16,
                            height: 16,
                            borderRadius: 3,
                            background: '#e0f2fe',
                            color: '#0369a1',
                            cursor: 'pointer',
                        }}
                    >
                        <IconCloseMini size={10} color="#0369a1" />
                    </span>
                ) : (
                    <IconChevronDownCustom size={11} color="#94a3b8" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                )}
            </button>

            {open && (
                <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    right: 0,
                    width: 280,
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.06)',
                    zIndex: 9999,
                    overflow: 'hidden',
                }}>
                    <div style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc' }}>
                        <IconSearchOptic size={13} color="#94a3b8" />
                        <input
                            autoFocus
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={isEn ? 'Filter distributors...' : 'Tìm đại lý...'}
                            style={{
                                width: '100%',
                                border: 'none',
                                outline: 'none',
                                background: 'transparent',
                                fontSize: 12,
                                color: '#0f172a',
                            }}
                        />
                        {search ? (
                            <button onClick={() => setSearch('')} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}>
                                <IconCloseMini size={11} color="#94a3b8" />
                            </button>
                        ) : (
                            <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, padding: '1px 5px', background: '#e2e8f0', borderRadius: 4 }}>
                                {options.length}
                            </span>
                        )}
                    </div>

                    <div style={{ maxHeight: 240, overflowY: 'auto', padding: '4px' }}>
                        <div
                            onClick={() => { onChange(null); setOpen(false); }}
                            style={{
                                padding: '7px 10px',
                                margin: '1px 0',
                                borderRadius: 4,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                fontSize: 12,
                                cursor: 'pointer',
                                background: !value ? '#f0f9ff' : 'transparent',
                                color: !value ? '#0369a1' : '#334155',
                                fontWeight: !value ? 600 : 500,
                            }}
                            onMouseEnter={(e) => { if (value) e.currentTarget.style.background = '#f8fafc'; }}
                            onMouseLeave={(e) => { if (value) e.currentTarget.style.background = 'transparent'; }}
                        >
                            <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                <FleetDistributorIcon size={14} color={!value ? '#0284c7' : '#94a3b8'} />
                                <span>{isEn ? 'All Distributors' : 'Tất cả đại lý'}</span>
                            </span>
                            {!value && <span style={{ color: '#0284c7', fontWeight: 700, fontSize: 12 }}>✓</span>}
                        </div>

                        {filteredOptions.map((opt) => {
                            const isSelected = value === opt.value;
                            return (
                                <div
                                    key={opt.value}
                                    onClick={() => { onChange(opt.value); setOpen(false); }}
                                    style={{
                                        padding: '7px 10px',
                                        margin: '1px 0',
                                        borderRadius: 4,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        fontSize: 12,
                                        cursor: 'pointer',
                                        background: isSelected ? '#f0f9ff' : 'transparent',
                                        color: isSelected ? '#0369a1' : '#334155',
                                        fontWeight: isSelected ? 600 : 500,
                                    }}
                                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = '#f8fafc'; }}
                                    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                                >
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 7, overflow: 'hidden' }}>
                                        <span style={{
                                            width: 6,
                                            height: 6,
                                            borderRadius: '50%',
                                            background: isSelected ? '#0284c7' : '#cbd5e1',
                                            flexShrink: 0,
                                        }} />
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {opt.label}
                                        </span>
                                    </span>
                                    {isSelected && <span style={{ color: '#0284c7', fontWeight: 700, fontSize: 12 }}>✓</span>}
                                </div>
                            );
                        })}

                        {filteredOptions.length === 0 && (
                            <div style={{ padding: '16px', textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>
                                {isEn ? 'No distributors found' : 'Không tìm thấy đại lý'}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
