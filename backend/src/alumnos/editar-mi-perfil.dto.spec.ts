import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EditarMiPerfilAlumnoDto } from './alumnos.dto';
describe('Autogestión del perfil de alumno', () => {
  it('solo permite seis campos de contacto propios', async () => {
    const dto = plainToInstance(EditarMiPerfilAlumnoDto, {
      correoPersonal: 'personal@example.test', fechaNacimiento: '2005-07-03',
      telefono: '5512345678', tutorNombre: 'Tutor', tutorTelefono: '5512345679',
      direccion: 'Calle sin número',
    });
    expect(await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).toHaveLength(0);
  });
  it('rechaza modificaciones del correo institucional, rol, matrícula y proveedor', async () => {
    const dto = plainToInstance(EditarMiPerfilAlumnoDto, {
      email: 'atacante@example.test', matricula: 'NUEVA', rol: 'SUPERADMIN', correoProveedor: 'GODADDY',
    });
    const errores = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(errores.map((e) => e.property)).toEqual(expect.arrayContaining(['email', 'matricula', 'rol', 'correoProveedor']));
  });
  it('rechaza correos personales inválidos y fecha mal formada', async () => {
    const dto = plainToInstance(EditarMiPerfilAlumnoDto, { correoPersonal: 'invalido', fechaNacimiento: 'mañana' });
    expect((await validate(dto)).map((e) => e.property)).toEqual(expect.arrayContaining(['correoPersonal', 'fechaNacimiento']));
  });
  it('permite vaciar un campo opcional', async () => {
    const dto = plainToInstance(EditarMiPerfilAlumnoDto, { correoPersonal: ' ', telefono: '' });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.correoPersonal).toBeNull();
    expect(dto.telefono).toBeNull();
  });
});
