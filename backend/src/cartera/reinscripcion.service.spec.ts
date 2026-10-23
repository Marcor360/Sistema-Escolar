import { Alumno, CicloEscolar, Inscripcion, PeriodoAcademico } from '../entities';
import { CarteraService } from './cartera.service';
import { PrevisualizarReinscripcionDto } from './cartera.dto';

function preparar(numeroDestino: number, fechaInicio = '2027-01-15', motivo?: string) {
  const alumno = { id: 11, estatus: 'ACTIVO', plantelId: 7, usuario: { activo: true } };
  const origen = { alumnoId: 11, grupo: {
    tipo: 'REGULAR', periodoAcademicoId: 19, carreraId: 6, nivelId: 5, plantelId: 7,
    ciclo: { fechaFin: '2026-12-31' },
  }};
  const periodos = {
    findOneBy: jest.fn()
      .mockResolvedValueOnce({ id: 20, tipo: 'CUATRIMESTRAL', numero: numeroDestino, activo: true })
      .mockResolvedValueOnce({ id: 19, tipo: 'CUATRIMESTRAL', numero: 3, activo: true }),
  };
  const m = {
    getRepository: jest.fn((entidad) => entidad === Alumno ? { findOne: async()=>alumno } :
      entidad === Inscripcion ? { findOne: async()=>origen } :
      entidad === PeriodoAcademico ? periodos :
      entidad === CicloEscolar ? {findOneBy: async()=>({fechaInicio})} : {}),
  };
  const service = new CarteraService({} as never, { validarGestion: jest.fn() } as never, {} as never);
  const dto = { alumnoId:11, plantelId:7, cicloId:10, nivelId:5, carreraId:6,
    periodoAcademicoId:20, origenInscripcionId:12, turno:'MATUTINO', conceptoIds:[1],
    periodo:'2027-01', fechaVencimiento:'2027-01-20', motivo } as PrevisualizarReinscripcionDto;
  const actor = {sub:88,roles:['FINANZAS']} as Parameters<CarteraService['previsualizarReinscripcion']>[1];
  return {service,m,dto,actor};
}
describe('Validación del cambio de ciclo y periodo',()=>{
  it('acepta retroceso a segundo con motivo documentado sin mutar el origen',async()=>{
    const {service,m,dto,actor}=preparar(2,'2027-01-15','Se repite el segundo cuatrimestre por reprobación');
    await expect(service['validarReinscripcion'](m as never,dto,actor)).resolves.toMatchObject({
      destino:{numero:2}, anterior:{numero:3},
    });
  });
  it('rechaza retroceder sin razón suficiente',async()=>{
    const {service,m,dto,actor}=preparar(2);
    await expect(service['validarReinscripcion'](m as never,dto,actor)).rejects.toThrow('requiere un motivo');
  });
  it('rechaza crear segundo periodo del mismo ciclo sin migración del historial',async()=>{
    const {service,m,dto,actor}=preparar(4,'2026-09-01');
    await expect(service['validarReinscripcion'](m as never,dto,actor)).rejects.toThrow('ciclo posterior');
  });
  it('impide ajuste financiero por actor de Control Escolar',async()=>{
    const {service,m,dto,actor}=preparar(4);
    dto.ajustes=[{conceptoId:3,monto:750,motivo:'Contrato nuevo firmado por tesorería'}];
    await expect(service['validarReinscripcion'](m as never,dto,{...actor,roles:['ADMINISTRATIVO']})).rejects.toThrow('Solo Finanzas');
  });
});
