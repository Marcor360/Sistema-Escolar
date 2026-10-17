import { DocentesController } from './docentes.controller';
import { DocentesService } from './docentes.service';
import { ActivacionService } from '../auth/activacion.service';
import { CrearDocenteDto } from './docentes.dto';
import { JwtUser } from '../common/current-user.decorator';
import { validate } from 'class-validator';

describe('Alta docente e invitación', () => {
  const actor: JwtUser = { sub: 1, email: 'admin@example.test', nombre: 'Admin', roles: ['ADMINISTRATIVO'] };
  const dto: CrearDocenteDto = {
    email: 'docente@example.test', nombre: 'Ana', apellidoPaterno: 'García',
    numEmpleado: 'DOC-001', plantelIds: [1], cedulaPendiente: true,
  };

  it('solicita invitación únicamente después del alta exitosa', async () => {
    const secuencia: string[] = [];
    const service = { crear: jest.fn(async () => { secuencia.push('guardado'); return { id: 1 }; }) };
    const activacion = { solicitar: jest.fn(async () => { secuencia.push('invitado'); }) };
    const controller = new DocentesController(service as unknown as DocentesService, activacion as unknown as ActivacionService);
    await controller.crear(dto, actor);
    expect(secuencia).toEqual(['guardado', 'invitado']);
    expect(activacion.solicitar).toHaveBeenCalledWith(dto.email);
  });

  it('no invita si falla el alta', async () => {
    const service = { crear: jest.fn().mockRejectedValue(new Error('rechazado')) };
    const activacion = { solicitar: jest.fn() };
    const controller = new DocentesController(service as unknown as DocentesService, activacion as unknown as ActivacionService);
    await expect(controller.crear(dto, actor)).rejects.toThrow('rechazado');
    expect(activacion.solicitar).not.toHaveBeenCalled();
  });

  it('exige cédula salvo declaración expresa de pendiente', async () => {
    const sinCedula = Object.assign(new CrearDocenteDto(), { ...dto, cedulaPendiente: false });
    expect((await validate(sinCedula)).some((e) => e.property === 'cedulaProfesional')).toBe(true);
    const pendiente = Object.assign(new CrearDocenteDto(), dto);
    expect((await validate(pendiente)).some((e) => e.property === 'cedulaProfesional')).toBe(false);
  });
});
