export interface GenreResponse {
  idGenre: number;
  nameGenre: string;
  disabled?: number;
}

export class GenresMapper {
  static toResponse(row: Record<string, any>): GenreResponse {
    const idGenre = Number(row.IdGenre ?? row.idGenre);
    const nameGenre = String(row.NameGenre ?? row.nameGenre ?? '');
    const disabled = row.Disabled !== undefined && row.Disabled !== null
      ? Number(row.Disabled)
      : (row.disabled !== undefined ? Number(row.disabled) : 0);

    return {
      idGenre,
      nameGenre,
      disabled,
    };
  }
}
