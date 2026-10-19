import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { GuiaPreparacionCiclo } from './GuiaPreparacionCiclo';

it('explica los elementos de un ciclo y enlaza módulos existentes sin crearlos', () => {
  render(<MemoryRouter><GuiaPreparacionCiclo /></MemoryRouter>);
  fireEvent.click(screen.getByText('¿Qué debe incluir el ciclo escolar?'));
  expect(screen.getByText(/Crear un ciclo no genera grupos/)).toBeTruthy();
  const rutas = [
    ['Niveles, carreras y periodos académicos', '/catalogos-academicos'],
    ['Materias, créditos y tipos', '/materias?vista=consulta'],
    ['Grupos, turnos y docentes', '/grupos?vista=consulta'],
    ['Apertura de cartera', '/apertura-cartera'],
  ];
  for (const [nombre, destino] of rutas) {
    const enlace = screen.getByRole('link', { name: nombre }) as HTMLAnchorElement;
    expect(enlace.getAttribute('href')).toBe(destino);
  }
});
