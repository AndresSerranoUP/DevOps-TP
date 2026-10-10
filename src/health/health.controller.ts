import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DataStore } from '../store/data-store';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly dataStore: DataStore) {}

  @Get()
  checkLiveness() {
    return { status: 'ok' };
  }

  @Get('ready')
  async checkReadiness() {
    try {
      const isUp = await this.dataStore.ping();
      if (!isUp) {
        throw new ServiceUnavailableException({
          status: 'error',
          error: { database: { status: 'down' } },
        });
      }
      return {
        status: 'ok',
        info: { database: { status: 'up' } },
      };
    } catch (err) {
      if (err instanceof ServiceUnavailableException) {
        throw err;
      }
      throw new ServiceUnavailableException({
        status: 'error',
        error: { database: { status: 'down' } },
      });
    }
  }
}
