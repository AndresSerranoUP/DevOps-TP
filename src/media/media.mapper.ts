export interface MediaResponse {
  idMedia: number;
  idMediaType: number;
  idGame: number;
  url: string;
  mediaTypeName?: string | null;
  nameGame?: string | null;
  price?: number | null;
}

export class MediaMapper {
  static toResponse(row: Record<string, any>): MediaResponse {
    const idMedia = Number(row.IdMedia ?? row.idMedia);
    const idMediaType = Number(row.IdMediaType ?? row.idMediaType);
    const idGame = Number(row.IdGame ?? row.idGame);
    const url = String(row.Url ?? row.url ?? '');
    const mediaTypeName = (row.MediaTypeName ?? row.mediaTypeName) ?? null;
    const nameGame = (row.NameGame ?? row.nameGame) ?? null;
    const price = row.Price !== undefined && row.Price !== null
      ? Number(row.Price)
      : (row.price !== undefined && row.price !== null ? Number(row.price) : null);

    return {
      idMedia,
      idMediaType,
      idGame,
      url,
      mediaTypeName,
      nameGame,
      price,
    };
  }
}
