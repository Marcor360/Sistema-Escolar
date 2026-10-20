import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { AceptacionInstitucional } from '../entities/aceptacion-institucional.entity';
import { JwtUser } from '../common/current-user.decorator';

type Documento = 'REGLAMENTO_ACADEMICO' | 'POLITICAS_INSTITUCIONALES';
interface Definicion { clave: Documento; titulo: string; url: string; version: string }

@Injectable()
export class ConsentimientoInstitucionalService {
  constructor(private readonly ds: DataSource, private readonly config: ConfigService) {}

  private definiciones(): Definicion[] {
    if (this.config.get<string>('CONSENTIMIENTO_INSTITUCIONAL_HABILITADO') !== 'true') return [];
    const documentos: Definicion[] = [
      { clave: 'REGLAMENTO_ACADEMICO', titulo: 'Reglamento académico', url: this.config.get<string>('REGLAMENTO_ACADEMICO_URL') || '', version: this.config.get<string>('REGLAMENTO_ACADEMICO_VERSION') || '' },
      { clave: 'POLITICAS_INSTITUCIONALES', titulo: 'Políticas institucionales', url: this.config.get<string>('POLITICAS_INSTITUCIONALES_URL') || '', version: this.config.get<string>('POLITICAS_INSTITUCIONALES_VERSION') || '' },
    ];
    if (documentos.some(d => !/^https:\/\/[^\s/]+\/.+/.test(d.url) || !/^[A-Za-z0-9._-]{1,80}$/.test(d.version))) {
      throw new Error('Consentimiento habilitado sin URLs HTTPS o versiones documentales autorizadas');
    }
    return documentos;
  }

  private validarAlumno(u: JwtUser): void {
    if (!u.roles.includes('ALUMNO')) throw new ForbiddenException('Operación exclusiva del alumno');
  }

  async estado(u: JwtUser) {
    this.validarAlumno(u);
    const documentos = this.definiciones();
    if (!documentos.length) return { habilitado: false, pendiente: false, documentos: [] };
    const previas = await this.ds.getRepository(AceptacionInstitucional).findBy({ usuarioId: u.sub });
    const detalle = documentos.map(d => ({ ...d, aceptadoEn: previas.find(a => a.documento === d.clave && a.versionDocumento === d.version)?.aceptadoEn?.toISOString() || null }));
    return { habilitado: true, pendiente: detalle.some(d => !d.aceptadoEn), documentos: detalle };
  }

  async pendiente(u: JwtUser): Promise<boolean> {
    if (!u.roles.includes('ALUMNO')) return false;
    return (await this.estado(u)).pendiente;
  }

  async aceptar(u: JwtUser, versiones: Record<Documento, string>) {
    this.validarAlumno(u);
    const documentos = this.definiciones();
    if (!documentos.length) throw new ForbiddenException('La aceptación institucional aún no está habilitada');
    if (documentos.some(d => versiones[d.clave] !== d.version)) {
      throw new BadRequestException('Los documentos cambiaron. Consulta las versiones vigentes antes de aceptar.');
    }
    await this.ds.transaction(async m => {
      const repo = m.getRepository(AceptacionInstitucional);
      const ahora = new Date();
      for (const documento of documentos) {
        const previa = await repo.findOneBy({ usuarioId: u.sub, documento: documento.clave, versionDocumento: documento.version });
        if (!previa) {
          await repo.insert({ id: randomUUID(), usuarioId: u.sub, documento: documento.clave, versionDocumento: documento.version, aceptadoEn: ahora });
        }
      }
    });
    return this.estado(u);
  }
}
