import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtUser } from '../common/current-user.decorator';
import { TitulacionFirmante } from '../entities/titulacion-firmante.entity';
import { ScopeService } from '../planteles/scope.service';
import { RegistrarFirmanteDto } from './firmantes.dto';

@Injectable()
export class FirmantesService {
  constructor(
    @InjectRepository(TitulacionFirmante) private readonly firmantes: Repository<TitulacionFirmante>,
    private readonly scope: ScopeService,
  ) {}

  private exigirDirector(actor: JwtUser) {
    if (actor.portal === 'MOVIL' || !actor.roles.includes('DIRECTOR')) {
      throw new ForbiddenException('Los firmantes de titulación solo los administra DIRECTOR desde web');
    }
  }

  async registrar(dto: RegistrarFirmanteDto, actor: JwtUser) {
    this.exigirDirector(actor);
    await this.scope.validarGestion(actor, dto.plantelId);
    if (dto.vigenteHasta && dto.vigenteHasta < dto.vigenteDesde) {
      throw new ConflictException('La vigencia termina antes del nombramiento');
    }
    const nuevo = this.firmantes.create({
      plantelId: dto.plantelId,
      nombre: dto.nombre.trim(),
      cargo: dto.cargo.trim(),
      curp: dto.curp,
      vigenteDesde: dto.vigenteDesde.slice(0, 10),
      vigenteHasta: dto.vigenteHasta?.slice(0, 10) ?? null,
      certificadoSha256: dto.certificadoSha256 ?? null,
      estado: 'PENDIENTE_VALIDACION',
      registradoPorId: actor.sub,
    });
    const guardado = await this.firmantes.save(nuevo);
    return this.presentar(guardado);
  }

  async listar(plantelId: number, actor: JwtUser) {
    this.exigirDirector(actor);
    await this.scope.validarGestion(actor, plantelId);
    const filas = await this.firmantes.find({
      where: { plantelId }, order: { id: 'DESC' }, take: 100,
    });
    return filas.map((fila) => this.presentar(fila));
  }

  async desactivar(id: number, actor: JwtUser) {
    this.exigirDirector(actor);
    const firmante = await this.firmantes.findOne({ where: { id } });
    if (!firmante) throw new NotFoundException('Firmante no encontrado');
    await this.scope.validarGestion(actor, firmante.plantelId);
    if (firmante.estado === 'INACTIVO') return this.presentar(firmante);
    firmante.estado = 'INACTIVO';
    return this.presentar(await this.firmantes.save(firmante));
  }

  private presentar(fila: TitulacionFirmante) {
    return {
      id: fila.id, plantelId: fila.plantelId, nombre: fila.nombre, cargo: fila.cargo,
      vigenteDesde: fila.vigenteDesde, vigenteHasta: fila.vigenteHasta,
      certificadoConfigurado: Boolean(fila.certificadoSha256), estado: fila.estado,
    };
  }
}
