import { Body, Controller, Delete, Get, Injectable, Module, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { EventoCalendario } from '../entities/evento-calendario.entity';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';

class EventoDto {
  @IsString() titulo: string;
  @IsOptional() @IsString() descripcion?: string;
  @IsOptional() @IsIn(['GENERAL', 'EXAMEN', 'ENTREGA', 'FESTIVO'])
  tipo?: 'GENERAL' | 'EXAMEN' | 'ENTREGA' | 'FESTIVO';
  @IsString() fechaInicio: string; // ISO
  @IsOptional() @IsString() fechaFin?: string;
  @IsOptional() @IsInt() grupoId?: number;
}

@Injectable()
export class CalendarioService {
  constructor(
    @InjectRepository(EventoCalendario) private readonly repo: Repository<EventoCalendario>,
  ) {}

  listar(desde?: string, hasta?: string) {
    if (desde && hasta) {
      return this.repo.find({
        where: { fechaInicio: Between(new Date(desde), new Date(hasta)) },
        order: { fechaInicio: 'ASC' },
      });
    }
    return this.repo.find({ order: { fechaInicio: 'ASC' }, take: 200 });
  }

  crear(dto: EventoDto) {
    return this.repo.save(
      this.repo.create({
        titulo: dto.titulo,
        descripcion: dto.descripcion ?? null,
        tipo: dto.tipo ?? 'GENERAL',
        fechaInicio: new Date(dto.fechaInicio),
        fechaFin: dto.fechaFin ? new Date(dto.fechaFin) : null,
        grupoId: dto.grupoId ?? null,
      }),
    );
  }

  async eliminar(id: number) {
    await this.repo.delete(id);
    return { ok: true };
  }
}

@ApiTags('calendario')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('calendario')
class CalendarioController {
  constructor(private readonly service: CalendarioService) {}

  @Get()
  listar(@Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.service.listar(desde, hasta);
  }

  @Post()
  @Roles('ADMINISTRATIVO', 'MAESTRO')
  crear(@Body() dto: EventoDto) {
    return this.service.crear(dto);
  }

  @Delete(':id')
  @Roles('ADMINISTRATIVO', 'MAESTRO')
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.service.eliminar(id);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([EventoCalendario])],
  providers: [CalendarioService],
  controllers: [CalendarioController],
})
export class CalendarioModule {}
