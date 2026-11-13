import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EntityManager, In } from 'typeorm';
import { GrupoDto, MateriaDto } from '../academico/academico.dto';
import { BitacoraAcademica, CarreraPlan, CicloEscolar, Grupo, Materia, NivelAcademico, PeriodoAcademico, Plantel } from '../entities';
import { JwtUser } from '../common/current-user.decorator';
import { ScopeService } from '../planteles/scope.service';
export type TipoCargaAcademica = 'MATERIAS' | 'GRUPOS';
export const COLUMNAS_ACADEMICAS = {
  MATERIAS: ['clave', 'nombre', 'creditos', 'tipo', 'descripcion'],
  GRUPOS: ['plantelId', 'cicloId', 'nombre', 'grado', 'turno', 'nivelId', 'carreraId', 'periodoAcademicoId'],
};
type Fila = Record<string, string>;
type Preparada = { tipo: 'MATERIAS'; datos: MateriaDto } | { tipo: 'GRUPOS'; datos: GrupoDto };
const ids = (filas: Fila[], campo: string) => [...new Set(filas.map(f => Number(f[campo])).filter(n => Number.isSafeInteger(n) && n > 0))].sort((a,b)=>a-b);
const claveGrupo = (g: {plantelId: number; cicloId: number; nombre: string}) => JSON.stringify([g.plantelId, g.cicloId, g.nombre.trim().toUpperCase()]);

/** Consultas por lote y revalidación bajo la transacción de confirmación. No crea cuentas ni cargos. */
export async function evaluarCargaAcademica(manager: EntityManager, tipo: TipoCargaAcademica, filas: Fila[], user: JwtUser, scope: ScopeService, bloquear: boolean) {
  const permitidos = await scope.resolverFiltro(user);
  const opciones = { loadEagerRelations: false, ...(bloquear ? { lock: { mode: 'pessimistic_write' as const } } : {}) };
  const ciclos = tipo === 'GRUPOS' && ids(filas,'cicloId').length ? await manager.getRepository(CicloEscolar).find({where:{id:In(ids(filas,'cicloId'))}, order:{id:'ASC'}, ...opciones}) : [];
  const planteles = tipo === 'GRUPOS' && ids(filas,'plantelId').length ? await manager.getRepository(Plantel).find({where:{id:In(ids(filas,'plantelId'))}, order:{id:'ASC'}, ...opciones}) : [];
  const niveles = tipo === 'GRUPOS' && ids(filas,'nivelId').length ? await manager.getRepository(NivelAcademico).find({where:{id:In(ids(filas,'nivelId'))}, order:{id:'ASC'}, ...opciones}) : [];
  const carreras = tipo === 'GRUPOS' && ids(filas,'carreraId').length ? await manager.getRepository(CarreraPlan).find({where:{id:In(ids(filas,'carreraId'))}, order:{id:'ASC'}, ...opciones}) : [];
  const periodos = tipo === 'GRUPOS' && ids(filas,'periodoAcademicoId').length ? await manager.getRepository(PeriodoAcademico).find({where:{id:In(ids(filas,'periodoAcademicoId'))}, order:{id:'ASC'}, ...opciones}) : [];
  const claves = filas.map(f=>(f.clave ?? '').trim().toUpperCase()).filter(Boolean);
  const nombres = filas.map(f=>(f.nombre ?? '').trim()).filter(Boolean);
  const existentes = tipo === 'MATERIAS'
    ? new Set((claves.length ? await manager.getRepository(Materia).find({where:{clave:In(claves)},select:{clave:true},loadEagerRelations:false}) : []).map(m=>m.clave.toUpperCase()))
    : new Set((nombres.length && ciclos.length && planteles.length ? await manager.getRepository(Grupo).find({where:{nombre:In(nombres),cicloId:In(ciclos.map(c=>c.id)),plantelId:In(planteles.map(p=>p.id))},loadEagerRelations:false}) : []).map(claveGrupo));
  const vistos = new Set<string>(), validas: Preparada[] = [], errores: {fila:number;mensaje:string}[] = [], duplicados: {fila:number;mensaje:string}[] = [];
  for (const [indice, fila] of filas.entries()) {
    try {
      if (Object.keys(fila).some(c=>!COLUMNAS_ACADEMICAS[tipo].includes(c))) throw new BadRequestException('Hay columnas no admitidas; descarga la plantilla');
      const valores: Record<string,unknown> = Object.fromEntries(Object.entries(fila).filter(([,v])=>v!==''));
      if (tipo === 'MATERIAS' && valores.creditos !== undefined) valores.creditos = Number(valores.creditos);
      const datos = tipo === 'MATERIAS' ? plainToInstance(MateriaDto,valores) : plainToInstance(GrupoDto,valores);
      const fallos = await validate(datos,{whitelist:true,forbidNonWhitelisted:true});
      if (fallos.length) throw new BadRequestException('Campos inválidos: '+fallos.map(f=>f.property).join(', '));
      if (tipo === 'GRUPOS') {
        const g = datos as GrupoDto;
        if (permitidos !== null && !permitidos.includes(g.plantelId)) throw new ForbiddenException('El plantel solicitado está fuera de tu alcance');
        if (!planteles.find(p=>p.id===g.plantelId)?.activo) throw new ConflictException('Plantel inexistente o inactivo');
        if (!ciclos.some(c=>c.id===g.cicloId && ['ACTIVO','PREPARACION'].includes(c.estado))) throw new ConflictException('El ciclo debe estar activo o en preparación');
        if ([g.nivelId,g.carreraId,g.periodoAcademicoId].some(v=>v!=null)) {
          const n=niveles.find(n=>n.id===g.nivelId), c=carreras.find(c=>c.id===g.carreraId), p=periodos.find(p=>p.id===g.periodoAcademicoId);
          if (!n?.activo || !c?.activo || !p?.activo || n.plantelId!==g.plantelId || c.plantelId!==g.plantelId || p.plantelId!==g.plantelId || c.nivelId!==g.nivelId || p.carreraId!==g.carreraId || p.cicloId!==g.cicloId) throw new ConflictException('Nivel, carrera y periodo deben estar completos, activos y corresponder al plantel y ciclo');
        }
      }
      const clave = tipo === 'MATERIAS' ? (datos as MateriaDto).clave : claveGrupo(datos as GrupoDto);
      if (existentes.has(clave) || vistos.has(clave)) {
        duplicados.push({fila:indice+2,mensaje:existentes.has(clave)?'Ya registrado: se omite sin modificarlo (incluye inactivos)':'Repetido en el archivo: se omite'});
        continue;
      }
      vistos.add(clave);
      if (tipo === 'MATERIAS') validas.push({tipo,datos:datos as MateriaDto});
      else validas.push({tipo,datos:datos as GrupoDto});
    } catch(e) {
      if (!(e instanceof BadRequestException || e instanceof ConflictException || e instanceof ForbiddenException)) throw e;
      errores.push({fila:indice+2,mensaje:e.message});
    }
  }
  return {validas,errores,duplicados};
}

