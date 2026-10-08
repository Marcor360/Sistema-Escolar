import { ConfigService } from '@nestjs/config';
import { ImportacionesService } from '../../src/importaciones/importaciones.service';
import { ScopeService } from '../../src/planteles/scope.service';
import { ImportacionPreview, ImportacionFila, Docente, Grupo, GrupoMateria, Inscripcion, UsuarioPlantel } from '../../src/entities';
import { ContextoIntegracion } from './contexto';
import { expect, it } from '@jest/globals';
import * as ExcelJS from 'exceljs';
import * as bcrypt from 'bcryptjs';
import { Alumno, BitacoraAcademica, Usuario } from '../../src/entities';
export const casos_importaciones: Record<number, (ctx: ContextoIntegracion) => void> = {
  33: (ctx) => {
it('importa con preview ligado al actor, valida duplicados y confirma una sola vez', async () => {
    const admin = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.adminId })).email);
    const superadmin = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.superadminId })).email);
    const enviar = (texto: string) => { const f = new FormData(); f.append('tipo', 'ALUMNOS'); f.append('archivo', new Blob([texto]), 'alumnos.csv'); return ctx.api('/importaciones/preview', { method: 'POST', token: admin, body: f }); };
    const email = `importado_${ctx.sufijo}@example.invalid`;
    const fila = `${email},Importado,Prueba,IMP${ctx.sufijo},${ctx.plantelId}`;
    const csv = 'email,nombre,apellidoPaterno,matricula,plantelId\n' + fila;
    const duplicado = await enviar(csv + '\n' + fila); expect(duplicado.response.status).toBe(201); expect(duplicado.data.previewId).toBeNull(); expect(duplicado.data.errores).toHaveLength(1);
    expect(await ctx.dataSource.getRepository(Usuario).findOneBy({ email })).toBeNull();
    const preview = await enviar(csv); expect(preview.response.status).toBe(201); expect(preview.data.errores).toEqual([]);
    expect((await ctx.api('/importaciones/confirmar', { method: 'POST', token: superadmin, body: { previewId: preview.data.previewId, confirmado: true } })).response.status).toBe(404);
    const confirmado = await ctx.api('/importaciones/confirmar', { method: 'POST', token: admin, body: { previewId: preview.data.previewId, confirmado: true } }); expect(confirmado.response.status).toBe(201); expect(confirmado.data.insertados).toBe(1);
    expect((await ctx.api('/importaciones/confirmar', { method: 'POST', token: admin, body: { previewId: preview.data.previewId, confirmado: true } })).response.status).toBe(404);
    const cuenta = await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ email }); expect(cuenta.passwordChangeRequired).toBe(true);
    expect(await ctx.dataSource.getRepository(Alumno).countBy({ usuarioId: cuenta.id })).toBe(1);
    expect(await ctx.dataSource.getRepository(BitacoraAcademica).countBy({ accion: 'IMPORTAR_ALUMNOS' })).toBe(1);
  });
  },
  35: (ctx) => {
it('revierte el lote completo si surge un duplicado después del preview', async () => {
    const admin = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.adminId })).email);
    const email1 = `atomic1_${ctx.sufijo}@example.invalid`; const email2 = `atomic2_${ctx.sufijo}@example.invalid`;
    const f = new FormData(); f.append('tipo', 'ALUMNOS'); f.append('archivo', new Blob([`email,nombre,apellidoPaterno,matricula,plantelId\n${email1},Primero,Lote,AT1${ctx.sufijo},${ctx.plantelId}\n${email2},Segundo,Lote,AT2${ctx.sufijo},${ctx.plantelId}`]), 'lote.csv');
    const preview = await ctx.api('/importaciones/preview', { method: 'POST', token: admin, body: f }); expect(preview.data.errores).toEqual([]);
    expect((await ctx.api('/alumnos', { method: 'POST', token: admin, body: { email: email2, password: 'Integracion_Segura_42!', nombre: 'Segundo', apellidoPaterno: 'Concurrente', matricula: `OT2${ctx.sufijo}`, plantelId: ctx.plantelId } })).response.status).toBe(201);
    expect((await ctx.api('/importaciones/confirmar', { method: 'POST', token: admin, body: { previewId: preview.data.previewId, confirmado: true } })).response.status).toBe(409);
    expect(await ctx.dataSource.getRepository(Usuario).findOneBy({ email: email1 })).toBeNull(); expect(await ctx.dataSource.getRepository(Alumno).countBy({ matricula: `AT1${ctx.sufijo}`.toUpperCase() })).toBe(0);
    expect(await ctx.dataSource.getRepository(BitacoraAcademica).countBy({ accion: 'IMPORTAR_ALUMNOS' })).toBe(1);
  });
  },
  48: (ctx) => {
    it('conserva previews entre instancias, cifra datos y consume concurrentemente una sola vez', async () => {
      const cuenta = await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.adminId });
      const user = { sub: cuenta.id, email: cuenta.email, nombre: cuenta.nombre, roles: ['ADMINISTRATIVO'] };
      const otra = new ImportacionesService(ctx.dataSource, ctx.app.get(ScopeService), ctx.app.get(ConfigService));
      const email = `persistente_${ctx.sufijo}@example.invalid`;
      const preview = await ctx.app.get(ImportacionesService).preview('ALUMNOS', Buffer.from(`email,nombre,apellidoPaterno,matricula,plantelId\n${email},Persistente,Prueba,PS${ctx.sufijo},${ctx.plantelId}`), 'persistente.csv', user);
      expect(preview.previewId).not.toBeNull();
      const filas = await ctx.dataSource.getRepository(ImportacionFila).findBy({ previewId: preview.previewId! });
      expect(filas).toHaveLength(1); expect(filas[0].contenido).not.toContain(email);
      const resultados = await Promise.allSettled([otra.confirmar(preview.previewId!,true,user), ctx.app.get(ImportacionesService).confirmar(preview.previewId!,true,user)]);
      expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(await ctx.dataSource.getRepository(Usuario).countBy({ email })).toBe(1);
      expect(await ctx.dataSource.getRepository(ImportacionFila).countBy({ previewId: preview.previewId! })).toBe(0);
      const vencido = await otra.preview('ALUMNOS', Buffer.from(`email,nombre,apellidoPaterno,matricula,plantelId\nvencido_${ctx.sufijo}@example.invalid,Vencido,Prueba,VE${ctx.sufijo},${ctx.plantelId}`),'vencido.csv',user);
      await ctx.dataSource.getRepository(ImportacionPreview).update(vencido.previewId!,{ expira: new Date(Date.now()-1000) });
      await expect(otra.confirmar(vencido.previewId!,true,user)).rejects.toThrow('Previsualización expirada');
    });
  },
  49: (ctx) => {
    it('importa 500 alumnos con auditoría completa y contraseña de activación sin exponerla', async () => {
      const cuenta = await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.adminId });
      const user = { sub: cuenta.id, email: cuenta.email, nombre: cuenta.nombre, roles: ['ADMINISTRATIVO'] };
      const servicio = ctx.app.get(ImportacionesService);
      const filas = Array.from({ length: 500 }, (_,i) => `masivo${i}_${ctx.sufijo}@example.invalid,Masivo,Alumno,MI${i}${ctx.sufijo},${ctx.plantelId}`);
      const desde = Date.now();
      const preview = await servicio.preview('ALUMNOS',Buffer.from('email,nombre,apellidoPaterno,matricula,plantelId\n'+filas.join('\n')),'masivo.csv',user);
      const previewMs = Date.now()-desde; expect(preview.errores).toEqual([]);
      const confirmarDesde = Date.now(); const resultado = await servicio.confirmar(preview.previewId!,true,user);
      expect(resultado.insertados).toBe(500);
      const alumnos = await ctx.dataSource.getRepository(Alumno).createQueryBuilder('a').innerJoinAndSelect('a.usuario','u').where('u.email LIKE :patron',{ patron: `masivo%_${ctx.sufijo}@example.invalid` }).getMany();
      expect(alumnos).toHaveLength(500); expect(alumnos.every((a) => a.usuario.passwordChangeRequired)).toBe(true);
      expect(await ctx.dataSource.getRepository(BitacoraAcademica).countBy({ accion: 'IMPORTAR_ALUMNOS', entidadId: require('typeorm').In(alumnos.map((a) => a.id)) })).toBe(500);
      console.log(JSON.stringify({ prueba: 'importacion_500', motor: process.env.DB_TYPE, filas: 500, previewMs, confirmacionMs: Date.now()-confirmarDesde }));
    });
  },
  54: (ctx) => {
    it('importa docentes, personal e inscripciones con relaciones y alcance completos', async () => {
      const cuenta = await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.superadminId });
      const user = { sub: cuenta.id,email: cuenta.email,nombre: cuenta.nombre,roles: ['SUPERADMIN'] };
      const servicio = ctx.app.get(ImportacionesService);
      const importar = async (tipo: 'DOCENTES' | 'PERSONAL' | 'INSCRIPCIONES',csv: string) => {
        const p = await servicio.preview(tipo,Buffer.from(csv),'relaciones.csv',user); expect(p.errores).toEqual([]);
        expect((await servicio.confirmar(p.previewId!,true,user)).insertados).toBe(1);
      };
      const email = `docimp_${ctx.sufijo}@example.invalid`;
      await importar('DOCENTES',`email,nombre,apellidoPaterno,numEmpleado,plantelIds\n${email},Docente,Importado,DI${ctx.sufijo},${ctx.plantelId}`);
      const docenteUsuario = await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ email });
      expect(docenteUsuario.roles.map((r) => r.clave)).toEqual(['MAESTRO']); expect(await ctx.dataSource.getRepository(Docente).countBy({ usuarioId: docenteUsuario.id })).toBe(1);
      expect(await ctx.dataSource.getRepository(UsuarioPlantel).countBy({ usuarioId: docenteUsuario.id,plantelId: ctx.plantelId,activo: true })).toBe(1);
      const personalEmail = `perimp_${ctx.sufijo}@example.invalid`;
      await importar('PERSONAL',`email,nombre,apellidoPaterno,roles,plantelIds\n${personalEmail},Personal,Importado,ADMINISTRATIVO;FINANZAS,${ctx.plantelId}`);
      const personal = await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ email: personalEmail }); expect(personal.roles.map((r) => r.clave).sort()).toEqual(['ADMINISTRATIVO','FINANZAS']);
      expect(await ctx.dataSource.getRepository(UsuarioPlantel).countBy({ usuarioId: personal.id,plantelId: ctx.plantelId,activo: true })).toBe(1);
      const base = await ctx.dataSource.getRepository(GrupoMateria).findOneByOrFail({ id: ctx.grupoMateriaIdMaestro });
      const grupo = await ctx.dataSource.getRepository(Grupo).save({ nombre: `IM-${ctx.sufijo}`,cicloId: base.grupo.cicloId,plantelId: ctx.plantelId,activo: true });
      const alumno = await ctx.dataSource.getRepository(Alumno).findOneByOrFail({ matricula: `MI0${ctx.sufijo}`.toUpperCase() });
      await importar('INSCRIPCIONES',`matricula,grupoId\n${alumno.matricula},${grupo.id}`);
      expect(await ctx.dataSource.getRepository(Inscripcion).countBy({ alumnoId: alumno.id,grupoId: grupo.id,estatus: 'ACTIVA' })).toBe(1);
    });
  },
};
