import { Controller, Get, Header, Param, ParseBoolPipe, ParseIntPipe, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, JwtUser } from '../common/current-user.decorator';
import { contentDisposition } from '../common/content-disposition';
import { FormatosEscolaresService } from './formatos-escolares.service';
const opcional = new ParseIntPipe({optional:true});
@ApiTags('reportes') @ApiBearerAuth()
@Controller('reportes/formatos') @UseGuards(JwtAuthGuard,RolesGuard)
export class FormatosEscolaresController {
 constructor(private readonly formatos:FormatosEscolaresService){}
 @Header('Cache-Control','private, no-store') @Get('acta/:id') @Roles('MAESTRO','ADMINISTRATIVO')
 acta(@Param('id',ParseIntPipe) id:number,@Query('parcial',ParseIntPipe) parcial:number,@CurrentUser() u:JwtUser){return this.formatos.acta(id,parcial,u);}
 @Get('acta/:id/excel') @Roles('MAESTRO','ADMINISTRATIVO')
 async actaExcel(@Param('id',ParseIntPipe) id:number,@Query('parcial',ParseIntPipe) parcial:number,@Query('plantilla',new ParseBoolPipe({optional:true})) plantilla:boolean|undefined,@CurrentUser() u:JwtUser,@Res() res:Response){this.enviar(res,await this.formatos.actaExcel(id,parcial,u,plantilla===true),`acta-${id}-${parcial}${plantilla?'-plantilla':''}.xlsx`);}
 @Header('Cache-Control','private, no-store') @Get('mi-boleta') @Roles('ALUMNO')
 mia(@CurrentUser() u:JwtUser,@Query('inscripcionId',opcional) inscripcionId?:number,@Query('cicloId',opcional) cicloId?:number){return this.formatos.miBoleta(u,inscripcionId,cicloId);}
 @Header('Cache-Control','private, no-store') @Get('boleta/:alumnoId') @Roles('ALUMNO','ADMINISTRATIVO','DIRECTOR')
 boleta(@Param('alumnoId',ParseIntPipe) alumnoId:number,@CurrentUser() u:JwtUser,@Query('inscripcionId',opcional) inscripcionId?:number,@Query('cicloId',opcional) cicloId?:number){return this.formatos.boleta(alumnoId,u,inscripcionId,cicloId);}
 @Get('boleta/:alumnoId/pdf') @Roles('ALUMNO','ADMINISTRATIVO','DIRECTOR')
 async pdf(@Param('alumnoId',ParseIntPipe) alumnoId:number,@CurrentUser() u:JwtUser,@Res() res:Response,@Query('inscripcionId',opcional) inscripcionId?:number,@Query('cicloId',opcional) cicloId?:number){
  const buffer=await this.formatos.boletaPdf(alumnoId,u,inscripcionId,cicloId);res.setHeader('Cache-Control','private, no-store');res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',contentDisposition(`boleta-${alumnoId}.pdf`,'attachment'));res.send(buffer);
 }
 @Get('boleta/:alumnoId/excel') @Roles('ALUMNO','ADMINISTRATIVO','DIRECTOR')
 async excel(@Param('alumnoId',ParseIntPipe) alumnoId:number,@CurrentUser() u:JwtUser,@Res() res:Response,@Query('inscripcionId',opcional) inscripcionId?:number,@Query('cicloId',opcional) cicloId?:number){this.enviar(res,await this.formatos.boletaExcel(alumnoId,u,inscripcionId,cicloId),`boleta-${alumnoId}.xlsx`);}
 private enviar(res:Response,buffer:Buffer,nombre:string){res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');res.setHeader('Content-Disposition',contentDisposition(nombre,'attachment'));res.send(buffer);}
}
