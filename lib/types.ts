import type { Redis } from 'ioredis';

export interface RedisClient extends Redis {
  exot_set_add: (key: string, time: string, value: string, label: string, expire: string, entryId: string, nodeId: string) => Promise<any>;
}

export interface RedisStoreInit {
  defaultExpire?: number;
  keyPrefix?: string;
  partitionSize?: number;
  redis: Redis;
}
