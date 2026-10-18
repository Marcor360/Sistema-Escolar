import { ListarMateriasDto } from './listar-materias.dto';
import { exigirCambios } from '../common/exigir-cambios';
import { esConflictoUnico } from './conflictos';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Materia } from '../entities/materia.entity';
import { GrupoMateria } from '../entities/grupo-materia.entity';
import { ActualizarMateriaDto, MateriaDto } from './academico.dto';
@Injectable()
export class MateriasService {
 constructor(@InjectRepository(Materia) private readonly materias: Repository<Materia>,
@InjectRepository(GrupoMateria) private readonly grupoMaterias: Repository<GrupoMateria>) {}
listarMaterias() { return this.materias.find({ where: { activo: true }, order: { clave: 'ASC' } }); }

async consultarMaterias(query: ListarMateriasDto) {
    const { pagina = 1, porPagina = 10 } = query;
    const qb = this.materias.createQueryBuilder('m').where('m.activo = :activo', { activo: true });
    const buscar = query.buscar?.trim().toLowerCase();
    if (buscar) {
      const termino = '%' + buscar.replace(/[!%_[]/g, c => '!' + c) + '%';
      qb.andWhere("(LOWER(m.clave) LIKE :termino ESCAPE '!' OR LOWER(m.nombre) LIKE :termino ESCAPE '!')", { termino });
    }
    const [datos, total] = await qb.orderBy('m.clave', 'ASC').addOrderBy('m.id', 'ASC').skip((pagina - 1) * porPagina).take(porPagina).getManyAndCount();
    return { datos, total, pagina, porPagina };
  }

async crearMateria(dto: MateriaDto) {
    try { return await this.materias.save(this.materias.create(dto)); }
    catch (error) { if (esConflictoUnico(error)) throw new ConflictException('La clave de materia ya está registrada'); throw error; }
  }

async actualizarMateria(id: number, dto: ActualizarMateriaDto) {
    if (!await this.materias.findOne({ where: { id } })) throw new NotFoundException('Materia no encontrada');
    exigirCambios(dto);
    try { await this.materias.update(id, dto); }
    catch (error) { if (esConflictoUnico(error)) throw new ConflictException('La clave de materia ya está registrada'); throw error; }
    return this.materias.findOne({ where: { id } });
  }

async desactivarMateria(id: number) {
    const materia = await this.materias.findOne({ where: { id } });
    if (!materia) throw new NotFoundException('Materia no encontrada');
    const clases = await this.grupoMaterias.count({ where: { materiaId: id, grupo: { activo: true, ciclo: { activo: true } } } });
    if (clases) throw new ConflictException('Primero retira la materia de los grupos vigentes; no se elimina el historial');
    await this.materias.update(id, { activo: false });
    return { ok: true };
  }
}
