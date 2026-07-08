import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { Alumno } from '../entities/alumno.entity';
import { Inscripcion } from '../entities/inscripcion.entity';
import { GrupoMateria } from '../entities/grupo-materia.entity';
import { UsuariosService } from '../usuarios/usuarios.service';
import { ActualizarAlumnoDto, CrearAlumnoDto } from './alumnos.dto';

@Injectable()
export class AlumnosService {
  constructor(
    @InjectRepository(Alumno) private readonly alumnos: Repository<Alumno>,
    @InjectRepository(Inscripcion) private readonly inscripciones: Repository<Inscripcion>,
    @InjectRepository(GrupoMateria) private readonly grupoMaterias: Repository<GrupoMateria>,
    private readonly usuarios: UsuariosService,
  ) {}

  listar(buscar?: string) {
    if (buscar) {
      return this.alumnos.find({
        where: [{ matricula: Like(`%${buscar}%`) }],
        order: { id: 'DESC' },
        take: 200,
      });
    }
    return this.alumnos.find({ order: { id: 'DESC' }, take: 200 });
  }

  async obtener(id: number) {
    const alumno = await this.alumnos.findOne({ where: { id } });
    if (!alumno) throw new NotFoundException('Alumno no encontrado');
    return alumno;
  }

  async obtenerPorUsuario(usuarioId: number) {
    const alumno = await this.alumnos.findOne({ where: { usuarioId } });
    if (!alumno) throw new NotFoundException('El usuario no tiene expediente de alumno');
    return alumno;
  }

  async crear(dto: CrearAlumnoDto) {
    const existe = await this.alumnos.findOne({ where: { matricula: dto.matricula }, withDeleted: true });
    if (existe) throw new ConflictException('La matrícula ya está registrada');

    const usuario = await this.usuarios.crear({
      email: dto.email,
      password: dto.password,
      nombre: dto.nombre,
      apellidoPaterno: dto.apellidoPaterno,
      apellidoMaterno: dto.apellidoMaterno,
      telefono: dto.telefono,
      roles: ['ALUMNO'],
    });
    return this.alumnos.save(
      this.alumnos.create({
        usuarioId: usuario.id,
        matricula: dto.matricula,
        curp: dto.curp ?? null,
        fechaNacimiento: dto.fechaNacimiento ?? null,
        tutorNombre: dto.tutorNombre ?? null,
        tutorTelefono: dto.tutorTelefono ?? null,
        direccion: dto.direccion ?? null,
      }),
    );
  }

  async actualizar(id: number, dto: ActualizarAlumnoDto) {
    const alumno = await this.obtener(id);
    if (dto.nombre || dto.apellidoPaterno || dto.apellidoMaterno || dto.telefono) {
      await this.usuarios.actualizar(alumno.usuarioId, {
        nombre: dto.nombre,
        apellidoPaterno: dto.apellidoPaterno,
        apellidoMaterno: dto.apellidoMaterno,
        telefono: dto.telefono,
      });
    }
    Object.assign(alumno, {
      curp: dto.curp ?? alumno.curp,
      fechaNacimiento: dto.fechaNacimiento ?? alumno.fechaNacimiento,
      tutorNombre: dto.tutorNombre ?? alumno.tutorNombre,
      tutorTelefono: dto.tutorTelefono ?? alumno.tutorTelefono,
      direccion: dto.direccion ?? alumno.direccion,
      estatus: dto.estatus ?? alumno.estatus,
    });
    return this.alumnos.save(alumno);
  }

  async baja(id: number) {
    const alumno = await this.obtener(id);
    alumno.estatus = 'BAJA';
    await this.alumnos.save(alumno);
    await this.alumnos.softDelete(id);
    return { ok: true };
  }

  /** Materias del alumno en sus grupos con inscripción activa. */
  async misMaterias(usuarioId: number) {
    const alumno = await this.obtenerPorUsuario(usuarioId);
    const inscripciones = await this.inscripciones.find({
      where: { alumnoId: alumno.id, estatus: 'ACTIVA' },
    });
    if (inscripciones.length === 0) return [];
    const materias: GrupoMateria[] = [];
    for (const insc of inscripciones) {
      const gms = await this.grupoMaterias.find({ where: { grupoId: insc.grupoId } });
      materias.push(...gms);
    }
    return materias;
  }
}
