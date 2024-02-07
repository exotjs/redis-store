import { randomBytes } from 'node:crypto';
import { RedisClient, RedisStoreInit } from './types';
import type { Store, StoreEntry, StoreQueryResult } from '@exotjs/measurements/types';
import type { Redis } from 'ioredis';

const QUERY_MAX_ITERATIONS = 1000;

export class RedisStore implements Store {
  readonly defaultExpire?: number;

  readonly nodeId: string = randomBytes(3).toString('hex');

  readonly keyPrefix: string;

  readonly partitionSize: number;

  readonly redis?: Redis;

  uidCounter: number = 1;

  constructor(init: RedisStoreInit) {
    const {
      defaultExpire,
      keyPrefix = 'inspector:',
      partitionSize = 3600000, // 1 hour
      redis,
    } = init;
    this.defaultExpire = defaultExpire;
    this.partitionSize = partitionSize;
    this.keyPrefix = keyPrefix;
    this.redis = redis;
    this.#setup();
  }

  #setup() {
    this.getClient().defineCommand('exot_set_add', {
      numberOfKeys: 1,
      lua: `
      local key = KEYS[1]
      local time = ARGV[1]
      local value = cjson.decode(ARGV[2])
      local label = ARGV[3]
      local expire = tonumber(ARGV[4])
      local entryid = ARGV[5]
      local nodeid = ARGV[6]
      
      local entries = redis.call('ZRANGEBYSCORE', key, time, time, 'WITHSCORES')
      local remove = {}
      
      for i = 1, #entries, 2 do
          local entry = cjson.decode(entries[i])
          if entry[1] == label and string.sub(entry[3], 1, #nodeid) == nodeid then
              table.insert(remove, entries[i])
              table.insert(remove, entries[i + 1])
          end
      end
      
      if #remove > 0 then
          redis.call('ZREM', key, unpack(remove))
      end
      
      redis.call('ZADD', key, time, cjson.encode({label, value, entryid}))
      
      if expire then
          redis.call('EXPIRE', key, expire)
      end
      `,
    })
  }

  async #delete(key: string, time: number, label: string = '') {
    const client = this.getClient();
    const pkey = this.getPartitionKey(key, time);
    const entries = await client.zrange(pkey, time, time, 'BYSCORE');
    const remove = entries.filter((entry) => {
      return this.#parseJSON(entry)?.[0] === label;
    });
    if (remove.length) {
      await client.zrem(pkey, ...remove);
    }
  }

  async #query(key: string, startTime: number, endTime: number, limit: number = 1000): Promise<StoreQueryResult> {
    const entries: [number, string][] = [];
    const partitionEndTime = endTime + this.partitionSize;
    const iterations = Math.ceil((partitionEndTime - startTime) / this.partitionSize);
    if (iterations > QUERY_MAX_ITERATIONS) {
      throw new Error('Time span is too large.');
    }
    for (let time = startTime; time <= partitionEndTime; time += this.partitionSize) {
      const result = await this.getClient().zrange(this.getPartitionKey(key, time), startTime, '(' + endTime, 'BYSCORE', 'LIMIT', 0, limit + 1, 'WITHSCORES');
      for (let i = 0; i < result.length; i += 2) {
        entries.push([parseInt(result[i + 1], 10), result[i]]);
      }
      if (entries.length >= limit) {
        break;
      }
    }
    return {
      entries: entries.slice(0, limit).reduce((acc, [ time, entry ]) => {
        const json = this.#parseJSON(entry);
        if (json) {
          acc.push([time, ...json.slice(0, 2)] as StoreEntry);
        }
        return acc;
      }, [] as StoreEntry[]),
      hasMore: entries.length > limit,
    };
  }

  #parseJSON(str: string) {
    try {
      return JSON.parse(str);
    } catch (err) {
      return null;
    }
  }

  getPartitionKey(key: string, time: number) {
    return this.keyPrefix + key + ':' + (Math.floor(time / this.partitionSize) * this.partitionSize);
  }

  getClient(): RedisClient {
    if (!this.redis) {
      throw new Error('Store destroyed.');
    }
    return this.redis as RedisClient;
  }

  generateEntryUid() {
    this.uidCounter = (this.uidCounter + 1) % Number.MAX_SAFE_INTEGER;
    return this.nodeId + this.uidCounter.toString(16);
  }

  async clear(key?: string | undefined) {
    // noop
  }

  async destroy() {
    // noop
  }

  async listDelete(key: string, time: number, label?: string) {
    return this.#delete(key, time, label);
  }

  async listAdd<T>(key: string, time: number, value: T, label: string = '', expire: number | undefined = this.defaultExpire) {
    const pkey = this.getPartitionKey(key, time);
    let chain = this.getClient().multi().zadd(pkey, time, JSON.stringify([label, value, this.generateEntryUid()]));
    if (expire) {
      chain = chain.expire(pkey, Math.floor(expire / 1000));
    }
    await chain.exec();
  }

  async listQuery(key: string, startTime: number, endTime: number, limit?: number): Promise<StoreQueryResult> {
    return this.#query(key, startTime, endTime, limit);
  }

  async setAdd<T>(key: string, time: number, value: T, label: string = '', expire: number | undefined = this.defaultExpire): Promise<void> {
    await this.getClient().exot_set_add(this.getPartitionKey(key, time), String(time), JSON.stringify(value), label, expire ? String(expire) : 'nil', this.generateEntryUid(), this.nodeId);
  }

  async setDelete(key: string, time: number, label?: string | undefined): Promise<void> {
    return this.#delete(key, time, label);
  }

  async setQuery(key: string, startTime: number, endTime: number, limit?: number): Promise<StoreQueryResult> {
    return this.#query(key, startTime, endTime, limit);
  }

}
