import { SystemClock } from '../src/common/clock';
import { SystemRandom } from '../src/common/random';
import { formatDateTime } from '../src/common/format';
import { IsDisabled, RatingLikeDislike, RangoDeveloper, MEDIA_TYPES, MediaTypeEnum } from '../src/common/enums';
import { KeyNormalizePipe } from '../src/common/http/key-normalize.pipe';
import { ParseIdPipe } from '../src/common/http/parse-id.pipe';
import { PlainText, HtmlContent } from '../src/common/http/plain-text.decorator';
import { StoreExceptionFilter } from '../src/common/http/store-exception.filter';
import { AllExceptionsFilter } from '../src/common/http/all-exceptions.filter';
import { DuplicateKeyError, ForeignKeyError, UnknownTableOrColumnError } from '../src/store/data-store';
import { PageQueryDto } from '../src/common/pagination/page-query.dto';
import { PageResult } from '../src/common/pagination/page-result';
import { paginate } from '../src/common/pagination/paginate';
import { UrlBuilder } from '../src/common/pagination/url-builder';
import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

describe('Common module unit tests', () => {
  describe('SystemClock', () => {
    it('returns current date', () => {
      const clock = new SystemClock();
      const before = Date.now();
      const now = clock.now();
      const after = Date.now();
      expect(now).toBeInstanceOf(Date);
      expect(now.getTime()).toBeGreaterThanOrEqual(before);
      expect(now.getTime()).toBeLessThanOrEqual(after);
    });
  });

  describe('SystemRandom', () => {
    const random = new SystemRandom();

    it('generates random bytes of given length', () => {
      const bytes = random.nextBytes(16);
      expect(bytes).toBeInstanceOf(Buffer);
      expect(bytes.length).toBe(16);
    });

    it('generates integer within range', () => {
      for (let i = 0; i < 20; i++) {
        const val = random.nextInt(5, 15);
        expect(val).toBeGreaterThanOrEqual(5);
        expect(val).toBeLessThan(15);
      }
    });

    it('generates float between 0 and 1', () => {
      const val = random.next();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    });

    it('generates valid UUID v4', () => {
      const uuid = random.nextUuid();
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });
  });

  describe('formatDateTime', () => {
    it('formats date to ISO string without Z', () => {
      const date = new Date('2026-10-10T12:30:45.000Z');
      expect(formatDateTime(date)).toBe('2026-10-10T12:30:45.000');
    });
  });

  describe('Enums', () => {
    it('has expected enum values', () => {
      expect(IsDisabled.Active).toBe(0);
      expect(IsDisabled.Disabled).toBe(1);

      expect(RatingLikeDislike.Dislike).toBe(0);
      expect(RatingLikeDislike.Like).toBe(1);
      expect(RatingLikeDislike.Neutral).toBe(2);

      expect(RangoDeveloper.Owner).toBe(0);
      expect(RangoDeveloper.Admin).toBe(1);
      expect(RangoDeveloper.Member).toBe(2);

      expect(MEDIA_TYPES.Featured).toBe(2);
      expect(MEDIA_TYPES.Screenshot).toBe(5);

      expect(MediaTypeEnum.Featured).toBe(2);
      expect(MediaTypeEnum.Screenshot).toBe(5);
    });
  });

  describe('KeyNormalizePipe', () => {
    const pipe = new KeyNormalizePipe();

    it('returns primitive and non-object values unchanged', () => {
      expect(pipe.transform('hello', { type: 'body' })).toBe('hello');
      expect(pipe.transform(123, { type: 'body' })).toBe(123);
      expect(pipe.transform(null, { type: 'body' })).toBeNull();
      expect(pipe.transform(undefined, { type: 'body' })).toBeUndefined();
    });

    it('ignores arguments that are not body or query', () => {
      const obj = { NameGame: 'Halo' };
      expect(pipe.transform(obj, { type: 'param' })).toBe(obj);
      expect(pipe.transform(obj, { type: 'custom' })).toBe(obj);
    });

    it('ignores array and Date values', () => {
      const arr = [1, 2, 3];
      const d = new Date();
      expect(pipe.transform(arr, { type: 'body' })).toBe(arr);
      expect(pipe.transform(d, { type: 'body' })).toBe(d);
    });

    it('normalizes PascalCase keys to camelCase and preserves original keys', () => {
      const input = {
        NameGame: 'Halo',
        Price: 59.99,
        alreadyCamel: 'val',
      };
      const result = pipe.transform(input, { type: 'body' }) as Record<string, unknown>;
      expect(result.nameGame).toBe('Halo');
      expect(result.NameGame).toBe('Halo');
      expect(result.price).toBe(59.99);
      expect(result.Price).toBe(59.99);
      expect(result.alreadyCamel).toBe('val');
    });

    it('handles empty key edge case', () => {
      const input = { '': 'empty' };
      const result = pipe.transform(input, { type: 'body' }) as Record<string, unknown>;
      expect(result['']).toBe('empty');
    });
  });

  describe('ParseIdPipe', () => {
    const pipe = new ParseIdPipe();

    it('transforms valid positive integer string or number', () => {
      expect(pipe.transform('123')).toBe(123);
      expect(pipe.transform(456)).toBe(456);
      expect(pipe.transform('0')).toBe(0);
    });

    it('throws BadRequestException for invalid values', () => {
      expect(() => pipe.transform('abc')).toThrow(BadRequestException);
      expect(() => pipe.transform('-1')).toThrow(BadRequestException);
      expect(() => pipe.transform('12.34')).toThrow(BadRequestException);
      expect(() => pipe.transform(NaN)).toThrow(BadRequestException);
    });
  });

  describe('PlainText and HtmlContent decorators', () => {
    it('can be invoked without errors', () => {
      class TestClass {
        @PlainText()
        plainMethod() {}

        @HtmlContent()
        htmlMethod() {}
      }
      expect(new TestClass()).toBeDefined();
    });
  });

  describe('AllExceptionsFilter & StoreExceptionFilter', () => {
    const filter = new AllExceptionsFilter();
    let errorSpy: jest.SpyInstance;
    const originalEnv = { ...process.env };

    beforeEach(() => {
      errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      errorSpy.mockRestore();
      process.env = { ...originalEnv };
    });

    function mockHost() {
      const json = jest.fn();
      const status = jest.fn().mockReturnValue({ json });
      const response = { status, json } as unknown as Response;
      const host = {
        switchToHttp: () => ({
          getResponse: () => response,
        }),
      };
      return { host: host as any, status, json };
    }

    it('maps DuplicateKeyError to 409 Conflict', () => {
      const { host, status, json } = mockHost();
      filter.catch(new DuplicateKeyError('Duplicate entry'), host);
      expect(status).toHaveBeenCalledWith(409);
      expect(json).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 409,
        error: 'Conflict',
        message: 'Duplicate entry',
      }));
    });

    it('maps ForeignKeyError to 400 Bad Request', () => {
      const { host, status, json } = mockHost();
      filter.catch(new ForeignKeyError('FK violation'), host);
      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 400,
        error: 'Bad Request',
        message: 'FK violation',
      }));
    });

    it('maps UnknownTableOrColumnError to 400 Bad Request', () => {
      const { host, status, json } = mockHost();
      filter.catch(new UnknownTableOrColumnError('Unknown col'), host);
      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Unknown col',
      }));
    });

    it('preserves status and response for HttpException with object response', () => {
      const { host, status, json } = mockHost();
      const httpException = new HttpException(
        { statusCode: 404, message: 'Game not found', error: 'Not Found' },
        HttpStatus.NOT_FOUND,
      );
      filter.catch(httpException, host);
      expect(status).toHaveBeenCalledWith(404);
      expect(json).toHaveBeenCalledWith({
        statusCode: 404,
        message: 'Game not found',
        error: 'Not Found',
      });
    });

    it('preserves status and wraps response for HttpException with string response', () => {
      const { host, status, json } = mockHost();
      const httpException = new HttpException('Forbidden resource', HttpStatus.FORBIDDEN);
      filter.catch(httpException, host);
      expect(status).toHaveBeenCalledWith(403);
      expect(json).toHaveBeenCalledWith({
        statusCode: 403,
        message: 'Forbidden resource',
      });
    });

    it('maps generic unhandled error to 500 Internal Server Error', () => {
      const { host, status, json } = mockHost();
      filter.catch(new Error('Unexpected crash'), host);
      expect(status).toHaveBeenCalledWith(500);
      expect(json).toHaveBeenCalledWith({
        statusCode: 500,
        message: 'Unexpected crash',
      });
    });

    it('maps non-Error exception object to 500 with extracted message or fallback', () => {
      const { host, status, json } = mockHost();
      filter.catch({ message: 'Custom failure object' }, host);
      expect(status).toHaveBeenCalledWith(500);
      expect(json).toHaveBeenCalledWith({
        statusCode: 500,
        message: 'Custom failure object',
      });

      const { host: host2, status: status2, json: json2 } = mockHost();
      filter.catch('string error', host2);
      expect(status2).toHaveBeenCalledWith(500);
      expect(json2).toHaveBeenCalledWith({
        statusCode: 500,
        message: 'Internal server error',
      });
    });

    it('prints full trace with console.error when DEBUG is "true"', () => {
      process.env.DEBUG = 'true';
      process.env.NODE_ENV = 'production';

      const { host } = mockHost();
      const err = new Error('Debug error');
      filter.catch(err, host);

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(err);
    });

    it('prints full trace with console.error when NODE_ENV is "development"', () => {
      process.env.DEBUG = 'false';
      process.env.NODE_ENV = 'development';

      const { host } = mockHost();
      const err = new Error('Dev error');
      filter.catch(err, host);

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(err);
    });

    it('suppresses console.error when in production and DEBUG is false or undefined', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.DEBUG;

      const { host } = mockHost();
      filter.catch(new Error('Production silent crash'), host);
      expect(errorSpy).not.toHaveBeenCalled();

      process.env.DEBUG = 'false';
      filter.catch(new Error('Production silent crash 2'), host);
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('StoreExceptionFilter alias instantiates and behaves identically', () => {
      const legacyFilter = new StoreExceptionFilter();
      const { host, status, json } = mockHost();
      legacyFilter.catch(new DuplicateKeyError('Duplicate entry'), host);
      expect(status).toHaveBeenCalledWith(409);
      expect(json).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 409,
        message: 'Duplicate entry',
      }));
    });
  });

  describe('Pagination & UrlBuilder', () => {
    it('creates default PageQueryDto', () => {
      const dto = new PageQueryDto();
      expect(dto.page).toBe(1);
      expect(dto.pageSize).toBe(12);
      expect(dto.ascending).toBe(true);
    });

    it('creates PageResult and exports toJSON with clean camelCase keys', () => {
      const pr = new PageResult({
        pageNumber: 2,
        pageSize: 5,
        totalNumberOfPages: 4,
        totalNumberOfRecords: 20,
        results: ['a', 'b', 'c'],
        nextPageUrl: 'http://test?page=3',
        previousPageUrl: 'http://test?page=1',
      });

      const json = pr.toJSON();
      expect(json.pageNumber).toBe(2);
      expect((json as any).PageNumber).toBeUndefined();
      expect(json.pageSize).toBe(5);
      expect((json as any).PageSize).toBeUndefined();
      expect(json.totalNumberOfPages).toBe(4);
      expect((json as any).TotalNumberOfPages).toBeUndefined();
      expect(json.totalNumberOfRecords).toBe(20);
      expect((json as any).TotalNumberOfRecords).toBeUndefined();
      expect(json.results).toEqual(['a', 'b', 'c']);
      expect((json as any).Results).toBeUndefined();
      expect(json.nextPageUrl).toBe('http://test?page=3');
      expect(json.previousPageUrl).toBe('http://test?page=1');
    });

    it('paginate computes next/previous links when in middle page', async () => {
      const countFn = jest.fn().mockResolvedValue(50);
      const itemsFn = jest.fn().mockResolvedValue([1, 2, 3, 4, 5]);

      const result = await paginate(countFn, itemsFn, { page: 3, pageSize: 5 }, 'http://api.com/items');

      expect(result.pageNumber).toBe(3);
      expect(result.totalNumberOfPages).toBe(10);
      expect(result.nextPageUrl).toBe('http://api.com/items?page=4&pageSize=5');
      expect(result.previousPageUrl).toBe('http://api.com/items?page=2&pageSize=5');
    });

    it('paginate sets nextPageUrl to null on last page and previousPageUrl to null on first page', async () => {
      const countFn = jest.fn().mockResolvedValue(10);
      const itemsFn = jest.fn().mockResolvedValue([1, 2]);

      const firstPage = await paginate(countFn, itemsFn, { page: 1, pageSize: 5 }, 'http://api.com/items');
      expect(firstPage.previousPageUrl).toBeNull();
      expect(firstPage.nextPageUrl).toBe('http://api.com/items?page=2&pageSize=5');

      const lastPage = await paginate(countFn, itemsFn, { page: 2, pageSize: 5 }, 'http://api.com/items');
      expect(lastPage.nextPageUrl).toBeNull();
      expect(lastPage.previousPageUrl).toBe('http://api.com/items?page=1&pageSize=5');
    });

    it('UrlBuilder adds extra query params and filters null/undefined', () => {
      const url = UrlBuilder.buildPageUrl('http://test.com/api', 1, 10, {
        category: 'action',
        ignored: undefined,
        ignoredNull: null,
      });
      expect(url).toBe('http://test.com/api?page=1&pageSize=10&category=action');
    });
  });
});
