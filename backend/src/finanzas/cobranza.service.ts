import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlantillaCorreo } from '../entities/plantilla-correo.entity';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { CargosService } from './cargos.service';
import { BitacoraFinancieraService } from './bitacora-financiera.service';
import { JwtUser } from '../common/current-user.decorator';

const redondear = (n: number) => Math.round(n * 100) / 100;

/** Única responsabilidad: avisos de cobranza con plantilla a alumnos con saldo. */
@Injectable()
export class CobranzaService {
  constructor(
    @InjectRepository(PlantillaCorreo) private readonly plantillas: Repository<PlantillaCorreo>,
    private readonly cargos: CargosService,
    private readonly notificaciones: NotificacionesService,
    private readonly bitacora: BitacoraFinancieraService,
    private readonly config: ConfigService,
  ) {}

  async enviarAvisos(user: JwtUser) {
    const plantilla = await this.plantillas.findOne({ where: { clave: 'AVISO_ADEUDO' } });
    if (!plantilla) throw new BadRequestException('Falta la plantilla AVISO_ADEUDO');
    const institucion = this.config.get<string>('NOMBRE_INSTITUCION') || 'Institución';

    const adeudos = await this.cargos.adeudos(user);
    const porAlumno = new Map<number, { nombre: string; email: string; usuarioId: number; saldo: number }>();
    for (const cargo of adeudos) {
      const actual = porAlumno.get(cargo.alumnoId) ?? {
        nombre: cargo.alumno.usuario.nombreCompleto,
        email: cargo.alumno.usuario.email,
        usuarioId: cargo.alumno.usuarioId,
        saldo: 0,
      };
      actual.saldo = redondear(actual.saldo + cargo.saldo);
      porAlumno.set(cargo.alumnoId, actual);
    }

    let enviados = 0;
    for (const datos of porAlumno.values()) {
      const html = plantilla.cuerpoHtml
        .replace(/{{nombre}}/g, datos.nombre)
        .replace(/{{saldo}}/g, datos.saldo.toFixed(2))
        .replace(/{{institucion}}/g, institucion);
      const asunto = plantilla.asunto.replace(/{{institucion}}/g, institucion);
      await this.notificaciones.enviarEmail(datos.email, asunto, html);
      await this.notificaciones.crear(
        datos.usuarioId, 'Aviso de adeudo',
        `Presentas un saldo pendiente de $${datos.saldo.toFixed(2)} MXN.`, 'FINANCIERA',
      );
      enviados++;
    }
    await this.bitacora.registrar(user.sub, 'AVISOS_COBRANZA', 'notificacion', null, `avisos=${enviados}`);
    return { enviados };
  }
}
