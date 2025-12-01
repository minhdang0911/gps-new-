'use client';

import { useEffect, useRef } from 'react';
import mqtt from 'mqtt';

export default function MqttConnector({ imei, onMessage }) {
    const clientRef = useRef(null);

    useEffect(() => {
        if (!imei) return; // chưa có imei thì khỏi connect

        const url = 'wss://ev-mqtt.iky.vn:8083';
        const topic = `device/${imei}/telemetry`;

        console.log('🔌 Connecting MQTT to:', url, 'topic:', topic);

        const client = mqtt.connect(url, {
            clientId: `iky_web_${Math.random().toString(16).slice(2)}`,
            username: 'iky',
            password: 'IKY123456',
            connectTimeout: 10000,
            reconnectPeriod: 5000,
            keepalive: 60,
            clean: true,
        });

        clientRef.current = client;

        client.on('connect', () => {
            console.log('✅ MQTT Connected!');
            client.subscribe(topic, (err) => {
                if (err) console.error('❌ Subscribe error:', err);
                else console.log(`📡 Subscribed → ${topic}`);
            });
        });

        client.on('error', (err) => {
            console.error('❌ MQTT ERROR:', err?.message || err);
        });

        client.on('message', (tpc, payload) => {
            const raw = payload.toString();

            console.log('--------------------------------------------------');
            console.log('📥 MQTT RAW MESSAGE:');
            console.log('TOPIC:', tpc);
            console.log('PAYLOAD:', raw);

            let json = null;
            try {
                json = JSON.parse(raw);
                console.log('📦 JSON PARSED:', json);
            } catch {
                console.log('⚠️ PAYLOAD KHÔNG PHẢI JSON');
            }
            console.log('--------------------------------------------------');

            onMessage?.(tpc, json || raw);
        });

        return () => {
            console.log('🔌 MQTT Disconnected');
            client.end(true);
        };
    }, [imei]);

    return null;
}
