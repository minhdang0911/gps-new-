// app/lib/server/mongodb.js

import { MongoClient } from 'mongodb';

const DEFAULT_DB_NAME = 'gps_address_cache';
const DEFAULT_COLLECTION_NAME = 'gps_address_cache';

const globalForMongo = globalThis;

export function isMongoConfigured() {
    const uri = (process.env.MONGODB_URI || '').trim();
    return Boolean(uri && !uri.includes('<db_password>'));
}

async function getMongoClient() {
    if (!isMongoConfigured()) return null;

    if (!globalForMongo._ikyMongoClientPromise) {
        const uri = process.env.MONGODB_URI.trim();
        const client = new MongoClient(uri, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 2500,
            connectTimeoutMS: 2500,
        });

        globalForMongo._ikyMongoClientPromise = client.connect().catch((err) => {
            console.error('[mongodb] Connection failed:', err?.message || err);
            globalForMongo._ikyMongoClientPromise = null;
            return null;
        });
    }

    return globalForMongo._ikyMongoClientPromise;
}

/**
 * Trả về collection lưu địa chỉ MongoDB và tự đảm bảo tạo index key + 2dsphere 1 lần.
 */
export async function getAddressCollection() {
    const client = await getMongoClient();
    if (!client) return null;

    const dbName = (process.env.MONGODB_DB_NAME || DEFAULT_DB_NAME).trim();
    const collectionName = (process.env.MONGODB_ADDRESS_COLLECTION || DEFAULT_COLLECTION_NAME).trim();
    const collection = client.db(dbName).collection(collectionName);

    if (!globalForMongo._ikyAddressIndexesPromise) {
        globalForMongo._ikyAddressIndexesPromise = Promise.all([
            collection.createIndex({ key: 1 }, { unique: true, background: true }),
            collection.createIndex({ lang: 1, location: '2dsphere' }, { background: true }),
        ]).catch((err) => {
            console.warn('[mongodb] Index setup warning:', err?.message || err);
            globalForMongo._ikyAddressIndexesPromise = null;
        });
    }

    await globalForMongo._ikyAddressIndexesPromise;
    return collection;
}

