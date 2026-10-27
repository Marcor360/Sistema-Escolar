import { DataSource, Repository } from 'typeorm';
import { Alumno } from '../entities/alumno.entity';
import { Inscripcion } from '../entities/inscripcion.entity';
import { GrupoMateria } from '../entities/grupo-materia.entity';
import { UsuariosService } from '../usuarios/usuarios.service';
import { ScopeService } from '../planteles/scope.service';
import { JwtUser } from '../common/current-user.decorator';
import { AlumnosService } from './alumnos.service';

it('pagina el historial y conserva el filtro de planteles autorizados', async () => {
  const qb = {
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[{
      id: 12, alumnoId: 5, grupoId: 9, estatus: 'BAJA',
      grupo: { id: 9, nombre: 'A', plantelId: 2, ciclo: { id: 4, nombre: 'Ciclo' }, plantel: { nombre: 'Centro' } },
    }], 27]),
  };
  const inscripciones = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
  const scope = { validarGestion: jest.fn().mockResolvedValue(undefined), plantelesDe: jest.fn().mockResolvedValue([2]) };
  const servicio = new AlumnosService(
    { findOne: jest.fn().mockResolvedValue({ id: 5, plantelId: 2 }) } as unknown as Repository<Alumno>,
    inscripciones as unknown as Repository<Inscripcion>,
    {} as Repository<GrupoMateria>,
    {} as UsuariosService,
    scope as unknown as ScopeService,
    { getRepository: jest.fn().mockReturnValue({ findOneBy: jest.fn().mockResolvedValue(null) }) } as unknown as DataSource,
  );
  const actor = { sub: 1, roles: ['ADMINISTRATIVO'] } as JwtUser;
  const resultado = await servicio.historialPaginado(5, actor, { pagina: 2, porPagina: 10 });

  expect(qb.where).toHaveBeenCalledWith('i.alumnoId = :alumnoId', { alumnoId: 5 });
  expect(qb.andWhere).toHaveBeenCalledWith('g.plantelId IN (:...planteles)', { planteles: [2] });
  expect(qb.skip).toHaveBeenCalledWith(10);
  expect(qb.take).toHaveBeenCalledWith(10);
  expect(resultado).toMatchObject({ total: 27, pagina: 2, porPagina: 10, datos: [{ id: 12, grupoId: 9 }] });
});
