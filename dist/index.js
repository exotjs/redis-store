import { randomBytes } from 'node:crypto';
export class RedisStore {
    nodeId = randomBytes(3).toString('hex');
    keyPrefix;
    partitionSize;
    redis;
    uidCounter = 1;
    constructor(init) {
        const { keyPrefix = '', partitionSize = 3600000, // 1 hour
        redis, } = init;
        this.partitionSize = partitionSize;
        this.keyPrefix = keyPrefix;
        this.redis = redis;
    }
    async #delete(key, time, label = '') {
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
    async #query(key, startTime, endTime, limit = 1000) {
        const entries = [];
        const partitionEndTime = endTime + this.partitionSize;
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
            entries: entries.slice(0, limit).reduce((acc, [time, entry]) => {
                const json = this.#parseJSON(entry);
                if (json) {
                    acc.push([time, ...json.slice(0, 2)]);
                }
                return acc;
            }, []),
            hasMore: entries.length > limit,
        };
    }
    #parseJSON(str) {
        try {
            return JSON.parse(str);
        }
        catch (err) {
            return null;
        }
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
    generateEntryUid() {
        this.uidCounter = (this.uidCounter + 1) % Number.MAX_SAFE_INTEGER;
        return this.nodeId + this.uidCounter.toString(16);
    }
    async clear(key) {
        // noop
    }
    async destroy() {
        if (this.redis) {
            //await this.redis.quit();
        }
    }
    async listDelete(key, time, label) {
        return this.#delete(key, time, label);
    }
    async listAdd(key, time, value, label = '', expire) {
        const pkey = this.getPartitionKey(key, time);
        let chain = this.getClient().multi().zadd(pkey, time, JSON.stringify([label, value, this.generateEntryUid()]));
        if (expire) {
            chain = chain.expire(pkey, Math.floor(expire / 1000));
        }
        await chain.exec();
    }
    async listQuery(key, startTime, endTime, limit) {
        return this.#query(key, startTime, endTime, limit);
    }
    async setAdd(key, time, value, label = '', expire) {
        const pkey = this.getPartitionKey(key, time);
        const client = this.getClient();
        const entries = await client.zrange(pkey, time, time, 'BYSCORE');
        const remove = entries.filter((entry) => {
            return this.#parseJSON(entry)?.[0] === label;
        });
        const chain = client.multi();
        if (remove.length) {
            chain.zrem(pkey, ...remove);
        }
        chain.zadd(pkey, time, JSON.stringify([label, value]));
        if (expire) {
            chain.expire(pkey, Math.floor(expire / 1000));
        }
        await chain.exec();
    }
    async setDelete(key, time, label) {
        return this.#delete(key, time, label);
    }
    async setQuery(key, startTime, endTime, limit) {
        return this.#query(key, startTime, endTime, limit);
    }
}
