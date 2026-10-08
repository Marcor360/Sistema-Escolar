import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class CicloAnaliticaDto {
  @ApiProperty() id!: number;
  @ApiProperty() nombre!: string;
}
export class ParcialAnaliticaDto {
  @ApiProperty({ enum: [1,2,3] }) parcial!: number;
  @ApiProperty() capturados!: number;
  @ApiProperty() faltantes!: number;
  @ApiProperty({ type: Number, nullable: true }) promedio!: number | null;
}
export class ClaseAnaliticaDto {
  @ApiProperty() grupoMateriaId!: number;
  @ApiProperty() grupo!: string;
  @ApiProperty() materia!: string;
  @ApiProperty() plantel!: string;
  @ApiProperty() inscritos!: number;
  @ApiProperty() participantesHistoricos!: number;
  @ApiProperty() inscritosVigentes!: number;
  @ApiProperty() oficialesCompletos!: number;
  @ApiProperty({ type: Number, nullable: true }) promedioOficial!: number | null;
  @ApiProperty() aprobados!: number;
  @ApiProperty() bajoReferencia!: number;
  @ApiProperty({ type: [ParcialAnaliticaDto] }) parciales!: ParcialAnaliticaDto[];
  @ApiProperty() entregasEsperadas!: number;
  @ApiProperty() entregasRecibidas!: number;
  @ApiProperty() entregasFaltantes!: number;
}
export class AcademicoAnaliticaDto {
  @ApiProperty() regla!: string;
  @ApiProperty({ type: [ClaseAnaliticaDto] }) clases!: ClaseAnaliticaDto[];
}
export class FinancieroAnaliticaDto {
  @ApiProperty() cargos!: number;
  @ApiProperty() facturado!: number;
  @ApiProperty() aplicado!: number;
  @ApiProperty() saldo!: number;
}
export class AnaliticaRespuestaDto {
  @ApiProperty({ type: CicloAnaliticaDto }) ciclo!: CicloAnaliticaDto;
  @ApiProperty({ enum: ['VIGENTE','HISTORICO'] }) modo!: string;
  @ApiProperty({ type: Number, nullable: true }) plantelId!: number | null;
  @ApiProperty({ format: 'date-time' }) generadoEn!: string;
  @ApiPropertyOptional({ type: AcademicoAnaliticaDto, description: 'Solo capacidad académica; maestro restringido incluso con Finanzas' }) academico?: AcademicoAnaliticaDto;
  @ApiPropertyOptional({ type: FinancieroAnaliticaDto, description: 'Solo capacidad financiera, sumada independientemente de clases propias' }) financiero?: FinancieroAnaliticaDto;
}
