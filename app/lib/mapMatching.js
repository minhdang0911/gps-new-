// ==========================================
// 🗺️ MAP MATCHING - OSRM
// Snap GPS coordinates lên đường thật
// ==========================================

const OSRM_BASE = 'https://router.project-osrm.org/match/v1/driving';
const BATCH_SIZE = 80;       // max điểm / request
const OVERLAP = 5;           // overlap giữa các batch để ghép mượt
const RADIUS_M = 25;         // ✅ FIX: 50 bị OSRM từ chối "Too Large", dùng 25
const TIMEOUT_MS = 10000;    // timeout mỗi request
const MAX_RETRIES = 1;       // số lần retry nếu lỗi


// ─── IndexedDB cache store ───────────────────────────────
const DB_NAME = 'IKY_MAP_MATCH';
const DB_VERSION = 1;
const STORE_NAME = 'matched_routes';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 ngày

let _db = null;

async function openDb() {
    if (_db) return _db;
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => { _db = req.result; resolve(_db); };
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'cacheKey' });
                store.createIndex('cachedAt', 'cachedAt', { unique: false });
            }
        };
    });
}

async function cacheGet(key) {
    try {
        const db = await openDb();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).get(key);
            req.onsuccess = () => {
                const entry = req.result;
                if (!entry) return resolve(null);
                if (Date.now() - entry.cachedAt > CACHE_TTL_MS) return resolve(null);
                resolve(entry.data);
            };
            req.onerror = () => resolve(null);
        });
    } catch {
        return null;
    }
}

async function cacheSet(key, data) {
    try {
        const db = await openDb();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put({ cacheKey: key, data, cachedAt: Date.now() });
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
        });
    } catch {
        return false;
    }
}

/** Cleanup entries cũ hơn CACHE_TTL_MS */
export async function cleanupMapMatchCache() {
    try {
        const db = await openDb();
        const cutoff = Date.now() - CACHE_TTL_MS;
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const idx = tx.objectStore(STORE_NAME).index('cachedAt');
            const req = idx.openCursor(IDBKeyRange.upperBound(cutoff));
            req.onsuccess = (ev) => {
                const cursor = ev.target.result;
                if (cursor) { cursor.delete(); cursor.continue(); }
                else resolve(true);
            };
            req.onerror = () => resolve(false);
        });
    } catch {
        return false;
    }
}

