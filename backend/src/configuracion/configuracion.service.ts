import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { constants, promises as fs } from 'fs';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { uploadsPath } from '../common/uploads-path';
import { validarContenidoArchivo } from '../common/validar-archivo';
import { Repository } from 'typeorm';
import { programarLimpieza } from '../archivos/archivo-limpieza.service';
import { ConfiguracionMarca } from '../entities';
import { ActualizarMarcaDto, ActualizarOpcionesGlobalesDto, MarcaPublicaDto } from './configuracion.dto';

/** Asocia una copia PNG validada con el WebP publicado, sin aceptar nombres ajenos. */
export function nombreLogoPdf(logoUrl: string): string {
  if (!/^\/uploads\/marca-logo-[0-9a-f-]+\.webp$/i.test(logoUrl)) throw new BadRequestException('Logo institucional inválido');
  return logoUrl.slice('/uploads/'.length).replace(/\.webp$/i, '.png');
}

const VALORES_INICIALES = {
  id: 1,
  nombreInstitucion: 'Sistema Escolar',
  nombreCorto: 'SE',
  logoUrl: null as string | null,
  colorPrimario: '#14343B',
  colorAcento: '#C79A3C',
  mensajeBienvenida: '',
  tamanoLogo: 'NORMAL' as const,
};

@Injectable()
export class ConfiguracionService {
  constructor(@InjectRepository(ConfiguracionMarca) private readonly repo: Repository<ConfiguracionMarca>) {}

  async obtener(): Promise<MarcaPublicaDto> {
    let marca = await this.repo.findOne({ where: { id: 1 } });
    if (!marca) marca = await this.repo.save(this.repo.create(VALORES_INICIALES));
    return this.aPublica(marca);
  }

  async actualizar(dto: ActualizarMarcaDto): Promise<MarcaPublicaDto> {
    return this.modificar((marca) => {
      Object.assign(marca, dto, {
        colorPrimario: dto.colorPrimario.toUpperCase(),
        colorAcento: dto.colorAcento.toUpperCase(),
      });
    });
  }

  async actualizarOpciones(dto: ActualizarOpcionesGlobalesDto): Promise<MarcaPublicaDto> {
    return this.modificar((marca) => {
      marca.mensajeBienvenida = dto.mensajeBienvenida;
      marca.tamanoLogo = dto.tamanoLogo;
    });
  }
  async guardarLogo(file: Express.Multer.File): Promise<MarcaPublicaDto> {
    const nombre = `marca-logo-${randomUUID()}.webp`;
    const destino = join(uploadsPath(), nombre);
    let publicado = false;
    try {
      await validarContenidoArchivo(file);
      await fs.rename(file.path, destino);
      publicado = true;
      await fs.access(destino, constants.R_OK);
      return await this.modificar((marca) => { marca.logoUrl = `/uploads/${nombre}`; });
    } catch (error) {
      if (publicado) await fs.unlink(destino).catch(() => undefined);
      throw error;
    } finally {
      await fs.unlink(file.path).catch(() => undefined);
    }
  }

  async guardarLogoPdf(file: Express.Multer.File, logoUrl?: string) {
    try {
      const nombre = nombreLogoPdf(logoUrl ?? '');
      await validarContenidoArchivo(file);
      const imagen = await fs.open(file.path, 'r');
      let cabecera: Buffer;
      try {
        cabecera = Buffer.alloc(33);
        const { bytesRead } = await imagen.read(cabecera, 0, 33, 0);
        if (bytesRead !== 33) throw new BadRequestException('El logo PNG está incompleto');
      } finally { await imagen.close(); }
      if (cabecera.readUInt32BE(8) !== 13 || cabecera.subarray(12, 16).toString('ascii') !== 'IHDR') {
        throw new BadRequestException('La cabecera PNG no es válida');
      }
      const ancho = cabecera.readUInt32BE(16);
      const alto = cabecera.readUInt32BE(20);
      if (!ancho || !alto || ancho > 1024 || alto > 1024 || ancho * alto > 1024 * 1024) {
        throw new BadRequestException('La imagen PDF excede las dimensiones permitidas');
      }
      const destino = join(uploadsPath(), nombre);
      await this.repo.manager.transaction(async (manager) => {
        const actual = await manager.getRepository(ConfiguracionMarca).findOne({ where: { id: 1 }, lock: { mode: 'pessimistic_write' } });
        if (!actual || actual.logoUrl !== logoUrl) throw new ConflictException('El logo cambió; vuelve a cargar el archivo antes de asociar su variante PDF');
        await fs.rename(file.path, destino);
      });
      return { logoPdfUrl: '/uploads/' + nombre };
    } finally {
      await fs.unlink(file.path).catch(() => undefined);
    }
  }

  async quitarLogo(): Promise<MarcaPublicaDto> {
    return this.modificar((marca) => { marca.logoUrl = null; });
  }

  private async modificar(cambio: (marca: ConfiguracionMarca) => void): Promise<MarcaPublicaDto> {
    await this.obtener();
    return this.repo.manager.transaction(async (manager) => {
      const repo = manager.getRepository(ConfiguracionMarca);
      const marca = await repo.findOneOrFail({ where: { id: 1 }, lock: { mode: 'pessimistic_write' } });
      const anterior = marca.logoUrl;
      cambio(marca);
      const guardada = await repo.save(marca);
      if (anterior && anterior !== guardada.logoUrl) {
        await programarLimpieza(manager, anterior);
        if (/^\/uploads\/marca-logo-[0-9a-f-]+\.webp$/i.test(anterior)) {
          await programarLimpieza(manager, '/uploads/' + nombreLogoPdf(anterior));
        }
      }
      return this.aPublica(guardada);
    });
  }

  private aPublica(marca: ConfiguracionMarca): MarcaPublicaDto {
    return {
      nombreInstitucion: marca.nombreInstitucion,
      nombreCorto: marca.nombreCorto,
      logoUrl: marca.logoUrl,
      colorPrimario: marca.colorPrimario,
      colorPrimarioOscuro: this.oscurecer(marca.colorPrimario),
      colorAcento: marca.colorAcento,
      mensajeBienvenida: marca.mensajeBienvenida,
      tamanoLogo: marca.tamanoLogo,
      actualizadoEn: marca.actualizadoEn,
    };
  }

  private oscurecer(color: string): string {
    // Se conserva la pareja histórica exacta; para cualquier otro color se aplica el factor acordado.
    if (color.toUpperCase() === '#14343B') return '#0E262B';
    const canales = [1, 3, 5].map((inicio) => Math.round(parseInt(color.slice(inicio, inicio + 2), 16) * 0.72));
    return `#${canales.map((canal) => canal.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
  }
}
