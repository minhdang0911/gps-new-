'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { message, Modal } from 'antd';
import { parseTimToDate } from '../../util/time';
import { pickField } from '../util/monitorHelpers';

const { confirm } = Modal;

export function useMonitorControl({ selectedDevice, liveTelemetry, lastCruise, batteryStatus, lastMqttAtRef, t }) {
    const [lockLoading, setLockLoading] = useState(false);
    const [lockError, setLockError] = useState(null);
    const [pendingAction, setPendingAction] = useState(null);
    const mqttClientRef = useRef(null);

    const publishControlCommand = (payload) => {
        if (!selectedDevice || !selectedDevice.imei) {
            const msgText = t.error.missingDeviceOrImei;
            setLockError(msgText);
            message.error(msgText);
            return;
        }

        const client = mqttClientRef.current;
        if (!client) {
            const msgText = t.error.mqttNotReady;
            setLockError(msgText);
            message.error(msgText);
            return;
        }

        const topic = `device/${selectedDevice.imei}/control`;

        try {
            client.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
                if (err) {
                    console.error('Publish control error:', err);
                    const msgText = t.error.controlFailed;
                    setLockError(msgText);
                    message.error(msgText);
                } else {
                    setLockError(null);
                }
            });
        } catch (e) {
            console.error('Publish exception:', e);
            const msgText = t.error.controlException;
            setLockError(msgText);
            message.error(msgText);
        }
    };

    const handleLockDevice = () => {
        publishControlCommand({ sos: 1 });
        message.success(t.control.lockSuccessToast);
    };

    const handleUnlockDevice = () => {
        publishControlCommand({ sos: 0 });
        message.success(t.control.unlockSuccessToast);
    };

    const handleConfirmLock = () => {
        if (!selectedDevice) return;
        const plate = selectedDevice.license_plate || selectedDevice.imei || t.common.deviceFallback;

        confirm({
            title: t.control.confirmLockTitle,
            content: t.control.confirmLockContent.replace('{plate}', plate),
            okText: t.control.confirmLockOk,
            cancelText: t.control.confirmCancel,
            onOk: () => {
                setPendingAction('lock');
                setLockLoading(true);
                handleLockDevice();
                setLockLoading(false);
                setPendingAction(null);
            },
        });
    };

    const handleConfirmUnlock = () => {
        if (!selectedDevice) return;
        const plate = selectedDevice.license_plate || selectedDevice.imei || t.common.deviceFallback;

        confirm({
            title: t.control.confirmUnlockTitle,
            content: t.control.confirmUnlockContent.replace('{plate}', plate),
            okText: t.control.confirmUnlockOk,
            cancelText: t.control.confirmCancel,
            onOk: () => {
                setPendingAction('unlock');
                setLockLoading(true);
                handleUnlockDevice();
                setLockLoading(false);
                setPendingAction(null);
            },
        });
    };

    const [currentTime, setCurrentTime] = useState(() => Date.now());

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(Date.now());
        }, 10_000);
        return () => clearInterval(timer);
    }, []);

    const isConnected = useMemo(() => {
        if (!selectedDevice) return false;
        const ctx = { liveTelemetry, lastCruise, batteryStatus };
        const timVal = pickField('tim', ctx, lastMqttAtRef) ?? lastCruise?.tim ?? batteryStatus?.tim;
        if (!timVal) return false;

        let atDate = parseTimToDate(timVal);
        if (!atDate) {
            const fallback = new Date(timVal);
            if (!isNaN(fallback.getTime())) {
                atDate = fallback;
            }
        }
        if (!atDate) return false;

        const diffMs = currentTime - atDate.getTime();
        return diffMs <= 2 * 60 * 1000 && diffMs >= -2 * 60 * 1000;
    }, [selectedDevice, liveTelemetry, lastCruise, batteryStatus, currentTime]);

    return {
        lockLoading,
        lockError,
        pendingAction,
        mqttClientRef,
        handleConfirmLock,
        handleConfirmUnlock,
        isConnected,
    };
}
