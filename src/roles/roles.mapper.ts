export interface RoleResponse {
  idRole: number;
  roleName: string;
  disabled?: number;
}

export class RolesMapper {
  static toResponse(row: Record<string, any>): RoleResponse {
    const idRole = Number(row.IdRole ?? row.idRole);
    const roleName = String(row.NameRole ?? row.roleName ?? row.nameRole ?? '');
    const disabled = row.Disabled !== undefined && row.Disabled !== null
      ? Number(row.Disabled)
      : (row.disabled !== undefined ? Number(row.disabled) : 0);

    return {
      idRole,
      roleName,
      disabled,
    };
  }
}
