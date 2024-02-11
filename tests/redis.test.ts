import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import { Redis } from 'ioredis';
import { Measurements } from '@exotjs/measurements';
import { roundTime } from '@exotjs/measurements/helpers';
import { RedisStore } from '../lib/index.js';

describe('RedisStore', () => {
  let redis: Redis;
  let store: RedisStore;

  beforeAll(() => {
    redis = new Redis();

    store = new RedisStore({
      keyPrefix: 'storetest:',
      partitionSize: 3600000,
      redis,
    });
  });

  afterEach(async () => {
    await redis.del('storetest:test:0');
  });

  afterAll(async () => {
    await store.destroy();
    await redis.quit();
  });

  describe('.getPartitionKey()', () => {
    it('should return partition key with prefix', () => {
      const time = Date.now();
      const key = store.getPartitionKey('test', time);
      expect(key).toEqual(
        `${store.keyPrefix}test:${Math.floor(time / store.partitionSize) * store.partitionSize}`
      );
    });
  });

  describe('.generateEntryUid()', () => {
    it('should generate unique IDs', () => {
      const uid1 = store.generateEntryUid();
      const uid2 = store.generateEntryUid();
      const uid3 = store.generateEntryUid();
      expect(uid1 !== uid2 && uid1 !== uid3 && uid2 !== uid3);
    });
  });

  describe('.listAdd()', () => {
    it('should add entry to the list', async () => {
      await store.listAdd('test', 0, '', 'a');
      await store.listAdd('test', 0, '', 'a');
      await store.listAdd('test', 0, '', 'b');
      const result = await store.listQuery('test', 0, 1);
      expect(result).toEqual({
        entries: [
          [0, '', 'a'],
          [0, '', 'a'],
          [0, '', 'b'],
        ],
        hasMore: false,
      });
    });
  });

  describe('.listDelete()', () => {
    it('should delete a matching entries from the list', async () => {
      await store.listAdd('test', 0, 'label1', 'a');
      await store.listAdd('test', 0, 'label2', 'b');
      await store.listAdd('test', 0, 'label1', 'c');
      await store.listDelete('test', 0, 'label1');
      const result = await store.listQuery('test', 0, 1);
      expect(result).toEqual({
        entries: [[0, 'label2', 'b']],
        hasMore: false,
      });
    });
  });

  describe('.listQuery()', () => {
    it('should return entries', async () => {
      await store.listAdd('test', 0, '', 'a');
      await store.listAdd('test', 0, '', 'b');
      await store.listAdd('test', 0, '', 'c');
      const result = await store.listQuery('test', 0, 1);
      expect(result).toEqual({
        entries: [
          [0, '', 'a'],
          [0, '', 'b'],
          [0, '', 'c'],
        ],
        hasMore: false,
      });
    });
  });

  describe('.setAdd()', () => {
    it('should add one entry to the set', async () => {
      await store.setAdd('test', 0, '', 'a');
      await store.setAdd('test', 0, '', 'b');
      await store.setAdd('test', 0, '', 'c');
      const result = await store.setQuery('test', 0, 1);
      expect(result).toEqual({
        entries: [[0, '', 'c']],
        hasMore: false,
      });
    });
  });

  describe('.setDelete()', () => {
    it('should delete a matching entries from the list', async () => {
      await store.setAdd('test', 0, 'label1', 'a');
      await store.setAdd('test', 0, 'label2', 'b');
      await store.setDelete('test', 0, 'label1');
      const result = await store.setQuery('test', 0, 1);
      expect(result).toEqual({
        entries: [[0, 'label2', 'b']],
        hasMore: false,
      });
    });
  });

  describe('.setQuery()', () => {
    it('should return entries', async () => {
      await store.setAdd('test', 0, '', 'a');
      await store.setAdd('test', 1, '', 'b');
      await store.setAdd('test', 2, '', 'c');
      const result = await store.setQuery('test', 0, 2);
      expect(result).toEqual({
        entries: [
          [0, '', 'a'],
          [1, '', 'b'],
        ],
        hasMore: false,
      });
    });
  });

  describe('Clustering', () => {
    let store2: RedisStore;

    beforeAll(() => {
      store2 = new RedisStore({
        keyPrefix: store.keyPrefix,
        partitionSize: store.partitionSize,
        redis,
      });
    });

    afterAll(async () => {
      await store2.destroy();
    });

    it('should store the same value twice if set from a different instance', async () => {
      await store.setAdd('test', 0, '', 'a');
      await store2.setAdd('test', 0, '', 'a');
      const result = await store.setQuery('test', 0, 2);
      expect(result).toEqual({
        entries: [
          [0, '', 'a'],
          [0, '', 'a'],
        ],
        hasMore: false,
      });
    });

    describe('Measurements', () => {
      it('should merge entries', async () => {
        const now = Date.now();
        const m1 = new Measurements({
          measurements: [
            {
              key: 'test',
              type: 'aggregate',
              interval: 5000,
            },
          ],
          store,
        });
        const m2 = new Measurements({
          measurements: [
            {
              key: 'test',
              type: 'aggregate',
              interval: 5000,
            },
          ],
          store: store2,
        });
        m1.aggregate('test').push([1]);
        m2.aggregate('test').push([3]);
        const result = await m1.export({
          startTime: now - 5000,
          endTime: now,
        });
        expect(result[0].measurements).toEqual([
          [roundTime(now, 5000), '', [1, 3, 2, 4, 1, 3, 2]],
        ]);
      });
    });
  });
});