// ─── OSRM fetch một batch ────────────────────────────────
async function fetchOsrmBatch(points, retries = MAX_RETRIES) {
    // Build coord string: "lon,lat;lon,lat;..."
    const coordStr = points.map(p => `${p.lon},${p.lat}`).join(';');
    const radii = points.map(() => RADIUS_M).join(';');

    // Thêm timestamps nếu có (giúp OSRM match tốt hơn)
    const hasTime = points.some(p => p.__timeMs && Number.isFinite(p.__timeMs));
    let timeParam = '';
    if (hasTime) {
        const tFirst = points[0].__timeMs || Date.now();
        const timestamps = points.map((p, i) => {
            const t = (p.__timeMs && Number.isFinite(p.__timeMs)) ? p.__timeMs : tFirst + i * 12000;
            return Math.floor(t / 1000); // UNIX seconds
        }).join(';');
        timeParam = `&timestamps=${timestamps}`;
    }

    // gaps=ignore: bỏ qua đoạn GPS nhảy vọt (quan trọng cho xe bị mất signal)
    const url = `${OSRM_BASE}/${coordStr}?geometries=geojson&radiuses=${radii}&overview=full&steps=false&gaps=ignore${timeParam}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);

        if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new Error(`OSRM HTTP ${res.status}: ${body.substring(0, 100)}`);
        }
        const json = await res.json();

        if (!json.matchings || json.matchings.length === 0) return [];

        const coords = [];
        for (const m of json.matchings) {
            const geom = m.geometry?.coordinates;
            if (!Array.isArray(geom)) continue;
            for (const c of geom) {
                coords.push([c[1], c[0]]);
            }
        }
        return coords;
    } catch (err) {
        clearTimeout(timer);
        if (retries > 0 && err.name !== 'AbortError') {
            await new Promise(r => setTimeout(r, 800));
            return fetchOsrmBatch(points, retries - 1);
        }
        console.warn('[MapMatch] batch failed:', err.message);
        return null;
    }
}


// ─── Sample điểm đều ──────────────────────────────────────
/**
 * Xe khách đi 500km/ngày → có thể có 10,000+ điểm GPS.
 * Chọn tối đa `maxTotal` điểm để giữ độ chính xác mà không gọi quá nhiều batch.
 */
function samplePoints(points, maxTotal = 800) {
    if (points.length <= maxTotal) return points;
    const step = Math.ceil(points.length / maxTotal);
    const result = [];
    for (let i = 0; i < points.length; i += step) result.push(points[i]);
    // Luôn giữ điểm cuối
    const last = points[points.length - 1];
    if (result[result.length - 1] !== last) result.push(last);
    return result;
}

// ─── Hàm chính: mapMatchRoute ─────────────────────────────
/**
 * @param {Array<{lat:number, lon:number}>} rawPoints - điểm GPS thô
 * @param {object} options
 * @param {string} [options.cacheKey] - key để cache (e.g. "imei_start_end")
 * @param {number} [options.maxSample=800] - tổng số điểm tối đa sau sample
 * @param {function} [options.onProgress] - callback(pct: 0..100)
 * @returns {Promise<[number, number][]>} - mảng [lat, lon] đã snap lên đường
 */
export async function mapMatchRoute(rawPoints, options = {}) {
    const { cacheKey, maxSample = 800, onProgress } = options;

    // 1. Lọc điểm hợp lệ — dùng parseFloat để handle cả string lat/lon từ API
    const valid = rawPoints
        .map(p => {
            const lat = parseFloat(p.lat);
            const lon = parseFloat(p.lon);
            return (!isNaN(lat) && !isNaN(lon)) ? { ...p, lat, lon } : null;
        })
        .filter(Boolean);

    console.log(`[MapMatch] Input: ${rawPoints.length} pts, valid: ${valid.length} pts`);

    if (valid.length < 2) {
        console.warn('[MapMatch] không đủ điểm hợp lệ (<2)');
        return valid.map(p => [p.lat, p.lon]);
    }

    // 2. Kiểm tra cache
    if (cacheKey) {
        const cached = await cacheGet(cacheKey);
        if (cached && Array.isArray(cached) && cached.length > 0) {
            console.log('[MapMatch] ✅ cache hit:', cacheKey, '-', cached.length, 'pts');
            onProgress?.(100);
            return cached;
        }
    }

    // 3. Sample điểm
    const sampled = samplePoints(valid, maxSample);
    console.log(`[MapMatch] Sample: ${valid.length} → ${sampled.length} điểm, key: ${cacheKey}`);

    // 4. Chia batch với overlap
    const batches = [];
    for (let i = 0; i < sampled.length; i += BATCH_SIZE - OVERLAP) {
        const slice = sampled.slice(i, i + BATCH_SIZE);
        if (slice.length < 2) break;
        batches.push(slice);
        if (i + BATCH_SIZE >= sampled.length) break;
    }

    // 5. Fetch song song (tối đa 4 concurrent để không spam server)
    const CONCURRENT = 4;
    const results = new Array(batches.length).fill(null);

    console.log(`[MapMatch] Gọi OSRM: ${batches.length} batch, mỗi batch ~${BATCH_SIZE} pts`);

    for (let i = 0; i < batches.length; i += CONCURRENT) {
        const chunk = batches.slice(i, i + CONCURRENT);
        const fetched = await Promise.all(chunk.map(b => fetchOsrmBatch(b)));
        fetched.forEach((res, j) => {
            results[i + j] = res;
            console.log(`[MapMatch] Batch ${i+j+1}/${batches.length}: ${res === null ? '❌ lỗi' : res.length === 0 ? '⚠️ NoMatch' : '✅ ' + res.length + ' pts'}`);
        });
        const pct = Math.round(((i + CONCURRENT) / batches.length) * 90);
        onProgress?.(Math.min(pct, 90));
    }

    // 6. Kiểm tra nếu tất cả batch đều lỗi → fallback về đường thô
    const allFailed = results.every(r => r === null);
    if (allFailed) {
        console.warn('[MapMatch] all batches failed, fallback to raw latlngs');
        return valid.map(p => [p.lat, p.lon]);
    }

    // 7. Ghép kết quả (bỏ overlap khi nối batch)
    const merged = [];
    for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (!r || r.length === 0) {
            // batch lỗi → dùng điểm thô của batch đó
            const fallback = batches[i].map(p => [p.lat, p.lon]);
            merged.push(...(i === 0 ? fallback : fallback.slice(OVERLAP)));
            continue;
        }
        if (i === 0) {
            merged.push(...r);
        } else {
            // Bỏ ~5% điểm đầu batch để tránh nối bị gấp khúc
            merged.push(...r.slice(Math.max(1, Math.floor(r.length * 0.05))));
        }
    }

    onProgress?.(100);

    // 8. Cache kết quả
    if (cacheKey && merged.length > 0) {
        cacheSet(cacheKey, merged).catch(() => {});
        console.log(`[MapMatch] 💾 cached ${merged.length} pts → key: ${cacheKey}`);
    }

    return merged;
}

/** Xóa toàn bộ cache map matching (gọi từ console: window.clearMapMatchCache?.()) */
export async function clearAllMapMatchCache() {
    try {
        const db = await openDb();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).clear();
            tx.oncomplete = () => { console.log('[MapMatch] 🗑️ cleared all cache'); resolve(true); };
            tx.onerror = () => resolve(false);
        });
    } catch {
        return false;
    }
}

