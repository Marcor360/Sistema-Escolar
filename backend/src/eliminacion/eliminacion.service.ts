import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { JwtUser } from '../common/current-user.decorator';
import { Alumno } from '../entities/alumno.entity';
import { Docente } from '../entities/docente.entity';
import { Plantel } from '../entities/plantel.entity';
import { Usuario } from '../entities/usuario.entity';
import { UsuarioPlantel } from '../entities/usuario-plantel.entity';

export type TipoEliminacion = 'alumnos' | 'docentes' | 'planteles' | 'usuarios';
const cuentasAuxiliares = new Set([
  'usuario_roles', 'usuario_planteles', 'sesiones', 'password_reset_tokens',
  'activacion_tokens', 'push_dispositivos', 'notificaciones',
]);
const nombresVinculos: Record<string, string> = {
  alumnos: 'expedientes de alumnos', docentes: 'expedientes de docentes', planteles: 'dirección de planteles',
  grupos: 'grupos', grupo_materias: 'clases asignadas', inscripciones: 'inscripciones',
  calificaciones: 'calificaciones', historial_calificaciones: 'historial de calificaciones',
  cargos: 'cargos', pagos: 'pagos', ordenes_pago: 'órdenes de pago', entregas: 'entregas de actividades',
  incidencias: 'incidencias', incidencia_seguimientos: 'seguimientos de incidencias',
  eventos_calendario: 'eventos del calendario', bitacora_academica: 'historial académico',
  bitacora_financiera: 'historial financiero', cobranza_envios: 'seguimiento de cobranza',
  biblioteca_carpetas: 'carpetas de biblioteca', biblioteca_archivos: 'archivos de biblioteca',
  periodos_calificacion: 'cierres de evaluaciones', importacion_previews: 'importaciones',
};
const referenciasUsuario = [
  'usuarioId', 'directorUsuarioId', 'creadoPorId', 'capturadaPorId', 'registradoPorId',
  'registradaPorId', 'actorId', 'cerradoPorId', 'reabiertoPorId',
];

@Injectable()
export class EliminacionService {
  constructor(private readonly dataSource: DataSource) {}

