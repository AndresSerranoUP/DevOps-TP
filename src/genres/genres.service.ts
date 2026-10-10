import { Injectable, NotFoundException } from '@nestjs/common';
import { DataStore } from '../store/data-store';
import { GenresMapper, GenreResponse } from './genres.mapper';

@Injectable()
export class GenresService {
  constructor(private readonly dataStore: DataStore) {}

  async getAll(): Promise<GenreResponse[]> {
    const rows = await this.dataStore.select({
      table: 'Genres',
      orderBy: 'IdGenre',
    });
    return rows.map(r => GenresMapper.toResponse(r));
  }

  async getById(id: number): Promise<GenreResponse> {
    const rows = await this.dataStore.select({
      table: 'Genres',
      where: { IdGenre: id },
    });
    if (!rows[0]) {
      throw new NotFoundException('Genre not found');
    }
    return GenresMapper.toResponse(rows[0]);
  }
}
