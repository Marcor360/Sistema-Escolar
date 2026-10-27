import axios from 'axios';
import { afterEach, beforeEach, expect } from 'vitest';

// Unit tests must declare their HTTP responses. Never contact a developer's API.
const solicitudesSinMock: string[] = [];
axios.defaults.adapter = async (config) => {
  const solicitud = `${config.method?.toUpperCase() ?? 'GET'} ${config.url}`;
  solicitudesSinMock.push(solicitud);
  throw new Error(`Solicitud HTTP sin simular: ${solicitud}`);
};
beforeEach(() => { solicitudesSinMock.length = 0; });
afterEach(() => { expect(solicitudesSinMock, 'Simula explícitamente las solicitudes HTTP de esta prueba').toEqual([]); });
