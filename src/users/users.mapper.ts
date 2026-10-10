export interface UserResponse {
  idUser: number;
  emailUser: string;
  usernameUser: string;
  imgAvatar: string | null;
  idRole: number | null;
  isVerified: boolean | null;
  disabled: number | null;
}

export class UsersMapper {
  static toResponse(row: Record<string, any>): UserResponse {
    const idUser = Number(row.IdUser ?? row.idUser);
    const emailUser = String(row.EmailUser ?? row.emailUser ?? '');
    const usernameUser = String(row.UsernameUser ?? row.usernameUser);
    const imgAvatar = (row.ImgAvatar ?? row.imgAvatar) ?? null;
    const idRole = row.IdRole !== undefined && row.IdRole !== null
      ? Number(row.IdRole)
      : (row.idRole !== undefined && row.idRole !== null ? Number(row.idRole) : null);
    const isVerified = row.IsVerified !== undefined && row.IsVerified !== null
      ? Boolean(row.IsVerified)
      : (row.isVerified !== undefined && row.isVerified !== null ? Boolean(row.isVerified) : null);
    const disabled = row.Disabled !== undefined && row.Disabled !== null
      ? Number(row.Disabled)
      : (row.disabled !== undefined && row.disabled !== null ? Number(row.disabled) : 0);

    return {
      idUser,
      emailUser,
      usernameUser,
      imgAvatar,
      idRole,
      isVerified,
      disabled,
    };
  }
}
