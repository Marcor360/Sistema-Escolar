import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CuentaDeposito } from '../entities/cuenta-deposito.entity';
import { ConfigurarBbvaDto } from './configuracion-banco.dto';
export function validarClabe(clabe: string): boolean {
  if (!/^\d{18}$/.test(clabe)) return false;
  const factores = [3, 7, 1];
  const total = [...clabe.slice(0, 17)].reduce((suma, cifra, indice) => suma + (Number(cifra) * factores[indice % 3]) % 10, 0);
  return (10 - total % 10) % 10 === Number(clabe[17]);
}
@Injectable()
export class ConfiguracionBancoService {
  constructor(@InjectRepository(CuentaDeposito) private readonly repo: Repository<CuentaDeposito>) {}
  async obtener() {
    const cuenta = await this.repo.findOneBy({ id: 1 });
    return cuenta ?? { configurado: false, banco: 'BBVA', activo: false };
  }
  async actualizar(dto: ConfigurarBbvaDto) {
    if (dto.clabe && !validarClabe(dto.clabe)) throw new BadRequestException('La CLABE no tiene un dígito verificador válido');
    const previo = await this.repo.findOneBy({ id: 1 });
    return this.repo.save(this.repo.create({
      ...(previo ?? {}), id: 1, banco: 'BBVA', titular: dto.titular.trim(),
      numeroCuenta: dto.numeroCuenta, clabe: dto.clabe || null, activo: dto.activo,
    }));
  }
}
