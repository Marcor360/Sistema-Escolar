import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { join } from 'path';
import { readFileSync } from 'fs';

/**
 * Motor configurable vía .env (DB_TYPE=mysql | mssql).
 * Las entidades usan solo tipos portables y naming snake_case,
 * en correspondencia 1:1 con database/{mysql,sqlserver}/schema.sql.
 */
export function typeOrmConfig(config: ConfigService): TypeOrmModuleOptions {
  const type = (config.get<string>('DB_TYPE') || 'mysql') as 'mysql' | 'mssql';
  const production = config.get<string>('NODE_ENV') === 'production';
  const synchronize = config.get<string>('DB_SYNC') === 'true';
  if (production && synchronize) {
    throw new Error('Seguridad: DB_SYNC no puede habilitarse en producción; aplica migraciones incrementales');
  }

  const booleanEnv = (name: string, fallback: boolean) => {
    const value = config.get<string>(name);
    return value === undefined ? fallback : value.toLowerCase() === 'true';
  };

  const base = {
    type,
    host: config.get<string>('DB_HOST') || 'localhost',
    port: Number(config.get('DB_PORT')) || (type === 'mssql' ? 1433 : 3306),
    username: config.get<string>('DB_USER') || 'root',
    password: config.get<string>('DB_PASS') || '',
    database: config.get<string>('DB_NAME') || 'escolar',
    entities: [join(__dirname, '..', 'entities', '*.entity{.ts,.js}')],
    synchronize,
    namingStrategy: new SnakeNamingStrategy(),
    logging: false,
  };

  if (type === 'mssql') {
    const encrypt = booleanEnv('DB_ENCRYPT', production);
    const trustServerCertificate = booleanEnv('DB_TRUST_SERVER_CERTIFICATE', !production);
    if (production && (!encrypt || trustServerCertificate)) {
      throw new Error('Seguridad: SQL Server en producción requiere TLS y validación del certificado');
    }
    return {
      ...base,
      options: { encrypt, trustServerCertificate },
    } as TypeOrmModuleOptions;
  }

  const ssl = booleanEnv('DB_SSL', production);
  if (production && !ssl) throw new Error('Seguridad: MySQL en producción requiere TLS');
  const caPath = config.get<string>('DB_SSL_CA_PATH');
  return {
    ...base,
    ...(ssl ? { ssl: { rejectUnauthorized: true, ...(caPath ? { ca: readFileSync(caPath) } : {}) } } : {}),
  } as TypeOrmModuleOptions;
}
