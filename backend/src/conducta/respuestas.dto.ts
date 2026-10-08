import { ApiProperty } from '@nestjs/swagger';
export class SeguimientoRespuestaDto {
  @ApiProperty() id!: number;
  @ApiProperty() incidenciaId!: number;
  @ApiProperty() usuarioId!: number;
  @ApiProperty() nota!: string;
  @ApiProperty() motivo!: string;
  @ApiProperty({ enum: ['ABIERTA','EN_SEGUIMIENTO','CERRADA','ANULADA'] }) estado!: string;
  @ApiProperty({ format: 'date-time' }) fecha!: string;
}
export class IncidenciaRespuestaDto {
  @ApiProperty() id!: number;
  @ApiProperty() alumnoId!: number;
  @ApiProperty() grupoId!: number;
  @ApiProperty() registradaPorId!: number;
  @ApiProperty() tipo!: string;
  @ApiProperty({ enum: ['LEVE','MEDIA','GRAVE'] }) gravedad!: string;
  @ApiProperty() descripcion!: string;
  @ApiProperty({ enum: ['ABIERTA','EN_SEGUIMIENTO','CERRADA','ANULADA'] }) estado!: string;
  @ApiProperty({ format: 'date-time' }) fecha!: string;
}
export class DetalleIncidenciaRespuestaDto extends IncidenciaRespuestaDto {
  @ApiProperty({ type: [SeguimientoRespuestaDto] }) seguimientos!: SeguimientoRespuestaDto[];
}
export class ListaIncidenciaRespuestaDto {
  @ApiProperty({ type: [IncidenciaRespuestaDto] }) datos!: IncidenciaRespuestaDto[];
  @ApiProperty() total!: number;
  @ApiProperty() pagina!: number;
  @ApiProperty() porPagina!: number;
}
export class OperacionRespuestaDto { @ApiProperty() ok!: boolean; }
