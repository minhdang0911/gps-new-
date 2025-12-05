'use client';

import { useEffect, useRef } from 'react';
import mqtt from 'mqtt';

export default function MqttConnector({ imei, onMessage, onClientReady }) {
    const clientRef = useRef(null);

    // lấy từ env
    const url = process.env.NEXT_PUBLIC_MQTT_URL;
    const username = process.env.NEXT_PUBLIC_MQTT_USERNAME;
    const password = process.env.NEXT_PUBLIC_MQTT_PASSWORD;

    useEffect(() => {
        if (!imei) return;

        const topic = `device/${imei}/telemetry`;

        console.log('🔌 MQTT connecting →', url, 'topic →', topic);

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
            onClientReady?.(client);
            client.subscribe(topic, (err) => {
                if (err) console.error('❌ Subscribe error', err);
                else console.log('📡 Subscribed:', topic);
            });
        });

        client.on('error', (err) => {
            console.error('❌ MQTT ERROR:', err?.message || err);
        });

        client.on('message', (tpc, payload) => {
            const raw = payload.toString();
            let json = null;
            try {
                json = JSON.parse(raw);
                console.log('📦 JSON PARSED:', json);
            } catch {
                console.log('⚠️ PAYLOAD KHÔNG PHẢI JSON');
            }
            onMessage?.(tpc, json || raw);
        });

        return () => {
            console.log('🔌 MQTT Disconnected');
            onClientReady?.(null);
            client.end(true);
        };
    }, [imei]);

    return null;
}
