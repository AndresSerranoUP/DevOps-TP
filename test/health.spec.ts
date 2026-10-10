import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from '../src/health/health.controller';
import { HealthModule } from '../src/health/health.module';
import { DataStore } from '../src/store/data-store';

describe('Health module unit tests', () => {
  let mockDataStore: {
    ping: jest.Mock;
  };
  let controller: HealthController;

  beforeEach(() => {
    mockDataStore = {
      ping: jest.fn(),
    };
    controller = new HealthController(mockDataStore as unknown as DataStore);
  });

  it('checkLiveness returns { status: "ok" }', () => {
    expect(controller.checkLiveness()).toEqual({ status: 'ok' });
  });

  it('checkReadiness returns status ok when ping succeeds', async () => {
    mockDataStore.ping.mockResolvedValue(true);
    const res = await controller.checkReadiness();
    expect(res).toEqual({
      status: 'ok',
      info: { database: { status: 'up' } },
    });
  });

  it('checkReadiness throws ServiceUnavailableException when ping returns false', async () => {
    mockDataStore.ping.mockResolvedValue(false);
    await expect(controller.checkReadiness()).rejects.toThrow(ServiceUnavailableException);
  });

  it('checkReadiness throws ServiceUnavailableException when ping throws an error', async () => {
    mockDataStore.ping.mockRejectedValue(new Error('Connection failure'));
    await expect(controller.checkReadiness()).rejects.toThrow(ServiceUnavailableException);
  });

  it('HealthModule is defined', () => {
    expect(HealthModule).toBeDefined();
    const module = new HealthModule();
    expect(module).toBeInstanceOf(HealthModule);
  });
});
