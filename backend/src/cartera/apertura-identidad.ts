import { ConflictException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { EntityManager } from 'typeorm';
import { Alumno, Rol, Usuario } from '../entities';
import { AlumnoSinCorreoDto } from '../alumnos/alumnos.dto';
import { hashPasswordNueva } from '../common/password-bcrypt';

export async function validarIdentidadApertura(m: EntityManager, d: AlumnoSinCorreoDto) {
  const alumnos = m.getRepository(Alumno);
  if (await alumnos.findOne({ where: { curp: d.curp }, withDeleted: true }))
    throw new ConflictException('La CURP ya pertenece a un expediente; utiliza el alumno existente');
  if (await alumnos.findOne({ where: { matricula: d.matricula }, withDeleted: true }))
    throw new ConflictException('La matrícula ya está registrada');
}
/** No asigna dirección institucional ni invoca servicios de correo. Comparte commit con la cartera. */
export async function crearIdentidadApertura(m: EntityManager, plantelId: number, d: AlumnoSinCorreoDto) {
  await validarIdentidadApertura(m, d);
  const rol = await m.getRepository(Rol).findOneByOrFail({ clave: 'ALUMNO' });
  const usuario = await m.getRepository(Usuario).save(
    m.getRepository(Usuario).create({
      email: null,
      correoPersonal: d.correoPersonal ?? null,
      nombre: d.nombre,
      segundoNombre: d.segundoNombre ?? null,
      apellidoPaterno: d.apellidoPaterno,
      apellidoMaterno: d.apellidoMaterno ?? null,
      telefono: d.telefono ?? null,
      roles: [rol],
      passwordHash: await hashPasswordNueva(randomBytes(32).toString('base64url')),
      activo: true,
      activacionPendiente: true,
      passwordChangeRequired: true,
      correoProveedor: 'MICROSOFT365',
    }),
  );
  return m.getRepository(Alumno).save(
    m.getRepository(Alumno).create({
      usuarioId: usuario.id,
      plantelId,
      matricula: d.matricula,
      curp: d.curp,
      fechaNacimiento: d.fechaNacimiento ?? null,
      tutorNombre: d.tutorNombre ?? null,
      tutorTelefono: d.tutorTelefono ?? null,
      direccion: d.direccion ?? null,
    }),
  );
}
