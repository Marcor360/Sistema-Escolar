import { IsObject, ValidateNested, IsString, Matches } from 'class-validator';
import { Type } from 'class-transformer';
class VersionesDocumentalesDto {
  @IsString() @Matches(/^[A-Za-z0-9._-]{1,80}$/) REGLAMENTO_ACADEMICO!: string;
  @IsString() @Matches(/^[A-Za-z0-9._-]{1,80}$/) POLITICAS_INSTITUCIONALES!: string;
}
export class AceptarConsentimientoDto {
  @IsObject() @ValidateNested() @Type(() => VersionesDocumentalesDto)
  versiones!: VersionesDocumentalesDto;
}
