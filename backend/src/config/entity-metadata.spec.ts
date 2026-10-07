import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import * as entities from '../entities';

// Valida los decoradores reales con el mismo compilador estricto que la API,
// sin necesitar una conexión. Antes de la reparación falla en ambos motores.
class MetadataDataSource extends DataSource {
  async validateEntities() {
    await this.buildMetadatas();
    return this.entityMetadatas;
  }
}

describe.each(['mysql', 'mssql'] as const)('Metadata de entidades (%s)', (type) => {
  it('acepta todas las entidades y resuelve cada columna nullable a un tipo del motor', async () => {
    const source = new MetadataDataSource({
      type,
      database: 'escolar_metadata_test',
      entities: Object.values(entities),
      namingStrategy: new SnakeNamingStrategy(),
      synchronize: false,
    });
    const metadata = await source.validateEntities();
    expect(metadata.filter((entity) => !entity.isJunction)).toHaveLength(Object.values(entities).length);
    const nullable = metadata.flatMap((entity) => entity.columns.filter((column) => column.isNullable));
    expect(nullable.length).toBeGreaterThan(50);
    for (const column of nullable) {
      expect(source.driver.supportedDataTypes).toContain(source.driver.normalizeType(column));
    }
    const user = source.getMetadata(entities.Usuario);
    expect(source.driver.normalizeType(user.findColumnWithPropertyName('apellidoMaterno')!))
      .toBe(type === 'mysql' ? 'varchar' : 'nvarchar');
    expect(source.driver.normalizeType(source.getMetadata(entities.BitacoraActividad)
      .findColumnWithPropertyName('usuarioId')!)).toBe('int');
    expect(source.getMetadata(entities.Grupo).findColumnWithPropertyName('legacyId')?.isNullable).toBe(true);
  });
});
