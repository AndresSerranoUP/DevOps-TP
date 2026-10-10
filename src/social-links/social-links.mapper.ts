export interface SocialLinkResponse {
  idSocialLink: number;
  webName: string;
  webUrl: string;
  imgSocialLink?: string | null;
  idDeveloper?: number;
  disabled?: number;
}

export class SocialLinksMapper {
  static toResponse(row: Record<string, any>): SocialLinkResponse {
    const idSocialLink = Number(row.IdSocialLink ?? row.idSocialLink);
    const webName = String(row.NameSocialLink ?? row.webName ?? row.nameSocialLink ?? '');
    const webUrl = String(row.UrlSocialLink ?? row.webUrl ?? row.urlSocialLink ?? '');
    const imgSocialLink = (row.ImgSocialLink ?? row.imgSocialLink) ?? null;
    const idDeveloper = row.IdDeveloper !== undefined ? Number(row.IdDeveloper) : (row.idDeveloper !== undefined ? Number(row.idDeveloper) : undefined);
    const disabled = row.Disabled !== undefined && row.Disabled !== null
      ? Number(row.Disabled)
      : (row.disabled !== undefined ? Number(row.disabled) : 0);

    return {
      idSocialLink,
      webName,
      webUrl,
      imgSocialLink,
      idDeveloper,
      disabled,
    };
  }
}
