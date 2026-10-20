import { ConsentimientoInstitucionalService } from './consentimiento-institucional.service';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { JwtUser } from '../common/current-user.decorator';
const alumno: JwtUser = { sub: 7, email: 'alumno@ejemplo.mx', nombre: 'Alumno', roles: ['ALUMNO'] };
const config = (variables: Record<string,string>) => ({ get: (clave: string) => variables[clave] }) as ConfigService;
const ds = { getRepository: () => ({ findBy: async () => [] }) } as unknown as DataSource;
describe('Consentimiento institucional', () => {
  it('no bloquea antes de la aprobación de documentos', async () => {
    const s = new ConsentimientoInstitucionalService(ds, config({ CONSENTIMIENTO_INSTITUCIONAL_HABILITADO: 'false' }));
    expect((await s.estado(alumno)).pendiente).toBe(false);
  });
  it('requiere ambas URLs y versiones cuando está habilitado', async () => {
    const s = new ConsentimientoInstitucionalService(ds, config({ CONSENTIMIENTO_INSTITUCIONAL_HABILITADO: 'true' }));
    await expect(s.estado(alumno)).rejects.toThrow('Consentimiento habilitado');
  });
  it('mantiene pendiente a quien no aceptó los documentos vigentes', async () => {
    const s = new ConsentimientoInstitucionalService(ds, config({
      CONSENTIMIENTO_INSTITUCIONAL_HABILITADO: 'true', REGLAMENTO_ACADEMICO_URL: 'https://iua.edu.mx/comunidad/',
      REGLAMENTO_ACADEMICO_VERSION: '2026-A', POLITICAS_INSTITUCIONALES_URL: 'https://iua.edu.mx/comunidad/',
      POLITICAS_INSTITUCIONALES_VERSION: '2026-B',
    }));
    expect((await s.estado(alumno)).pendiente).toBe(true);
  });
});
