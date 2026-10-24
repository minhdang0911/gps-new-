'use client';

import { useEffect, useRef } from 'react';
import mqtt from 'mqtt';

/**
 * 🛠️ Tự động sửa lỗi cú pháp payload từ firmware thiết bị
 * Ví dụ lỗi firmware nối chuỗi bị thừa dấu mở ngoặc nhọn:
 * {"dev":"860056082844128",{"bid":"860056082844128",...} -> {"dev":"860056082844128","bid":"860056082844128",...}
 */
function safeParseMqttPayload(raw) {
    if (!raw || typeof raw !== 'string') return null;
    const trimmed = raw.trim();

    // 1️⃣ Parse chuẩn thông thường
    try {
        return JSON.parse(trimmed);
    } catch {
        // Tiếp tục thử sửa lỗi định dạng firmware
    }

    // 2️⃣ Sửa lỗi firmware ghép chuỗi bị thừa dấu '{' ở giữa:
    try {
        const fixed = trimmed.replace(/"\s*,\s*\{"/, '","');
        return JSON.parse(fixed);
    } catch {
        // Thử trường hợp 3
    }

    // 3️⃣ Trường hợp firmware gửi object lồng nhưng thiếu key: {"dev":"...", {...}}
    try {
        const fixed = trimmed.replace(/"\s*,\s*\{/, '","data":{');
        return JSON.parse(fixed);
    } catch {
        return null;
    }
}

export default function MqttConnector({ imei, onMessage, onClientReady }) {
    const clientRef = useRef(null);
    const onMessageRef = useRef(onMessage);
    onMessageRef.current = onMessage;
    const onClientReadyRef = useRef(onClientReady);
    onClientReadyRef.current = onClientReady;
    const currentSubscribedTopicRef = useRef(null);

    const url = process.env.NEXT_PUBLIC_MQTT_URL;
    const username = process.env.NEXT_PUBLIC_MQTT_USERNAME;
    const password = process.env.NEXT_PUBLIC_MQTT_PASSWORD;

    // 1️⃣ Kết nối MQTT 1 lần duy nhất trong session
    useEffect(() => {
        if (!url) return;

        const initialTopic = imei ? `device/${imei}/telemetry` : '';
        console.log('🔌 MQTT connecting →', url, 'topic →', initialTopic);

        const client = mqtt.connect(url, {
            clientId: `iky_web_${Math.random().toString(16).slice(2)}`,
            username,
            password,
            connectTimeout: 10000,
            reconnectPeriod: 5000,
            keepalive: 60,
            clean: true,
        });

        clientRef.current = client;

        client.on('connect', () => {
            console.log('✅ MQTT Connected!');
            onClientReadyRef.current?.(client);
            const pendingTopic = currentSubscribedTopicRef.current;
            if (pendingTopic) {
                client.subscribe(pendingTopic, (err) => {
                    if (err) console.error('❌ MQTT Subscribe error', err);
                    else console.log('📡 Subscribed:', pendingTopic);
                });
            }
        });

        client.on('error', (err) => {
            console.error('❌ MQTT ERROR:', err?.message || err);
        });

        client.on('message', (tpc, payload) => {
            const raw = payload.toString();
            const json = safeParseMqttPayload(raw);

            if (json) {
                console.log('📦 JSON PARSED:', json);
            } else {
                console.warn('⚠️ PAYLOAD KHÔNG PHẢI JSON (không thể tự sửa):', raw);
            }

            onMessageRef.current?.(tpc, json || raw);
        });

        return () => {
            console.log('🔌 MQTT Disconnected');
            onClientReadyRef.current?.(null);
            client.end(true);
            clientRef.current = null;
        };
    }, [url, username, password]);

    // 2️⃣ Khi đổi IMEI (chuyển xe): Unsubscribe topic cũ & subscribe topic mới ngay lập tức (0ms reconnect)
    useEffect(() => {
        const client = clientRef.current;
        const newTopic = imei ? `device/${imei}/telemetry` : null;
        const oldTopic = currentSubscribedTopicRef.current;

        if (client && client.connected) {
            if (oldTopic && oldTopic !== newTopic) {
                client.unsubscribe(oldTopic);
                console.log('🔌 Unsubscribed:', oldTopic);
            }
            if (newTopic) {
                client.subscribe(newTopic, (err) => {
                    if (err) console.error('❌ MQTT Subscribe error', err);
                    else console.log('📡 Subscribed:', newTopic);
                });
            }
        }

        currentSubscribedTopicRef.current = newTopic;
    }, [imei]);

    return null;
}
