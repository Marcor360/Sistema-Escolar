import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { mkdir, rename, unlink, writeFile } from 'fs/promises';
import { basename, extname, join } from 'path';
import { randomUUID } from 'crypto';
import { BibliotecaArchivo, BibliotecaCarpeta, Plantel } from '../entities';
import { ScopeService } from '../planteles/scope.service';
import { JwtUser } from '../common/current-user.decorator';
import { uploadsPath } from '../common/uploads-path';
import { programarLimpieza } from '../archivos/archivo-limpieza.service';
import { CrearCarpetaDto, ConsultaBibliotecaDto, SubirBibliotecaDto } from './biblioteca.dto';
import { escanearArchivo, validarArchivo } from './validar-archivo';
@Injectable()
export class BibliotecaService {
  constructor(
    private readonly ds: DataSource,
    private readonly scope: ScopeService,
    private readonly config: ConfigService,
  ) {}
  private cuota() {
    const n = Number(this.config.get('BIBLIOTECA_CUOTA_MB') ?? 100);
    if (!Number.isSafeInteger(n) || n < 1 || n > 2000)
      throw new BadRequestException('Cuota de biblioteca no configurada correctamente');
    return n * 1024 * 1024;
  }
  async listar(dto: ConsultaBibliotecaDto, user: JwtUser) {
    await this.scope.validarGestion(user, dto.plantelId);
    if (dto.carpetaId) await this.carpeta(dto.carpetaId, user, dto.plantelId);
    const carpetas = await this.ds
      .getRepository(BibliotecaCarpeta)
      .find({ where: { plantelId: dto.plantelId }, order: { nombre: 'ASC', id: 'ASC' }, take: 500 });
    const [archivos, total] = await this.ds
      .getRepository(BibliotecaArchivo)
      .findAndCount({
        where: { plantelId: dto.plantelId, ...(dto.carpetaId ? { carpetaId: dto.carpetaId } : {}) },
        select: {
          id: true,
          plantelId: true,
          carpetaId: true,
          titulo: true,
          archivoNombre: true,
          mime: true,
          bytes: true,
          categoria: true,
          creadoAt: true,
        },
        order: { id: 'DESC' },
        skip: (dto.pagina - 1) * 10,
        take: 10,
      });
    const bytes = (await this.ds.getRepository(BibliotecaArchivo).sum('bytes', { plantelId: dto.plantelId })) ?? 0;
    return { carpetas, archivos, total, pagina: dto.pagina, porPagina: 10, bytes, cuota: this.cuota() };
  }
  private async carpeta(id: number, user: JwtUser, plantelId?: number) {
    const c = await this.ds.getRepository(BibliotecaCarpeta).findOneBy({ id });
    if (!c) throw new NotFoundException('Carpeta no encontrada');
    await this.scope.validarGestion(user, c.plantelId);
    if (plantelId !== undefined && c.plantelId !== plantelId)
      throw new BadRequestException('La carpeta no pertenece al plantel seleccionado');
    return c;
  }
  async crear(dto: CrearCarpetaDto, user: JwtUser) {
    await this.scope.validarGestion(user, dto.plantelId);
    if (dto.nombre.includes('/') || dto.nombre.includes('\\') || ['.', '..'].includes(dto.nombre))
      throw new BadRequestException('Usa un nombre de carpeta sin rutas');
    return this.ds.transaction(async (manager) => {
      const plantel = await manager
        .getRepository(Plantel)
        .findOne({ where: { id: dto.plantelId }, lock: { mode: 'pessimistic_write' } });
      if (!plantel?.activo) throw new ConflictException('Plantel inactivo');
      const repo = manager.getRepository(BibliotecaCarpeta);
      if ((await repo.countBy({ plantelId: dto.plantelId })) >= 500)
        throw new ConflictException('Máximo 500 carpetas por plantel');
      if (dto.padreId) {
        const padre = await repo.findOneBy({ id: dto.padreId });
        if (!padre || padre.plantelId !== dto.plantelId)
          throw new BadRequestException('Carpeta padre ajena al plantel');
      }
      if (await repo.existsBy({ plantelId: dto.plantelId, nombre: dto.nombre }))
        throw new ConflictException('Ya existe una carpeta con ese nombre en el plantel');
      return repo.save(repo.create({ plantelId: dto.plantelId, padreId: dto.padreId ?? null, nombre: dto.nombre }));
    });
  }
  async subir(dto: SubirBibliotecaDto, file: Express.Multer.File, user: JwtUser) {
    if (!file?.buffer) throw new BadRequestException('Adjunta un archivo');
    const carpeta = await this.carpeta(dto.carpetaId, user);
    const mime = validarArchivo(file.buffer, file.originalname, file.mimetype, dto.categoria);
    const directorio = uploadsPath(this.config.get<string>('UPLOADS_DIR') || 'uploads'),
      cuarentena = join(directorio, '.cuarentena');
    await mkdir(cuarentena, { recursive: true, mode: 0o700 });
    const nombre = `biblioteca-${randomUUID()}${extname(file.originalname).toLowerCase()}`,
      temporal = join(cuarentena, nombre),
      final = join(directorio, nombre);
    let movido = false;
    try {
      await writeFile(temporal, file.buffer, { flag: 'wx', mode: 0o600 });
      await escanearArchivo(temporal);
      const archivo = await this.ds.transaction(async (manager) => {
        const plantel = await manager
          .getRepository(Plantel)
          .findOne({ where: { id: carpeta.plantelId }, lock: { mode: 'pessimistic_write' } });
        if (!plantel?.activo) throw new ConflictException('Plantel inactivo');
        await this.scope.validarGestion(user, carpeta.plantelId);
        const vigente = await manager
          .getRepository(BibliotecaCarpeta)
          .findOneBy({ id: carpeta.id, plantelId: carpeta.plantelId });
        if (!vigente) throw new ConflictException('Carpeta ya no disponible');
        const repo = manager.getRepository(BibliotecaArchivo),
          usados = (await repo.sum('bytes', { plantelId: carpeta.plantelId })) ?? 0;
        if (usados + file.buffer.length > this.cuota()) throw new ConflictException('Cuota del plantel agotada');
        await rename(temporal, final);
        movido = true;
        const registro = await repo.save(
          repo.create({
            plantelId: carpeta.plantelId,
            carpetaId: carpeta.id,
            titulo: dto.titulo,
            categoria: dto.categoria,
            archivoNombre: basename(file.originalname.replace(/\\/g, '/')).slice(0, 200),
            archivoRuta: `/uploads/${nombre}`,
            mime,
            bytes: file.buffer.length,
            creadoPorId: user.sub,
            creadoAt: new Date(),
          }),
        );
        return { id: registro.id, titulo: registro.titulo };
      });
      return archivo;
    } catch (e) {
      if (movido) {
        // Referencia durable para un fallo de eliminación posterior al rollback.
        await this.ds.transaction((manager) => programarLimpieza(manager, `/uploads/${nombre}`));
      }
      throw e;
    } finally {
      await unlink(temporal).catch(() => undefined);
    }
  }
  async eliminar(id: number, user: JwtUser) {
    return this.ds.transaction(async (manager) => {
      const repo = manager.getRepository(BibliotecaArchivo),
        archivo = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!archivo) throw new NotFoundException('Archivo no encontrado');
      await this.scope.validarGestion(user, archivo.plantelId);
      await programarLimpieza(manager, archivo.archivoRuta);
      await repo.delete(id);
      return { ok: true };
    });
  }
}
