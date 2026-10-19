import React, { useEffect, type ReactNode } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import MateriasScreen from './Materias';
import { api } from '../api/client';
import { Linking, RefreshControl } from 'react-native';

const contexto = vi.hoisted(() => ({ sesion: { sub: 1 } as { sub: number } | null, enfocada: true }));
vi.mock('../sesion', () => ({ useSesion: () => ({ sesion: contexto.sesion }) }));
vi.mock('../api/client', () => ({ api: { get: vi.fn() }, archivosBase: 'https://example.test',
  mensajeDeError: (error: unknown) => (error as Error).message }));
vi.mock('@react-navigation/native', () => ({
  useFocusEffect: (efecto: () => void | (() => void)) => {
    useEffect(() => contexto.enfocada ? efecto() : undefined, [efecto, contexto.enfocada]);
  },
}));
vi.mock('react-native', async () => {
  const { createElement } = await import('react');
  return {
    View: 'View', Text: 'Text', TouchableOpacity: 'TouchableOpacity', Pressable: 'Pressable',
    ActivityIndicator: 'ActivityIndicator', RefreshControl: 'RefreshControl',
    Linking: { openURL: vi.fn() }, StyleSheet: { create: (styles: unknown) => styles },
    FlatList: ({ data, renderItem, ListEmptyComponent, refreshControl }: {
      data: { id: number }[]; renderItem: (args: { item: { id: number } }) => ReactNode;
      ListEmptyComponent: ReactNode; refreshControl: ReactNode;
    }) => createElement('FlatList', null, refreshControl, data.length
      ? data.map((item) => createElement(React.Fragment, { key: item.id }, renderItem({ item })))
      : ListEmptyComponent),
  };
});
vi.mock('../components/Texto', () => ({ Text: 'Text' }));
const materias = [1, 2].map((id) => ({ id, materia: { clave: `MAT${id}`, nombre: `Materia ${id}` },
  grupo: { nombre: 'A', ciclo: { clave: '2026' } }, docente: null }));
const material = { id: 10, titulo: 'Guía', archivoNombre: 'guia.pdf', tamanoKb: 2 };
function pendiente() {
  let resolver!: (value: { data: unknown }) => void;
  let rechazar!: (error: Error) => void;
  const promesa = new Promise<{ data: unknown }>((resolve, reject) => { resolver = resolve; rechazar = reject; });
  return { promesa, resolver, rechazar };
}
let vista: ReactTestRenderer;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  contexto.sesion = { sub: 1 }; contexto.enfocada = true;
  vi.mocked(api.get).mockReset().mockResolvedValue({ data: {datos:materias,total:materias.length} });
  vi.mocked(Linking.openURL).mockReset();
});
afterEach(async () => { if (vista) await act(async () => vista.unmount()); vi.unstubAllGlobals(); });
async function montar() { await act(async () => { vista = create(<MateriasScreen />); }); }
async function actualizar() { await act(async () => { vista.update(<MateriasScreen />); }); }
async function pulsar(etiqueta: string) {
  const boton = vista.root.findByProps({ accessibilityLabel: etiqueta });
  await act(async () => boton.props.onPress());
}
const textos = () => JSON.stringify(vista.toJSON());

it('un fallo de materiales termina la carga y permite reintentar esa materia', async () => {
  await montar();
  vi.mocked(api.get).mockRejectedValueOnce(new Error('Sin red'));
  await pulsar('MAT1: Materia 1. Ver materiales');
  expect(textos()).toContain('Sin red');
  expect(textos()).not.toContain('Cargando materiales de clase');
  vi.mocked(api.get).mockResolvedValueOnce({ data: [] });
  await pulsar('Reintentar carga');
  expect(api.get).toHaveBeenLastCalledWith('/grupo-materias/1/materiales');
  expect(textos()).toContain('El maestro aún no sube materiales.');
  expect(textos()).not.toContain('Sin red');
});

it('volver a la pantalla cancela la materia incompleta y permite cargarla otra vez', async () => {
  await montar(); const anterior = pendiente();
  vi.mocked(api.get).mockReturnValueOnce(anterior.promesa);
  await pulsar('MAT1: Materia 1. Ver materiales');
  contexto.enfocada = false; await actualizar();
  contexto.enfocada = true; await actualizar();
  vi.mocked(api.get).mockResolvedValueOnce({ data: [material] });
  await pulsar('MAT1: Materia 1. Ver materiales');
  await act(async () => { anterior.rechazar(new Error('Error antiguo')); });
  expect(textos()).toContain('Abrir material: Guía, guia.pdf');
  expect(textos()).not.toContain('Error antiguo');
});

