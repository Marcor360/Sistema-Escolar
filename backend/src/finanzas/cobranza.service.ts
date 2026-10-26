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
import { ListarPendientesDto } from './finanzas.dto';
const redondear = (n: number) => Math.round(n * 100) / 100;
const escapar = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
@Injectable()
export class CobranzaService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>; private timerAutomaticos?: ReturnType<typeof setInterval>;
  private trabajando = false; private automatizando = false;
  private ultimoDiaRecargos = '';
  private readonly logger = new Logger(CobranzaService.name);
  constructor(
    @InjectRepository(PlantillaCorreo) private readonly plantillas: Repository<PlantillaCorreo>,
    private readonly cargos: CargosService, private readonly notificaciones: NotificacionesService,
    private readonly bitacora: BitacoraFinancieraService, private readonly config: ConfigService,
    private readonly ds: DataSource, private readonly scope: ScopeService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => { void this.procesar().catch(() => this.logger.warn('Cobranza pendiente; revisar configuración/proveedor')); }, 30000);
    this.timer.unref();
    this.timerAutomaticos = setInterval(() => { void this.ejecutarAutomaticos().catch(() => this.logger.warn('Automatización financiera pendiente de revisión')); }, 60 * 60 * 1000);
    this.timerAutomaticos.unref();
    void this.ejecutarAutomaticos().catch(() => this.logger.warn('No se pudo ejecutar la automatización financiera'));
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.timerAutomaticos) clearInterval(this.timerAutomaticos);
  }

  async enviarAvisos(user: JwtUser, plantelId?: number, preview = false, confirmado = false, soloVencidos = false, soloSinAbono = false) {
    if (!plantelId) throw new BadRequestException('Selecciona un plantel para esta operación');
    if (!preview && !confirmado) throw new BadRequestException('Revisa la previsualización y confirma la operación');
    if (!await this.plantillas.findOneBy({ clave: 'AVISO_ADEUDO' })) throw new BadRequestException('Falta la plantilla AVISO_ADEUDO');
    const dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const adeudos = (await this.cargos.adeudos(user, plantelId, true))
      .filter((cargo) => !soloVencidos || (cargo.fechaVencimiento !== null && cargo.fechaVencimiento < dia));
    const abonado = new Map<number, number>();
    for (const cargo of adeudos) abonado.set(cargo.alumnoId, (abonado.get(cargo.alumnoId) ?? 0) + cargo.pagado);
    const porAlumno = new Map<number, { usuarioId: number; saldo: number; cargos: string[] }>();
    for (const c of adeudos) {
      if (c.alumno.estatus !== 'ACTIVO' || (soloSinAbono && (abonado.get(c.alumnoId) ?? 0) > 0)) continue;
      const actual = porAlumno.get(c.alumnoId) ?? { usuarioId: c.alumno.usuarioId, saldo: 0, cargos: [] };
      actual.saldo = redondear(actual.saldo + c.saldo); actual.cargos.push(`${c.id}:${c.saldo}`); porAlumno.set(c.alumnoId, actual);
    }
    if (preview) return { plantelId, registros: porAlumno.size, totalEstimado: redondear([...porAlumno.values()].reduce((s, a) => s + a.saldo, 0)) };
    let programados = 0, omitidos = 0;
    for (const datos of porAlumno.values()) {
      const clave = createHash('sha256').update(JSON.stringify(
        soloVencidos ? ['AUTO_CARTERA_VENCIDA', dia.slice(0, 7), plantelId, datos.usuarioId] :
          [dia, plantelId, datos.usuarioId, datos.cargos.sort()],
      )).digest('hex');
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
  /**
   * Un solo actor real de FINANZAS opera por sus planteles asignados.
   * Las banderas permanecen apagadas hasta aprobar calendario, SMTP y UAT.
   */
  private async ejecutarAutomaticos() {
    const avisosActivos = this.config.get<string>('COBRANZA_DIA3_HABILITADA') === 'true';
    const recargosActivos = this.config.get<string>('RECARGOS_AUTOMATICOS_HABILITADOS') === 'true';
    if ((!avisosActivos && !recargosActivos) || this.automatizando) return;
    const fecha = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
    const enviarHoy = avisosActivos && fecha.endsWith('-03');
    const aplicarHoy = recargosActivos && Number(fecha.slice(-2)) >= 4 && this.ultimoDiaRecargos !== fecha;
    if (!enviarHoy && !aplicarHoy) return;
    this.automatizando = true;
    try {
      const actorId = Number(this.config.get<string>('FINANZAS_AUTO_ACTOR_ID'));
      if (!Number.isSafeInteger(actorId) || actorId <= 0) throw new Error('FINANZAS_AUTO_ACTOR_ID inválido');
      const usuario = await this.ds.getRepository(Usuario).findOneBy({ id: actorId, activo: true });
      if (!usuario || !usuario.roles.some((rol) => rol.clave === 'FINANZAS')) {
        throw new Error('El actor de automatización no es un usuario FINANZAS activo');
      }
      const actor: JwtUser = { sub: usuario.id, email: usuario.email, nombre: usuario.nombre,
        roles: usuario.roles.map((rol) => rol.clave), portal: 'WEB' };
      const planteles = await this.scope.plantelesDe(actor);
      if (!planteles || planteles.length === 0) throw new Error('El actor automático necesita planteles asignados');
      if (enviarHoy && !this.config.get<string>('SMTP_HOST')) throw new Error('El correo SMTP no está configurado');
      for (const plantelId of planteles) {
        if (enviarHoy) await this.enviarAvisos(actor, plantelId, false, true, true);
        if (aplicarHoy) await this.cargos.aplicarRecargos({ plantelId, porcentaje: 10, confirmado: true }, actor);
      }
      if (aplicarHoy) this.ultimoDiaRecargos = fecha;
    } finally {
      this.automatizando = false;
    }
  }

  /** Unifica saldos por alumno sin publicar teléfonos fuera del rol FINANZAS. */
  async pendientes(user: JwtUser, q: ListarPendientesDto) {
    await this.scope.validarGestion(user, q.plantelId);
    const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City',
      year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const cargos = await this.cargos.adeudos(user, q.plantelId, true);
    const porAlumno = new Map<number, {
      alumnoId: number; matricula: string; nombre: string; telefono: string | null; email: string | null;
      saldo: number; abonado: number; numeroCargos: number; primerVencimiento: string | null; vencidos: number;
    }>();
    for (const c of cargos) {
      if (c.alumno.estatus !== 'ACTIVO') continue;
      const contacto = c.alumno as typeof c.alumno & { tutorTelefono?: string | null; usuario: typeof c.alumno.usuario & { email?: string; telefono?: string | null } };
      const linea = porAlumno.get(c.alumnoId) ?? {
        alumnoId: c.alumnoId, matricula: c.alumno.matricula, nombre: c.alumno.usuario?.nombreCompleto ?? c.alumno.matricula,
        telefono: contacto.tutorTelefono || contacto.usuario?.telefono || null,
        email: contacto.usuario?.email || null, saldo: 0, abonado: 0,
        numeroCargos: 0, primerVencimiento: null, vencidos: 0,
      };
      linea.saldo = redondear(linea.saldo + c.saldo);
      linea.abonado = redondear(linea.abonado + c.pagado);
      linea.numeroCargos++;
      if (c.fechaVencimiento && (!linea.primerVencimiento || c.fechaVencimiento < linea.primerVencimiento))
        linea.primerVencimiento = c.fechaVencimiento;
      if (c.fechaVencimiento && c.fechaVencimiento < hoy) linea.vencidos++;
      porAlumno.set(c.alumnoId, linea);
    }
    const datos = [...porAlumno.values()].filter(a =>
      (q.sinAbono !== true || a.abonado === 0) &&
      (q.situacion !== 'VENCIDOS' || a.vencidos > 0) &&
      (q.situacion !== 'POR_VENCER' || a.vencidos === 0),
    ).sort((a, b) => b.vencidos - a.vencidos || b.saldo - a.saldo || a.matricula.localeCompare(b.matricula));
    const pagina = q.pagina || 1, porPagina = q.porPagina || 10;
    return {
      datos: datos.slice((pagina - 1) * porPagina, pagina * porPagina),
      total: datos.length, pagina, porPagina,
      resumen: { alumnosConSaldo: porAlumno.size, sinAbono: [...porAlumno.values()].filter(a => a.abonado === 0).length,
        conAbonoParcial: [...porAlumno.values()].filter(a => a.abonado > 0).length,
        vencidos: [...porAlumno.values()].filter(a => a.vencidos > 0).length },
      nota: 'Sin abono significa sin pagos aplicados a los cargos aún pendientes; no indica falta de pagos históricos.',
    };
  }
  async listar(user: JwtUser, pagina = 1) {
    const planteles = await this.scope.resolverFiltro(user);
    const [datos, total] = await this.ds.getRepository(CobranzaEnvio).findAndCount({ where: planteles === null ? {} : { plantelId: In(planteles) }, order: { id: 'DESC' }, skip: (pagina - 1) * 10, take: 10 });
    return { datos: datos.map(({ id, plantelId, usuarioId, saldo, estado, intentos, error, createdAt }) => ({ id, plantelId, usuarioId, saldo, estado, intentos, error, createdAt })), total, pagina, porPagina: 10 };
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
          const resultado = await this.notificaciones.enviarEmail(usuario.email, plantilla.asunto.replace(/{{institucion}}/g, institucion), html, `${envio.clave}@escolar.invalid`, 'FINANCIERA');
          await this.resultado(envio, resultado.omitido ? 'OMITIDO' : resultado.simulado ? 'ERROR' : 'ENVIADO', resultado.omitido ? 'PREFERENCIA_USUARIO' : resultado.simulado ? 'SMTP_NO_CONFIGURADO' : null);
        } catch (e) {
          const codigo = (e as { responseCode?: number }).responseCode;
          const rechazado = codigo !== undefined && codigo >= 400 && codigo < 600;
          const retry = rechazado && codigo < 500 && envio.intentos < 3;
          await this.resultado(envio, retry ? 'PENDIENTE' : rechazado ? 'ERROR' : 'INCIERTO', rechazado ? 'SMTP_RECHAZO' : 'CORREO_RESULTADO_INCIERTO');
        }
      }
    } finally { this.trabajando = false; }
  }
  private async resultado(envio: CobranzaEnvio, estado: CobranzaEnvio['estado'], error: string | null) {
    await this.ds.transaction(async (manager) => {
      await manager.getRepository(CobranzaEnvio).update(envio.id, { estado, error, proximoIntento: new Date(Date.now() + 120000) });
      await this.bitacora.registrar(envio.actorId, `COBRANZA_${estado}`, 'cobranza_envio', envio.id, `intentos=${envio.intentos}; resultado=${error ?? 'CORREO_ACEPTADO'}`, envio.plantelId, manager);
    });
  }
}
