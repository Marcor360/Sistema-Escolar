import { SelectQueryBuilder } from 'typeorm';
import { Usuario } from '../entities/usuario.entity';
import { UsuariosService } from './usuarios.service';

describe('búsqueda de directorio de usuarios', () => {
  it('consulta nombre, ambos apellidos y correo sin concatenar el texto a SQL', () => {
    const where = jest.fn();
    const qb = { andWhere: where } as unknown as SelectQueryBuilder<Usuario>;
    const servicio = Object.create(UsuariosService.prototype) as UsuariosService;
    const invocar = servicio as unknown as {
      aplicarBusqueda: (consulta: SelectQueryBuilder<Usuario>, buscar?: string, extra?: string) => void;
    };
    invocar.aplicarBusqueda(qb, '  López  ', 'a.matricula');
    expect(where).toHaveBeenCalledWith(
      expect.stringContaining('u.apellido_materno LIKE :buscar'),
      { buscar: '%López%' },
    );
    expect(where.mock.calls[0][0]).toContain('a.matricula LIKE :buscar');
  });
});