it('cambiar de alumno limpia materiales y vuelve a consultar el catálogo sin perder el foco', async () => {
  await montar();
  vi.mocked(api.get).mockResolvedValueOnce({ data: [material] });
  await pulsar('MAT1: Materia 1. Ver materiales');
  const nueva = pendiente(); vi.mocked(api.get).mockReturnValueOnce(nueva.promesa);
  contexto.sesion = { sub: 2 }; await actualizar();
  expect(api.get).toHaveBeenLastCalledWith('/alumnos/me/materias/listado',{params:{pagina:1,porPagina:10}});
  expect(textos()).not.toContain('guia.pdf');
  expect(textos()).not.toContain('MAT1');
  await act(async () => { nueva.resolver({ data: {datos:[materias[1]],total:1} }); });
  expect(textos()).toContain('MAT2');
  expect(textos()).not.toContain('MAT1');
});

it('una materia anterior no publica materiales cuando se cambia a otra ya almacenada', async () => {
  await montar();
  vi.mocked(api.get).mockResolvedValueOnce({ data: [] });
  await pulsar('MAT2: Materia 2. Ver materiales');
  const anterior = pendiente(); vi.mocked(api.get).mockReturnValueOnce(anterior.promesa);
  await pulsar('MAT1: Materia 1. Ver materiales');
  await pulsar('MAT2: Materia 2. Ver materiales');
  await act(async () => { anterior.resolver({ data: [material] }); });
  vi.mocked(api.get).mockResolvedValueOnce({ data: [] });
  await pulsar('MAT1: Materia 1. Ver materiales');
  expect(api.get).toHaveBeenLastCalledWith('/grupo-materias/1/materiales');
  expect(textos()).not.toContain('guia.pdf');
});

it('no abre un enlace privado que termina después de cambiar de alumno', async () => {
  await montar(); vi.mocked(api.get).mockResolvedValueOnce({ data: [material] });
  await pulsar('MAT1: Materia 1. Ver materiales');
  const enlace = pendiente(); vi.mocked(api.get).mockReturnValueOnce(enlace.promesa);
  const boton = vista.root.findByProps({ accessibilityLabel: 'Abrir material: Guía, guia.pdf' });
  let apertura!: Promise<void>;
  await act(async () => { apertura = boton.props.onPress(); });
  contexto.sesion = { sub: 2 }; await actualizar();
  await act(async () => { enlace.resolver({ data: { url: '/archivo-firmado' } }); await apertura; });
  expect(Linking.openURL).not.toHaveBeenCalled();
});

it('actualizar materias invalida los materiales antiguos y vuelve a consultarlos', async () => {
  await montar();
  vi.mocked(api.get).mockResolvedValueOnce({ data: [material] });
  await pulsar('MAT1: Materia 1. Ver materiales');
  expect(textos()).toContain('guia.pdf');
  vi.mocked(api.get).mockResolvedValueOnce({ data: {datos:materias,total:materias.length} });
  const refrescar = vista.root.findByType(RefreshControl);
  await act(async () => refrescar.props.onRefresh());
  expect(textos()).not.toContain('guia.pdf');
  vi.mocked(api.get).mockResolvedValueOnce({ data: [] });
  await pulsar('MAT1: Materia 1. Ver materiales');
  expect(textos()).toContain('El maestro aún no sube materiales.');
  expect(api.get).toHaveBeenLastCalledWith('/grupo-materias/1/materiales');
});

it('pagina desde API sin conservar materiales de la página anterior',async()=>{
 vi.mocked(api.get).mockResolvedValueOnce({data:{datos:[materias[0]],total:11}});await montar();
 vi.mocked(api.get).mockResolvedValueOnce({data:[material]});await pulsar('MAT1: Materia 1. Ver materiales');
 vi.mocked(api.get).mockResolvedValueOnce({data:{datos:[materias[1]],total:11}});await pulsar('Página siguiente');
 expect(api.get).toHaveBeenLastCalledWith('/alumnos/me/materias/listado',{params:{pagina:2,porPagina:10}});expect(textos()).toContain('MAT2');expect(textos()).not.toContain('MAT1');expect(textos()).not.toContain('guia.pdf');expect(textos()).toContain('registros');
});
it('cambiar de alumno desde página dos vuelve a uno sin mostrar datos anteriores',async()=>{
 vi.mocked(api.get).mockResolvedValueOnce({data:{datos:[materias[0]],total:11}});await montar();
 vi.mocked(api.get).mockResolvedValueOnce({data:{datos:[materias[1]],total:11}});await pulsar('Página siguiente');
 vi.mocked(api.get).mockResolvedValue({data:{datos:[],total:0}});contexto.sesion={sub:2};await actualizar();
 expect(api.get).toHaveBeenLastCalledWith('/alumnos/me/materias/listado',{params:{pagina:1,porPagina:10}});expect(textos()).not.toContain('MAT2');
});
