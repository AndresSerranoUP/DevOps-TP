import { Injectable, NotFoundException } from '@nestjs/common';
import { DataStore } from '../store/data-store';
import { SocialLinksMapper, SocialLinkResponse } from './social-links.mapper';

@Injectable()
export class SocialLinksService {
  constructor(private readonly dataStore: DataStore) {}

  async getAll(): Promise<SocialLinkResponse[]> {
    const rows = await this.dataStore.select({
      table: 'SocialLinks',
      orderBy: 'IdSocialLink',
    });
    return rows.map(r => SocialLinksMapper.toResponse(r));
  }

  async getById(id: number): Promise<SocialLinkResponse> {
    const rows = await this.dataStore.select({
      table: 'SocialLinks',
      where: { IdSocialLink: id },
    });
    if (!rows[0]) {
      throw new NotFoundException('Social link not found');
    }
    return SocialLinksMapper.toResponse(rows[0]);
  }
}
