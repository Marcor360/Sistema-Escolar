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
