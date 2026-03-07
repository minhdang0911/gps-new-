'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AutoComplete, Input } from 'antd';
import { EnvironmentOutlined } from '@ant-design/icons';

// ===============================
// 🔑 NHIỀU GOONG API KEY + XOAY VÒNG
// ===============================
const GOONG_KEYS = [
    process.env.NEXT_PUBLIC_GOONG_API_KEY,
    process.env.NEXT_PUBLIC_GOONG_API_KEY1,
    process.env.NEXT_PUBLIC_GOONG_API_KEY3,
    process.env.NEXT_PUBLIC_GOONG_API_KEY4,
    process.env.NEXT_PUBLIC_GOONG_API_KEY5,
    process.env.NEXT_PUBLIC_GOONG_API_KEY6,
    process.env.NEXT_PUBLIC_GOONG_API_KEY7,
    process.env.NEXT_PUBLIC_GOONG_API_KEY8,
].filter(Boolean); // bỏ undefined / null

let goongKeyIndex = 0;

const getCurrentGoongKey = () => {
    if (!GOONG_KEYS.length) return null;
    return GOONG_KEYS[goongKeyIndex % GOONG_KEYS.length];
};

const moveToNextGoongKey = () => {
    if (!GOONG_KEYS.length) return;
    goongKeyIndex = (goongKeyIndex + 1) % GOONG_KEYS.length;
};

const callGoongAutocompleteWithRotation = async (q, limit = 10) => {
    if (!GOONG_KEYS.length) return null;

    for (let i = 0; i < GOONG_KEYS.length; i++) {
        const apiKey = getCurrentGoongKey();
        if (!apiKey) break;

        try {
            const params = new URLSearchParams({
                input: q,
                limit: String(limit),
                api_key: apiKey,
                has_deprecated_administrative_unit: 'true', // V2 param
                // more_compound: 'true', // nếu sau này cần thêm quận/xã/tỉnh chi tiết thì bật
            });

            const url = `https://rsapi.goong.io/v2/place/autocomplete?${params.toString()}`;

            const res = await fetch(url);

            let data = null;
            try {
                data = await res.json();
            } catch (e) {
                // parse json lỗi → thử key tiếp theo
                moveToNextGoongKey();
                continue;
            }

            // 1. HTTP bị limit/quyền
            if (res.status === 429 || res.status === 403) {
                moveToNextGoongKey();
                continue;
            }

            // 2. Body báo lỗi limit / denied (v1 & v2 đều có thể trả mấy field này)
            const status = data?.status || data?.error || data?.error_code;
            if (
                status === 'OVER_QUERY_LIMIT' ||
                status === 'REQUEST_DENIED' ||
                status === 'PERMISSION_DENIED' ||
                status === 429 ||
                status === 403
            ) {
                moveToNextGoongKey();
                continue;
            }

            // 3. Lỗi HTTP khác
            if (!res.ok) {
                moveToNextGoongKey();
                continue;
            }

            // Thành công → trả data, KHÔNG đổi key
            return data;
        } catch (err) {
            // Lỗi network hoặc fetch → thử key khác
            moveToNextGoongKey();
        }
    }

    // Tất cả key fail
    return null;
};

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
    }, []);

    const fetchSuggestions = useCallback(
        async (q) => {
            if (!q || q.trim().length < 2) {
                setOptions([]);
                return;
            }
            if (fallbackMode) return;

            // Không có key nào → chuyển fallback luôn
            if (!GOONG_KEYS.length) {
                console.warn('No Goong API keys configured');
                switchToFallbackMode();
                return;
            }

            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(async () => {
                try {
                    setLoading(true);

                    const data = await callGoongAutocompleteWithRotation(q);

                    // Nếu hết key hoặc API lỗi → tăng error, có thể chuyển fallback
                    if (!data) {
                        setErrorCount((prev) => {
                            const next = prev + 1;
                            if (next >= 3) switchToFallbackMode();
                            return next;
                        });
                        setOptions([]);
                        setLoading(false);
                        return;
                    }

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
            onChange={(val) => {
                // chỉ đổi state nội bộ (khi clear hoặc khi AutoComplete thay đổi)
                setInnerValue(val || '');
            }}
            onSelect={(val, option) => {
                setInnerValue(val);
                onChange?.(val, { place_id: option?.place_id, raw: option?.raw });
            }}
            notFoundContent={loading ? 'Đang tìm...' : null}
        >
            <Input
                placeholder={placeholder || 'Nhập địa chỉ...'}
                prefix={<EnvironmentOutlined />}
                value={innerValue}
                onChange={(e) => {
                    const v = e.target.value;
                    setInnerValue(v); // gõ mượt
                    fetchSuggestions(v); // ✅ thay cho AutoComplete.onSearch
                }}
            />
        </AutoComplete>
    );
}
