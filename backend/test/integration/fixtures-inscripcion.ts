import { ContextoIntegracion } from './contexto';
import { Inscripcion } from '../../src/entities';
/** Fuente histórica sintética para probar otros módulos. No simula respuestas HTTP.
 * Altas ordinarias/reactivación se comprueban por las rutas reales en cartera y reinscripciones. */
export async function crearInscripcionFixture(ctx:ContextoIntegracion,grupoId:number,alumnoId:number){
 const repo=ctx.dataSource.getRepository(Inscripcion),previa=await repo.findOneBy({grupoId,alumnoId});
 return repo.save(previa?{...previa,estatus:'ACTIVA'}:repo.create({grupoId,alumnoId,estatus:'ACTIVA'}));
}
