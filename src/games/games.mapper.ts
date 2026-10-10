export interface GameResponse {
  idGame: number;
  nameGame: string;
  releaseDate: Date | string | null;
  idDeveloper: number;
  imgThumbnail: string | null;
  imgLogo: string | null;
  imgBackground: string | null;
  size: number | null;
  price: number;
  longDescription: string | null;
  shortDescription: string | null;
  minRam: string | null;
  minGpu: string | null;
  minCpu: string | null;
  minOs: string | null;
  idSteam: number | null;
  disabled: number;
  likes?: number;
  dislikes?: number;
  isOwned?: boolean;
  userRate?: number | null;
  genero?: string;
  genres?: any[];
  genresIds?: number[];
}

export class GamesMapper {
  static toResponse(row: Record<string, any>): GameResponse {
    const idGame = Number(row.IdGame ?? row.idGame);
    const nameGame = String(row.NameGame ?? row.nameGame ?? '');
    const releaseDate = (row.ReleaseDate ?? row.releaseDate) ?? null;
    const idDeveloper = Number(row.IdDeveloper ?? row.idDeveloper);
    const imgThumbnail = (row.ImgThumbnail ?? row.imgThumbnail) ?? null;
    const imgLogo = (row.ImgLogo ?? row.imgLogo) ?? null;
    const imgBackground = (row.ImgBackground ?? row.imgBackground) ?? null;
    const size = (row.Size !== undefined && row.Size !== null)
      ? Number(row.Size)
      : (row.size !== undefined && row.size !== null ? Number(row.size) : null);
    const price = Number(row.Price ?? row.price ?? 0);
    const longDescription = (row.LongDescription ?? row.longDescription) ?? null;
    const shortDescription = (row.ShortDescription ?? row.shortDescription) ?? null;
    const minRam = (row.MinRam ?? row.minRam) ?? null;
    const minGpu = (row.MinGpu ?? row.minGpu) ?? null;
    const minCpu = (row.MinCpu ?? row.minCpu) ?? null;
    const minOs = (row.MinOs ?? row.minOs) ?? null;
    const idSteam = (row.IdSteam !== undefined && row.IdSteam !== null)
      ? Number(row.IdSteam)
      : (row.idSteam !== undefined && row.idSteam !== null ? Number(row.idSteam) : null);
    const disabled = row.Disabled !== undefined && row.Disabled !== null
      ? Number(row.Disabled)
      : (row.disabled !== undefined && row.disabled !== null ? Number(row.disabled) : 0);

    const likes = row.likes !== undefined ? Number(row.likes) : (row.Likes !== undefined ? Number(row.Likes) : undefined);
    const dislikes = row.dislikes !== undefined ? Number(row.dislikes) : (row.Dislikes !== undefined ? Number(row.Dislikes) : undefined);
    const isOwned = row.isOwned !== undefined ? Boolean(row.isOwned) : (row.IsOwned !== undefined ? Boolean(row.IsOwned) : undefined);
    const userRate = row.userRate !== undefined ? row.userRate : (row.UserRate !== undefined ? row.UserRate : undefined);
    const genero = row.genero !== undefined ? String(row.genero) : (row.Genero !== undefined ? String(row.Genero) : undefined);
    const genres = row.genres ?? row.Genres ?? undefined;
    const genresIds = row.genresIds ?? undefined;

    return {
      idGame,
      nameGame,
      releaseDate,
      idDeveloper,
      imgThumbnail,
      imgLogo,
      imgBackground,
      size,
      price,
      longDescription,
      shortDescription,
      minRam,
      minGpu,
      minCpu,
      minOs,
      idSteam,
      disabled,
      ...(likes !== undefined ? { likes } : {}),
      ...(dislikes !== undefined ? { dislikes } : {}),
      ...(isOwned !== undefined ? { isOwned } : {}),
      ...(userRate !== undefined ? { userRate } : {}),
      ...(genero !== undefined ? { genero } : {}),
      ...(genres !== undefined ? { genres } : {}),
      ...(genresIds !== undefined ? { genresIds } : {}),
    };
  }
}
