export interface DeveloperResponse {
  idDeveloper: number;
  nameDeveloper: string;
  logoDeveloper: string | null;
  longDescription: string | null;
  shortDescription: string | null;
  disabled: number;
  idUserOwner?: number;
}

export class DevelopersMapper {
  static toResponse(row: Record<string, any>): DeveloperResponse {
    const idDeveloper = Number(row.IdDeveloper ?? row.idDeveloper);
    const nameDeveloper = String(row.NameDeveloper ?? row.nameDeveloper ?? '');
    const logoDeveloper = (row.LogoDeveloper ?? row.logoDeveloper) ?? null;
    const longDescription = (row.LongDescription ?? row.longDescription) ?? null;
    const shortDescription = (row.ShortDescription ?? row.shortDescription) ?? null;
    const disabled = row.Disabled !== undefined && row.Disabled !== null
      ? Number(row.Disabled)
      : (row.disabled !== undefined ? Number(row.disabled) : 0);
    const idUserOwner = row.IdUserOwner !== undefined && row.IdUserOwner !== null
      ? Number(row.IdUserOwner)
      : (row.idUserOwner !== undefined && row.idUserOwner !== null ? Number(row.idUserOwner) : undefined);

    const res: DeveloperResponse = {
      idDeveloper,
      nameDeveloper,
      logoDeveloper,
      longDescription,
      shortDescription,
      disabled,
    };

    if (idUserOwner !== undefined) {
      res.idUserOwner = idUserOwner;
    }

    return res;
  }
}
