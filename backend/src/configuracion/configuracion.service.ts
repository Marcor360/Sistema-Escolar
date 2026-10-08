import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { promises as fs } from 'fs';
import { validarContenidoArchivo } from '../common/validar-archivo';
import { Repository } from 'typeorm';
import { programarLimpieza } from '../archivos/archivo-limpieza.service';
import { ConfiguracionMarca } from '../entities';
import { ActualizarMarcaDto, MarcaPublicaDto } from './configuracion.dto';

const VALORES_INICIALES = {
  id: 1,
  nombreInstitucion: 'Sistema Escolar',
  nombreCorto: 'SE',
  logoUrl: null as string | null,
  colorPrimario: '#14343B',
  colorAcento: '#C79A3C',
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

  async guardarLogo(file: Express.Multer.File): Promise<MarcaPublicaDto> {
    try {
      await validarContenidoArchivo(file);
      return await this.modificar((marca) => { marca.logoUrl = `/uploads/${file.filename}`; });
    } catch (error) {
      await fs.unlink(file.path).catch(() => undefined);
      throw error;
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
      if (anterior && anterior !== guardada.logoUrl) await programarLimpieza(manager, anterior);
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
