import { ContextoIntegracion } from './contexto';
import { expect, it } from '@jest/globals';
import * as ExcelJS from 'exceljs';
import * as bcrypt from 'bcryptjs';
import { Alumno, CicloEscolar, Grupo, GrupoMateria, Inscripcion, Docente, Materia, Rol, Usuario, UsuarioPlantel } from '../../src/entities';
export const casos_roles: Record<number, (ctx: ContextoIntegracion) => void> = {
  45: (ctx) => {
it('aplica capacidades por operación a seis combinaciones de roles sin ampliar clases por Finanzas', async () => {
    const ciclo = await ctx.dataSource.getRepository(CicloEscolar).findOneByOrFail({ activo: true });
    const passwordHash = await bcrypt.hash('Integracion_Segura_42!', 4);
    const rolesRepo = ctx.dataSource.getRepository(Rol);
    const nuevo = async (clave: string, roles: string[]) => ctx.dataSource.getRepository(Usuario).save({ email: `multi_${clave}_${ctx.sufijo}@example.invalid`, nombre: 'Multirol', apellidoPaterno: clave, passwordHash, activo: true, roles: await rolesRepo.findBy({ clave: require('typeorm').In(roles) }) });
    const grupos = await ctx.dataSource.getRepository(Grupo).save([0,1].map((i) => ({ plantelId: ctx.plantelId, cicloId: ciclo.id, nombre: `Multi${i}-${ctx.sufijo}`, activo: true })));
    const materia = await ctx.dataSource.getRepository(Materia).save({ clave: `MUL${ctx.sufijo}`, nombre: 'Materia multirol', creditos: 0, activo: true });
    const alumnos = [];
    for (let i=0;i<2;i++) {
      const u = await nuevo(`alumno${i}`, ['ALUMNO']);
      const a = await ctx.dataSource.getRepository(Alumno).save({ usuarioId: u.id, plantelId: ctx.plantelId, matricula: `MU${i}${ctx.sufijo}`, estatus: 'ACTIVO' }); alumnos.push(a);
      await ctx.dataSource.getRepository(Inscripcion).save({ grupoId: grupos[i].id, alumnoId: a.id, estatus: 'ACTIVA' });
    }
    const externo = await nuevo('docenteExterno', ['MAESTRO']);
    const docenteExterno = await ctx.dataSource.getRepository(Docente).save({ usuarioId: externo.id, numEmpleado: `MX${ctx.sufijo}`, estatus: 'ACTIVO' });
    const ajena = await ctx.dataSource.getRepository(GrupoMateria).save({ grupoId: grupos[1].id, materiaId: materia.id, docenteId: docenteExterno.id });
    const root = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.superadminId })).email);
    const incidencia = await ctx.api('/conducta/incidencias', { method: 'POST', token: root, body: { alumnoId: alumnos[1].id, grupoId: grupos[1].id, tipo: 'Seguimiento', gravedad: 'LEVE', descripcion: 'Solo personal autorizado', fecha: new Date().toISOString() } }); expect(incidencia.response.status).toBe(201);
    const combinaciones = [['MAESTRO'], ['FINANZAS'], ['MAESTRO','FINANZAS'], ['ADMINISTRATIVO','MAESTRO'], ['ADMINISTRATIVO','FINANZAS'], ['SUPERADMIN']];
    for (let i=0;i<combinaciones.length;i++) {
      const roles = combinaciones[i], u = await nuevo(String(i), roles);
      await ctx.dataSource.getRepository(UsuarioPlantel).save({ usuarioId: u.id, plantelId: ctx.plantelId, activo: true });
      const admin = roles.includes('ADMINISTRATIVO') || roles.includes('SUPERADMIN'), maestro = roles.includes('MAESTRO'), financiero = admin || roles.includes('FINANZAS');
      const docente = maestro ? await ctx.dataSource.getRepository(Docente).save({ usuarioId: u.id, numEmpleado: `MM${i}${ctx.sufijo}`, estatus: 'ACTIVO' }) : null;
      const propia = await ctx.dataSource.getRepository(GrupoMateria).save({ grupoId: grupos[0].id, materiaId: (await ctx.dataSource.getRepository(Materia).save({ clave: `MM${i}${ctx.sufijo}`, nombre: `Clase ${i}`, activo: true, creditos: 0 })).id, docenteId: docente?.id ?? null });
      const token = await ctx.emitirToken(u.email);
      const consultar = async (ruta: string, permitido: boolean) => expect((await ctx.api(ruta, { token })).response.status).toBe(permitido ? 200 : 403);
      await consultar(`/alumnos/${alumnos[1].id}`, admin || !maestro);
      await consultar(`/academico/grupos/${grupos[1].id}/alumnos`, admin);
      await consultar(`/calificaciones/grupo-materia/${ajena.id}`, admin);
      await consultar(`/calificaciones/grupo-materia/${propia.id}`, admin || maestro);
      await consultar(`/calificaciones/alumno/${alumnos[1].id}`, admin);
      const captura = await ctx.api('/calificaciones/captura', { method: 'POST', token, body: { grupoMateriaId: ajena.id, parcial: 1, motivo: 'Comprobación de capacidad', items: [{ alumnoId: alumnos[1].id, calificacion: 80 }] } }); expect(captura.response.status).toBe(admin ? 201 : 403);
      await consultar(`/reportes/grupo-materias/${ajena.id}/calificaciones.xlsx`, admin);
      await consultar('/calendario', admin || maestro);
      await consultar(`/conducta/incidencias/${incidencia.data.id}`, admin);
      await consultar('/finanzas/cargos', financiero);
      const analitica = await ctx.api(`/analitica?cicloId=${ciclo.id}`, { token }); expect(analitica.response.status).toBe(200);
      expect(analitica.data.financiero !== undefined).toBe(financiero);
      expect(analitica.data.academico !== undefined).toBe(admin || maestro);
      if (maestro && !admin) {
        expect(analitica.data.academico.clases.some((c: any) => c.grupoMateriaId === ajena.id)).toBe(false);
        expect(analitica.data.academico.clases.some((c: any) => c.grupoMateriaId === propia.id)).toBe(true);
        const listado = await ctx.api(`/academico/grupos?buscar=Multi1-${ctx.sufijo}`, { token }); expect(listado.data.datos).toEqual([]);
      }
    }
  });
  },
};