  async eliminar(tipo: TipoEliminacion, id: number, actor: JwtUser) {
    if (!actor.roles.includes('SUPERADMIN')) throw new ForbiddenException('Solo SUPERADMIN puede eliminar definitivamente');
    try {
      return await this.dataSource.transaction('SERIALIZABLE', async (manager) => {
        // Serializa estas operaciones y vuelve a comprobar al actor en la base.
        // Dos SUPERADMIN no pueden eliminarse mutuamente con solicitudes concurrentes.
        const administradores = await manager.getRepository(Usuario).createQueryBuilder('u')
          .innerJoin('u.roles', 'r', 'r.clave = :rol', { rol: 'SUPERADMIN' })
          .where('u.activo = :activo', { activo: true }).orderBy('u.id', 'ASC')
          .setLock('pessimistic_write').getMany();
        if (!administradores.some((u) => u.id === actor.sub)) {
          throw new ForbiddenException('La cuenta debe conservar acceso activo de SUPERADMIN');
        }
        if (tipo === 'planteles') {
          const plantel = await manager.getRepository(Plantel).findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
          if (!plantel) throw new NotFoundException('Plantel no encontrado');
          await this.validarReferencias(manager, Plantel, id, ['plantelId'], new Set(['usuario_planteles']));
          if (await manager.countBy(UsuarioPlantel, { plantelId: id, activo: true })) {
            throw new ConflictException('Primero retira o reasigna el personal del plantel');
          }
          await manager.delete(UsuarioPlantel, { plantelId: id });
          await manager.delete(Plantel, id);
        } else {
          let usuarioId = id;
          // El expediente y su cuenta se eliminan juntos; nunca queda una cuenta huérfana.
          const expediente = tipo === 'alumnos' ? Alumno : tipo === 'docentes' ? Docente : null;
          if (expediente) {
            const fila = await manager.getRepository<{ id: number; usuarioId: number }>(expediente).findOne({
              where: { id }, withDeleted: true, lock: { mode: 'pessimistic_write' }, loadEagerRelations: false,
            });
            if (!fila) throw new NotFoundException('Expediente no encontrado');
            usuarioId = fila.usuarioId;
          }
          if (usuarioId === actor.sub) throw new ConflictException('No puedes eliminar tu propia cuenta');
          const usuario = await manager.getRepository(Usuario).findOne({
            where: { id: usuarioId }, withDeleted: true, lock: { mode: 'pessimistic_write' }, loadEagerRelations: false,
          });
          if (!usuario) throw new NotFoundException('Usuario no encontrado');
          const perfilAlumno = await manager.getRepository(Alumno).findOne({ where: { usuarioId }, withDeleted: true, loadEagerRelations: false });
          const perfilDocente = await manager.getRepository(Docente).findOne({ where: { usuarioId }, withDeleted: true, loadEagerRelations: false });
          if (!expediente && (perfilAlumno || perfilDocente)) {
            throw new ConflictException('Elimina la cuenta desde su expediente de Alumnos o Docentes');
          }
          if (perfilAlumno) await this.validarReferencias(manager, Alumno, perfilAlumno.id, ['alumnoId']);
          if (perfilDocente) await this.validarReferencias(manager, Docente, perfilDocente.id, ['docenteId']);
          await this.validarReferencias(manager, Usuario, usuarioId, referenciasUsuario,
            new Set([...cuentasAuxiliares, 'alumnos', 'docentes', 'bitacora_actividad']));
          // Limpieza explícita: incluye tablas sin relaciones declaradas en la entidad.
          for (const tabla of ['push_dispositivos', 'notificaciones', 'activacion_tokens', 'password_reset_tokens', 'sesiones', 'usuario_planteles', 'usuario_roles']) {
            const metadata = this.dataSource.entityMetadatas.find((m) => m.tableName === tabla);
            if (!metadata) throw new Error(`Falta metadata de ${tabla}`);
            const columna = metadata.columns.find((c) => c.databaseName === 'usuario_id');
            if (!columna) throw new Error(`Falta usuario_id en ${tabla}`);
            await manager.createQueryBuilder().delete().from(metadata.target)
              .where(`${manager.connection.driver.escape(columna.databaseName)} = :id`, { id: usuarioId }).execute();
          }
          if (perfilAlumno) await manager.delete(Alumno, perfilAlumno.id);
          if (perfilDocente) await manager.delete(Docente, perfilDocente.id);
          await manager.delete(Usuario, usuarioId);
        }
        return { ok: true, eliminado: true };
      });
    } catch (error) {
      if (error instanceof QueryFailedError) {
        const driver = error.driverError as { code?: string; number?: number; errno?: number };
        if (driver.errno === 1451 || driver.number === 547 || driver.code === 'ER_ROW_IS_REFERENCED_2') {
          throw new ConflictException('No se puede eliminar: existen registros vinculados. Conserva el historial usando la baja o desactivación');
        }
      }
      throw error;
    }
  }

  /** También revisa referencias escalares sin relación TypeORM y registros con borrado lógico. */
  private async validarReferencias(
    manager: EntityManager, destino: typeof Usuario | typeof Alumno | typeof Docente | typeof Plantel,
    id: number, propiedades: string[], omitir = new Set<string>(),
  ) {
    const tablaDestino = this.dataSource.getMetadata(destino).tablePath;
    for (const metadata of this.dataSource.entityMetadatas) {
      if (omitir.has(metadata.tableName)) continue;
      const columnas = new Set(metadata.columns.filter((c) => propiedades.includes(c.propertyName)));
      for (const fk of metadata.foreignKeys) {
        if (fk.referencedEntityMetadata.tablePath === tablaDestino) fk.columns.forEach((c) => columnas.add(c));
      }
      for (const columna of columnas) {
        const existe = await manager.createQueryBuilder().select('1').from(metadata.target, 'vinculo').withDeleted()
          .where(`vinculo.${columna.propertyPath} = :id`, { id }).limit(1).getRawOne();
        if (existe) throw new ConflictException(`No se puede eliminar: existen registros vinculados en ${nombresVinculos[metadata.tableName] ?? 'información relacionada'}. Usa la baja o desactivación para conservar el historial`);
      }
    }
  }
}
