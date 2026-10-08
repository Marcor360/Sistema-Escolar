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
  const type = config.getOrThrow<string>('DB_TYPE') as 'mysql' | 'mssql';
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
    host: config.getOrThrow<string>('DB_HOST'),
    port: Number(config.getOrThrow<string>('DB_PORT')),
    username: config.getOrThrow<string>('DB_USER'),
    password: config.getOrThrow<string>('DB_PASS'),
    database: config.getOrThrow<string>('DB_NAME'),
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
