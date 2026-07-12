import 'dotenv/config'; // primero: garantiza process.env para módulos evaluados al importar
import 'reflect-metadata';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const uploadsDir = join(process.cwd(), process.env.UPLOADS_DIR || 'uploads');
  mkdirSync(uploadsDir, { recursive: true }); // Multer no crea el destino por sí solo

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Encabezados de seguridad
  app.use(helmet({ contentSecurityPolicy: false }));

  // CORS: en producción, restringir con CORS_ORIGINS=https://portal.midominio.mx,https://otro
  const origenes = process.env.CORS_ORIGINS?.split(',').map((o) => o.trim());
  app.enableCors({
    origin: origenes?.filter(Boolean).length
      ? origenes.filter(Boolean)
      : process.env.NODE_ENV === 'production' ? false : 'http://localhost:5173',
  });

  app.setGlobalPrefix('api', { exclude: [{ path: 'uploads/:filename', method: RequestMethod.GET }] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Documentación interactiva solo fuera de producción
  if (process.env.NODE_ENV !== 'production') {
    const swagger = new DocumentBuilder()
      .setTitle('Sistema Escolar MVP')
      .setDescription('API académica, administrativa y financiera')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger));
  }

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);
  console.log(`API en http://localhost:${port}/api`);
}
bootstrap();
