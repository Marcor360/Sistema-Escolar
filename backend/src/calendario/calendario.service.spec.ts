import { ForbiddenException } from '@nestjs/common';
import { CalendarioService } from './calendario.service';
import { JwtUser } from '../common/current-user.decorator';

const maestro: JwtUser = {
  sub: 20,
  email: 'maestro@escuela.mx',
  nombre: 'Maestro',
  roles: ['MAESTRO'],
};

describe('CalendarioService', () => {
  it('maestro no puede crear evento global', async () => {
    const service = new CalendarioService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.crear({ titulo: 'Global', fechaInicio: '2026-07-10T10:00:00.000Z' }, maestro),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
