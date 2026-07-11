import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Docente } from '../entities/docente.entity';
import { UsuariosService } from '../usuarios/usuarios.service';
import { ActualizarDocenteDto, CrearDocenteDto } from './docentes.dto';
import { UsuarioPlantel } from '../entities/usuario-plantel.entity';
import { ScopeService } from '../planteles/scope.service';
import { JwtUser } from '../common/current-user.decorator';
import { In } from 'typeorm';

@Injectable()
export class DocentesService {
  constructor(
    @InjectRepository(Docente) private readonly docentes: Repository<Docente>,
    @InjectRepository(UsuarioPlantel) private readonly asignaciones: Repository<UsuarioPlantel>,
    private readonly usuarios: UsuariosService,
    private readonly scope: ScopeService,
  ) {}

  async listar(user: JwtUser, plantelId?: number) {
    const planteles = await this.scope.resolverFiltro(user, plantelId);
    const qb = this.docentes.createQueryBuilder('d').innerJoinAndSelect('d.usuario', 'u');
    if (planteles !== null) qb.andWhere(
      'EXISTS (SELECT 1 FROM usuario_planteles up WHERE up.usuario_id = u.id AND up.activo = :activa AND up.plantel_id IN (:...planteles))',
      { activa: true, planteles },
    );
    const docentes = await qb.orderBy('d.id', 'DESC').getMany();
    const asignaciones = docentes.length ? await this.asignaciones.find({
      where: { usuarioId: In(docentes.map((d) => d.usuarioId)), activo: true },
    }) : [];
    return docentes.map((d) => ({
      ...d,
      planteles: asignaciones.filter((a) => a.usuarioId === d.usuarioId).map((a) => a.plantel.nombre),
    }));
  }

  async obtener(id: number) {
    const docente = await this.docentes.findOne({ where: { id } });
    if (!docente) throw new NotFoundException('Docente no encontrado');
    return docente;
  }

  async obtenerPorUsuario(usuarioId: number) {
    const docente = await this.docentes.findOne({ where: { usuarioId } });
    if (!docente) throw new NotFoundException('El usuario no tiene expediente de docente');
    return docente;
  }

  async crear(dto: CrearDocenteDto, user: JwtUser) {
    const plantelIds = [...new Set(dto.plantelIds)];
    for (const plantelId of plantelIds) await this.scope.validarGestion(user, plantelId);
    const existe = await this.docentes.findOne({ where: { numEmpleado: dto.numEmpleado }, withDeleted: true });
    if (existe) throw new ConflictException('El número de empleado ya está registrado');

    const usuario = await this.usuarios.crear({
      email: dto.email,
      password: dto.password,
      nombre: dto.nombre,
      apellidoPaterno: dto.apellidoPaterno,
      apellidoMaterno: dto.apellidoMaterno,
      telefono: dto.telefono,
      roles: ['MAESTRO'],
    });
    const docente = await this.docentes.save(
      this.docentes.create({
        usuarioId: usuario.id,
        numEmpleado: dto.numEmpleado,
        cedulaProfesional: dto.cedulaProfesional ?? null,
        especialidad: dto.especialidad ?? null,
      }),
    );
    await this.asignaciones.save(plantelIds.map((plantelId) => this.asignaciones.create({
      usuarioId: usuario.id, plantelId, activo: true,
    })));
    return docente;
  }

  async actualizar(id: number, dto: ActualizarDocenteDto) {
    const docente = await this.obtener(id);
    if (dto.nombre || dto.apellidoPaterno || dto.apellidoMaterno || dto.telefono) {
      await this.usuarios.actualizar(docente.usuarioId, {
        nombre: dto.nombre,
        apellidoPaterno: dto.apellidoPaterno,
        apellidoMaterno: dto.apellidoMaterno,
        telefono: dto.telefono,
      });
    }
    Object.assign(docente, {
      cedulaProfesional: dto.cedulaProfesional ?? docente.cedulaProfesional,
      especialidad: dto.especialidad ?? docente.especialidad,
      estatus: dto.estatus ?? docente.estatus,
    });
    return this.docentes.save(docente);
  }

  async baja(id: number) {
    const docente = await this.obtener(id);
    docente.estatus = 'BAJA';
    await this.docentes.save(docente);
    await this.docentes.softDelete(id);
    return { ok: true };
  }
}
