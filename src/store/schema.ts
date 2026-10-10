export interface ColumnDefinition {
  type: 'Int' | 'NVarChar' | 'Bit' | 'DateTime' | 'Decimal';
  isNullable: boolean;
}

export interface ForeignKeyDefinition {
  table: string;
  column: string;
}

export interface TableDefinition {
  pk: string[];
  identity?: string;
  columns: Record<string, ColumnDefinition>;
  fks?: Record<string, ForeignKeyDefinition>;
}

export const SCHEMA: Record<string, TableDefinition> = {
  Users: {
    pk: ['IdUser'],
    identity: 'IdUser',
    columns: {
      IdUser: { type: 'Int', isNullable: false },
      EmailUser: { type: 'NVarChar', isNullable: false },
      PasswordUser: { type: 'NVarChar', isNullable: false },
      UsernameUser: { type: 'NVarChar', isNullable: false },
      ImgAvatar: { type: 'NVarChar', isNullable: true },
      HashUser: { type: 'NVarChar', isNullable: true },
      IsVerified: { type: 'Bit', isNullable: true },
      IdRole: { type: 'Int', isNullable: true },
      Disabled: { type: 'Int', isNullable: true },
    },
    fks: {
      IdRole: { table: 'Roles', column: 'IdRole' },
    },
  },
  Games: {
    pk: ['IdGame'],
    identity: 'IdGame',
    columns: {
      IdGame: { type: 'Int', isNullable: false },
      NameGame: { type: 'NVarChar', isNullable: false },
      ReleaseDate: { type: 'DateTime', isNullable: true },
      IdDeveloper: { type: 'Int', isNullable: false },
      ImgThumbnail: { type: 'NVarChar', isNullable: true },
      ImgLogo: { type: 'NVarChar', isNullable: true },
      ImgBackground: { type: 'NVarChar', isNullable: true },
      Size: { type: 'Decimal', isNullable: true },
      Price: { type: 'Decimal', isNullable: false },
      LongDescription: { type: 'NVarChar', isNullable: true },
      ShortDescription: { type: 'NVarChar', isNullable: true },
      MinRam: { type: 'NVarChar', isNullable: true },
      MinGpu: { type: 'NVarChar', isNullable: true },
      MinCpu: { type: 'NVarChar', isNullable: true },
      MinOs: { type: 'NVarChar', isNullable: true },
      IdSteam: { type: 'Int', isNullable: true },
      Disabled: { type: 'Int', isNullable: true },
    },
    fks: {
      IdDeveloper: { table: 'Developers', column: 'IdDeveloper' },
    },
  },
  Developers: {
    pk: ['IdDeveloper'],
    identity: 'IdDeveloper',
    columns: {
      IdDeveloper: { type: 'Int', isNullable: false },
      NameDeveloper: { type: 'NVarChar', isNullable: false },
      LogoDeveloper: { type: 'NVarChar', isNullable: true },
      LongDescription: { type: 'NVarChar', isNullable: true },
      ShortDescription: { type: 'NVarChar', isNullable: true },
      Disabled: { type: 'Int', isNullable: true },
    },
  },
  Genres: {
    pk: ['IdGenre'],
    identity: 'IdGenre',
    columns: {
      IdGenre: { type: 'Int', isNullable: false },
      NameGenre: { type: 'NVarChar', isNullable: false },
      Disabled: { type: 'Int', isNullable: true },
    },
  },
  Roles: {
    pk: ['IdRole'],
    identity: 'IdRole',
    columns: {
      IdRole: { type: 'Int', isNullable: false },
      NameRole: { type: 'NVarChar', isNullable: false },
      Disabled: { type: 'Int', isNullable: true },
    },
  },
  SocialLinks: {
    pk: ['IdSocialLink'],
    identity: 'IdSocialLink',
    columns: {
      IdSocialLink: { type: 'Int', isNullable: false },
      NameSocialLink: { type: 'NVarChar', isNullable: false },
      UrlSocialLink: { type: 'NVarChar', isNullable: false },
      ImgSocialLink: { type: 'NVarChar', isNullable: true },
      IdDeveloper: { type: 'Int', isNullable: false },
      Disabled: { type: 'Int', isNullable: true },
    },
    fks: {
      IdDeveloper: { table: 'Developers', column: 'IdDeveloper' },
    },
  },
  MediaType: {
    pk: ['IdMediaType'],
    identity: 'IdMediaType',
    columns: {
      IdMediaType: { type: 'Int', isNullable: false },
      MediaTypeName: { type: 'NVarChar', isNullable: false },
    },
  },
  Media: {
    pk: ['IdMedia'],
    identity: 'IdMedia',
    columns: {
      IdMedia: { type: 'Int', isNullable: false },
      IdGame: { type: 'Int', isNullable: false },
      IdMediaType: { type: 'Int', isNullable: false },
      Url: { type: 'NVarChar', isNullable: false },
    },
    fks: {
      IdGame: { table: 'Games', column: 'IdGame' },
      IdMediaType: { table: 'MediaType', column: 'IdMediaType' },
    },
  },
  UsersGames: {
    pk: ['IdUser', 'IdGame'],
    columns: {
      IdUser: { type: 'Int', isNullable: false },
      IdGame: { type: 'Int', isNullable: false },
      BuyDate: { type: 'DateTime', isNullable: true },
    },
    fks: {
      IdUser: { table: 'Users', column: 'IdUser' },
      IdGame: { table: 'Games', column: 'IdGame' },
    },
  },
  Ratings: {
    pk: ['IdRating'],
    identity: 'IdRating',
    columns: {
      IdRating: { type: 'Int', isNullable: false },
      IdGame: { type: 'Int', isNullable: false },
      IdUser: { type: 'Int', isNullable: false },
      Likes: { type: 'Int', isNullable: false },
    },
    fks: {
      IdGame: { table: 'Games', column: 'IdGame' },
      IdUser: { table: 'Users', column: 'IdUser' },
    },
  },
  DevelopersUsers: {
    pk: ['IdUser', 'IdDeveloper'],
    columns: {
      IdUser: { type: 'Int', isNullable: false },
      IdDeveloper: { type: 'Int', isNullable: false },
      Rango: { type: 'Int', isNullable: true },
    },
    fks: {
      IdUser: { table: 'Users', column: 'IdUser' },
      IdDeveloper: { table: 'Developers', column: 'IdDeveloper' },
    },
  },
  GamesGenres: {
    pk: ['IdGame', 'IdGenre'],
    columns: {
      IdGame: { type: 'Int', isNullable: false },
      IdGenre: { type: 'Int', isNullable: false },
    },
    fks: {
      IdGame: { table: 'Games', column: 'IdGame' },
      IdGenre: { table: 'Genres', column: 'IdGenre' },
    },
  },
};
