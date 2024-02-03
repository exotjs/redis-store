# Exot Redis Store

This package contains Redis-backed persistant store for [Exot Inspector](https://exot.dev).


## How it works

The Exot Store supports two types of data structures: sets (maps), and lists (arrays). In the Redis Store, both structures are implemented using "sorted sets".

The store creates partitions of data based on the timestamp of the entry, where the default partition size is 1 hour (configurable via `partitionSize`) to accomodate both fast lookups and efficient data expiration. Each partition represents a "sorted set" containing individual entries winthing it's time boundary, where the timestamp of the entry is the "score".

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

## Supported clients

- `ioredis`

## Configuration

- `keyPrefix?: string`
- `partitionSize?: number`
- `redis: RedisClient`

### `redis: RedisClient`

Provide an instance of the RedisClient from `ioredis` package.

### `partitionSize: number`

Default: `3600000` (1 hour)

Adjust the size of partitions (in milliseconds). Use with caution, chaning the partition size will make exiting data undiscoverable.

### `keyPrefix: string`

A prefix (string) added to all keys. Example: `myprefix:`.

## License

MIT