import { Store, StoreEntry, StoreQueryResult } from '@exotjs/inspector-measurements/types';
import { RedisClient, RedisStoreInit } from './types';

export class RedisStore implements Store {
  readonly partitionSize: number;

  readonly keyPrefix: string;

  readonly redis?: RedisClient;

  constructor(init: RedisStoreInit) {
    const {
      keyPrefix = '',
      partitionSize = 3600000, // 1 hour
      redis,
    } = init;
    this.partitionSize = partitionSize;
    this.keyPrefix = keyPrefix;
    this.redis = redis;
  }

  getPartitionKey(key: string, time: number) {
    return this.keyPrefix + key + ':' + (Math.floor(time / this.partitionSize) * this.partitionSize);
  }

  getClient(): RedisClient {
    if (!this.redis) {
      throw new Error('Store destroyed.');
    }
    return this.redis;
  }

  async delete(key: string, time: number) {
    await this.getClient().zremrangebyscore((this.getPartitionKey(key, time), time, time)); 
  }

  async destroy(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
  }

  async get(
    key: string,
    time: number
  ): Promise<StoreEntry | undefined> {
    const result = await this.getClient().zrange(this.getPartitionKey(key, time), time, time, 'BYSCORE', 'LIMIT', 0, 1);
    if (result.length) {
      return JSON.parse(result[0]) as StoreEntry;
    }
    return void 0;
  }

  async push(key: string, entry: StoreEntry, expire: number = 0): Promise<void> {
    const time = entry[0];
    const pkey = this.getPartitionKey(key, time);
    let chain = this.getClient().multi().zadd(pkey, time, JSON.stringify(entry));
    if (expire) {
      chain = chain.expire(pkey, Math.floor(expire / 1000));
    }
    await chain.exec();
  }

  async set(
    key: string,
    entry: StoreEntry,
    expire: number = 0,
  ): Promise<void> {
    /*
    const time = entry[0];
    const pkey = this.getPartitionKey(key, time);
    let chain = this.getClient()
      .multi()
      .del(pkey)
      .zadd(pkey, time, JSON.stringify(entry));
    if (expire) {
      chain = chain.expire(pkey, Math.floor(expire / 1000));
    }
    await chain.exec();
    */
    await this.push(key, entry, expire);
  }

  async query(
    key: string,
    startTime: number,
    endTime: number,
    limit: number = 1000,
  ): Promise<StoreQueryResult> {
    const entries: any[] = [];
    endTime = endTime + this.partitionSize;
    for (let time = startTime; time <= endTime; time += this.partitionSize) {
      entries.push(...await this.getClient().zrange(this.getPartitionKey(key, time), startTime, '(' + endTime, 'BYSCORE', 'LIMIT', 0, limit + 1));
      if (entries.length >= limit) {
        break;
      }
    }
    return {
      entries: entries.slice(0, limit).map((entry) => JSON.parse(entry)),
      hasMore: entries.length > limit,
    };
  }

  async clear(key?: string): Promise<void> {
    // not implemented
  }
}
