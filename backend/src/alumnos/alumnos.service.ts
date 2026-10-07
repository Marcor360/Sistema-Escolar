import { BitacoraAcademica } from '../entities/bitacora-academica.entity';
import { inscripcionVigente } from '../common/contexto-academico';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Alumno } from '../entities/alumno.entity';
import { Plantel } from '../entities/plantel.entity';
import { Inscripcion } from '../entities/inscripcion.entity';
import { GrupoMateria } from '../entities/grupo-materia.entity';
import { UsuariosService } from '../usuarios/usuarios.service';
import { JwtUser } from '../common/current-user.decorator';
import { ScopeService } from '../planteles/scope.service';
import { ActualizarAlumnoDto, CrearAlumnoDto, ListarAlumnosDto } from './alumnos.dto';

@Injectable()
export class AlumnosService {
  constructor(
    @InjectRepository(Alumno) private readonly alumnos: Repository<Alumno>,
    @InjectRepository(Inscripcion) private readonly inscripciones: Repository<Inscripcion>,
    @InjectRepository(GrupoMateria) private readonly grupoMaterias: Repository<GrupoMateria>,
    private readonly usuarios: UsuariosService,
    private readonly scope: ScopeService,
    private readonly dataSource: DataSource,
  ) {}

  async listar(query: ListarAlumnosDto, user?: JwtUser) {
    const pagina = query.pagina || 1;
    const porPagina = query.porPagina || 20;
    const maestroPuro = user?.roles.includes('MAESTRO') &&
      !user.roles.some((rol) => ['SUPERADMIN', 'ADMINISTRATIVO', 'FINANZAS'].includes(rol));
    const planteles = user && !maestroPuro ? await this.scope.resolverFiltro(user, query.plantelId) : null;
    const qb = this.alumnos.createQueryBuilder('a')
      .leftJoinAndSelect('a.usuario', 'u')
      .leftJoinAndSelect('a.plantel', 'p');
    if (planteles !== null) qb.andWhere('a.plantel_id IN (:...planteles)', { planteles });

    if (maestroPuro && user) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM inscripciones i INNER JOIN grupos g ON g.id = i.grupo_id AND g.activo = :grupoActivo INNER JOIN ciclos_escolares ce ON ce.id = g.ciclo_id AND ce.activo = :grupoActivo INNER JOIN planteles pl ON pl.id = g.plantel_id AND pl.activo = :grupoActivo INNER JOIN grupo_materias gm ON gm.grupo_id = i.grupo_id INNER JOIN docentes d ON d.id = gm.docente_id WHERE i.alumno_id = a.id AND i.estatus = :estatusInscripcion AND d.usuario_id = :docenteUsuarioId)',
        { grupoActivo: true, estatusInscripcion: 'ACTIVA', docenteUsuarioId: user.sub },
      );
    }
    if (query.buscar?.trim()) {
      qb.andWhere('(a.matricula LIKE :buscar OR u.nombre LIKE :buscar OR u.apellido_paterno LIKE :buscar OR u.apellido_materno LIKE :buscar)', {
        buscar: `%${query.buscar.trim()}%`,
      });
    }
    const [datos, total] = await qb.orderBy('a.id', 'DESC')
      .skip((pagina - 1) * porPagina)
      .take(porPagina)
      .getManyAndCount();
    const administrativo = user?.roles.some((rol) => ['ADMINISTRATIVO', 'SUPERADMIN'].includes(rol)) ?? false;
    return {
      datos: datos.map((a) => ({
        id: a.id,
        matricula: a.matricula,
        estatus: a.estatus,
        usuario: {
          nombre: a.usuario.nombre,
          apellidoPaterno: a.usuario.apellidoPaterno,
          apellidoMaterno: a.usuario.apellidoMaterno,
          ...(administrativo ? { email: a.usuario.email } : {}),
        },
        plantel: a.plantel ? { id: a.plantel.id, nombre: a.plantel.nombre } : null,
      })),
      total, pagina, porPagina,
    };
  }

  async obtener(id: number, user?: JwtUser) {
    const alumno = await this.alumnos.findOne({ where: { id } });
    if (!alumno) throw new NotFoundException('Alumno no encontrado');
    if (user) {
      const maestroPuro = user.roles.includes('MAESTRO') &&
        !user.roles.some((rol) => ['SUPERADMIN', 'ADMINISTRATIVO', 'FINANZAS'].includes(rol));
      if (maestroPuro) {
        const permitido = await this.inscripciones.createQueryBuilder('i')
          .where('i.alumno_id = :alumnoId', { alumnoId: id })
          .andWhere('i.estatus = :estatus', { estatus: 'ACTIVA' })
          .andWhere(
            'EXISTS (SELECT 1 FROM grupos g INNER JOIN ciclos_escolares ce ON ce.id = g.ciclo_id AND ce.activo = :grupoActivo INNER JOIN planteles pl ON pl.id = g.plantel_id AND pl.activo = :grupoActivo INNER JOIN grupo_materias gm ON gm.grupo_id = g.id INNER JOIN docentes d ON d.id = gm.docente_id WHERE g.id = i.grupo_id AND g.activo = :grupoActivo AND d.usuario_id = :usuarioId)',
            { grupoActivo: true, usuarioId: user.sub },
          )
          .getCount();
        if (!permitido) throw new ForbiddenException('El alumno no pertenece a uno de tus grupos');
      }
      if (!maestroPuro) await this.scope.validarGestion(user, alumno.plantelId);
    }
    return alumno;
  }

  async obtenerParaApi(id: number, user: JwtUser) {
    const alumno = await this.obtener(id, user);
    const publico = {
      id: alumno.id,
      matricula: alumno.matricula,
      estatus: alumno.estatus,
      plantelId: alumno.plantelId,
      plantel: alumno.plantel ? { id: alumno.plantel.id, nombre: alumno.plantel.nombre } : null,
      usuario: {
        id: alumno.usuario.id,
        nombre: alumno.usuario.nombre,
        apellidoPaterno: alumno.usuario.apellidoPaterno,
        apellidoMaterno: alumno.usuario.apellidoMaterno,
      },
    };
    if (!user.roles.some((rol) => ['ADMINISTRATIVO', 'SUPERADMIN'].includes(rol))) return publico;
    return {
      ...publico,
      curp: alumno.curp,
      fechaNacimiento: alumno.fechaNacimiento,
      tutorNombre: alumno.tutorNombre,
      tutorTelefono: alumno.tutorTelefono,
      direccion: alumno.direccion,
      usuario: { ...publico.usuario, email: alumno.usuario.email, telefono: alumno.usuario.telefono },
    };
  }

  async obtenerPorUsuario(usuarioId: number) {
    const alumno = await this.alumnos.findOne({ where: { usuarioId } });
    if (!alumno) throw new NotFoundException('El usuario no tiene expediente de alumno');
    return alumno;
  }

  async historial(id: number, user: JwtUser) {
    const alumno = await this.obtener(id, user);
    const inscripciones = await this.inscripciones.find({ where: { alumnoId: alumno.id }, order: { id: 'DESC' } });
    const permitidos = await this.scope.plantelesDe(user);
    return inscripciones.filter((i) => permitidos === null || permitidos.includes(i.grupo.plantelId)).map((i) => ({
      id: i.id, grupoId: i.grupoId, estatus: i.estatus, fechaInscripcion: i.fechaInscripcion,
      grupo: { id: i.grupo.id, nombre: i.grupo.nombre, ciclo: i.grupo.ciclo, plantel: { id: i.grupo.plantelId, nombre: i.grupo.plantel.nombre } },
    }));
  }

  async perfilPropio(usuarioId: number) {
    const alumno = await this.obtenerPorUsuario(usuarioId);
    return {
      id: alumno.id,
      matricula: alumno.matricula,
      estatus: alumno.estatus,
      curp: alumno.curp,
      tutorNombre: alumno.tutorNombre,
      usuario: {
        nombre: alumno.usuario.nombre,
        apellidoPaterno: alumno.usuario.apellidoPaterno,
        nombreCompleto: alumno.usuario.nombreCompleto,
        email: alumno.usuario.email,
      },
    };
  }

  async crear(dto: CrearAlumnoDto, user?: JwtUser) {
    if (user) await this.scope.validarGestion(user, dto.plantelId);
    const existe = await this.alumnos.findOne({ where: { matricula: dto.matricula }, withDeleted: true });
    if (existe) throw new ConflictException('La matrícula ya está registrada');

    return this.dataSource.transaction(async (manager) => {
      const plantel = await manager.getRepository(Plantel).findOne({ where: { id: dto.plantelId, activo: true } });
      if (!plantel) throw new ConflictException('El plantel no está activo');
      const usuario = await this.usuarios.crear({
        email: dto.email,
        password: dto.password,
        nombre: dto.nombre,
        apellidoPaterno: dto.apellidoPaterno,
        apellidoMaterno: dto.apellidoMaterno,
        telefono: dto.telefono,
        roles: ['ALUMNO'],
      }, manager);
      const alumnos = manager.getRepository(Alumno);
      return alumnos.save(alumnos.create({
        usuarioId: usuario.id,
        plantelId: dto.plantelId,
        matricula: dto.matricula,
        curp: dto.curp ?? null,
        fechaNacimiento: dto.fechaNacimiento ?? null,
        tutorNombre: dto.tutorNombre ?? null,
        tutorTelefono: dto.tutorTelefono ?? null,
        direccion: dto.direccion ?? null,
      }));
    });
  }

  async actualizar(id: number, dto: ActualizarAlumnoDto, user?: JwtUser) {
    if (dto.estatus !== undefined) throw new BadRequestException('Usa las acciones de baja o egreso para cambiar el estado');
    if (dto.plantelId !== undefined) throw new BadRequestException('Usa la transferencia para cambiar de plantel');
    return this.dataSource.transaction(async (manager) => {
      const alumnos = manager.getRepository(Alumno);
      const alumno = await alumnos.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!alumno) throw new NotFoundException('Alumno no encontrado');
      if (user) {
        await this.scope.validarGestion(user, alumno.plantelId);
        if (dto.plantelId) await this.scope.validarGestion(user, dto.plantelId);
      }
      if (dto.nombre || dto.apellidoPaterno || dto.apellidoMaterno || dto.telefono) {
        await this.usuarios.actualizar(alumno.usuarioId, {
          nombre: dto.nombre,
          apellidoPaterno: dto.apellidoPaterno,
          apellidoMaterno: dto.apellidoMaterno,
          telefono: dto.telefono,
        }, manager);
      }
      Object.assign(alumno, {
        curp: dto.curp ?? alumno.curp,
        fechaNacimiento: dto.fechaNacimiento ?? alumno.fechaNacimiento,
        tutorNombre: dto.tutorNombre ?? alumno.tutorNombre,
        tutorTelefono: dto.tutorTelefono ?? alumno.tutorTelefono,
        direccion: dto.direccion ?? alumno.direccion,

      });
      return alumnos.save(alumno);
    });
  }

  async baja(id: number, user?: JwtUser) {
    return this.dataSource.transaction(async (manager) => {
      const alumnos = manager.getRepository(Alumno);
      const alumno = await alumnos.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!alumno) throw new NotFoundException('Alumno no encontrado');
      if (user) await this.scope.validarGestion(user, alumno.plantelId);
      if (alumno.estatus !== 'ACTIVO') throw new ConflictException('Solo puede darse de baja un alumno activo; un egresado conserva su estado histórico');
      alumno.estatus = 'BAJA';
      await alumnos.save(alumno);

      await manager.getRepository(Inscripcion).update(
        { alumnoId: id, estatus: 'ACTIVA' }, { estatus: 'BAJA' },
      );
      await this.usuarios.actualizar(alumno.usuarioId, { activo: false }, manager);
      if (user) await manager.getRepository(BitacoraAcademica).insert({ usuarioId: user.sub, plantelId: alumno.plantelId, accion: 'ALUMNO_BAJA', entidadId: id, detalle: 'Transición explícita: cuenta e inscripciones desactivadas', fecha: new Date() });
      return { ok: true };
    });
  }

  /** Egresar conserva el expediente; el piloto no habilita acceso de egresados. */
  async egresar(id: number, user: JwtUser) {
    return this.dataSource.transaction(async (manager) => {
      const alumnos = manager.getRepository(Alumno);
      const alumno = await alumnos.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!alumno) throw new NotFoundException('Alumno no encontrado');
      await this.scope.validarGestion(user, alumno.plantelId);
      if (alumno.estatus !== 'ACTIVO') throw new ConflictException('Solo puede egresar un alumno activo');
      alumno.estatus = 'EGRESADO';
      await alumnos.save(alumno);
      await manager.getRepository(Inscripcion).update({ alumnoId: id, estatus: 'ACTIVA' }, { estatus: 'BAJA' });
      await this.usuarios.actualizar(alumno.usuarioId, { activo: false }, manager);
      if (user) await manager.getRepository(BitacoraAcademica).insert({ usuarioId: user.sub, plantelId: alumno.plantelId, accion: alumno.estatus === 'EGRESADO' ? 'ALUMNO_EGRESADO' : 'ALUMNO_BAJA', entidadId: id, detalle: 'Transición explícita: cuenta e inscripciones desactivadas', fecha: new Date() });
      return { ok: true };
    });
  }

  /** La transferencia termina las inscripciones anteriores y conserva su historial. */
  async transferir(id: number, plantelId: number, user: JwtUser) {
    return this.dataSource.transaction(async (manager) => {
      const alumnos = manager.getRepository(Alumno);
      const alumno = await alumnos.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!alumno) throw new NotFoundException('Alumno no encontrado');
      await this.scope.validarGestion(user, alumno.plantelId);
      await this.scope.validarGestion(user, plantelId);
      if (alumno.estatus !== 'ACTIVO') throw new ConflictException('Solo puede transferirse un alumno activo');
      if (alumno.plantelId === plantelId) throw new ConflictException('El alumno ya pertenece a ese plantel');
      const destino = await manager.getRepository(Plantel).findOne({ where: { id: plantelId, activo: true } });
      if (!destino) throw new NotFoundException('Plantel de destino activo no encontrado');
      await manager.getRepository(Inscripcion).update({ alumnoId: id, estatus: 'ACTIVA' }, { estatus: 'BAJA' });
      await manager.getRepository(BitacoraAcademica).insert({ usuarioId: user.sub, plantelId: alumno.plantelId, accion: 'ALUMNO_TRANSFERIDO', entidadId: id, detalle: `origen=${alumno.plantelId}; destino=${plantelId}; inscripciones anteriores desactivadas`, fecha: new Date() });
      alumno.plantelId = plantelId;
      alumno.plantel = destino;
      await alumnos.save(alumno);
      return { ok: true, mensaje: 'Transferencia completada; inscribe al alumno en el grupo de destino' };
    });
  }

  async reactivar(id: number, motivo: string, user: JwtUser) {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Alumno);
      const alumno = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!alumno) throw new NotFoundException('Alumno no encontrado');
      await this.scope.validarGestion(user, alumno.plantelId);
      if (alumno.estatus !== 'BAJA') throw new ConflictException('Solo se reactiva una baja; un egresado requiere otro proceso institucional');
      if (!await manager.getRepository(Plantel).findOneBy({ id: alumno.plantelId, activo: true })) throw new ConflictException('El plantel no está activo');
      await repo.update(id, { estatus: 'ACTIVO' });
      await this.usuarios.actualizar(alumno.usuarioId, { activo: true }, manager);
      await manager.getRepository(BitacoraAcademica).insert({ usuarioId: user.sub, plantelId: alumno.plantelId, accion: 'ALUMNO_REACTIVADO', entidadId: id, detalle: motivo, fecha: new Date() });
      return { ok: true, mensaje: 'Expediente reactivado; inscribe explícitamente al alumno. No se restauran inscripciones.' };
    });
  }

  /** Materias del alumno en sus grupos con inscripción activa. */
  async misMaterias(usuarioId: number) {
    const alumno = await this.obtenerPorUsuario(usuarioId);
    const inscripciones = await this.inscripciones.find({
      where: { ...inscripcionVigente, alumnoId: alumno.id },
    });
    if (inscripciones.length === 0) return [];
    const grupoIds = [...new Set(inscripciones.map((insc) => insc.grupoId))];
    return this.grupoMaterias.find({ where: { grupoId: In(grupoIds) }, order: { grupoId: 'ASC', materiaId: 'ASC' } });
  }
}
