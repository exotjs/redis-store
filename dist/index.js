export class RedisStore {
    partitionSize;
    keyPrefix;
    redis;
    constructor(init) {
        const { keyPrefix = '', partitionSize = 3600000, // 1 hour
        redis, } = init;
        this.partitionSize = partitionSize;
        this.keyPrefix = keyPrefix;
        this.redis = redis;
    }
    getPartitionKey(key, time) {
        return this.keyPrefix + key + ':' + (Math.floor(time / this.partitionSize) * this.partitionSize);
    }
    getClient() {
        if (!this.redis) {
            throw new Error('Store destroyed.');
        }
        return this.redis;
    }
    async delete(key, time) {
        await this.getClient().zremrangebyscore((this.getPartitionKey(key, time), time, time));
    }
    async destroy() {
        if (this.redis) {
            await this.redis.quit();
        }
    }
    async get(key, time) {
        const result = await this.getClient().zrange(this.getPartitionKey(key, time), time, time, 'BYSCORE', 'LIMIT', 0, 1);
        if (result.length) {
            return JSON.parse(result[0]);
        }
        return void 0;
    }
    async push(key, entry, expire = 0) {
        const time = entry[0];
        const pkey = this.getPartitionKey(key, time);
        let chain = this.getClient().multi().zadd(pkey, time, JSON.stringify(entry));
        if (expire) {
            chain = chain.expire(pkey, Math.floor(expire / 1000));
        }
        await chain.exec();
    }
    async set(key, entry, expire = 0) {
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
    async query(key, startTime, endTime, limit = 1000) {
        const entries = [];
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
    async clear(key) {
        // not implemented
    }
}
