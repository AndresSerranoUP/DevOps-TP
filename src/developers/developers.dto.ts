import { IsNotEmpty, IsOptional, IsString, IsInt } from 'class-validator';

export class DeveloperCreateDto {
  @IsString()
  @IsNotEmpty()
  nameDeveloper!: string;

  @IsOptional()
  @IsString()
  logoDeveloper?: string;

  @IsOptional()
  @IsString()
  longDescription?: string;

  @IsOptional()
  @IsString()
  shortDescription?: string;

  // Legacy aliases
  get NameDeveloper(): string { return this.nameDeveloper; }
  set NameDeveloper(v: string) { this.nameDeveloper = v; }

  get LogoDeveloper(): string | undefined { return this.logoDeveloper; }
  set LogoDeveloper(v: string | undefined) { this.logoDeveloper = v; }

  get LongDescription(): string | undefined { return this.longDescription; }
  set LongDescription(v: string | undefined) { this.longDescription = v; }

  get ShortDescription(): string | undefined { return this.shortDescription; }
  set ShortDescription(v: string | undefined) { this.shortDescription = v; }
}

export class DeveloperUpdateDto extends DeveloperCreateDto {
  @IsOptional()
  @IsInt()
  idDeveloper?: number;

  get IdDeveloper(): number | undefined { return this.idDeveloper; }
  set IdDeveloper(v: number | undefined) { this.idDeveloper = v; }
}
