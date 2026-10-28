import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser, JwtUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { PaginacionDto } from '../common/paginacion.dto';
import { TransicionEspecialDto } from '../programas-especiales/programas.dto';
import { RecursamientosService } from './recursamientos.service';
import { CupoRecursamientoDto, InscribirRecursamientoDto, NotaRecursamientoDto } from './recursamientos.dto';
@Controller('recursamientos') @UseGuards(JwtAuthGuard,RolesGuard) @Roles('ADMINISTRATIVO')
export class RecursamientosController {
  constructor(private readonly s:RecursamientosService){}
  @Get('me') @Roles('ALUMNO') propios(@Query() q:PaginacionDto,@CurrentUser() u:JwtUser){return this.s.listar(q,u,undefined,true);}
  @Get('clases/:id') @Roles('ADMINISTRATIVO','MAESTRO') clase(@Param('id',ParseIntPipe) id:number,@Query() q:PaginacionDto,@CurrentUser() u:JwtUser){return this.s.listar(q,u,id);}
  @Patch('clases/:id/cupo') cupo(@Param('id',ParseIntPipe) id:number,@Body() d:CupoRecursamientoDto,@CurrentUser() u:JwtUser){return this.s.cupo(id,d,u);}
  @Get() @Roles('ADMINISTRATIVO','MAESTRO') listar(@Query() q:PaginacionDto,@CurrentUser() u:JwtUser){return this.s.listar(q,u);}
  @Post() inscribir(@Body() d:InscribirRecursamientoDto,@CurrentUser() u:JwtUser){return this.s.inscribir(d,u);}
  @Get(':id') @Roles('ADMINISTRATIVO','MAESTRO','ALUMNO') obtener(@Param('id',ParseIntPipe) id:number,@CurrentUser() u:JwtUser){return this.s.obtener(id,u);}
  @Post(':id/baja') baja(@Param('id',ParseIntPipe) id:number,@Body() d:TransicionEspecialDto,@CurrentUser() u:JwtUser){return this.s.terminar(id,'BAJA',d,u);}
  @Post(':id/finalizar') finalizar(@Param('id',ParseIntPipe) id:number,@Body() d:TransicionEspecialDto,@CurrentUser() u:JwtUser){return this.s.terminar(id,'FINALIZADA',d,u);}
  @Post(':id/calificaciones') @Roles('ADMINISTRATIVO','MAESTRO') nota(@Param('id',ParseIntPipe) id:number,@Body() d:NotaRecursamientoDto,@CurrentUser() u:JwtUser){return this.s.calificar(id,d,u);}
  @Get(':id/acta') @Roles('ADMINISTRATIVO','MAESTRO','ALUMNO') async acta(@Param('id',ParseIntPipe) id:number,@CurrentUser() u:JwtUser,@Res() res:Response){const r=await this.s.obtener(id,u);res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition',`attachment; filename="recursamiento-${id}.csv"`);res.send('\uFEFFparticipacion,intento,parcial,calificacion,escala\r\n'+r.calificaciones.map(n=>`${id},${r.intento},${n.parcial},${n.calificacion},${r.escalaMaxima}`).join('\r\n'));}
}
