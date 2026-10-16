import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from '../entities/usuario.entity';
import { Rol } from '../entities/rol.entity';
import { UsuariosService } from './usuarios.service';
import { UsuariosController } from './usuarios.controller';
import { Alumno } from '../entities/alumno.entity';
import { Docente } from '../entities/docente.entity';
import { UsuarioPlantel } from '../entities/usuario-plantel.entity';
import { PlantelesModule } from '../planteles/planteles.module';
import { BitacoraActividad } from '../entities/bitacora-actividad.entity';
import { PasswordResetToken } from '../entities/password-reset-token.entity';
import { ActivacionToken } from '../entities/activacion-token.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Usuario, Rol, Alumno, Docente, UsuarioPlantel, BitacoraActividad, PasswordResetToken, ActivacionToken]), PlantelesModule],
  providers: [UsuariosService],
  controllers: [UsuariosController],
  exports: [UsuariosService],
})
export class UsuariosModule {}
