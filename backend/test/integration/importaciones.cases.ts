import { curpFicticia } from './identidad-ficticia';
import { ConfigService } from '@nestjs/config';
import { ImportacionesService } from '../../src/importaciones/importaciones.service';
import { ScopeService } from '../../src/planteles/scope.service';
import { ImportacionPreview, ImportacionFila, Docente, Grupo, GrupoMateria, Inscripcion, UsuarioPlantel } from '../../src/entities';
import { ContextoIntegracion } from './contexto';
import { expect, it } from '@jest/globals';
import * as ExcelJS from 'exceljs';
import { AuthService } from '../../src/auth/auth.service';
import { Alumno, BitacoraAcademica, Usuario } from '../../src/entities';
export const casos_importaciones: Record<number, (ctx: ContextoIntegracion) => void> = {
  33: (ctx) => {
it('importa con preview ligado al actor, valida duplicados y confirma una sola vez', async () => {
    const admin = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.finanzasId })).email);
    const superadmin = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.superadminId })).email);
    const enviar = (texto: string) => { const f = new FormData(); f.append('tipo', 'ALUMNOS'); f.append('archivo', new Blob([texto]), 'alumnos.csv'); return ctx.api('/importaciones/preview', { method: 'POST', token: admin, body: f }); };
    const email = `importado_${ctx.sufijo}@example.invalid`;
    const fila = `${email},Microsoft 365,Importado,Prueba,IMP${ctx.sufijo},${ctx.plantelId},${curpFicticia()}`;
    const csv = 'email,correoProveedor,nombre,apellidoPaterno,matricula,plantelId,curp\n' + fila;
    const duplicado = await enviar(csv + '\n' + fila); expect(duplicado.response.status).toBe(201); expect(duplicado.data.previewId).not.toBeNull(); expect(duplicado.data.errores).toHaveLength(0); expect(duplicado.data.duplicados).toHaveLength(1); expect(duplicado.data.validos).toBe(1);
    expect(await ctx.dataSource.getRepository(Usuario).findOneBy({ email })).toBeNull();
    await ctx.dataSource.getRepository(ImportacionPreview).delete(duplicado.data.previewId);
    const preview = await enviar(csv); expect(preview.response.status).toBe(201); expect(preview.data.errores).toEqual([]);
    expect((await ctx.api('/importaciones/confirmar', { method: 'POST', token: superadmin, body: { previewId: preview.data.previewId, confirmado: true } })).response.status).toBe(404);
    const confirmado = await ctx.api('/importaciones/confirmar', { method: 'POST', token: admin, body: { previewId: preview.data.previewId, confirmado: true } }); expect(confirmado.response.status).toBe(201); expect(confirmado.data.insertados).toBe(1);
    expect((await ctx.api('/importaciones/confirmar', { method: 'POST', token: admin, body: { previewId: preview.data.previewId, confirmado: true } })).response.status).toBe(404);
    const cuenta = await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ email });
    expect(cuenta.passwordChangeRequired).toBe(true);
    expect(cuenta.activacionPendiente).toBe(true);
    expect(await ctx.dataSource.getRepository(Alumno).countBy({ usuarioId: cuenta.id })).toBe(1);
    const inicio = await ctx.api('/auth/login', { method: 'POST', headers: { 'x-portal': 'MOVIL' }, body: { email, password: `IMP${ctx.sufijo}`.toUpperCase() } });
    expect(inicio.response.status).toBe(401);
    await ctx.emitirToken(email); // Activación real: token enviado al mock de correo, consumido una vez.
    const definitiva = await ctx.app.get(AuthService).login(email, 'Integracion_Renovada_42!', 'MOVIL');
    expect(definitiva.usuario.passwordChangeRequired).toBe(false);
    expect((await ctx.api('/calificaciones/mias', { token: definitiva.accessToken })).response.status).toBe(200);
    expect(await ctx.dataSource.getRepository(BitacoraAcademica).countBy({ accion: 'IMPORTAR_ALUMNOS' })).toBe(1);
  });
  },
  35: (ctx) => {
it('omite el duplicado nuevo entre preview y confirmar sin cancelar al alumno válido', async () => {
    const admin = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.finanzasId })).email);
    const email1 = `atomic1_${ctx.sufijo}@example.invalid`; const email2 = `atomic2_${ctx.sufijo}@example.invalid`;
    const f = new FormData(); f.append('tipo', 'ALUMNOS'); f.append('archivo', new Blob([`email,correoProveedor,nombre,apellidoPaterno,matricula,plantelId,curp\n${email1},Microsoft 365,Primero,Lote,AT1${ctx.sufijo},${ctx.plantelId},${curpFicticia()}\n${email2},GoDaddy,Segundo,Lote,AT2${ctx.sufijo},${ctx.plantelId},${curpFicticia()}`]), 'lote.csv');
    const preview = await ctx.api('/importaciones/preview', { method: 'POST', token: admin, body: f }); expect(preview.data.errores).toEqual([]);
    const superadmin = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.superadminId })).email);
    expect((await ctx.api('/alumnos', { method: 'POST', token: superadmin, body: { email: email2, nombre: 'Segundo', apellidoPaterno: 'Concurrente', matricula: `OT2${ctx.sufijo}`, plantelId: ctx.plantelId, curp: curpFicticia() } })).response.status).toBe(201);
    const confirmado = await ctx.api('/importaciones/confirmar', { method: 'POST', token: admin, body: { previewId: preview.data.previewId, confirmado: true } });
    expect(confirmado.response.status).toBe(201);
    expect(confirmado.data.insertados).toBe(1); expect(confirmado.data.existentes).toBe(1);
    expect(await ctx.dataSource.getRepository(Usuario).findOneBy({ email: email1 })).not.toBeNull(); expect(await ctx.dataSource.getRepository(Alumno).countBy({ matricula: `AT1${ctx.sufijo}`.toUpperCase() })).toBe(1);
    expect(await ctx.dataSource.getRepository(BitacoraAcademica).countBy({ accion: 'IMPORTAR_ALUMNOS' })).toBe(2);
  });
  },
  48: (ctx) => {
    it('conserva previews entre instancias, cifra datos y consume concurrentemente una sola vez', async () => {
      const cuenta = await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.finanzasId });
      const user = { sub: cuenta.id, email: cuenta.email!, nombre: cuenta.nombre, roles: ['FINANZAS'] };
      const otra = new ImportacionesService(ctx.dataSource, ctx.app.get(ScopeService), ctx.app.get(ConfigService));
      const email = `persistente_${ctx.sufijo}@example.invalid`;
      const preview = await ctx.app.get(ImportacionesService).preview('ALUMNOS', Buffer.from(`email,correoProveedor,nombre,apellidoPaterno,matricula,plantelId,curp\n${email},Microsoft 365,Persistente,Prueba,PS${ctx.sufijo},${ctx.plantelId},${curpFicticia()}`), 'persistente.csv', user);
      expect(preview.previewId).not.toBeNull();
      const filas = await ctx.dataSource.getRepository(ImportacionFila).findBy({ previewId: preview.previewId! });
      expect(filas).toHaveLength(1); expect(filas[0].contenido).not.toContain(email);
      const resultados = await Promise.allSettled([otra.confirmar(preview.previewId!,true,user), ctx.app.get(ImportacionesService).confirmar(preview.previewId!,true,user)]);
      expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(await ctx.dataSource.getRepository(Usuario).countBy({ email })).toBe(1);
      expect(await ctx.dataSource.getRepository(ImportacionFila).countBy({ previewId: preview.previewId! })).toBe(0);
      const vencido = await otra.preview('ALUMNOS', Buffer.from(`email,correoProveedor,nombre,apellidoPaterno,matricula,plantelId,curp\nvencido_${ctx.sufijo}@example.invalid,GoDaddy,Vencido,Prueba,VE${ctx.sufijo},${ctx.plantelId},${curpFicticia()}`),'vencido.csv',user);
      await ctx.dataSource.getRepository(ImportacionPreview).update(vencido.previewId!,{ expira: new Date(Date.now()-1000) });
      await expect(otra.confirmar(vencido.previewId!,true,user)).rejects.toThrow('Previsualización expirada');
    });
  },
  49: (ctx) => {
    it('importa 500 alumnos con auditoría completa y contraseña de activación sin exponerla', async () => {
      const cuenta = await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.finanzasId });
      const user = { sub: cuenta.id, email: cuenta.email!, nombre: cuenta.nombre, roles: ['FINANZAS'] };
      const servicio = ctx.app.get(ImportacionesService);
      const filas = Array.from({ length: 500 }, (_,i) => `masivo${i}_${ctx.sufijo}@example.invalid,Microsoft 365,Masivo,Alumno,MI${i}${ctx.sufijo},${ctx.plantelId},${curpFicticia()}`);
      const desde = Date.now();
      const preview = await servicio.preview('ALUMNOS',Buffer.from('email,correoProveedor,nombre,apellidoPaterno,matricula,plantelId,curp\n'+filas.join('\n')),'masivo.csv',user);
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
      const user = { sub: cuenta.id,email: cuenta.email!,nombre: cuenta.nombre,roles: ['SUPERADMIN'] };
      const servicio = ctx.app.get(ImportacionesService);
      const importar = async (tipo: 'DOCENTES' | 'PERSONAL' | 'INSCRIPCIONES',csv: string) => {
        const p = await servicio.preview(tipo,Buffer.from(csv),'relaciones.csv',user); expect(p.errores).toEqual([]);
        expect((await servicio.confirmar(p.previewId!,true,user)).insertados).toBe(1);
      };
      const email = `docimp_${ctx.sufijo}@example.invalid`;
      await importar('DOCENTES',`email,nombre,apellidoPaterno,numEmpleado,plantelIds,cedulaPendiente\n${email},Docente,Importado,DI${ctx.sufijo},${ctx.plantelId},true`);
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
