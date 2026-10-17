import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';
import { ActivacionService } from '../auth/activacion.service';
import { CrearPersonalDto } from './usuarios.dto';
import { JwtUser } from '../common/current-user.decorator';

describe('UsuariosController — invitación de personal', () => {
  const actor: JwtUser = { sub: 1, email: 'admin@ejemplo.edu.mx', nombre: 'Admin', roles: ['SUPERADMIN'] };
  const dto: CrearPersonalDto = {
    email: 'personal@ejemplo.edu.mx', nombre: 'Ana', apellidoPaterno: 'Prueba',
    roles: ['ADMINISTRATIVO'], plantelIds: [1],
  };

  it('solicita invitación solamente después de crear la cuenta', async () => {
    const orden: string[] = [];
    const service = {
      crearPersonal: jest.fn(async () => {
        orden.push('creado');
        return { id: 22, email: dto.email };
      }),
    };
    const activacion = {
      solicitar: jest.fn(async () => {
        orden.push('invitado');
        return { mensaje: 'Invitación solicitada' };
      }),
    };
    const controller = new UsuariosController(
      service as unknown as UsuariosService,
      activacion as unknown as ActivacionService,
    );
    await controller.crear(dto, actor);
    expect(orden).toEqual(['creado', 'invitado']);
    expect(activacion.solicitar).toHaveBeenCalledWith(dto.email);
  });

  it('no envía invitación si falla la creación', async () => {
    const service = { crearPersonal: jest.fn().mockRejectedValue(new Error('Alta rechazada')) };
    const activacion = { solicitar: jest.fn() };
    const controller = new UsuariosController(
      service as unknown as UsuariosService,
      activacion as unknown as ActivacionService,
    );
    await expect(controller.crear(dto, actor)).rejects.toThrow('Alta rechazada');
    expect(activacion.solicitar).not.toHaveBeenCalled();
  });
});
