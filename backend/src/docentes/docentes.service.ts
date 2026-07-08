import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Docente } from '../entities/docente.entity';
import { UsuariosService } from '../usuarios/usuarios.service';
import { ActualizarDocenteDto, CrearDocenteDto } from './docentes.dto';

@Injectable()
export class DocentesService {
  constructor(
    @InjectRepository(Docente) private readonly docentes: Repository<Docente>,
    private readonly usuarios: UsuariosService,
  ) {}

  listar() {
    return this.docentes.find({ order: { id: 'DESC' } });
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

  async crear(dto: CrearDocenteDto) {
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
    return this.docentes.save(
      this.docentes.create({
        usuarioId: usuario.id,
        numEmpleado: dto.numEmpleado,
        cedulaProfesional: dto.cedulaProfesional ?? null,
        especialidad: dto.especialidad ?? null,
      }),
    );
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
