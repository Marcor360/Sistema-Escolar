import { ValueTransformer } from 'typeorm';

/** DECIMAL llega como string desde el driver; lo exponemos como number. */
export const decimalTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) => (value === null || value === undefined ? null : Number(value)),
};
