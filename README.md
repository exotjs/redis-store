# Exot Redis Store

A Redis-backed persistent store designed for use with the [Exot Inspector](https://exot.dev).

## Data structure

In the Redis store, both data structures required by the Exot Inspector — sets and lists — are implemented using "sorted sets."

The store organizes data into partitions based on the entry timestamp (with the default partition size set to 1 hour). This approach facilitates fast lookups and efficient data expiration. Each partition is represented as a "sorted set" containing individual entries within its time boundary, with the entry timestamp serving as the "score."

## Usage

```ts
import { Inspector } from '@exotjs/inspector';
import { RedisStore } from '@exotjs/redist-store';
import { Redis } from 'ioredis';

const inspector = new Inspector({
  store: new RedisStore({
    redis: new Redis(),
  }),
});
```

## Supported redis clients

- `ioredis`

## Configuration

- `keyPrefix?: string`
- `partitionSize?: number`
- `redis: RedisClient`

### `redis: RedisClient`

Provide an instance of the RedisClient from `ioredis` package.

### `partitionSize: number`

Default: `3600000` (1 hour)

Adjust the size of partitions (in milliseconds). Use with caution, as changing the partition size will make existing data undiscoverable.

### `keyPrefix: string`

Default: `inspector:`

A prefix (string) added to all keys.

## License

MIT