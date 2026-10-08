import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ContextoIntegracion } from './contexto';
import { expect, it } from '@jest/globals';
import * as ExcelJS from 'exceljs';
import * as bcrypt from 'bcryptjs';
import { Grupo } from '../../src/entities';
export const casos_baseline: Record<number, (ctx: ContextoIntegracion) => void> = {
  0: (ctx) => {
it('mantiene paridad de columnas nullable entre las entidades y el baseline migrado', async () => {
    const runner = ctx.dataSource.createQueryRunner();
    try {
      for (const metadata of ctx.dataSource.entityMetadatas) {
        const table = await runner.getTable(metadata.tablePath);
        expect(table).toBeDefined();
        expect(table!.columns.map((column) => column.name).sort())
          .toEqual(metadata.columns.map((column) => column.databaseName).sort());
        for (const column of metadata.columns) {
          const physical = table!.findColumnByName(column.databaseName)!;
          const tipo = ctx.dataSource.driver.normalizeType(column);
          // SQL Server conserva datetime2 y NVARCHAR(MAX) para instantes/textos portables.
          const compatibles = ctx.dataSource.options.type === 'mssql' && tipo === 'datetime' ? ['datetime', 'datetime2']
            : ctx.dataSource.options.type === 'mssql' && tipo === 'text' ? ['text', 'nvarchar'] : [tipo];
          expect(compatibles).toContain(physical.type);
          if (ctx.dataSource.options.type === 'mssql' && tipo === 'text' && physical.type === 'nvarchar') expect(physical.length).toBe('MAX');
          expect(`${metadata.tableName}.${column.databaseName}: ${physical.isNullable}`)
            .toBe(`${metadata.tableName}.${column.databaseName}: ${column.isNullable}`);
          if (column.length) expect(physical.length).toBe(column.length);
          if (column.type === 'decimal') {
            expect(physical.precision).toBe(column.precision);
            expect(physical.scale).toBe(column.scale);
          }
        }
      }
    } finally {
      await runner.release();
    }
  });
  },
  1: (ctx) => {
it('conserva los grupos preexistentes al actualizar el índice histórico', async () => {
    const grupoExistente = await ctx.dataSource.getRepository(Grupo).findOneBy({ nombre: 'GRUPO_MIGRACION_EXISTENTE' });
    expect(grupoExistente).toEqual(expect.objectContaining({ nombre: 'GRUPO_MIGRACION_EXISTENTE' }));
  });
  },
  8: (ctx) => {
it('expone disponibilidad con verificación real de la base', async () => {
    const health = await ctx.api('/health');
    expect(health.response.status).toBe(200);
    expect(health.data).toEqual({ status: 'ok', database: 'ok' });
    expect((await ctx.api('/health/live')).response.status).toBe(200);
    const ready = await ctx.api('/health/ready');
    expect(ready.response.status).toBe(200);
    expect(ready.data.schema).toBe('ok');
  });
  },
  50: (ctx) => {
    it('publica contratos OpenAPI de importación, promoción, conducta y analítica con errores y alcance', () => {
      const doc = SwaggerModule.createDocument(ctx.app, new DocumentBuilder().addBearerAuth().build());
      const paths = Object.keys(doc.paths);
      for (const sufijo of ['/importaciones/preview','/importaciones/confirmar','/academico/promocion/preview','/conducta/incidencias','/analitica']) {
        const path = paths.find((p) => p.endsWith(sufijo)); expect(path).toBeDefined();
        const operacion = doc.paths[path!].post ?? doc.paths[path!].get!;
        for (const code of ['400','401','403','404','409']) expect(operacion.responses[code]).toBeDefined();
        expect(operacion.security).toBeDefined();
      }
      const preview = doc.paths[paths.find((p) => p.endsWith('/importaciones/preview'))!].post!;
      expect(preview.requestBody).toHaveProperty('content.multipart/form-data.schema.required', ['tipo','archivo']);
      expect(doc.components?.schemas?.AnaliticaRespuestaDto).toHaveProperty('properties.academico');
      expect(doc.components?.schemas?.AnaliticaRespuestaDto).toHaveProperty('properties.financiero');
    });
  },
};
