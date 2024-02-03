import { Store, StoreQueryResult } from '@exotjs/measurements/types';
import { RedisClient, RedisStoreInit } from './types';
export declare class RedisStore implements Store {
    #private;
    readonly nodeId: string;
    readonly keyPrefix: string;
    readonly partitionSize: number;
    readonly redis?: RedisClient;
    uidCounter: number;
    constructor(init: RedisStoreInit);
    getPartitionKey(key: string, time: number): string;
    getClient(): RedisClient;
    generateEntryUid(): string;
    clear(key?: string | undefined): Promise<void>;
    destroy(): Promise<void>;
    listDelete(key: string, time: number, label?: string): Promise<void>;
    listAdd<T>(key: string, time: number, value: T, label?: string, expire?: number | undefined): Promise<void>;
    listQuery(key: string, startTime: number, endTime: number, limit?: number): Promise<StoreQueryResult>;
    setAdd<T>(key: string, time: number, value: T, label?: string, expire?: number | undefined): Promise<void>;
    setDelete(key: string, time: number, label?: string | undefined): Promise<void>;
    setQuery(key: string, startTime: number, endTime: number, limit?: number): Promise<StoreQueryResult>;
}
