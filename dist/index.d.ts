import { Store, StoreEntry, StoreQueryResult } from '@exotjs/inspector-measurements/types';
import { RedisClient, RedisStoreInit } from './types';
export declare class RedisStore implements Store {
    readonly partitionSize: number;
    readonly keyPrefix: string;
    readonly redis?: RedisClient;
    constructor(init: RedisStoreInit);
    getPartitionKey(key: string, time: number): string;
    getClient(): RedisClient;
    delete(key: string, time: number): Promise<void>;
    destroy(): Promise<void>;
    get(key: string, time: number): Promise<StoreEntry | undefined>;
    push(key: string, entry: StoreEntry, expire?: number): Promise<void>;
    set(key: string, entry: StoreEntry, expire?: number): Promise<void>;
    query(key: string, startTime: number, endTime: number, limit?: number): Promise<StoreQueryResult>;
    clear(key?: string): Promise<void>;
}
