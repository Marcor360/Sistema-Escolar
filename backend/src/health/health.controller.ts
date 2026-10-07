import { constants, readFileSync } from 'fs';
import { access } from 'fs/promises';
import { uploadsPath } from '../common/uploads-path';
import { version } from '../../package.json';
import { resolve } from 'path';
import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get('live')
  vivo() { return { status: 'ok', version }; }

  @Get('ready')
  async listo() {
    try {
      const manifest = JSON.parse(readFileSync(resolve(__dirname, '../../../database/baseline-manifest.json'), 'utf8')) as {
        baseline: string; motores: Record<string, { pendientes: string[] }>;
      };
      const motor = this.dataSource.options.type === 'mssql' ? 'sqlserver' : 'mysql';
      const filas: { migration_id: string }[] = await this.dataSource.query('SELECT migration_id FROM schema_migrations');
      const aplicadas = new Set(filas.map((f) => f.migration_id));
      if (!aplicadas.has(`baseline:${manifest.baseline}`) || manifest.motores[motor].pendientes.some((m) => !aplicadas.has(m))) {
        throw new Error('Migraciones pendientes');
      }
      await access(uploadsPath(), constants.R_OK | constants.W_OK);
      return { status: 'ok', version, database: 'ok', schema: 'ok', storage: 'ok' };
    } catch { throw new ServiceUnavailableException('La API no está lista; verifica base, migraciones y almacenamiento'); }
  }

  @Get()
  async comprobar() {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ok', database: 'ok' };
    } catch {
      throw new ServiceUnavailableException('La base de datos no está disponible');
    }
  }
}
