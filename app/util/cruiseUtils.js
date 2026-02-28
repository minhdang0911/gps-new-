// util/cruiseUtils.js
import { formatDateFromDevice } from './FormatDate';

// ===============================
// ⚙️ CONFIG
// ===============================
export const FETCH_PAGE_LIMIT = 1000;

// Map sampling (polyline + playback)
export const VISUAL_MAX_POINTS_ON_MAP = 3000;
export const MAP_MIN_SAMPLE_DIST_M = 60;

// Playback/UI perf
export const UI_FPS = 6;
export const UI_THROTTLE_MS = Math.round(1000 / UI_FPS);
export const BASE_SPEED_MPS = 60;

// Segment config
export const MIN_EVENT_DURATION_SEC = 10;

// ===============================
// GPS utils
// ===============================
const EARTH_RADIUS_M = 6371000;
const toRad = (v) => (v * Math.PI) / 180;

export const distanceMeters = (a, b) => {
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lon - a.lon);

    const sinLat = Math.sin(dLat / 2);
    const sinLon = Math.sin(dLon / 2);

    const aa = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLon * sinLon;
    const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
    return EARTH_RADIUS_M * c;
};

export const calcTotalDistanceKm = (points) => {
    if (!points || points.length < 2) return 0;
    let totalM = 0;
    for (let i = 1; i < points.length; i++) {
        const a = points[i - 1];
        const b = points[i];
        if (typeof a?.lat !== 'number' || typeof a?.lon !== 'number') continue;
        if (typeof b?.lat !== 'number' || typeof b?.lon !== 'number') continue;

        const d = distanceMeters({ lat: a.lat, lon: a.lon }, { lat: b.lat, lon: b.lon });
        if (d > 0 && d < 2000) totalM += d;
    }
    return totalM / 1000;
};

// ===============================
// Bearing
// ===============================
export const getBearing = (lat1, lon1, lat2, lon2) => {
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

    let θ = Math.atan2(y, x);
    θ = (θ * 180) / Math.PI;
    return (θ + 360) % 360;
};

export const normalizeAngle = (a) => ((a % 360) + 360) % 360;

// ===============================
// 🧠 Map downsample
// ===============================
export const buildMapSample = (rawPoints, maxPoints = VISUAL_MAX_POINTS_ON_MAP, minDistM = MAP_MIN_SAMPLE_DIST_M) => {
    if (!rawPoints || rawPoints.length === 0) return { indices: [], points: [] };
    const isValid = (p) => p && typeof p.lat === 'number' && typeof p.lon === 'number';

    let first = -1;
    for (let i = 0; i < rawPoints.length; i++) {
        if (isValid(rawPoints[i])) {
            first = i;
            break;
        }
    }
    if (first === -1) return { indices: [], points: [] };

    let last = first;
    for (let i = rawPoints.length - 1; i >= 0; i--) {
        if (isValid(rawPoints[i])) {
            last = i;
            break;
        }
    }

    const kept = [first];
    let lastKept = rawPoints[first];

    for (let i = first + 1; i <= last; i++) {
        const p = rawPoints[i];
        if (!isValid(p)) continue;
        const d = distanceMeters({ lat: lastKept.lat, lon: lastKept.lon }, { lat: p.lat, lon: p.lon });
        if (d >= minDistM) {
            kept.push(i);
            lastKept = p;
        }
    }

    if (kept[kept.length - 1] !== last) kept.push(last);

    if (kept.length > maxPoints) {
        const step = Math.ceil(kept.length / maxPoints);
        const down = [];
        for (let i = 0; i < kept.length; i += step) down.push(kept[i]);
        if (down[down.length - 1] !== kept[kept.length - 1]) down.push(kept[kept.length - 1]);
        return { indices: down, points: down.map((idx) => rawPoints[idx]) };
    }

    return { indices: kept, points: kept.map((idx) => rawPoints[idx]) };
};

export const nearestRenderIndex = (renderToRaw, rawIdx) => {
    if (!renderToRaw || renderToRaw.length === 0) return -1;
    let lo = 0;
    let hi = renderToRaw.length - 1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const v = renderToRaw[mid];
        if (v === rawIdx) return mid;
        if (v < rawIdx) lo = mid + 1;
        else hi = mid - 1;
    }
    const a = Math.max(0, Math.min(renderToRaw.length - 1, lo));
    const b = Math.max(0, Math.min(renderToRaw.length - 1, lo - 1));
    return Math.abs(renderToRaw[a] - rawIdx) < Math.abs(renderToRaw[b] - rawIdx) ? a : b;
};

// ===============================
// ✅ Popup text
// ===============================
export const popupText = (isEn) => ({
    licensePlate: isEn ? 'License plate' : 'Biển số xe',
    vehicleType: isEn ? 'Vehicle type' : 'Loại xe',
    manufacturer: isEn ? 'Manufacturer' : 'Hãng',
    time: isEn ? 'Time' : 'Thời điểm',
    currentLocation: isEn ? 'Current location' : 'Vị trí hiện tại',
    coordinate: isEn ? 'Coordinates' : 'Tọa độ',
    machineStatus: isEn ? 'Engine status' : 'Trạng thái máy',
    vehicleStatus: isEn ? 'Vehicle status' : 'Trạng thái xe',
    speed: isEn ? 'Speed' : 'Vận tốc',

    engineOn: isEn ? 'Engine on' : 'Mở máy',
    engineOff: isEn ? 'Engine off' : 'Tắt máy',

    vehicleRunning: isEn ? 'Running' : 'Xe đang chạy',
    vehicleStopped: isEn ? 'Stopped' : 'Xe dừng',
    vehicleParking: isEn ? 'Parked' : 'Xe đỗ',

    loadingAddress: isEn ? 'Fetching address...' : 'Đang lấy địa chỉ...',
});

