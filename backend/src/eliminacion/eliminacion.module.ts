import { Module } from '@nestjs/common';
import { EliminacionController } from './eliminacion.controller';
import { EliminacionService } from './eliminacion.service';

@Module({ controllers: [EliminacionController], providers: [EliminacionService] })
export class EliminacionModule {}
