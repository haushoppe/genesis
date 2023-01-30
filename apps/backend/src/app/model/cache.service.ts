import { Injectable } from '@nestjs/common';
import NodeCache = require('node-cache');


@Injectable()
export class CacheService {

  private cache = new NodeCache();

  /**
   * Check if a key is cached
   * @param key Cache key to check
   * @returns Boolean indicating if the key is cached or not
   */
  has( key: string): boolean {
    return this.cache.has(key)
  }

  /**
   * Set a cached key. Returns the cached element
   *
   * @param key Cache key
   * @param value A element to cache.
   * @param ttl The time to live in seconds (optional)
   */
  set<T>(key: string, value: T, ttl?: number): T {
    this.cache.set(key, value, ttl);
    return value;
  }

  /**
   * Get a cached key
   *
   * @param key Cache key
   * @returns The value stored in the key
   */
  get<T>(key: string): T {
    return this.cache.get(key)
  }
}
