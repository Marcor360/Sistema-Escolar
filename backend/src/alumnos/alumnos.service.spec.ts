import { AlumnosService } from './alumnos.service';

describe('AlumnosService.listar', () => {
  it('pagina=2, porPagina=20 aplica skip(20).take(20) y devuelve el total', async () => {
    const alumnosRepo = { findAndCount: jest.fn().mockResolvedValue([[{ id: 1 }], 45]) };
    const service = new AlumnosService(alumnosRepo as any, {} as any, {} as any, {} as any, {} as any);

    const resultado = await service.listar({ pagina: 2, porPagina: 20 } as any);

    expect(alumnosRepo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 20 }));
    expect(resultado).toEqual({ datos: [{ id: 1 }], total: 45, pagina: 2, porPagina: 20 });
  });
});
