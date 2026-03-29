import { describe, it, expect, beforeEach, vi } from 'vitest';
import paginationHelper, { PaginationHelper } from '../paginationHelper.js';

describe('PaginationHelper', () => {
  /** @type {PaginationHelper} */
  let helper;

  beforeEach(() => {
    helper = new PaginationHelper();
  });

  describe('paginate', () => {
    it('should return entries from the API function', async () => {
      const apiFn = vi.fn().mockResolvedValue({
        entries: [{ id: '1' }, { id: '2' }],
      });

      const result = await helper.paginate(apiFn);

      expect(result.entries).toEqual([{ id: '1' }, { id: '2' }]);
      expect(result.limit).toBe(50);
      expect(result.nextMarker).toBeUndefined();
    });

    it('should pass marker and limit to the API function (Req 39.1)', async () => {
      const apiFn = vi.fn().mockResolvedValue({ entries: [] });

      await helper.paginate(apiFn, { marker: 'abc123', limit: 25 });

      expect(apiFn).toHaveBeenCalledWith('abc123', 25);
    });

    it('should include nextMarker when API returns next_marker (Req 39.2)', async () => {
      const apiFn = vi.fn().mockResolvedValue({
        entries: [{ id: '1' }],
        next_marker: 'next-page-token',
      });

      const result = await helper.paginate(apiFn);

      expect(result.nextMarker).toBe('next-page-token');
    });

    it('should use default limit of 50 when not specified (Req 39.3)', async () => {
      const apiFn = vi.fn().mockResolvedValue({ entries: [] });

      const result = await helper.paginate(apiFn);

      expect(result.limit).toBe(50);
      expect(apiFn).toHaveBeenCalledWith(undefined, 50);
    });

    it('should clamp limit to maximum of 200 (Req 39.3)', async () => {
      const apiFn = vi.fn().mockResolvedValue({ entries: [] });

      const result = await helper.paginate(apiFn, { limit: 500 });

      expect(result.limit).toBe(200);
      expect(apiFn).toHaveBeenCalledWith(undefined, 200);
    });

    it('should clamp limit to minimum of 1', async () => {
      const apiFn = vi.fn().mockResolvedValue({ entries: [] });

      const result = await helper.paginate(apiFn, { limit: 0 });

      expect(result.limit).toBe(1);
      expect(apiFn).toHaveBeenCalledWith(undefined, 1);
    });

    it('should clamp negative limit to 1', async () => {
      const apiFn = vi.fn().mockResolvedValue({ entries: [] });

      const result = await helper.paginate(apiFn, { limit: -10 });

      expect(result.limit).toBe(1);
    });

    it('should return first page when no marker is provided (Req 39.5)', async () => {
      const apiFn = vi.fn().mockResolvedValue({
        entries: [{ id: 'first' }],
      });

      const result = await helper.paginate(apiFn);

      expect(apiFn).toHaveBeenCalledWith(undefined, 50);
      expect(result.entries).toEqual([{ id: 'first' }]);
    });

    it('should handle non-finite limit values by using default', async () => {
      const apiFn = vi.fn().mockResolvedValue({ entries: [] });

      const result = await helper.paginate(apiFn, { limit: NaN });

      expect(result.limit).toBe(50);
    });

    it('should handle API returning no entries array gracefully', async () => {
      const apiFn = vi.fn().mockResolvedValue({});

      const result = await helper.paginate(apiFn);

      expect(result.entries).toEqual([]);
    });

    it('should propagate API errors', async () => {
      const apiFn = vi.fn().mockRejectedValue(new Error('Box API error'));

      await expect(helper.paginate(apiFn)).rejects.toThrow('Box API error');
    });
  });

  describe('collectAll', () => {
    it('should collect entries from a single page', async () => {
      const apiFn = vi.fn().mockResolvedValue({
        entries: [{ id: '1' }, { id: '2' }],
      });

      const result = await helper.collectAll(apiFn);

      expect(result).toEqual([{ id: '1' }, { id: '2' }]);
      expect(apiFn).toHaveBeenCalledWith(undefined, 100);
    });

    it('should collect entries across multiple pages (Req 39.4)', async () => {
      const apiFn = vi.fn()
        .mockResolvedValueOnce({
          entries: [{ id: '1' }, { id: '2' }],
          next_marker: 'page2',
        })
        .mockResolvedValueOnce({
          entries: [{ id: '3' }, { id: '4' }],
          next_marker: 'page3',
        })
        .mockResolvedValueOnce({
          entries: [{ id: '5' }],
        });

      const result = await helper.collectAll(apiFn);

      expect(result).toEqual([
        { id: '1' }, { id: '2' },
        { id: '3' }, { id: '4' },
        { id: '5' },
      ]);
      expect(apiFn).toHaveBeenCalledTimes(3);
      expect(apiFn).toHaveBeenNthCalledWith(1, undefined, 100);
      expect(apiFn).toHaveBeenNthCalledWith(2, 'page2', 100);
      expect(apiFn).toHaveBeenNthCalledWith(3, 'page3', 100);
    });

    it('should use batch size of 100', async () => {
      const apiFn = vi.fn().mockResolvedValue({ entries: [] });

      await helper.collectAll(apiFn);

      expect(apiFn).toHaveBeenCalledWith(undefined, 100);
    });

    it('should return empty array when API returns no entries', async () => {
      const apiFn = vi.fn().mockResolvedValue({});

      const result = await helper.collectAll(apiFn);

      expect(result).toEqual([]);
    });

    it('should propagate API errors', async () => {
      const apiFn = vi.fn().mockRejectedValue(new Error('Box API error'));

      await expect(helper.collectAll(apiFn)).rejects.toThrow('Box API error');
    });

    it('should stop when next_marker is falsy', async () => {
      const apiFn = vi.fn()
        .mockResolvedValueOnce({
          entries: [{ id: '1' }],
          next_marker: 'page2',
        })
        .mockResolvedValueOnce({
          entries: [{ id: '2' }],
          next_marker: '',
        });

      const result = await helper.collectAll(apiFn);

      expect(result).toEqual([{ id: '1' }, { id: '2' }]);
      expect(apiFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('singleton export', () => {
    it('should export a default singleton instance', () => {
      expect(paginationHelper).toBeInstanceOf(PaginationHelper);
    });
  });
});
