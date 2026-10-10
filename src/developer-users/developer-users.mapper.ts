export interface DeveloperUserResponse {
  idUser: number;
  idDeveloper: number;
  rango: number;
}

export class DeveloperUsersMapper {
  static toResponse(row: Record<string, any>): DeveloperUserResponse {
    const idUser = Number(row.IdUser ?? row.idUser);
    const idDeveloper = Number(row.IdDeveloper ?? row.idDeveloper);
    const rango = row.Rango !== undefined && row.Rango !== null
      ? Number(row.Rango)
      : (row.rango !== undefined && row.rango !== null ? Number(row.rango) : 0);

    return {
      idUser,
      idDeveloper,
      rango,
    };
  }
}
