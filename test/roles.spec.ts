import { NotFoundException } from '@nestjs/common';
import { RolesMapper } from '../src/roles/roles.mapper';
import { RolesService } from '../src/roles/roles.service';
import { RolesController } from '../src/roles/roles.controller';
import { RolesModule } from '../src/roles/roles.module';
import { DataStore } from '../src/store/data-store';

describe('Roles module unit tests', () => {
  describe('RolesMapper', () => {
    it('maps row to response with clean camelCase keys', () => {
      const res = RolesMapper.toResponse({ IdRole: 1, NameRole: 'User', Disabled: 0 });
      expect(res.idRole).toBe(1);
      expect((res as any).IdRole).toBeUndefined();
      expect(res.roleName).toBe('User');
      expect((res as any).NameRole).toBeUndefined();
      expect((res as any).nameRole).toBeUndefined();
      expect(res.disabled).toBe(0);
      expect((res as any).Disabled).toBeUndefined();
    });

    it('handles defaults when fields are missing', () => {
      const res = RolesMapper.toResponse({});
      expect(res.idRole).toBeNaN();
      expect(res.roleName).toBe('');
      expect(res.disabled).toBe(0);
    });
  });

  describe('RolesService', () => {
    let mockStore: {
      select: jest.Mock;
    };
    let service: RolesService;

    beforeEach(() => {
      mockStore = {
        select: jest.fn(),
      };
      service = new RolesService(mockStore as unknown as DataStore);
    });

    it('getAll selects all roles ordered by IdRole', async () => {
      mockStore.select.mockResolvedValue([
        { IdRole: 1, NameRole: 'User' },
        { IdRole: 4, NameRole: 'Administrator' },
      ]);
      const res = await service.getAll();
      expect(res).toHaveLength(2);
      expect(res[0].idRole).toBe(1);
      expect(mockStore.select).toHaveBeenCalledWith({ table: 'Roles', orderBy: 'IdRole' });
    });

    it('getById returns single role or throws NotFoundException', async () => {
      mockStore.select.mockResolvedValue([{ IdRole: 4, NameRole: 'Administrator' }]);
      const res = await service.getById(4);
      expect(res.idRole).toBe(4);
      expect(res.roleName).toBe('Administrator');
      expect(mockStore.select).toHaveBeenCalledWith({ table: 'Roles', where: { IdRole: 4 } });

      mockStore.select.mockResolvedValue([]);
      await expect(service.getById(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('RolesController', () => {
    it('delegates calls to service', async () => {
      const mockService = {
        getAll: jest.fn().mockResolvedValue([]),
        getById: jest.fn().mockResolvedValue({ idRole: 1 }),
      };
      const controller = new RolesController(mockService as any);

      await controller.getAll();
      expect(mockService.getAll).toHaveBeenCalled();

      await controller.getById(1);
      expect(mockService.getById).toHaveBeenCalledWith(1);
    });

    it('RolesModule is defined', () => {
      expect(RolesModule).toBeDefined();
      const module = new RolesModule();
      expect(module).toBeInstanceOf(RolesModule);
    });
  });
});
