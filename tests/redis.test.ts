import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Redis } from 'ioredis';
import { RedisStore } from '../lib/index.js';

describe('RedisStore', () => {
  const redis = new Redis();

  let store: RedisStore;

  beforeEach(() => {
    store = new RedisStore({
      redis,
    });
  });

  afterEach(async () => {
    await redis.del('test:0');
  });

  afterAll(async () => {
    await store.destroy();
  });

  describe('.generateUid()', () => {
    it('should generate unique IDs', () => {
      const uid1 = store.generateUid();
      const uid2 = store.generateUid();
      const uid3 = store.generateUid();
      expect(uid1 !== uid2 && uid1 !== uid3 && uid2 !== uid3);
    });
  });

  describe('.listAdd()', () => {
    it('should add entry to the list', async () => {
      await store.listAdd('test', 0, 'a');
      await store.listAdd('test', 0, 'a');
      await store.listAdd('test', 0, 'b');
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
      await store.listAdd('test', 0, 'a', 'label1');
      await store.listAdd('test', 0, 'b', 'label2');
      await store.listAdd('test', 0, 'c', 'label1');
      await store.listDelete('test', 0, 'label1');
      const result = await store.listQuery('test', 0, 1);
      expect(result).toEqual({
        entries: [
          [0, 'label2', 'b'],
        ],
        hasMore: false,
      });
    });
  });

  describe('.listQuery()', () => {
    it('should return entries', async () => {
      await store.listAdd('test', 0, 'a');
      await store.listAdd('test', 0, 'b');
      await store.listAdd('test', 0, 'c');
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
    it('should add one entry to the list', async () => {
      await store.setAdd('test', 0, 'a');
      await store.setAdd('test', 0, 'b');
      await store.setAdd('test', 0, 'c');
      const result = await store.setQuery('test', 0, 1);
      expect(result).toEqual({
        entries: [
          [0, '', 'c'],
        ],
        hasMore: false,
      });
    });
  });

  describe('.setQuery()', () => {
    it('should return entries', async () => {
      await store.setAdd('test', 0, 'a');
      await store.setAdd('test', 1, 'b');
      await store.setAdd('test', 2, 'c');
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

});