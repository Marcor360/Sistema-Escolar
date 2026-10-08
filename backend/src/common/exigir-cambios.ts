import { BadRequestException } from '@nestjs/common';
export function exigirCambios(dto: object): void {
  if (!Object.values(dto).some((v) => v !== undefined)) throw new BadRequestException('Indica al menos un campo para actualizar');
}
