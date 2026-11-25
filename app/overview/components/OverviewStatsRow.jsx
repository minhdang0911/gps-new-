/**
 * @file OverviewStatsRow.jsx
 * @description Hàng hiển thị 4 hoặc 5 thẻ chỉ số StatCard trong trang Overview.
 */

'use client';

import React from 'react';
import StatCard from './StatCard';
import {
    FleetTotalIcon,
    FleetOnlineIcon,
    FleetOfflineIcon,
    FleetExpiringIcon,
    FleetDistributorIcon,
} from '../OverviewIcons';

export default function OverviewStatsRow({
    displayTotal,
    totalDevices,
    displayOnline,
    displayOffline,
    displayExpiring,
    distributorStats = [],
    distributorFilter,
    mapFilter,
    setMapFilter,
    loading,
    isAdmin,
    isEn,
}) {
    const t = (vi, en) => (isEn ? en : vi);

    return (
        <div className="ov-stats-row" style={isAdmin && !loading && distributorStats.length > 0 ? { '--stat-cols': '5' } : undefined}>
            <StatCard
                icon={<FleetTotalIcon size={24} color="#1d4ed8" />}
                label={t('Tổng thiết bị', 'Total Devices')}
                value={loading ? '—' : displayTotal.toLocaleString()}
                sub={displayTotal !== totalDevices ? t(`/ ${totalDevices} tổng hệ thống`, `/ ${totalDevices} total fleet`) : t('Thiết bị đang giám sát', 'Active fleet tracking')}
                accentColor="#1d4ed8"
                badgeText={t('ĐỘI XE', 'FLEET')}
                loading={loading}
                onClick={() => setMapFilter('all')}
                active={mapFilter === 'all'}
                isEn={isEn}
            />
            <StatCard
                icon={<FleetOnlineIcon size={24} color="#16a34a" />}
                label={t('Thiết bị Online', 'Devices Online')}
                value={loading ? '—' : displayOnline.toLocaleString()}
                percentage={displayTotal > 0 ? Math.round((displayOnline / displayTotal) * 100) : 0}
                progressColor="#16a34a"
                sub={displayTotal > 0 ? t(`${Math.round((displayOnline / displayTotal) * 100)}% hạm đội hoạt động`, `${Math.round((displayOnline / displayTotal) * 100)}% fleet active`) : null}
                accentColor="#16a34a"
                badgeText={t('TRỰC TUYẾN', 'ONLINE')}
                pulseDot
                loading={loading}
                onClick={() => setMapFilter((cur) => (cur === 'online' ? 'all' : 'online'))}
                active={mapFilter === 'online'}
                isEn={isEn}
            />
            <StatCard
                icon={<FleetOfflineIcon size={24} color="#dc2626" />}
                label={t('Thiết bị Offline', 'Devices Offline')}
                value={loading ? '—' : displayOffline.toLocaleString()}
                percentage={displayTotal > 0 ? Math.round((displayOffline / displayTotal) * 100) : 0}
                progressColor="#dc2626"
                sub={displayTotal > 0 ? t(`${Math.round((displayOffline / displayTotal) * 100)}% mất tín hiệu > 24h`, `${Math.round((displayOffline / displayTotal) * 100)}% inactive > 24h`) : null}
                accentColor="#dc2626"
                badgeText={t('MẤT TÍN HIỆU', 'OFFLINE')}
                loading={loading}
                onClick={() => setMapFilter((cur) => (cur === 'offline' ? 'all' : 'offline'))}
                active={mapFilter === 'offline'}
                isEn={isEn}
            />
            <StatCard
                icon={<FleetExpiringIcon size={24} color="#d97706" />}
                label={t('Sắp hết hạn', 'Expiring Soon')}
                value={loading ? '—' : displayExpiring.toLocaleString()}
                sub={displayExpiring > 0 ? t('Thiết bị cần gia hạn', 'Needs renewal') : t('Không có thiết bị hết hạn', 'All licenses active')}
                accentColor="#d97706"
                badgeText={displayExpiring > 0 ? t('CẦN XỬ LÝ', 'URGENT') : t('BÌNH THƯỜNG', 'NORMAL')}
                loading={loading}
                isEn={isEn}
            />
            {isAdmin && (
                <StatCard
                    icon={<FleetDistributorIcon size={24} color="#0284c7" />}
                    label={t('Đại lý phân phối', 'Distributors')}
                    value={loading ? '—' : distributorStats.length.toString()}
                    sub={distributorFilter ? t('Đang lọc theo đại lý', 'Filtered by distributor') : t('Phân bổ thiết bị', 'Fleet allocation')}
                    accentColor="#0284c7"
                    badgeText={t('ĐẠI LÝ', 'DEALER')}
                    loading={loading}
                    isEn={isEn}
                />
            )}
        </div>
    );
}
