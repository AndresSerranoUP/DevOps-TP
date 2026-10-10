import { IsInt, IsNotEmpty, IsString } from 'class-validator';

export class MediaCreateDto {
  @IsInt()
  idGame!: number;

  @IsInt()
  idMediaType!: number;

  @IsString()
  @IsNotEmpty()
  url!: string;

  // Legacy aliases
  get IdGame(): number { return this.idGame; }
  set IdGame(v: number) { this.idGame = v; }

  get IdMediaType(): number { return this.idMediaType; }
  set IdMediaType(v: number) { this.idMediaType = v; }

  get Url(): string { return this.url; }
  set Url(v: string) { this.url = v; }
}
