import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { PlantelesService } from './planteles.service';

@ApiTags('planteles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('planteles')
export class PlantelesController {
  constructor(private readonly service: PlantelesService) {}

  @Get('mios')
  mios(@CurrentUser() user: JwtUser) {
    return this.service.mios(user);
  }
}
