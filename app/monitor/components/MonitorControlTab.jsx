'use client';

import React from 'react';
import { CheckCircleFilled, LockFilled } from '@ant-design/icons';

export default function MonitorControlTab({
    t,
    isConnected,
    deviceStatusClass,
    isLocked,
    deviceStatusText,
    handleConfirmLock,
    handleConfirmUnlock,
    lockLoading,
    pendingAction,
    lockError,
}) {
    return (
        <div className="iky-monitor__popup-col">
            <div className="iky-monitor__control-row">
                <span>{t.control.connectionStatus}</span>
                <div
                    className={
                        'iky-monitor__connection ' +
                        (isConnected
                            ? 'iky-monitor__connection--on'
                            : 'iky-monitor__connection--off')
                    }
                >
                    <span className="iky-monitor__connection-icon">
                        {isConnected ? '✓' : '✕'}
                    </span>
                    <span className="iky-monitor__connection-text">
                        {isConnected
                            ? t.control.connectionOn
                            : t.control.connectionOff}
                    </span>
                </div>
            </div>

            <div className="iky-monitor__control-row">
                <span>{t.control.emergencyStop}</span>

                <div className={`iky-status-badge ${deviceStatusClass}`}>
                    {isLocked ? (
                        <LockFilled className="iky-status-icon" />
                    ) : (
                        <CheckCircleFilled className="iky-status-icon" />
                    )}
                    <span>{deviceStatusText}</span>
                </div>
            </div>

            <div className="iky-monitor__control-row iky-monitor__control-row--action">
                <span>{t.control.lockDevice}</span>
                <button
                    className="iky-monitor__secondary-btn iky-monitor__secondary-btn--control"
                    onClick={handleConfirmLock}
                    disabled={lockLoading}
                >
                    {lockLoading && pendingAction === 'lock'
                        ? t.control.locking
                        : t.control.lockButton}
                </button>
            </div>

            <div className="iky-monitor__control-row iky-monitor__control-row--action iky-monitor__control-row--unlock">
                <span>{t.control.unlockDevice}</span>
                <button
                    className="iky-monitor__secondary-btn iky-monitor__secondary-btn--control"
                    onClick={handleConfirmUnlock}
                    disabled={lockLoading}
                >
                    {lockLoading && pendingAction === 'unlock'
                        ? t.control.unlocking
                        : t.control.unlockButton}
                </button>
            </div>
            {lockError && (
                <div className="iky-monitor__alert iky-monitor__alert--error">
                    {lockError}
                </div>
            )}
        </div>
    );
}
