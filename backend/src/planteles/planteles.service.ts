import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { JwtUser } from '../common/current-user.decorator';
import { Plantel } from '../entities/plantel.entity';
import { ScopeService } from './scope.service';

@Injectable()
export class PlantelesService {
  constructor(
    @InjectRepository(Plantel) private readonly planteles: Repository<Plantel>,
    private readonly scope: ScopeService,
  ) {}

  async mios(user: JwtUser) {
    const ids = await this.scope.plantelesDe(user);
    if (ids === null) return this.planteles.find({ where: { activo: true }, order: { nombre: 'ASC' } });
    if (ids.length === 0) return [];
    return this.planteles.find({ where: { id: In(ids), activo: true }, order: { nombre: 'ASC' } });
  }
}
