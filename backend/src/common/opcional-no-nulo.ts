import { ValidateIf } from 'class-validator';

/** Omisión permite conservar el valor; null debe superar los validadores del campo. */
export const OpcionalNoNulo = () => ValidateIf((_objeto: unknown, valor: unknown) => valor !== undefined);
