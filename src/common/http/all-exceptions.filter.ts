import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import {
  DuplicateKeyError,
  ForeignKeyError,
  UnknownTableOrColumnError,
} from '../../store/data-store';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const isDebug =
      process.env.DEBUG?.toLowerCase().trim() === 'true' ||
      process.env.NODE_ENV === 'development';

    if (isDebug) {
      console.error(exception);
    }

    if (exception instanceof DuplicateKeyError) {
      return response.status(HttpStatus.CONFLICT).json({
        statusCode: HttpStatus.CONFLICT,
        message: exception.message,
        error: 'Conflict',
      });
    }

    if (exception instanceof ForeignKeyError) {
      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: exception.message,
        error: 'Bad Request',
      });
    }

    if (exception instanceof UnknownTableOrColumnError) {
      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: exception.message,
        error: 'Bad Request',
      });
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'object' && res !== null) {
        return response.status(status).json(res);
      }
      return response.status(status).json({
        statusCode: status,
        message: res,
      });
    }

    const message =
      (exception instanceof Error ? exception.message : undefined) ||
      (exception && typeof exception === 'object' && 'message' in exception
        ? String((exception as { message: unknown }).message)
        : undefined) ||
      'Internal server error';

    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message,
    });
  }
}
