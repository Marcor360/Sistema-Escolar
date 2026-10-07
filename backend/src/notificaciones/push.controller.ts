import { Body, Controller, Delete, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { PushService } from './push.service';
import { RegistrarPushDto } from './push.dto';
@ApiTags('push') @ApiBearerAuth() @Controller('notificaciones/push') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ALUMNO')
export class PushController {
  constructor(private readonly push: PushService) {}
  @Post('dispositivos') registrar(@Body() dto: RegistrarPushDto, @CurrentUser() user: JwtUser) { return this.push.registrar(dto, user); }
  @Delete('dispositivos/:id') retirar(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @CurrentUser() user: JwtUser) { return this.push.retirar(id, user); }
}