// ===============================
// ✅ Status logic (CHỐT)
// acc=1 => PARK (tắt máy)
// else: vgp>0 => RUN, vgp<=0/undefined => STOP
// ===============================
export const toNum = (v) => {
    if (v === null || v === undefined || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
};

export const getStatusType = ({ acc, spd }) => {
    const accNum = toNum(acc);
    const speed = toNum(spd) ?? 0;
    if (accNum === 1) return 'PARK';
    if (speed > 0) return 'RUN';
    return 'STOP';
};

export const buildStatusHard = ({ acc, spd }, isEn) => {
    const t = popupText(isEn);
    const accNum = toNum(acc);
    const speed = toNum(spd) ?? 0;

    if (accNum === 1) {
        return {
            machineStatus: t.engineOff,
            vehicleStatus: t.vehicleParking,
            speedText: `${speed} km/h`,
            speedNum: speed,
            type: 'PARK',
        };
    }

    if (speed > 0) {
        return {
            machineStatus: t.engineOn,
            vehicleStatus: t.vehicleRunning,
            speedText: `${speed} km/h`,
            speedNum: speed,
            type: 'RUN',
        };
    }

    return {
        machineStatus: t.engineOn,
        vehicleStatus: t.vehicleStopped,
        speedText: '0 km/h',
        speedNum: 0,
        type: 'STOP',
    };
};

// ===============================
// ✅ TIME PARSE (FIX TIM YYMMDDHHmmss)
// tim: "260112080402" => 2026-01-12 08:04:02 (local)
// ===============================
export const parseTimYYMMDDHHmmssToMs = (tim) => {
    if (!tim) return NaN;
    const s = String(tim).trim();
    if (!/^\d{12}$/.test(s)) return NaN;

    const yy = Number(s.slice(0, 2));
    const MM = Number(s.slice(2, 4));
    const dd = Number(s.slice(4, 6));
    const HH = Number(s.slice(6, 8));
    const mm = Number(s.slice(8, 10));
    const ss = Number(s.slice(10, 12));
    const year = 2000 + yy;

    return new Date(year, MM - 1, dd, HH, mm, ss).getTime();
};

export const parseDeviceTimeMs = (s) => {
    if (!s) return NaN;
    const str = String(s).trim();

    // tim dạng YYMMDDHHmmss
    if (/^\d{12}$/.test(str)) {
        const ms = parseTimYYMMDDHHmmssToMs(str);
        return Number.isFinite(ms) ? ms : NaN;
    }

    // ISO
    if (str.includes('T')) {
        const ms = Date.parse(str);
        return Number.isFinite(ms) ? ms : NaN;
    }

    // "YYYY-MM-DD HH:mm:ss"
    const normalized = str.includes(' ') ? str.replace(' ', 'T') : str;
    const ms = Date.parse(normalized);
    return Number.isFinite(ms) ? ms : NaN;
};

export const safeTimeMs = (p) => {
    const ms1 = parseTimYYMMDDHHmmssToMs(p?.timRaw || p?.tim);
    if (Number.isFinite(ms1)) return ms1;

    const ms2 = parseDeviceTimeMs(p?.dateTime);
    if (Number.isFinite(ms2)) return ms2;

    const ms3 = Date.parse(p?.createdAt || p?.updatedAt || '');
    return Number.isFinite(ms3) ? ms3 : NaN;
};

export const formatDuration = (sec) => {
    const s = Math.max(0, Math.floor(sec));
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    if (hh > 0) return `${hh} giờ ${mm} phút ${ss} giây`;
    if (mm > 0) return `${mm} phút ${ss} giây`;
    return `${ss} giây`;
};

// ===============================
// Popup HTML
// ===============================
export const buildPopupHtml = (p, isEn) => {
    const t = popupText(isEn);
    const status = buildStatusHard({ acc: p.acc, spd: p.spd ?? p.velocityNum ?? p.velocity }, isEn);

    return `
    <div class="iky-cruise-popup">
      <div><strong>${t.licensePlate}:</strong> ${p.licensePlate || '--'}</div>
      <div><strong>${t.vehicleType}:</strong> ${p.vehicleName || '--'}</div>
      <div><strong>${t.manufacturer}:</strong> ${p.manufacturer || '--'}</div>
      <div><strong>${t.time}:</strong> ${formatDateFromDevice(p.dateTime) || '--'}</div>
      <div><strong>${t.currentLocation}:</strong> ${p.address || t.loadingAddress}</div>
      <div><strong>${t.coordinate}:</strong> ${p.lat}, ${p.lon}</div>
      <div><strong>${t.machineStatus}:</strong> ${status.machineStatus}</div>
      <div><strong>${t.vehicleStatus}:</strong> ${status.vehicleStatus}</div>
      <div><strong>${t.speed}:</strong> ${status.speedText}</div>
    </div>
  `;
};

export const toInputDateTime = (date) => {
    const tzOffset = date.getTimezoneOffset() * 60000;
    const localISO = new Date(date.getTime() - tzOffset).toISOString();
    return localISO.slice(0, 16);
};

export const toApiDateTime = (value) => {
    if (!value) return '';
    const [date, timeRaw] = value.split('T');
    if (!timeRaw) return date;
    const time = timeRaw.slice(0, 8);
    if (time.length === 5) return `${date} ${time}:00`;
    return `${date} ${time}`;
};
