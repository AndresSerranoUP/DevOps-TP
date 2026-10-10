import { Injectable } from '@nestjs/common';
import { DataStore, Row } from '../store/data-store';

@Injectable()
export class UsersRepository {
  constructor(private readonly dataStore: DataStore) {}

  async findById(id: number): Promise<Row | undefined> {
    const rows = await this.dataStore.select({
      table: 'Users',
      where: { IdUser: id },
    });
    return rows[0];
  }

  async findByEmail(email: string): Promise<Row | undefined> {
    const rows = await this.dataStore.select({
      table: 'Users',
      where: { EmailUser: email },
    });
    return rows[0];
  }

  async countAll(): Promise<number> {
    return this.dataStore.count({ table: 'Users' });
  }

  async findPaged(offset: number, limit: number, orderCol = 'IdUser', asc = true): Promise<Row[]> {
    return this.dataStore.select({
      table: 'Users',
      offset,
      limit,
      orderBy: orderCol,
      ascending: asc,
    });
  }

  async create(values: Record<string, unknown>): Promise<Row> {
    return this.dataStore.insert('Users', values);
  }

  async update(id: number, values: Record<string, unknown>): Promise<Row | undefined> {
    const rows = await this.dataStore.update('Users', { IdUser: id }, values);
    return rows[0] ?? this.findById(id);
  }

  async softDelete(id: number): Promise<boolean> {
    const rows = await this.dataStore.update('Users', { IdUser: id }, { Disabled: 1 });
    return rows.length > 0;
  }
}
