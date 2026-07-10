import { ForbiddenException } from '@nestjs/common';
import { ReportesService } from './reportes.service';
import { JwtUser } from '../common/current-user.decorator';

const alumnoUser: JwtUser = {
  sub: 50,
  email: 'alumno@escuela.mx',
  nombre: 'Alumno',
  roles: ['ALUMNO'],
};

describe('ReportesService.boletaPdf', () => {
  it('rechaza alumno pidiendo boleta ajena', async () => {
    const alumnosRepo = { findOne: jest.fn().mockResolvedValue({ id: 2, plantelId: 1, matricula: 'A2' }) };
    const alumnosService = { obtenerPorUsuario: jest.fn().mockResolvedValue({ id: 1, plantelId: 1 }) };
    const service = new ReportesService(
      alumnosRepo as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      alumnosService as any,
      {} as any,
      {} as any,
    );

    await expect(service.boletaPdf(2, alumnoUser, {} as any)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
