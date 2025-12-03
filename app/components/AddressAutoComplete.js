'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AutoComplete, Input } from 'antd';
import { EnvironmentOutlined } from '@ant-design/icons';

export default function AddressAutoComplete({ value, onChange, placeholder }) {
    const [innerValue, setInnerValue] = useState(value || '');
    const [options, setOptions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [fallbackMode, setFallbackMode] = useState(false);
    const [errorCount, setErrorCount] = useState(0);
    const timerRef = useRef(null);

    // Đồng bộ khi parent change value (edit user, reset form, ...)
    useEffect(() => {
        setInnerValue(value || '');
    }, [value]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedFallback = sessionStorage.getItem('goong_fallback_mode');
            if (savedFallback === 'true') {
                setFallbackMode(true);
            }
        }
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    const switchToFallbackMode = useCallback(() => {
        setFallbackMode(true);
        setOptions([]);
        setLoading(false);
        if (typeof window !== 'undefined') {
            sessionStorage.setItem('goong_fallback_mode', 'true');
        }
        console.log('Switched to fallback mode (manual input)');
    }, []);

    const fetchSuggestions = useCallback(
        async (q) => {
            if (!q || q.trim().length < 2) {
                setOptions([]);
                return;
            }
            if (fallbackMode) return;

            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(async () => {
                try {
                    setLoading(true);
                    const apiKey = process.env.NEXT_PUBLIC_GOONG_API_KEY;

                    if (!apiKey) {
                        console.warn('Goong API key not set: NEXT_PUBLIC_GOONG_API_KEY');
                        switchToFallbackMode();
                        return;
                    }

                    const params = new URLSearchParams({
                        input: q,
                        limit: '6',
                        api_key: apiKey,
                    });

                    const url = `https://rsapi.goong.io/place/autocomplete?${params.toString()}`;
                    const res = await fetch(url);

                    if (!res.ok) {
                        const errorData = await res.json().catch(() => null);
                        console.error('Goong API error:', res.status, errorData);

                        setErrorCount((prev) => {
                            const next = prev + 1;
                            if (next >= 3) switchToFallbackMode();
                            return next;
                        });

                        setOptions([]);
                        setLoading(false);
                        return;
                    }

                    const data = await res.json();

                    setErrorCount(0);

                    const opts = (data.predictions || []).map((p) => ({
                        label: p.structured_formatting?.main_text
                            ? `${p.structured_formatting.main_text} — ${p.structured_formatting.secondary_text || ''}`
                            : p.description,
                        value: p.description,
                        place_id: p.place_id,
                        raw: p,
                    }));

                    setOptions(opts);
                } catch (err) {
                    console.error('Autocomplete fetch error:', err);

                    setErrorCount((prev) => {
                        const next = prev + 1;
                        if (next >= 3) switchToFallbackMode();
                        return next;
                    });

                    setOptions([]);
                } finally {
                    setLoading(false);
                }
            }, 150); // debounce thấp cho cảm giác "ăn liền"
        },
        [fallbackMode, switchToFallbackMode],
    );

    // Fallback: input thường, cho gõ trực tiếp + sync parent mỗi lần gõ
    if (fallbackMode) {
        return (
            <Input
                value={innerValue}
                onChange={(e) => {
                    const val = e.target.value;
                    setInnerValue(val);
                    if (onChange) {
                        onChange(val, { place_id: null, raw: null });
                    }
                }}
                placeholder={placeholder || 'Nhập địa chỉ'}
                prefix={<EnvironmentOutlined />}
                allowClear
            />
        );
    }

    return (
        <AutoComplete
            value={innerValue}
            options={options}
            style={{ width: '100%' }}
            allowClear
            onSearch={fetchSuggestions}
            onChange={(val) => {
                // GÕ MƯỢT: chỉ đổi state nội bộ, KHÔNG gọi onChange parent
                setInnerValue(val || '');
            }}
            onSelect={(val, option) => {
                // Khi user chọn 1 dòng → mới sync lên parent
                setInnerValue(val);
                if (onChange) {
                    onChange(val, { place_id: option?.place_id, raw: option?.raw });
                }
            }}
            notFoundContent={loading ? 'Đang tìm...' : null}
        >
            <Input placeholder={placeholder || 'Nhập địa chỉ...'} prefix={<EnvironmentOutlined />} />
        </AutoComplete>
    );
}
