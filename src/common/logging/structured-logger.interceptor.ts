import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { STATUS_CODES } from 'http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request, Response } from 'express';

export type LogLevel = 'info' | 'warn' | 'error';

export interface StructuredHttpLog {
  timestamp: string;
  level: LogLevel;
  method: string;
  path: string;
  status_code: number;
  duration_ms: number;
  message?: string;
}

export type LogWriter = (log: StructuredHttpLog, rawJson: string) => void;

@Injectable()
export class StructuredLoggerInterceptor implements NestInterceptor {
  constructor(private readonly writer?: LogWriter) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const httpContext = context.switchToHttp();
    const req = httpContext.getRequest<Request>();
    const res = httpContext.getResponse<Response>();

    const startTime = Date.now();
    let hasLogged = false;
    let capturedError: unknown = null;

    const emitLog = (forcedStatusCode?: number) => {
      if (hasLogged) {
        return;
      }
      hasLogged = true;

      const durationMs = Math.max(0, Date.now() - startTime);
      const statusCode =
        forcedStatusCode ??
        (res?.statusCode && res.statusCode >= 400
          ? res.statusCode
          : capturedError
            ? this.extractStatusCode(capturedError)
            : res?.statusCode || 200);
      const level = this.resolveLevel(statusCode);

      const logPayload: StructuredHttpLog = {
        timestamp: new Date().toISOString(),
        level,
        method: req?.method || 'UNKNOWN',
        path: req?.originalUrl || req?.url || '/',
        status_code: statusCode,
        duration_ms: durationMs,
      };

      if (level === 'warn' || level === 'error') {
        logPayload.message = this.extractErrorMessage(capturedError, statusCode, res);
      }

      const rawJson = JSON.stringify(logPayload);

      if (this.writer) {
        this.writer(logPayload, rawJson);
        return;
      }

      if (level === 'error') {
        console.error(rawJson);
      } else if (level === 'warn') {
        console.warn(rawJson);
      } else {
        console.log(rawJson);
      }
    };

    if (res?.writableEnded) {
      emitLog();
    } else if (res && typeof res.once === 'function') {
      res.once('finish', () => emitLog());
      res.once('close', () => {
        if (!res.writableEnded) {
          emitLog();
        }
      });
    }

    return next.handle().pipe(
      tap({
        next: () => {
          if (!res || typeof res.once !== 'function') {
            emitLog();
          }
        },
        error: (err: unknown) => {
          capturedError = err;
          if (!res || typeof res.once !== 'function') {
            const status = this.extractStatusCode(err);
            emitLog(status);
          }
        },
      }),
    );
  }

  private resolveLevel(statusCode: number): LogLevel {
    if (statusCode >= 500) {
      return 'error';
    }
    if (statusCode >= 400) {
      return 'warn';
    }
    return 'info';
  }

  private extractStatusCode(err: unknown): number {
    if (err instanceof HttpException) {
      return err.getStatus();
    }
    if (err && typeof err === 'object') {
      const candidate = err as { status?: unknown; statusCode?: unknown };
      if (typeof candidate.status === 'number') {
        return candidate.status;
      }
      if (typeof candidate.statusCode === 'number') {
        return candidate.statusCode;
      }
    }
    return 500;
  }

  private extractErrorMessage(
    err: unknown,
    statusCode: number,
    res?: Response,
  ): string {
    if (err instanceof HttpException) {
      const response = err.getResponse();
      if (typeof response === 'string' && response.trim().length > 0) {
        return response;
      }
      if (response && typeof response === 'object') {
        const resObj = response as Record<string, unknown>;
        if (typeof resObj.message === 'string' && resObj.message.trim().length > 0) {
          return resObj.message;
        }
        if (Array.isArray(resObj.message) && resObj.message.length > 0) {
          return resObj.message
            .filter((m) => typeof m === 'string')
            .join(', ');
        }
        if (typeof resObj.error === 'string' && resObj.error.trim().length > 0) {
          return resObj.error;
        }
      }
      if (err.message && err.message.trim().length > 0) {
        return err.message;
      }
    }

    if (err instanceof Error) {
      if (err.message && err.message.trim().length > 0) {
        return err.message;
      }
    }

    if (err && typeof err === 'object') {
      const candidate = err as { message?: unknown };
      if (typeof candidate.message === 'string' && candidate.message.trim().length > 0) {
        return candidate.message;
      }
      if (Array.isArray(candidate.message) && candidate.message.length > 0) {
        return candidate.message
          .filter((m) => typeof m === 'string')
          .join(', ');
      }
    }

    if (typeof err === 'string' && err.trim().length > 0) {
      return err;
    }

    if (res?.statusMessage && res.statusMessage.trim().length > 0) {
      return res.statusMessage;
    }

    const standardMessage = STATUS_CODES[statusCode];
    if (standardMessage) {
      return standardMessage;
    }

    return `HTTP ${statusCode}`;
  }
}
