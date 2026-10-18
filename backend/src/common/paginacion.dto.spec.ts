import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PaginacionDto } from './paginacion.dto';

describe('PaginacionDto', () => {
  it('usa 10 registros por defecto y admite solicitudes explícitas', async () => {
    const defecto = plainToInstance(PaginacionDto, {});
    expect(defecto.pagina).toBe(1);
    expect(defecto.porPagina).toBe(10);
    const solicitado = plainToInstance(PaginacionDto, { pagina: '2', porPagina: '20' });
    expect(await validate(solicitado)).toHaveLength(0);
    expect(solicitado.pagina).toBe(2);
    expect(solicitado.porPagina).toBe(20);
  });

  it('limita la cantidad solicitada a 100', async () => {
    const dto = plainToInstance(PaginacionDto, { porPagina: 101 });
    expect(await validate(dto)).not.toHaveLength(0);
  });
});
