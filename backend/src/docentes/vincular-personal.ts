import { RolClave } from '../common/roles.decorator';
import { HistorialRolesUsuario } from '../entities/historial-roles-usuario.entity';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { BitacoraAcademica, Docente, Rol, Usuario, UsuarioPlantel } from '../entities';
import { JwtUser } from '../common/current-user.decorator';
import { validarCambioRolesPersonal } from '../common/jerarquia-roles';
import { ScopeService } from '../planteles/scope.service';
import { VincularPersonalDocenteDto } from './docentes.dto';

/** Alta explícita sobre la misma identidad; conserva funciones, credenciales y planteles. */
export async function vincularPersonalDocente(m: EntityManager, d: VincularPersonalDocenteDto, actor: JwtUser, scope: ScopeService) {
  if (actor.portal === 'MOVIL') throw new ForbiddenException('Operación exclusiva del portal web');
  const usuarios = m.getRepository(Usuario);
  const autor = await usuarios.findOneBy({ id: actor.sub, activo: true });
  const usuario = await usuarios.findOne({ where: { id: d.usuarioId, activo: true }, lock: { mode: 'pessimistic_write' } });
  if (!autor || !usuario) throw new ConflictException('Selecciona una cuenta de personal activa');
  const anteriores = usuario.roles.map(r => r.clave);
  if (!anteriores.some(r => ['ADMINISTRATIVO', 'FINANZAS', 'DIRECTOR'].includes(r))) throw new ConflictException('Selecciona una cuenta de personal existente');
  const siguientes = [...new Set([...anteriores, 'MAESTRO'])] as RolClave[];
  validarCambioRolesPersonal({ sub: autor.id, roles: autor.roles.map(r => r.clave) }, usuario.id, anteriores, siguientes);
  const asignaciones = await m.getRepository(UsuarioPlantel).find({ where: { usuarioId: usuario.id, activo: true }, relations: { plantel: true } });
  if (!asignaciones.length || asignaciones.some(a => !a.plantel.activo)) throw new ConflictException('El personal requiere planteles activos');
  for (const a of asignaciones) await scope.validarGestion({ ...actor, roles: autor.roles.map(r => r.clave) }, a.plantelId);
  const docentes = m.getRepository(Docente);
  if (await docentes.exists({ where: [{ usuarioId: usuario.id }, { numEmpleado: d.numEmpleado }], withDeleted: true })) throw new ConflictException('La cuenta o el número de empleado ya tienen expediente docente');
  const rol = await m.getRepository(Rol).findOneBy({ clave: 'MAESTRO' });
  if (!rol) throw new ConflictException('El rol docente no está configurado');
  const docente = await docentes.save(docentes.create({ usuarioId: usuario.id, numEmpleado: d.numEmpleado, cedulaProfesional: d.cedulaPendiente ? null : d.cedulaProfesional!, especialidad: d.especialidad ?? null }));
  if (!anteriores.includes('MAESTRO')) usuario.roles.push(rol);
  usuario.sessionVersion = (usuario.sessionVersion ?? 0) + 1;
  await usuarios.save(usuario);
  await m.getRepository(HistorialRolesUsuario).insert({ usuarioId: usuario.id, actorId: autor.id, rolesAntes: [...anteriores].sort().join(','), rolesDespues: [...siguientes].sort().join(',') });
  for (const a of asignaciones) await m.getRepository(BitacoraAcademica).insert({ usuarioId: autor.id, plantelId: a.plantelId, accion: 'PERSONAL_DOCENTE_VINCULADO', entidadId: docente.id, detalle: `Cuenta existente ${usuario.id}; conserva funciones y planteles`, fecha: new Date() });
  return { id: docente.id, usuarioId: usuario.id, numEmpleado: docente.numEmpleado };
}
