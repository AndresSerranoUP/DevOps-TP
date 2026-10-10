import { IsInt, IsOptional } from 'class-validator';

export class DeveloperUserCreateDto {
  @IsInt()
  idUser!: number;

  @IsInt()
  idDeveloper!: number;

  @IsOptional()
  @IsInt()
  rango?: number;

  // Legacy aliases
  get IdUser(): number { return this.idUser; }
  set IdUser(v: number) { this.idUser = v; }

  get IdDeveloper(): number { return this.idDeveloper; }
  set IdDeveloper(v: number) { this.idDeveloper = v; }

  get Rango(): number | undefined { return this.rango; }
  set Rango(v: number | undefined) { this.rango = v; }
}