export async function guardarCargaAcademica(manager: EntityManager, tipo: TipoCargaAcademica, filas: Fila[], user: JwtUser, scope: ScopeService) {
  const resultado = await evaluarCargaAcademica(manager,tipo,filas,user,scope,true);
  if (resultado.errores.length) throw new ConflictException('La carga cambió o tiene errores; vuelve a previsualizar. No se guardó ningún registro');
  const guardadas = tipo === 'MATERIAS'
    ? await manager.getRepository(Materia).save(manager.getRepository(Materia).create(resultado.validas.filter(f=>f.tipo==='MATERIAS').map(f=>f.datos)),{chunk:50})
    : await manager.getRepository(Grupo).save(manager.getRepository(Grupo).create(resultado.validas.filter(f=>f.tipo==='GRUPOS').map(f=>f.datos)),{chunk:50});
  const auditoria=guardadas.map(entidad=>({usuarioId:user.sub,plantelId:'plantelId' in entidad?entidad.plantelId:null,accion:`IMPORTAR_${tipo}`,entidadId:entidad.id,detalle:'Alta académica desde archivo validado; sin inscripciones ni cargos',fecha:new Date()}));
  for(let i=0;i<auditoria.length;i+=100)await manager.getRepository(BitacoraAcademica).insert(auditoria.slice(i,i+100));
  return {insertados:resultado.validas.length,existentes:resultado.duplicados.length,rechazados:0,total:filas.length,activacion:null};
}
