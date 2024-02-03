import { randomBytes } from 'node:crypto';
import proc from 'node:process';
import { Store, StoreEntry, StoreQueryResult } from '@exotjs/measurements/types';
import { RedisClient, RedisStoreInit } from './types';

export class RedisStore implements Store {
  readonly nodeId: string = randomBytes(3).toString('hex');

  readonly keyPrefix: string;

  readonly partitionSize: number;

  readonly redis?: RedisClient;

  uidCounter: number = 1;

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

  generateUid() {
    this.uidCounter = (this.uidCounter + 1) % Number.MAX_SAFE_INTEGER;
    return this.nodeId + this.uidCounter.toString(16);
  }

  async clear(key?: string | undefined) {
    // noop
  }

  async destroy() {
    if (this.redis) {
      await this.redis.quit();
    }
  }

  async listDelete(key: string, time: number, label: string = '') {
    const pkey = this.getPartitionKey(key, time);
    const entries = await this.getClient().zrange(pkey, time, time, 'BYSCORE');
    const toRemove = entries.filter((entry) => {
      const json = JSON.parse(entry);
      return json[0] === label;
    });
    if (toRemove.length) {
      await this.getClient().zrem(pkey, ...toRemove);
    }
  }

  async listAdd<T>(key: string, time: number, value: T, label: string = '', expire?: number | undefined) {
    const pkey = this.getPartitionKey(key, time);
    let chain = this.getClient().multi().zadd(pkey, time, JSON.stringify([label, value, this.generateUid()]));
    if (expire) {
      chain = chain.expire(pkey, Math.floor(expire / 1000));
    }
    await chain.exec();
  }

  async listQuery(key: string, startTime: number, endTime: number, limit: number = 1000): Promise<StoreQueryResult> {
    const entries: [number, string][] = [];
    endTime = endTime + this.partitionSize;
    for (let time = startTime; time <= endTime; time += this.partitionSize) {
      const result = await this.getClient().zrange(this.getPartitionKey(key, time), startTime, '(' + endTime, 'BYSCORE', 'LIMIT', 0, limit + 1, 'WITHSCORES');
      for (let i = 0; i < result.length; i += 2) {
        entries.push([parseInt(result[i + 1], 10), result[i]]);
      }
      if (entries.length >= limit) {
        break;
      }
    }
    return {
      entries: entries.slice(0, limit).map(([ time, entry ]) => [time, ...JSON.parse(entry).slice(0, 2)] as StoreEntry),
      hasMore: entries.length > limit,
    };
  }

  async setAdd<T>(key: string, time: number, value: T, label: string = '', expire?: number | undefined): Promise<void> {
    const pkey = this.getPartitionKey(key, time);
    const client = this.getClient();
    const entries = await client.zrange(pkey, time, time, 'BYSCORE');
    const toRemove = entries.filter((entry) => {
      const json = JSON.parse(entry);
      return json[0] === time && json[1] === label;
    });
    const chain = client.multi();
    if (toRemove.length) {
      chain.zrem(pkey, ...toRemove);
    }
    chain.zadd(pkey, time, JSON.stringify([time, label, value]));
    if (expire) {
      chain.expire(pkey, Math.floor(expire / 1000));
    }
    await chain.exec();
  }

  async setDelete(key: string, time: number, label?: string | undefined): Promise<void> {
    await this.getClient().zremrangebyscore((this.getPartitionKey(key, time), time, time)); 
  }

  async setQuery(key: string, startTime: number, endTime: number, limit: number = 1000): Promise<StoreQueryResult> {
    const entries: any[] = [];
    const partitionEndTime = endTime + this.partitionSize;
    for (let time = startTime; time <= partitionEndTime; time += this.partitionSize) {
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
}
