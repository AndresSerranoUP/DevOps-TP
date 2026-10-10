import { IsDateString, IsInt, IsOptional } from 'class-validator';

export class UserGamesCreateDto {
  @IsInt()
  idGame!: number;

  @IsOptional()
  @IsDateString()
  buyDate?: string;

  // Legacy aliases
  get IdGame(): number { return this.idGame; }
  set IdGame(v: number) { this.idGame = v; }

  get BuyDate(): string | undefined { return this.buyDate; }
  set BuyDate(v: string | undefined) { this.buyDate = v; }
}
