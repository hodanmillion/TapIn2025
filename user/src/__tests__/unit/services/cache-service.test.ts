import { CacheService } from '../../../services/cache-service';

describe('CacheService', () => {
  let cacheService: CacheService;
  let mockRedisClient: any;

  beforeEach(() => {
    mockRedisClient = {
      get: jest.fn(),
      set: jest.fn(),
      setEx: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
    };
    cacheService = new CacheService(mockRedisClient);
  });

  describe('get', () => {
    it('should return parsed value when key exists', async () => {
      const testData = { foo: 'bar' };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(testData));

      const result = await cacheService.get('test-key');

      expect(mockRedisClient.get).toHaveBeenCalledWith('test-key');
      expect(result).toEqual(testData);
    });

    it('should return null when key does not exist', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await cacheService.get('non-existent-key');

      expect(result).toBeNull();
    });

    it('should return null and log warning on error', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      mockRedisClient.get.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.get('error-key');

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Cache get failed:', 'Redis error');
      consoleSpy.mockRestore();
    });
  });

  describe('set', () => {
    it('should set value without TTL', async () => {
      const testData = { foo: 'bar' };

      await cacheService.set('test-key', testData);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify(testData)
      );
    });

    it('should set value with TTL', async () => {
      const testData = { foo: 'bar' };
      const ttl = 3600;

      await cacheService.set('test-key', testData, ttl);

      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'test-key',
        ttl,
        JSON.stringify(testData)
      );
    });

    it('should log warning on error', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      mockRedisClient.set.mockRejectedValue(new Error('Redis error'));

      await cacheService.set('error-key', { data: 'test' });

      expect(consoleSpy).toHaveBeenCalledWith('Cache set failed:', 'Redis error');
      consoleSpy.mockRestore();
    });
  });

  describe('delete', () => {
    it('should delete key', async () => {
      await cacheService.delete('test-key');

      expect(mockRedisClient.del).toHaveBeenCalledWith('test-key');
    });

    it('should log warning on error', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      mockRedisClient.del.mockRejectedValue(new Error('Redis error'));

      await cacheService.delete('error-key');

      expect(consoleSpy).toHaveBeenCalledWith('Cache delete failed:', 'Redis error');
      consoleSpy.mockRestore();
    });
  });

  describe('invalidatePattern', () => {
    it('should delete all keys matching pattern', async () => {
      const matchingKeys = ['user:1', 'user:2', 'user:3'];
      mockRedisClient.keys.mockResolvedValue(matchingKeys);

      await cacheService.invalidatePattern('user:*');

      expect(mockRedisClient.keys).toHaveBeenCalledWith('user:*');
      expect(mockRedisClient.del).toHaveBeenCalledWith(matchingKeys);
    });

    it('should not call del when no keys match', async () => {
      mockRedisClient.keys.mockResolvedValue([]);

      await cacheService.invalidatePattern('nonexistent:*');

      expect(mockRedisClient.keys).toHaveBeenCalledWith('nonexistent:*');
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });

    it('should log warning on error', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      mockRedisClient.keys.mockRejectedValue(new Error('Redis error'));

      await cacheService.invalidatePattern('error:*');

      expect(consoleSpy).toHaveBeenCalledWith(
        'Cache invalidate pattern failed:',
        'Redis error'
      );
      consoleSpy.mockRestore();
    });
  });
});