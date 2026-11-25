'use client';

import React from 'react';
import { clampSoc } from '../util/monitorHelpers';

const BatteryBadge = React.memo(({ soc, showText = true, title, compact = true }) => {
    const s = clampSoc(soc);
    const level = s == null ? 'na' : s < 20 ? 'low' : s < 40 ? 'mid' : 'ok';

    return (
        <div className={`iky-battery-badge ${compact ? 'iky-battery-badge--compact' : ''}`} title={title || ''}>
            <div className={`iky-battery ${level}`}>
                <div className="iky-battery__fill" style={{ width: s == null ? '0%' : `${s}%` }} />
            </div>
            {showText && <span className={`iky-battery__text ${level}`}>{s == null ? '--' : `${s}%`}</span>}
        </div>
    );
});

BatteryBadge.displayName = 'BatteryBadge';

export default BatteryBadge;
