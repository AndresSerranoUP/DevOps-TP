import { ExecutionContext, CallHandler, HttpException, HttpStatus } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import {
  StructuredLoggerInterceptor,
  StructuredHttpLog,
} from '../src/common/logging/structured-logger.interceptor';

describe('StructuredLoggerInterceptor', () => {
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  function createMockContext(options: {
    type?: string;
    method?: string;
    originalUrl?: string;
    url?: string;
    statusCode?: number;
    writableEnded?: boolean;
    hasOnce?: boolean;
  }) {
    const {
      type = 'http',
      method = 'GET',
      originalUrl = '/api/test',
      url = '/test',
      statusCode = 200,
      writableEnded = false,
      hasOnce = true,
    } = options;

    const listeners: Record<string, () => void> = {};

    const req = {
      method,
      originalUrl,
      url,
    };

    const res: any = {
      statusCode,
      writableEnded,
    };

    if (hasOnce) {
      res.once = jest.fn((event: string, callback: () => void) => {
        listeners[event] = callback;
        return res;
      });
    }

    const context = {
      getType: jest.fn().mockReturnValue(type),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: () => req,
        getResponse: () => res,
      }),
    } as unknown as ExecutionContext;

    return { context, req, res, listeners };
  }

  it('passes through and does not log when context type is not http', (done) => {
    const { context } = createMockContext({ type: 'rpc' });
    const callHandler: CallHandler = {
      handle: () => of('result'),
    };

    const interceptor = new StructuredLoggerInterceptor();
    interceptor.intercept(context, callHandler).subscribe((result) => {
      expect(result).toBe('result');
      expect(logSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
      done();
    });
  });

  it('logs info via console.log on 2xx finish event with all required and recommended fields without message', (done) => {
    const { context, res, listeners } = createMockContext({
      statusCode: 200,
      method: 'GET',
      originalUrl: '/games?page=1',
    });
    const callHandler: CallHandler = {
      handle: () => of({ success: true }),
    };

    const interceptor = new StructuredLoggerInterceptor();
    interceptor.intercept(context, callHandler).subscribe(() => {
      expect(res.once).toHaveBeenCalledWith('finish', expect.any(Function));
      expect(res.once).toHaveBeenCalledWith('close', expect.any(Function));

      // Trigger finish event
      listeners['finish']();

      expect(logSpy).toHaveBeenCalledTimes(1);
      const rawJson = logSpy.mock.calls[0][0];
      const parsedLog: StructuredHttpLog = JSON.parse(rawJson);

      expect(parsedLog.log_type).toBe('structuredJsonMessage');
      expect(Object.keys(parsedLog)[0]).toBe('log_type');
      expect(parsedLog.level).toBe('info');
      expect(parsedLog.method).toBe('GET');
      expect(parsedLog.path).toBe('/games?page=1');
      expect(parsedLog.status_code).toBe(200);
      expect(typeof parsedLog.duration_ms).toBe('number');
      expect(parsedLog.duration_ms).toBeGreaterThanOrEqual(0);
      expect(new Date(parsedLog.timestamp).toISOString()).toBe(parsedLog.timestamp);
      expect(parsedLog.message).toBeUndefined();
      expect('message' in parsedLog).toBe(false);
      expect(rawJson).not.toContain('"message"');
      done();
    });
  });

  it('logs warn via console.warn on 4xx responses (e.g. 404) with message and without stack trace', (done) => {
    const { context, listeners } = createMockContext({
      statusCode: 404,
      method: 'POST',
      originalUrl: '/unknown-route',
    });
    const callHandler: CallHandler = {
      handle: () => of(null),
    };

    const interceptor = new StructuredLoggerInterceptor();
    interceptor.intercept(context, callHandler).subscribe(() => {
      listeners['finish']();

      expect(warnSpy).toHaveBeenCalledTimes(1);
      const rawJson = warnSpy.mock.calls[0][0];
      const parsedLog: StructuredHttpLog = JSON.parse(rawJson);
      expect(parsedLog.log_type).toBe('structuredJsonMessage');
      expect(parsedLog.level).toBe('warn');
      expect(parsedLog.status_code).toBe(404);
      expect(parsedLog.path).toBe('/unknown-route');
      expect(parsedLog.message).toBe('Not Found');
      expect(parsedLog.message).not.toContain('\n');
      expect((parsedLog as any).stack).toBeUndefined();
      expect(rawJson).not.toContain('    at ');
      done();
    });
  });

  it('logs error via console.error on 5xx responses (e.g. 500) with message and without stack trace', (done) => {
    const { context, listeners } = createMockContext({
      statusCode: 500,
      method: 'DELETE',
      originalUrl: '/server-crash',
    });
    const callHandler: CallHandler = {
      handle: () => of(null),
    };

    const interceptor = new StructuredLoggerInterceptor();
    interceptor.intercept(context, callHandler).subscribe(() => {
      listeners['finish']();

      expect(errorSpy).toHaveBeenCalledTimes(1);
      const rawJson = errorSpy.mock.calls[0][0];
      const parsedLog: StructuredHttpLog = JSON.parse(rawJson);
      expect(parsedLog.log_type).toBe('structuredJsonMessage');
      expect(parsedLog.level).toBe('error');
      expect(parsedLog.status_code).toBe(500);
      expect(parsedLog.method).toBe('DELETE');
      expect(parsedLog.message).toBe('Internal Server Error');
      expect(parsedLog.message).not.toContain('\n');
      expect((parsedLog as any).stack).toBeUndefined();
      expect(rawJson).not.toContain('    at ');
      done();
    });
  });

  it('uses custom writer if provided in constructor', (done) => {
    const customWriter = jest.fn();
    const { context, listeners } = createMockContext({ statusCode: 201 });
    const callHandler: CallHandler = {
      handle: () => of('created'),
    };

    const interceptor = new StructuredLoggerInterceptor(customWriter);
    interceptor.intercept(context, callHandler).subscribe(() => {
      listeners['finish']();

      expect(customWriter).toHaveBeenCalledTimes(1);
      const [payload, rawJson] = customWriter.mock.calls[0];
      expect(payload.log_type).toBe('structuredJsonMessage');
      expect(payload.status_code).toBe(201);
      expect(payload.level).toBe('info');
      expect(payload.message).toBeUndefined();
      expect('message' in payload).toBe(false);
      expect(JSON.parse(rawJson)).toEqual(payload);
      expect(logSpy).not.toHaveBeenCalled();
      done();
    });
  });

  it('logs immediately if res.writableEnded is true when interceptor is invoked', (done) => {
    const { context } = createMockContext({
      writableEnded: true,
      statusCode: 200,
    });
    const callHandler: CallHandler = {
      handle: () => of('already-ended'),
    };

    const interceptor = new StructuredLoggerInterceptor();
    interceptor.intercept(context, callHandler).subscribe(() => {
      expect(logSpy).toHaveBeenCalledTimes(1);
      const parsed = JSON.parse(logSpy.mock.calls[0][0]);
      expect(parsed.log_type).toBe('structuredJsonMessage');
      done();
    });
  });

  it('handles client close when writableEnded is false', (done) => {
    const { context, listeners } = createMockContext({
      writableEnded: false,
      statusCode: 499,
    });
    const callHandler: CallHandler = {
      handle: () => of(null),
    };

    const interceptor = new StructuredLoggerInterceptor();
    interceptor.intercept(context, callHandler).subscribe(() => {
      listeners['close']();
      expect(warnSpy).toHaveBeenCalledTimes(1);
      const parsed = JSON.parse(warnSpy.mock.calls[0][0]);
      expect(parsed.log_type).toBe('structuredJsonMessage');
      expect(parsed.level).toBe('warn');
      expect(parsed.status_code).toBe(499);
      expect(parsed.message).toBe('HTTP 499');
      done();
    });
  });

  it('does not log twice if both close and finish are called', (done) => {
    const { context, listeners } = createMockContext({ statusCode: 200 });
    const callHandler: CallHandler = {
      handle: () => of(null),
    };

    const interceptor = new StructuredLoggerInterceptor();
    interceptor.intercept(context, callHandler).subscribe(() => {
      listeners['finish']();
      listeners['close']();
      expect(logSpy).toHaveBeenCalledTimes(1);
      const parsed = JSON.parse(logSpy.mock.calls[0][0]);
      expect(parsed.log_type).toBe('structuredJsonMessage');
      done();
    });
  });

  it('fallback: logs on tap.next if response does not implement once()', (done) => {
    const { context } = createMockContext({
      hasOnce: false,
      statusCode: 200,
      originalUrl: '',
      url: '/fallback-url',
    });
    const callHandler: CallHandler = {
      handle: () => of('ok'),
    };

    const interceptor = new StructuredLoggerInterceptor();
    interceptor.intercept(context, callHandler).subscribe(() => {
      expect(logSpy).toHaveBeenCalledTimes(1);
      const parsed = JSON.parse(logSpy.mock.calls[0][0]);
      expect(parsed.log_type).toBe('structuredJsonMessage');
      expect(parsed.path).toBe('/fallback-url');
      expect(parsed.message).toBeUndefined();
      done();
    });
  });

  it('fallback: logs on tap.error with HttpException when response has no once()', (done) => {
    const { context } = createMockContext({
      hasOnce: false,
      statusCode: 200,
    });
    const callHandler: CallHandler = {
      handle: () => throwError(() => new HttpException('Not Found', HttpStatus.NOT_FOUND)),
    };

    const interceptor = new StructuredLoggerInterceptor();
    interceptor.intercept(context, callHandler).subscribe({
      error: (err) => {
        expect(err).toBeInstanceOf(HttpException);
        expect(warnSpy).toHaveBeenCalledTimes(1);
        const parsed = JSON.parse(warnSpy.mock.calls[0][0]);
        expect(parsed.log_type).toBe('structuredJsonMessage');
        expect(parsed.status_code).toBe(404);
        expect(parsed.level).toBe('warn');
        expect(parsed.message).toBe('Not Found');
        expect((parsed as any).stack).toBeUndefined();
        done();
      },
    });
  });

  it('fallback: logs on tap.error with object having status or statusCode', (done) => {
    const { context } = createMockContext({
      hasOnce: false,
    });
    const customError = { status: 403, message: 'Forbidden' };
    const callHandler: CallHandler = {
      handle: () => throwError(() => customError),
    };

    const interceptor = new StructuredLoggerInterceptor();
    interceptor.intercept(context, callHandler).subscribe({
      error: () => {
        expect(warnSpy).toHaveBeenCalledTimes(1);
        const parsed = JSON.parse(warnSpy.mock.calls[0][0]);
        expect(parsed.log_type).toBe('structuredJsonMessage');
        expect(parsed.status_code).toBe(403);
        expect(parsed.message).toBe('Forbidden');
        expect((parsed as any).stack).toBeUndefined();
        done();
      },
    });
  });

  it('fallback: logs on tap.error with object having statusCode property', (done) => {
    const { context } = createMockContext({
      hasOnce: false,
    });
    const customError = { statusCode: 502, message: 'Bad Gateway' };
    const callHandler: CallHandler = {
      handle: () => throwError(() => customError),
    };

    const interceptor = new StructuredLoggerInterceptor();
    interceptor.intercept(context, callHandler).subscribe({
      error: () => {
        expect(errorSpy).toHaveBeenCalledTimes(1);
        const parsed = JSON.parse(errorSpy.mock.calls[0][0]);
        expect(parsed.log_type).toBe('structuredJsonMessage');
        expect(parsed.status_code).toBe(502);
        expect(parsed.level).toBe('error');
        expect(parsed.message).toBe('Bad Gateway');
        expect((parsed as any).stack).toBeUndefined();
        done();
      },
    });
  });

  it('fallback: defaults to 500 when error is generic Error without status', (done) => {
    const { context } = createMockContext({
      hasOnce: false,
    });
    const callHandler: CallHandler = {
      handle: () => throwError(() => new Error('Unknown crash')),
    };

    const interceptor = new StructuredLoggerInterceptor();
    interceptor.intercept(context, callHandler).subscribe({
      error: () => {
        expect(errorSpy).toHaveBeenCalledTimes(1);
        const parsed = JSON.parse(errorSpy.mock.calls[0][0]);
        expect(parsed.log_type).toBe('structuredJsonMessage');
        expect(parsed.status_code).toBe(500);
        expect(parsed.level).toBe('error');
        expect(parsed.message).toBe('Unknown crash');
        expect(parsed.message).not.toContain('\n');
        expect((parsed as any).stack).toBeUndefined();
        done();
      },
    });
  });

  it('handles empty request object gracefully with defaults', (done) => {
    const context = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => null,
        getResponse: () => null,
      }),
    } as unknown as ExecutionContext;

    const callHandler: CallHandler = {
      handle: () => of(null),
    };

    const interceptor = new StructuredLoggerInterceptor();
    interceptor.intercept(context, callHandler).subscribe(() => {
      expect(logSpy).toHaveBeenCalledTimes(1);
      const parsed = JSON.parse(logSpy.mock.calls[0][0]);
      expect(parsed.log_type).toBe('structuredJsonMessage');
      expect(parsed.method).toBe('UNKNOWN');
      expect(parsed.path).toBe('/');
      expect(parsed.status_code).toBe(200);
      expect(parsed.message).toBeUndefined();
      expect('message' in parsed).toBe(false);
      done();
    });
  });

  it('includes error message without stack trace on 5xx when an Error is thrown (e.g. Azure SQL configuration is incomplete)', (done) => {
    const { context, listeners } = createMockContext({
      statusCode: 500,
      method: 'GET',
      originalUrl: '/api/User/GetAll?page=2&pageSize=12',
    });
    const error = new Error('Azure SQL configuration is incomplete');
    const callHandler: CallHandler = {
      handle: () => throwError(() => error),
    };

    const interceptor = new StructuredLoggerInterceptor();
    interceptor.intercept(context, callHandler).subscribe({
      error: () => {
        listeners['finish']();

        expect(errorSpy).toHaveBeenCalledTimes(1);
        const rawJson = errorSpy.mock.calls[0][0];
        const parsedLog: StructuredHttpLog = JSON.parse(rawJson);

        expect(parsedLog.log_type).toBe('structuredJsonMessage');
        expect(parsedLog.level).toBe('error');
        expect(parsedLog.status_code).toBe(500);
        expect(parsedLog.method).toBe('GET');
        expect(parsedLog.path).toBe('/api/User/GetAll?page=2&pageSize=12');
        expect(parsedLog.message).toBe('Azure SQL configuration is incomplete');
        expect(parsedLog.message).not.toContain('\n');
        expect((parsedLog as any).stack).toBeUndefined();
        expect(rawJson).not.toContain(error.stack!);
        expect(rawJson).not.toContain('    at ');
        done();
      },
    });
  });

  it('extracts joined message from HttpException with array response on 4xx', (done) => {
    const { context, listeners } = createMockContext({
      statusCode: 400,
      method: 'POST',
      originalUrl: '/api/User/Create',
    });
    const httpException = new HttpException(
      { message: ['email is required', 'password must be at least 8 chars'] },
      HttpStatus.BAD_REQUEST,
    );
    const callHandler: CallHandler = {
      handle: () => throwError(() => httpException),
    };

    const interceptor = new StructuredLoggerInterceptor();
    interceptor.intercept(context, callHandler).subscribe({
      error: () => {
        listeners['finish']();

        expect(warnSpy).toHaveBeenCalledTimes(1);
        const rawJson = warnSpy.mock.calls[0][0];
        const parsedLog: StructuredHttpLog = JSON.parse(rawJson);

        expect(parsedLog.log_type).toBe('structuredJsonMessage');
        expect(parsedLog.level).toBe('warn');
        expect(parsedLog.status_code).toBe(400);
        expect(parsedLog.message).toBe('email is required, password must be at least 8 chars');
        expect((parsedLog as any).stack).toBeUndefined();
        expect(rawJson).not.toContain('    at ');
        done();
      },
    });
  });

  it('uses res.statusMessage as fallback when available on 4xx/5xx without error object', (done) => {
    const { context, res, listeners } = createMockContext({
      statusCode: 403,
      method: 'GET',
      originalUrl: '/api/protected',
    });
    res.statusMessage = 'Forbidden Access';
    const callHandler: CallHandler = {
      handle: () => of(null),
    };

    const interceptor = new StructuredLoggerInterceptor();
    interceptor.intercept(context, callHandler).subscribe(() => {
      listeners['finish']();

      expect(warnSpy).toHaveBeenCalledTimes(1);
      const parsedLog: StructuredHttpLog = JSON.parse(warnSpy.mock.calls[0][0]);
      expect(parsedLog.log_type).toBe('structuredJsonMessage');
      expect(parsedLog.level).toBe('warn');
      expect(parsedLog.status_code).toBe(403);
      expect(parsedLog.message).toBe('Forbidden Access');
      done();
    });
  });

  describe('LOG_LEVEL filtering', () => {
    it('omits info logs but emits warn and error logs when LOG_LEVEL is "warn"', (done) => {
      process.env.LOG_LEVEL = 'warn';

      const customWriter = jest.fn();
      const interceptor = new StructuredLoggerInterceptor(customWriter);

      // Info level request (200)
      const infoCtx = createMockContext({ statusCode: 200 });
      interceptor.intercept(infoCtx.context, { handle: () => of('ok') }).subscribe(() => {
        infoCtx.listeners['finish']();
        expect(customWriter).not.toHaveBeenCalled();
        expect(logSpy).not.toHaveBeenCalled();

        // Warn level request (404)
        const warnCtx = createMockContext({ statusCode: 404 });
        interceptor.intercept(warnCtx.context, { handle: () => of(null) }).subscribe(() => {
          warnCtx.listeners['finish']();
          expect(customWriter).toHaveBeenCalledTimes(1);
          expect(customWriter.mock.calls[0][0].log_type).toBe('structuredJsonMessage');
          expect(customWriter.mock.calls[0][0].level).toBe('warn');

          // Error level request (500)
          const errorCtx = createMockContext({ statusCode: 500 });
          interceptor.intercept(errorCtx.context, { handle: () => of(null) }).subscribe(() => {
            errorCtx.listeners['finish']();
            expect(customWriter).toHaveBeenCalledTimes(2);
            expect(customWriter.mock.calls[1][0].log_type).toBe('structuredJsonMessage');
            expect(customWriter.mock.calls[1][0].level).toBe('error');
            done();
          });
        });
      });
    });

    it('omits info and warn logs but emits error logs when LOG_LEVEL is "error"', (done) => {
      process.env.LOG_LEVEL = 'error';

      const customWriter = jest.fn();
      const interceptor = new StructuredLoggerInterceptor(customWriter);

      // Info request (200)
      const infoCtx = createMockContext({ statusCode: 200 });
      interceptor.intercept(infoCtx.context, { handle: () => of('ok') }).subscribe(() => {
        infoCtx.listeners['finish']();
        expect(customWriter).not.toHaveBeenCalled();

        // Warn request (400)
        const warnCtx = createMockContext({ statusCode: 400 });
        interceptor.intercept(warnCtx.context, { handle: () => of(null) }).subscribe(() => {
          warnCtx.listeners['finish']();
          expect(customWriter).not.toHaveBeenCalled();

          // Error request (500)
          const errorCtx = createMockContext({ statusCode: 500 });
          interceptor.intercept(errorCtx.context, { handle: () => of(null) }).subscribe(() => {
            errorCtx.listeners['finish']();
            expect(customWriter).toHaveBeenCalledTimes(1);
            expect(customWriter.mock.calls[0][0].log_type).toBe('structuredJsonMessage');
            expect(customWriter.mock.calls[0][0].level).toBe('error');
            done();
          });
        });
      });
    });

    it('emits info, warn, and error logs when LOG_LEVEL is "info"', (done) => {
      process.env.LOG_LEVEL = 'info';

      const customWriter = jest.fn();
      const interceptor = new StructuredLoggerInterceptor(customWriter);

      const infoCtx = createMockContext({ statusCode: 200 });
      interceptor.intercept(infoCtx.context, { handle: () => of('ok') }).subscribe(() => {
        infoCtx.listeners['finish']();
        expect(customWriter).toHaveBeenCalledTimes(1);
        expect(customWriter.mock.calls[0][0].log_type).toBe('structuredJsonMessage');
        expect(customWriter.mock.calls[0][0].level).toBe('info');
        done();
      });
    });

    it('defaults to "warn" in production when LOG_LEVEL is not set', (done) => {
      delete process.env.LOG_LEVEL;
      process.env.NODE_ENV = 'production';

      const customWriter = jest.fn();
      const interceptor = new StructuredLoggerInterceptor(customWriter);

      const infoCtx = createMockContext({ statusCode: 200 });
      interceptor.intercept(infoCtx.context, { handle: () => of('ok') }).subscribe(() => {
        infoCtx.listeners['finish']();
        // Info should be skipped in production default (warn)
        expect(customWriter).not.toHaveBeenCalled();

        const errCtx = createMockContext({ statusCode: 500 });
        interceptor.intercept(errCtx.context, { handle: () => of(null) }).subscribe(() => {
          errCtx.listeners['finish']();
          expect(customWriter).toHaveBeenCalledTimes(1);
          expect(customWriter.mock.calls[0][0].log_type).toBe('structuredJsonMessage');
          expect(customWriter.mock.calls[0][0].level).toBe('error');
          done();
        });
      });
    });

    it('defaults to "info" in other environments when LOG_LEVEL is not set', (done) => {
      delete process.env.LOG_LEVEL;
      process.env.NODE_ENV = 'development';

      const customWriter = jest.fn();
      const interceptor = new StructuredLoggerInterceptor(customWriter);

      const infoCtx = createMockContext({ statusCode: 200 });
      interceptor.intercept(infoCtx.context, { handle: () => of('ok') }).subscribe(() => {
        infoCtx.listeners['finish']();
        expect(customWriter).toHaveBeenCalledTimes(1);
        expect(customWriter.mock.calls[0][0].log_type).toBe('structuredJsonMessage');
        expect(customWriter.mock.calls[0][0].level).toBe('info');
        done();
      });
    });
  });
});
