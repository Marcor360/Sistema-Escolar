import { ApiProperty } from '@nestjs/swagger';
export class GrupoPromocionDto {
  @ApiProperty() id!: number;
  @ApiProperty() nombre!: string;
  @ApiProperty() cicloId!: number;
}
export class AlumnoPromocionDto {
  @ApiProperty() id!: number;
  @ApiProperty() matricula!: string;
  @ApiProperty() nombre!: string;
  @ApiProperty() elegible!: boolean;
}
export class PreviewPromocionRespuestaDto {
  @ApiProperty({ type: GrupoPromocionDto }) origen!: GrupoPromocionDto;
  @ApiProperty({ type: GrupoPromocionDto }) destino!: GrupoPromocionDto;
  @ApiProperty() plantel!: string;
  @ApiProperty({ type: [AlumnoPromocionDto] }) alumnos!: AlumnoPromocionDto[];
  @ApiProperty() regla!: string;
}
export class ConfirmacionPromocionRespuestaDto {
  @ApiProperty() inscritos!: number;
  @ApiProperty() destinoGrupoId!: number;
}
export class CicloRespuestaDto {
  @ApiProperty() id!: number;
  @ApiProperty() clave!: string;
  @ApiProperty() nombre!: string;
  @ApiProperty({ format: 'date' }) fechaInicio!: string;
  @ApiProperty({ format: 'date' }) fechaFin!: string;
  @ApiProperty() activo!: boolean;
  @ApiProperty({ enum: ['PREPARACION','ACTIVO','EN_CIERRE','CERRADO'] }) estado!: string;
}
export class FaltanteCierreDto {
  @ApiProperty({ required: false }) grupoId?: number;
  @ApiProperty() grupoMateriaId!: number;
  @ApiProperty() parcial!: number;
  @ApiProperty() inscritos!: number;
  @ApiProperty() sinNota!: number;
  @ApiProperty() cerrado!: boolean;
}
export class ResumenCierreRespuestaDto {
  @ApiProperty({ type: CicloRespuestaDto }) ciclo!: CicloRespuestaDto;
  @ApiProperty() grupos!: number;
  @ApiProperty() clases!: number;
  @ApiProperty() inscritos!: number;
  @ApiProperty({ type: [FaltanteCierreDto] }) faltantes!: FaltanteCierreDto[];
  @ApiProperty() puedeCerrar!: boolean;
}
