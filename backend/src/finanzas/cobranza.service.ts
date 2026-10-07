import { BadRequestException, ConflictException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, LessThan, Repository } from 'typeorm';
import { createHash } from 'crypto';
import { PlantillaCorreo, CobranzaEnvio, Usuario, Notificacion } from '../entities';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { CargosService } from './cargos.service';
import { BitacoraFinancieraService } from './bitacora-financiera.service';
import { JwtUser } from '../common/current-user.decorator';
import { ScopeService } from '../planteles/scope.service';
const redondear = (n: number) => Math.round(n * 100) / 100;
const escapar = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
@Injectable()
export class CobranzaService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>; private trabajando = false;
  private readonly logger = new Logger(CobranzaService.name);
  constructor(
    @InjectRepository(PlantillaCorreo) private readonly plantillas: Repository<PlantillaCorreo>,
    private readonly cargos: CargosService, private readonly notificaciones: NotificacionesService,
    private readonly bitacora: BitacoraFinancieraService, private readonly config: ConfigService,
    private readonly ds: DataSource, private readonly scope: ScopeService,
  ) {}
  onModuleInit() { this.timer = setInterval(() => { void this.procesar().catch(() => this.logger.warn('Cobranza pendiente; revisar configuración/proveedor')); }, 30000); this.timer.unref(); }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
  async enviarAvisos(user: JwtUser, plantelId?: number, preview = false, confirmado = false) {
    if (!plantelId) throw new BadRequestException('Selecciona un plantel para esta operación');
    if (!preview && !confirmado) throw new BadRequestException('Revisa la previsualización y confirma la operación');
    if (!await this.plantillas.findOneBy({ clave: 'AVISO_ADEUDO' })) throw new BadRequestException('Falta la plantilla AVISO_ADEUDO');
    const adeudos = await this.cargos.adeudos(user, plantelId, true);
    const porAlumno = new Map<number, { usuarioId: number; saldo: number; cargos: string[] }>();
    for (const c of adeudos) {
      const actual = porAlumno.get(c.alumnoId) ?? { usuarioId: c.alumno.usuarioId, saldo: 0, cargos: [] };
      actual.saldo = redondear(actual.saldo + c.saldo); actual.cargos.push(`${c.id}:${c.saldo}`); porAlumno.set(c.alumnoId, actual);
    }
    if (preview) return { plantelId, registros: porAlumno.size, totalEstimado: redondear([...porAlumno.values()].reduce((s, a) => s + a.saldo, 0)) };
    let programados = 0, omitidos = 0;
    const dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    for (const datos of porAlumno.values()) {
      const clave = createHash('sha256').update(JSON.stringify([dia, plantelId, datos.usuarioId, datos.cargos.sort()])).digest('hex');
      try {
        const nuevo = await this.ds.transaction(async (manager) => {
          const repo = manager.getRepository(CobranzaEnvio);
          if (await repo.existsBy({ clave })) return false;
          const fila = await repo.save(repo.create({ clave, plantelId, usuarioId: datos.usuarioId, actorId: user.sub, saldo: datos.saldo, estado: 'PENDIENTE', intentos: 0, proximoIntento: new Date(), error: null }));
          await manager.getRepository(Notificacion).insert({ usuarioId: datos.usuarioId, titulo: 'Aviso de adeudo', mensaje: `Presentas un saldo pendiente de $${datos.saldo.toFixed(2)} MXN.`, tipo: 'FINANCIERA', pushPendiente: true });
          await this.bitacora.registrar(user.sub, 'PROGRAMAR_COBRANZA', 'cobranza_envio', fila.id, `saldo=${datos.saldo}`, plantelId, manager);
          return true;
        });
        if (nuevo) programados++; else omitidos++;
      } catch (e) {
        // Otra solicitud pudo confirmar la misma clave; cualquier otro fallo conserva su estado de error.
        if (await this.ds.getRepository(CobranzaEnvio).existsBy({ clave })) omitidos++; else throw e;
      }
    }
    return { programados, omitidos, mensaje: 'Consulta el seguimiento de cobranza: programado no significa enviado por SMTP.' };
  }
  async listar(user: JwtUser, pagina = 1) {
    const planteles = await this.scope.resolverFiltro(user);
    const [datos, total] = await this.ds.getRepository(CobranzaEnvio).findAndCount({ where: planteles === null ? {} : { plantelId: In(planteles) }, order: { id: 'DESC' }, skip: (pagina - 1) * 20, take: 20 });
    return { datos: datos.map(({ id, plantelId, usuarioId, saldo, estado, intentos, error, createdAt }) => ({ id, plantelId, usuarioId, saldo, estado, intentos, error, createdAt })), total, pagina, porPagina: 20 };
  }
  async reintentar(id: number, motivo: string, confirmado: boolean, user: JwtUser) {
    if (!confirmado || motivo.trim().length < 3) throw new BadRequestException('Confirma el reintento y proporciona un motivo');
    return this.ds.transaction(async (manager) => {
      const repo = manager.getRepository(CobranzaEnvio); const envio = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!envio) throw new BadRequestException('Envío no encontrado');
      await this.scope.validarGestion(user, envio.plantelId);
      if (!['ERROR', 'INCIERTO'].includes(envio.estado)) throw new ConflictException('Solo se reintenta un error o resultado incierto');
      await repo.update(id, { estado: 'PENDIENTE', intentos: 0, proximoIntento: new Date(), error: null });
      await this.bitacora.registrar(user.sub, 'REINTENTAR_COBRANZA', 'cobranza_envio', id, `estado_previo=${envio.estado}; ${motivo.trim()}`, envio.plantelId, manager);
      return { ok: true };
    });
  }
  async procesar() {
    if (this.trabajando) return; this.trabajando = true;
    try {
      const repo = this.ds.getRepository(CobranzaEnvio);
      const candidatos = await repo.find({ where: { estado: In(['PENDIENTE', 'ENVIANDO']), proximoIntento: LessThan(new Date()) }, order: { id: 'ASC' }, take: 25 });
      for (const candidato of candidatos) {
        const envio = await this.ds.transaction(async (manager) => {
          const r = manager.getRepository(CobranzaEnvio); const actual = await r.findOne({ where: { id: candidato.id }, lock: { mode: 'pessimistic_write' } });
          if (!actual || !['PENDIENTE', 'ENVIANDO'].includes(actual.estado) || actual.proximoIntento > new Date()) return null;
          if (actual.estado === 'ENVIANDO') {
            await r.update(actual.id, { estado: 'INCIERTO', error: 'ENVIO_INTERRUMPIDO_VERIFICAR_PROVEEDOR' });
            await this.bitacora.registrar(actual.actorId, 'COBRANZA_INCIERTO', 'cobranza_envio', actual.id, 'ENVIO_INTERRUMPIDO_VERIFICAR_PROVEEDOR', actual.plantelId, manager);
            return null;
          }
          actual.estado = 'ENVIANDO'; actual.intentos++; actual.proximoIntento = new Date(Date.now() + 120000); return r.save(actual);
        });
        if (!envio) continue;
        try {
          const usuario = await this.ds.getRepository(Usuario).findOneBy({ id: envio.usuarioId });
          const plantilla = await this.plantillas.findOneBy({ clave: 'AVISO_ADEUDO' });
          if (!usuario || !plantilla) throw Object.assign(new Error('Datos no disponibles'), { responseCode: 550 });
          const institucion = this.config.get<string>('NOMBRE_INSTITUCION') || 'Institución';
          const html = plantilla.cuerpoHtml.replace(/{{nombre}}/g, escapar(usuario.nombreCompleto)).replace(/{{saldo}}/g, envio.saldo.toFixed(2)).replace(/{{institucion}}/g, escapar(institucion));
          const resultado = await this.notificaciones.enviarEmail(usuario.email, plantilla.asunto.replace(/{{institucion}}/g, institucion), html, `${envio.clave}@escolar.invalid`);
          await this.resultado(envio, resultado.simulado ? 'ERROR' : 'ENVIADO', resultado.simulado ? 'SMTP_NO_CONFIGURADO' : null);
        } catch (e) {
          const codigo = (e as { responseCode?: number }).responseCode;
          const rechazado = codigo !== undefined && codigo >= 400 && codigo < 600;
          const retry = rechazado && codigo < 500 && envio.intentos < 3;
          await this.resultado(envio, retry ? 'PENDIENTE' : rechazado ? 'ERROR' : 'INCIERTO', rechazado ? 'SMTP_RECHAZO' : 'SMTP_RESULTADO_INCIERTO');
        }
      }
    } finally { this.trabajando = false; }
  }
  private async resultado(envio: CobranzaEnvio, estado: CobranzaEnvio['estado'], error: string | null) {
    await this.ds.transaction(async (manager) => {
      await manager.getRepository(CobranzaEnvio).update(envio.id, { estado, error, proximoIntento: new Date(Date.now() + 120000) });
      await this.bitacora.registrar(envio.actorId, `COBRANZA_${estado}`, 'cobranza_envio', envio.id, `intentos=${envio.intentos}; resultado=${error ?? 'SMTP_ACEPTADO'}`, envio.plantelId, manager);
    });
  }
}
