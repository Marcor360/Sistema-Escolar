import { Body, Controller, Get, Ip, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { CambiarPasswordDto, ForgotPasswordDto, LoginDto, ResetPasswordDto } from './dto/auth.dto';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../common/current-user.decorator';
import { Portal, PortalActual } from '../common/portales';

const LIMITE_ESTRICTO = { default: { limit: 5, ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @Throttle(LIMITE_ESTRICTO)
  login(@Body() dto: LoginDto, @PortalActual() portal: Portal, @Ip() ip: string) {
    return this.auth.login(dto.email, dto.password, portal, ip);
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: JwtUser) {
    return this.auth.me(user);
  }

  @Post('cambiar-password')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Throttle(LIMITE_ESTRICTO)
  cambiarPassword(@CurrentUser() user: JwtUser, @Body() dto: CambiarPasswordDto) {
    return this.auth.cambiarPassword(user.sub, dto.actual, dto.nueva);
  }

  @Post('forgot-password')
  @Throttle(LIMITE_ESTRICTO)
  forgot(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @Throttle(LIMITE_ESTRICTO)
  reset(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.password);
  }
}
