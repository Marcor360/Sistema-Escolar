import { BadRequestException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { cargoIdDeFicha, identificadorFicha } from './fichas.service';
import { RegistrarPagoFichaDto } from './fichas.dto';
import { validarClabe } from '../configuracion/configuracion-banco.service';
describe('fichas de cobro', () => {
  it('genera referencias reversibles, únicas para cada cargo sin guardar tokens adicionales', () => {
    expect(identificadorFicha(123)).toBe('IUA-C0000000123');
    expect(cargoIdDeFicha('IUA-C0000000123')).toBe(123);
    expect(identificadorFicha(124)).not.toBe(identificadorFicha(123));
  });
  it('rechaza identificadores alterados', () => {
    expect(()=>cargoIdDeFicha('IUA-C0000000000')).toThrow(BadRequestException);
    expect(()=>cargoIdDeFicha('IUA-C00000001XX')).toThrow(BadRequestException);
  });
  it('exige confirmación humana, folio separado e importe positivo', async () => {
    const pago = plainToInstance(RegistrarPagoFichaDto, {
      identificador:'IUA-C0000000123',claveIdempotencia:'748af7f4-9347-468d-a809-c4bd129f8055',
      monto:100,metodo:'TRANSFERENCIA',referenciaBancaria:'BBVA-98230',confirmado:true,
    });
    expect(await validate(pago)).toHaveLength(0);
    pago.confirmado = false as unknown as true;
    expect((await validate(pago)).map(e=>e.property)).toContain('confirmado');
  });
  it('valida CLABE sin aceptar números con verificador erróneo',()=>{
    expect(validarClabe('')).toBe(false);
    expect(validarClabe('123456789012345678')).toBe(false);
  });
});
