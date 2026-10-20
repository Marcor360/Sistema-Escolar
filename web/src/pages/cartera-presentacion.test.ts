import { describe, expect, it } from 'vitest';
import { estadoApertura, montoMXN, reglasAgrupacion } from './cartera-presentacion';
describe('Estados presentados de cartera', () => {
  it('distingue apertura con cargos y solicitud sin cargos', () => {
    expect(estadoApertura('ABIERTA').titulo).toBe('Abierta y asignada');
    expect(estadoApertura('PENDIENTE').descripcion).toContain('no se generan cargos');
    expect(estadoApertura('REQUIERE_REVISION').titulo).toBe('Requiere revisión');
  });
  it('formatea en moneda local y documenta sin sumar cobros pendientes', () => {
    expect(montoMXN(1250)).toContain('1,250');
    expect(reglasAgrupacion).toHaveLength(3);
  });
});
