export interface RedisClient {
  del(...args: any[]): Promise<number>;
  expire(...args: any[]): Promise<number>;
  multi(): RedisChainableCommands;
  quit(): Promise<any>;
  zadd(...args: any[]): Promise<string>;
  zrange(...args: any[]): Promise<string[]>;
  zrem(...args: any[]): Promise<number>;
  zremrangebyscore(...args: any[]): Promise<number>;

  lrange(...args: any[]): Promise<string[]>;
}

export interface RedisChainableCommands {
  del(...args: any[]): RedisChainableCommands;
  exec(): Promise<any>;
  expire(...args: any[]): RedisChainableCommands;
  zadd(...args: any[]): RedisChainableCommands;
  zrange(...args: any[]): RedisChainableCommands;
  zrem(...args: any[]): RedisChainableCommands;
  zremrangebyscore(...args: any[]): RedisChainableCommands;

  sadd(...args: any[]): RedisChainableCommands;

  lpush(...args: any[]): RedisChainableCommands;
  lrange(...args: any[]): RedisChainableCommands;
}

export interface RedisStoreInit {
  keyPrefix?: string;
  partitionSize?: number;
  redis: RedisClient;
}
