import { NotFoundException } from '@nestjs/common';
import { SocialLinksMapper } from '../src/social-links/social-links.mapper';
import { SocialLinksService } from '../src/social-links/social-links.service';
import { SocialLinksController } from '../src/social-links/social-links.controller';
import { SocialLinksModule } from '../src/social-links/social-links.module';
import { DataStore } from '../src/store/data-store';

describe('SocialLinks module unit tests', () => {
  describe('SocialLinksMapper', () => {
    it('maps row to response with clean camelCase keys', () => {
      const res = SocialLinksMapper.toResponse({
        IdSocialLink: 1,
        NameSocialLink: 'Twitter',
        UrlSocialLink: 'https://twitter.com/dev',
        ImgSocialLink: 'twitter.png',
        IdDeveloper: 5,
        Disabled: 0,
      });
      expect(res.idSocialLink).toBe(1);
      expect((res as any).IdSocialLink).toBeUndefined();
      expect(res.webName).toBe('Twitter');
      expect((res as any).nameSocialLink).toBeUndefined();
      expect(res.webUrl).toBe('https://twitter.com/dev');
      expect((res as any).urlSocialLink).toBeUndefined();
      expect(res.imgSocialLink).toBe('twitter.png');
      expect(res.idDeveloper).toBe(5);
      expect(res.disabled).toBe(0);
      expect((res as any).Disabled).toBeUndefined();
    });

    it('handles defaults when fields are missing', () => {
      const res = SocialLinksMapper.toResponse({});
      expect(res.idSocialLink).toBeNaN();
      expect(res.webName).toBe('');
      expect(res.webUrl).toBe('');
      expect(res.imgSocialLink).toBeNull();
      expect(res.idDeveloper).toBeUndefined();
      expect(res.disabled).toBe(0);
    });
  });

  describe('SocialLinksService', () => {
    let mockStore: {
      select: jest.Mock;
    };
    let service: SocialLinksService;

    beforeEach(() => {
      mockStore = {
        select: jest.fn(),
      };
      service = new SocialLinksService(mockStore as unknown as DataStore);
    });

    it('getAll selects all social links ordered by IdSocialLink', async () => {
      mockStore.select.mockResolvedValue([
        { IdSocialLink: 1, NameSocialLink: 'Twitter', UrlSocialLink: 'https://x.com' },
        { IdSocialLink: 2, NameSocialLink: 'Discord', UrlSocialLink: 'https://discord.gg' },
      ]);
      const res = await service.getAll();
      expect(res).toHaveLength(2);
      expect(res[0].idSocialLink).toBe(1);
      expect(mockStore.select).toHaveBeenCalledWith({ table: 'SocialLinks', orderBy: 'IdSocialLink' });
    });

    it('getById returns single social link or throws NotFoundException', async () => {
      mockStore.select.mockResolvedValue([
        { IdSocialLink: 1, NameSocialLink: 'Twitter', UrlSocialLink: 'https://x.com' },
      ]);
      const res = await service.getById(1);
      expect(res.idSocialLink).toBe(1);
      expect(res.webName).toBe('Twitter');
      expect(mockStore.select).toHaveBeenCalledWith({ table: 'SocialLinks', where: { IdSocialLink: 1 } });

      mockStore.select.mockResolvedValue([]);
      await expect(service.getById(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('SocialLinksController', () => {
    it('delegates calls to service', async () => {
      const mockService = {
        getAll: jest.fn().mockResolvedValue([]),
        getById: jest.fn().mockResolvedValue({ idSocialLink: 1 }),
      };
      const controller = new SocialLinksController(mockService as any);

      await controller.getAll();
      expect(mockService.getAll).toHaveBeenCalled();

      await controller.getById(1);
      expect(mockService.getById).toHaveBeenCalledWith(1);
    });

    it('SocialLinksModule is defined', () => {
      expect(SocialLinksModule).toBeDefined();
      const module = new SocialLinksModule();
      expect(module).toBeInstanceOf(SocialLinksModule);
    });
  });
});
