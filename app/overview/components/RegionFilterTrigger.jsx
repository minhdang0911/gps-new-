/**
 * @file RegionFilterTrigger.jsx
 * @description Nút bấm kích hoạt mở bộ lọc khu vực kèm các thẻ tag tỉnh thành đã chọn (TopCV style).
 */

'use client';

import React from 'react';
import { MapPin, ChevronDown, Loader2 } from 'lucide-react';

const TAG_LIMIT = 3;

export default function RegionFilterTrigger({
    provinces = [],
    appliedProvIds = new Set(),
    onToggleOpen,
    onRemoveTag,
    disabled = false,
    exporting = false,
    isEn = false,
}) {
    const t = (vi, en) => (isEn ? en : vi);
    const appliedProvList = provinces.filter((p) => appliedProvIds.has(p.id));
    const visibleTags = appliedProvList.slice(0, TAG_LIMIT);
    const hiddenCount = appliedProvList.length - visibleTags.length;

    return (
        <button
            type="button"
            className="ov-refresh-btn"
            onClick={() => { if (!disabled && !exporting) onToggleOpen(); }}
            disabled={disabled || exporting}
            style={{
                color: '#0f766e',
                borderColor: appliedProvIds.size > 0 ? '#0f766e' : '#99f6e4',
                background: appliedProvIds.size > 0 ? '#f0fdfa' : undefined,
                gap: 5,
                flexWrap: 'nowrap',
                maxWidth: 420,
                height: 'auto',
                minHeight: 32,
                padding: '4px 10px',
            }}
        >
            {exporting ? (
                <Loader2 size={13} style={{ animation: 'ov-spin .65s linear infinite', flexShrink: 0 }} />
            ) : (
                <MapPin size={13} style={{ flexShrink: 0 }} />
            )}

            {appliedProvIds.size === 0 ? (
                <span style={{ fontSize: 12.5, fontWeight: 500 }}>
                    {exporting ? t('Đang xuất…', 'Exporting…') : t('Theo khu vực', 'By Region')}
                </span>
            ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'nowrap', overflow: 'hidden' }}>
                    {visibleTags.map((prov) => (
                        <span
                            key={prov.id}
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: 3,
                                background: '#0f766e', color: '#fff',
                                borderRadius: 99, padding: '2px 8px 2px 9px',
                                fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', lineHeight: 1.4,
                            }}
                        >
                            {prov.full_name.replace(/^(Tỉnh|Thành phố)\s+/i, '')}
                            <span
                                role="button"
                                tabIndex={0}
                                onClick={(e) => onRemoveTag(e, prov.id)}
                                onKeyDown={(e) => e.key === 'Enter' && onRemoveTag(e, prov.id)}
                                style={{
                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    width: 13, height: 13, borderRadius: '50%', background: 'rgba(255,255,255,0.25)',
                                    cursor: 'pointer', flexShrink: 0, fontSize: 9, fontWeight: 900, lineHeight: 1,
                                }}
                            >
                                ✕
                            </span>
                        </span>
                    ))}
                    {hiddenCount > 0 && (
                        <span style={{
                            display: 'inline-flex', alignItems: 'center', background: '#ccfbf1',
                            color: '#0f766e', borderRadius: 99, padding: '2px 8px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                        }}>
                            +{hiddenCount}
                        </span>
                    )}
                </span>
            )}

            <ChevronDown size={11} strokeWidth={2.5} style={{ flexShrink: 0, marginLeft: 2, opacity: 0.7 }} />
        </button>
    );
}
