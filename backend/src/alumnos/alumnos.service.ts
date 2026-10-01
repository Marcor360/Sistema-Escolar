import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Alumno } from '../entities/alumno.entity';
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

    if (maestroPuro) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM inscripciones i INNER JOIN grupos g ON g.id = i.grupo_id AND g.activo = :grupoActivo INNER JOIN grupo_materias gm ON gm.grupo_id = i.grupo_id INNER JOIN docentes d ON d.id = gm.docente_id WHERE i.alumno_id = a.id AND i.estatus = :estatusInscripcion AND d.usuario_id = :docenteUsuarioId)',
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
            'EXISTS (SELECT 1 FROM grupos g INNER JOIN grupo_materias gm ON gm.grupo_id = g.id INNER JOIN docentes d ON d.id = gm.docente_id WHERE g.id = i.grupo_id AND g.activo = :grupoActivo AND d.usuario_id = :usuarioId)',
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
    return this.dataSource.transaction(async (manager) => {
      const alumnos = manager.getRepository(Alumno);
      const alumno = await alumnos.findOne({ where: { id } });
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
        plantelId: dto.plantelId ?? alumno.plantelId,
        estatus: dto.estatus ?? alumno.estatus,
      });
      return alumnos.save(alumno);
    });
  }

  async baja(id: number, user?: JwtUser) {
    return this.dataSource.transaction(async (manager) => {
      const alumnos = manager.getRepository(Alumno);
      const alumno = await alumnos.findOne({ where: { id } });
      if (!alumno) throw new NotFoundException('Alumno no encontrado');
      if (user) await this.scope.validarGestion(user, alumno.plantelId);
      alumno.estatus = 'BAJA';
      await alumnos.save(alumno);
      await alumnos.softDelete(id);
      await manager.getRepository(Inscripcion).update(
        { alumnoId: id, estatus: 'ACTIVA' }, { estatus: 'BAJA' },
      );
      await this.usuarios.actualizar(alumno.usuarioId, { activo: false }, manager);
      return { ok: true };
    });
  }

  /** Materias del alumno en sus grupos con inscripción activa. */
  async misMaterias(usuarioId: number) {
    const alumno = await this.obtenerPorUsuario(usuarioId);
    const inscripciones = await this.inscripciones.find({
      where: { alumnoId: alumno.id, estatus: 'ACTIVA' },
    });
    if (inscripciones.length === 0) return [];
    const grupoIds = [...new Set(inscripciones.map((insc) => insc.grupoId))];
    return this.grupoMaterias.find({ where: { grupoId: In(grupoIds) }, order: { grupoId: 'ASC', materiaId: 'ASC' } });
  }
}
