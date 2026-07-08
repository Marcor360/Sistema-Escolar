import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { join } from 'path';

/**
 * Motor configurable vía .env (DB_TYPE=mysql | mssql).
 * Las entidades usan solo tipos portables y naming snake_case,
 * en correspondencia 1:1 con database/{mysql,sqlserver}/schema.sql.
 */
export function typeOrmConfig(config: ConfigService): TypeOrmModuleOptions {
  const type = (config.get<string>('DB_TYPE') || 'mysql') as 'mysql' | 'mssql';

  const base = {
    type,
    host: config.get<string>('DB_HOST') || 'localhost',
    port: Number(config.get('DB_PORT')) || (type === 'mssql' ? 1433 : 3306),
    username: config.get<string>('DB_USER') || 'root',
    password: config.get<string>('DB_PASS') || '',
    database: config.get<string>('DB_NAME') || 'escolar',
    entities: [join(__dirname, '..', 'entities', '*.entity{.ts,.js}')],
    synchronize: config.get('DB_SYNC') === 'true',
    namingStrategy: new SnakeNamingStrategy(),
    logging: false,
  };

  if (type === 'mssql') {
    return { ...base, options: { encrypt: false, trustServerCertificate: true } } as TypeOrmModuleOptions;
  }
  return base as TypeOrmModuleOptions;
}
