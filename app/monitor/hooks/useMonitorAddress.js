'use client';

import { useState, useRef } from 'react';
import { reverseGeocodeAddress, getCachedAddressSync, isValidGeocodeCoord } from '../../lib/address/reverseGeocode';
import { getDistanceMeters } from '../../util/geo';

export function useMonitorAddress({ isEn, t }) {
    const [address, setAddress] = useState('');
    const [deprecatedAddress, setDeprecatedAddress] = useState('');
    const [loadingAddress, setLoadingAddress] = useState(false);
    const [addressError, setAddressError] = useState(null);

    const lastCoordsRef = useRef({ lat: null, lon: null });
    const lastResolvedAddrRef = useRef({ lat: null, lon: null, lang: null, address: '', deprecatedAddress: '' });
    const addressReqSeqRef = useRef(0);

    const fetchAddress = async (latVal, lonVal) => {
        if (!isValidGeocodeCoord(latVal, lonVal)) {
            addressReqSeqRef.current += 1;
            setLoadingAddress(false);
            setAddress('');
            setDeprecatedAddress('');
            setAddressError(null);
            return;
        }

        const latNum = Number(latVal);
        const lonNum = Number(lonVal);
        const lang = isEn ? 'en' : 'vi';

        const prevResolved = lastResolvedAddrRef.current;
        if (prevResolved.lang === lang && prevResolved.address && prevResolved.lat != null && prevResolved.lon != null) {
            const movedDist = getDistanceMeters(prevResolved.lat, prevResolved.lon, latNum, lonNum);
            if (movedDist != null && movedDist < 20) {
                setLoadingAddress(false);
                setAddressError(null);
                setAddress(prevResolved.address);
                setDeprecatedAddress(prevResolved.deprecatedAddress || '');
                return;
            }
        }

        const syncCached = getCachedAddressSync(latNum, lonNum, { lang, isEn });
        if (syncCached?.address) {
            addressReqSeqRef.current += 1;
            setLoadingAddress(false);
            setAddressError(null);
            setAddress(syncCached.address);
            setDeprecatedAddress(syncCached.deprecatedAddress || '');
            lastResolvedAddrRef.current = {
                lat: latNum,
                lon: lonNum,
                lang,
                address: syncCached.address,
                deprecatedAddress: syncCached.deprecatedAddress || '',
            };
            return;
        }

        const reqSeq = ++addressReqSeqRef.current;
        setLoadingAddress(true);
        setAddressError(null);
        setDeprecatedAddress('');

        try {
            const result = await reverseGeocodeAddress(latNum, lonNum, { lang, isEn });
            if (addressReqSeqRef.current !== reqSeq) return;

            if (result && result.address) {
                setAddress(result.address);
                setDeprecatedAddress(result.deprecatedAddress || '');
                lastResolvedAddrRef.current = {
                    lat: latNum,
                    lon: lonNum,
                    lang,
                    address: result.address,
                    deprecatedAddress: result.deprecatedAddress || '',
                };
            } else {
                setAddress('');
                setDeprecatedAddress('');
                setAddressError(t.error.address);
            }
        } catch (err) {
            if (addressReqSeqRef.current !== reqSeq) return;
            console.error('Fetch address error:', err);
            setAddress('');
            setDeprecatedAddress('');
            setAddressError(t.error.address);
        } finally {
            if (addressReqSeqRef.current === reqSeq) {
                setLoadingAddress(false);
            }
        }
    };

    const resetAddress = () => {
        addressReqSeqRef.current += 1;
        lastResolvedAddrRef.current = { lat: null, lon: null, lang: null, address: '', deprecatedAddress: '' };
        setLoadingAddress(false);
        setAddress('');
        setDeprecatedAddress('');
        setAddressError(null);
        lastCoordsRef.current = { lat: null, lon: null };
    };

    return {
        address,
        deprecatedAddress,
        loadingAddress,
        addressError,
        fetchAddress,
        resetAddress,
        lastCoordsRef,
        setAddress,
        setDeprecatedAddress,
        setLoadingAddress,
        setAddressError,
    };
}
