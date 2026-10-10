import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  IsArray,
} from 'class-validator';

export class GameCreateDto {
  @IsString()
  @IsNotEmpty()
  nameGame!: string;

  @IsOptional()
  @IsDateString()
  releaseDate?: string;

  @IsInt()
  idDeveloper!: number;

  @IsOptional()
  @IsString()
  imgThumbnail?: string;

  @IsOptional()
  @IsString()
  imgLogo?: string;

  @IsOptional()
  @IsString()
  imgBackground?: string;

  @IsOptional()
  @IsNumber()
  size?: number;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsString()
  longDescription?: string;

  @IsOptional()
  @IsString()
  shortDescription?: string;

  @IsOptional()
  @IsString()
  minRam?: string;

  @IsOptional()
  @IsString()
  minGpu?: string;

  @IsOptional()
  @IsString()
  minCpu?: string;

  @IsOptional()
  @IsString()
  minOs?: string;

  @IsOptional()
  @IsInt()
  idSteam?: number;

  @IsOptional()
  @IsArray()
  genresIds?: number[];

  // Legacy aliases
  get NameGame(): string { return this.nameGame; }
  set NameGame(v: string) { this.nameGame = v; }

  get ReleaseDate(): string | undefined { return this.releaseDate; }
  set ReleaseDate(v: string | undefined) { this.releaseDate = v; }

  get IdDeveloper(): number { return this.idDeveloper; }
  set IdDeveloper(v: number) { this.idDeveloper = v; }

  get ImgThumbnail(): string | undefined { return this.imgThumbnail; }
  set ImgThumbnail(v: string | undefined) { this.imgThumbnail = v; }

  get ImgLogo(): string | undefined { return this.imgLogo; }
  set ImgLogo(v: string | undefined) { this.imgLogo = v; }

  get ImgBackground(): string | undefined { return this.imgBackground; }
  set ImgBackground(v: string | undefined) { this.imgBackground = v; }

  get Size(): number | undefined { return this.size; }
  set Size(v: number | undefined) { this.size = v; }

  get Price(): number { return this.price; }
  set Price(v: number) { this.price = v; }

  get LongDescription(): string | undefined { return this.longDescription; }
  set LongDescription(v: string | undefined) { this.longDescription = v; }

  get ShortDescription(): string | undefined { return this.shortDescription; }
  set ShortDescription(v: string | undefined) { this.shortDescription = v; }

  get MinRam(): string | undefined { return this.minRam; }
  set MinRam(v: string | undefined) { this.minRam = v; }

  get MinGpu(): string | undefined { return this.minGpu; }
  set MinGpu(v: string | undefined) { this.minGpu = v; }

  get MinCpu(): string | undefined { return this.minCpu; }
  set MinCpu(v: string | undefined) { this.minCpu = v; }

  get MinOs(): string | undefined { return this.minOs; }
  set MinOs(v: string | undefined) { this.minOs = v; }

  get IdSteam(): number | undefined { return this.idSteam; }
  set IdSteam(v: number | undefined) { this.idSteam = v; }

  get GenresIds(): number[] | undefined { return this.genresIds; }
  set GenresIds(v: number[] | undefined) { this.genresIds = v; }
}

export class GameUpdateDto extends GameCreateDto {
  @IsOptional()
  @IsInt()
  idGame?: number;

  get IdGame(): number | undefined { return this.idGame; }
  set IdGame(v: number | undefined) { this.idGame = v; }
}

export class GameMinUpdateDto {
  @IsOptional()
  @IsString()
  nameGame?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  disabled?: boolean | number;

  @IsOptional()
  @IsString()
  imgThumbnail?: string;

  @IsOptional()
  @IsString()
  imgLogo?: string;

  @IsOptional()
  @IsString()
  imgBackground?: string;

  @IsOptional()
  @IsString()
  minRam?: string;

  @IsOptional()
  @IsString()
  minGpu?: string;

  @IsOptional()
  @IsString()
  minCpu?: string;

  @IsOptional()
  @IsString()
  minOs?: string;
}

export class RateDto {
  @IsInt()
  likes!: number;

  get Likes(): number { return this.likes; }
  set Likes(v: number) { this.likes = v; }
}

export class GameCreateResponseDto {
  idGame!: number;
  nameGame!: string;
  releaseDate!: string | Date;
  idDeveloper!: number;
  price!: number;
  disabled!: number;
  genresIds!: number[];
}
