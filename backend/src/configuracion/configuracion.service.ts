import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { promises as fs } from 'fs';
import { basename, join } from 'path';
import { Repository } from 'typeorm';
import { ConfiguracionMarca } from '../entities';
import { ActualizarMarcaDto, MarcaPublicaDto } from './configuracion.dto';

const VALORES_INICIALES = {
  id: 1,
  nombreInstitucion: 'Sistema Escolar',
  nombreCorto: 'SE',
  logoUrl: null,
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
    let marca = await this.repo.findOne({ where: { id: 1 } });
    if (!marca) marca = this.repo.create(VALORES_INICIALES);
    Object.assign(marca, dto, {
      colorPrimario: dto.colorPrimario.toUpperCase(),
      colorAcento: dto.colorAcento.toUpperCase(),
    });
    await this.repo.save(marca);
    return this.obtener();
  }

  async guardarLogo(file: Express.Multer.File): Promise<MarcaPublicaDto> {
    let marca = await this.repo.findOne({ where: { id: 1 } });
    if (!marca) marca = this.repo.create(VALORES_INICIALES);
    const anterior = marca.logoUrl;
    marca.logoUrl = `/uploads/${file.filename}`;
    await this.repo.save(marca);
    await this.eliminarArchivo(anterior);
    return this.obtener();
  }

  async quitarLogo(): Promise<MarcaPublicaDto> {
    let marca = await this.repo.findOne({ where: { id: 1 } });
    if (!marca) marca = this.repo.create(VALORES_INICIALES);
    const anterior = marca.logoUrl;
    marca.logoUrl = null;
    await this.repo.save(marca);
    await this.eliminarArchivo(anterior);
    return this.obtener();
  }

  private async eliminarArchivo(url: string | null): Promise<void> {
    if (!url) return;
    try {
      await fs.unlink(join(process.cwd(), process.env.UPLOADS_DIR || 'uploads', basename(url)));
    } catch {
      // La limpieza es best-effort: una ausencia previa no invalida la configuración.
    }
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
