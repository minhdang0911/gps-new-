// ==========================================
// 🗄️ CRUISE CACHE MANAGER - IndexedDB
// (Optimized: fresh cache with maxAge + parallel chunk load)
// ==========================================

class CruiseCacheManager {
    constructor() {
        this.dbName = 'IKY_CRUISE_CACHE';
        this.dbVersion = 1;
        this.storeName = 'cruise_routes';
        this.db = null;

        // Cache tồn tại tối đa 7 ngày (dùng cho cleanup / auto-expire)
        this.CACHE_DURATION = 7 * 24 * 60 * 60 * 1000;

        // Khoảng thời gian cache được coi là "fresh"
        // 60 * 10000 = 600,000ms = 10 phút — trong vòng 10 phút kể từ lúc cache thì lần load lại sẽ dùng cache
        this.MAX_CACHE_AGE_MS = 60 * 10000;
    }

    // Khởi tạo IndexedDB
    async init() {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                if (!db.objectStoreNames.contains(this.storeName)) {
                    const objectStore = db.createObjectStore(this.storeName, { keyPath: 'cacheKey' });

                    objectStore.createIndex('imei', 'imei', { unique: false });
                    objectStore.createIndex('startTime', 'startTime', { unique: false });
                    objectStore.createIndex('endTime', 'endTime', { unique: false });
                    objectStore.createIndex('cachedAt', 'cachedAt', { unique: false });
                }
            };
        });
    }

    // Tạo cache key cho một chunk
    createCacheKey(imei, start, end, page) {
        return `${imei}_${start}_${end}_p${page}`;
    }

    // Tạo cache key cho metadata (tổng quan về route)
    createMetadataKey(imei, start, end) {
        return `meta_${imei}_${start}_${end}`;
    }

    // Lưu một chunk dữ liệu
    async saveChunk(imei, start, end, page, data) {
        await this.init();

        const cacheKey = this.createCacheKey(imei, start, end, page);
        const cacheEntry = {
            cacheKey,
            imei,
            startTime: start,
            endTime: end,
            page,
            data,
            cachedAt: Date.now(),
            itemCount: Array.isArray(data) ? data.length : 0,
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.put(cacheEntry);

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    // Lấy một chunk từ cache
    async getChunk(imei, start, end, page) {
        await this.init();

        const cacheKey = this.createCacheKey(imei, start, end, page);

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.get(cacheKey);

            request.onsuccess = () => {
                const entry = request.result;

                if (!entry) {
                    resolve(null);
                    return;
                }

                // Check expiration theo CACHE_DURATION (cleanup logic)
                const age = Date.now() - entry.cachedAt;
                if (age > this.CACHE_DURATION) {
                    // Auto delete nếu quá cũ
                    this.deleteChunk(imei, start, end, page);
                    resolve(null);
                    return;
                }

                resolve(entry.data);
            };
            request.onerror = () => reject(request.error);
        });
    }

    // Lưu metadata (thông tin tổng quan)
    async saveMetadata(imei, start, end, totalPages, totalItems) {
        await this.init();

        const metaKey = this.createMetadataKey(imei, start, end);
        const metadata = {
            cacheKey: metaKey,
            imei,
            startTime: start,
            endTime: end,
            totalPages,
            totalItems,
            cachedAt: Date.now(),
            complete: true,
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.put(metadata);

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    // Lấy metadata
    async getMetadata(imei, start, end) {
        await this.init();

        const metaKey = this.createMetadataKey(imei, start, end);

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.get(metaKey);

            request.onsuccess = () => {
                const entry = request.result;

                if (!entry) {
                    resolve(null);
                    return;
                }

                const age = Date.now() - entry.cachedAt;
                if (age > this.CACHE_DURATION) {
                    resolve(null);
                    return;
                }

                resolve(entry);
            };
            request.onerror = () => reject(request.error);
        });
    }

    // Xóa một chunk
    async deleteChunk(imei, start, end, page) {
        await this.init();

        const cacheKey = this.createCacheKey(imei, start, end, page);

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.delete(cacheKey);

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    // Xóa toàn bộ cache của một route
    async deleteRoute(imei, start, end) {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);
            const index = objectStore.index('imei');
            const request = index.openCursor(IDBKeyRange.only(imei));

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const entry = cursor.value;
                    if (entry.startTime === start && entry.endTime === end) {
                        cursor.delete();
                    }
                    cursor.continue();
                } else {
                    resolve(true);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    // Dọn dẹp cache cũ (theo CACHE_DURATION)
    async cleanupOldCache() {
        await this.init();

        const cutoffTime = Date.now() - this.CACHE_DURATION;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);
            const index = objectStore.index('cachedAt');
            const request = index.openCursor(IDBKeyRange.upperBound(cutoffTime));

            let deletedCount = 0;
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    cursor.delete();
                    deletedCount++;
                    cursor.continue();
                } else {
                    resolve(deletedCount);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    // Kiểm tra metadata còn "fresh" không
    isMetadataFresh(metadata) {
        if (!metadata) return false;
        const age = Date.now() - metadata.cachedAt;
        return age < this.MAX_CACHE_AGE_MS;
    }

    // Kiểm tra xem một khoảng thời gian có được cache đầy đủ và còn fresh không
    async isCacheUsable(imei, start, end) {
        const metadata = await this.getMetadata(imei, start, end);
        if (!metadata || !metadata.complete) return false;
        if (!this.isMetadataFresh(metadata)) return false;

        // Kiểm tra tồn tại các chunk (nếu chunk nào expire theo CACHE_DURATION thì getChunk sẽ trả null)
        const promises = [];
        for (let page = 1; page <= metadata.totalPages; page++) {
            promises.push(this.getChunk(imei, start, end, page));
        }

        const chunks = await Promise.all(promises);
        if (chunks.some((c) => !c || !Array.isArray(c))) {
            return false;
        }

        return true;
    }

    // Lấy tất cả dữ liệu từ cache (song song)
    async getAllCachedData(imei, start, end) {
        const metadata = await this.getMetadata(imei, start, end);
        if (!metadata) return null;

        const promises = [];
        for (let page = 1; page <= metadata.totalPages; page++) {
            promises.push(this.getChunk(imei, start, end, page));
        }

        const chunks = await Promise.all(promises);

        if (chunks.some((c) => !c || !Array.isArray(c))) {
            return null; // Missing chunk, cache incomplete
        }

        // Giữ thứ tự theo page
        return chunks.flat();
    }

    // Lấy thống kê cache
    async getCacheStats() {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.getAll();

            request.onsuccess = () => {
                const entries = request.result;
                const totalEntries = entries.length;
                const totalSize = entries.reduce((sum, e) => sum + (e.itemCount || 0), 0);
                const oldestCache = entries.reduce((oldest, e) => {
                    return !oldest || e.cachedAt < oldest ? e.cachedAt : oldest;
                }, null);

                resolve({
                    totalEntries,
                    totalSize,
                    oldestCache: oldestCache ? new Date(oldestCache) : null,
                });
            };
            request.onerror = () => reject(request.error);
        });
    }

    // Xóa toàn bộ cache
    async clearAll() {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.clear();

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    // Smart Load: dùng cache nếu còn fresh, ngược lại fetch API và overwrite cache
    async smartLoadRoute(imei, start, end, fetchPageFn, limit = 1000) {
        // 1. Thử dùng cache nếu còn fresh
        try {
            const usable = await this.isCacheUsable(imei, start, end);
            if (usable) {
                console.log('✅ SmartLoad: using fresh cache');
                const cachedData = await this.getAllCachedData(imei, start, end);
                if (cachedData && cachedData.length) {
                    return {
                        data: cachedData,
                        source: 'cache',
                    };
                }
            }
        } catch (err) {
            console.warn('SmartLoad cache check error:', err);
        }

        // 2. Không dùng được cache → fetch từ API, lưu cache mới
        console.log('🌐 SmartLoad: fetching from API');
        let allData = [];
        let page = 1;
        let totalPages = 1;
        let totalItems = 0;

        while (page <= totalPages) {
            const response = await fetchPageFn(page, limit);
            const pageData = response?.data || [];
            const total = response?.total || 0;

            allData = allData.concat(pageData);

            // Cache chunk này
            await this.saveChunk(imei, start, end, page, pageData);

            // Tính lại totalPages theo total từ API
            totalItems = total;
            totalPages = total > 0 ? Math.ceil(total / limit) : page;

            if (pageData.length === 0 || page * limit >= total) break;
            page++;
        }

        // Lưu metadata với cachedAt = now
        await this.saveMetadata(imei, start, end, totalPages, totalItems || allData.length);

        return {
            data: allData,
            source: 'api',
        };
    }
}

// Export singleton instance
const cruiseCacheManager = new CruiseCacheManager();

export default cruiseCacheManager;
