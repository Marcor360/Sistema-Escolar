import { IsIn, IsInt, IsObject, IsOptional, IsString, Length, Matches, Min } from 'class-validator';
export class EvidenciaDto {
  @IsIn(['NO_ADEUDO', 'SERVICIO_SOCIAL', 'CONCLUSION']) tipo!: string;
  @IsString() @Length(10, 600) @Matches(/\S.{8,}\S/s) detalle!: string;
}
export class ExpedicionDto {
  @IsIn(['BOLETA', 'ASIGNATURAS', 'CONSTANCIA', 'HISTORIAL', 'FINALIZACION', 'CERTIFICADO', 'TITULO'])
  tipo!: string;
  @IsOptional() @IsInt() @Min(1) carreraPlanId?: number;
  @IsOptional() @IsObject() datos?: Record<string, Record<string, string>>;
  @IsOptional() @IsString() @Length(32, 2048) @Matches(/^[A-Za-z0-9+/]+={0,2}$/) sello?: string;
}
