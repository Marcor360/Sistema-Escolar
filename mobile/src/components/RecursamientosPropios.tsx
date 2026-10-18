import { useCallback, useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Text } from './Texto';
import { api, mensajeDeError } from '../api/client';
import { useSesion } from '../sesion';
interface Intento { id:number;materia:string;grupo:string;intento:number;estado:string }
export function RecursamientosPropios(){
  const {sesion}=useSesion(),[pagina,setPagina]=useState(1),[total,setTotal]=useState(0),[datos,setDatos]=useState<Intento[]>([]),[error,setError]=useState(''),[cargando,setCargando]=useState(false),[intento,setIntento]=useState(0);
  const [seleccion,setSeleccion]=useState<number|null>(null);
  useFocusEffect(useCallback(()=>{let vigente=true;setCargando(true);setError('');setSeleccion(null);api.get('/recursamientos/me',{params:{pagina,porPagina:10}}).then(r=>{if(vigente){setDatos(r.data.datos);setTotal(r.data.total);}}).catch(e=>{if(vigente)setError(mensajeDeError(e));}).finally(()=>{if(vigente)setCargando(false);});return()=>{vigente=false;};},[pagina,sesion?.sub,intento]));
  return <View><Text accessibilityRole="header">Mis recursamientos</Text><Text>Solo la materia inscrita; tu grupo principal se conserva.</Text>{cargando&&<Text>Cargando intentos…</Text>}{error&&<><Text accessibilityRole="alert">{error}</Text><TouchableOpacity accessibilityRole="button" onPress={()=>setIntento(v=>v+1)}><Text>Reintentar recursamientos</Text></TouchableOpacity></>}
    {!cargando&&!error&&!datos.length&&<Text>Sin recursamientos registrados.</Text>}{datos.map(r=><View key={r.id}><Text>{r.materia} · {r.grupo} · Intento {r.intento} · {r.estado}</Text><TouchableOpacity accessibilityRole="button" onPress={()=>setSeleccion(seleccion===r.id?null:r.id)}><Text>Ver notas del intento {r.intento}</Text></TouchableOpacity>{seleccion===r.id&&<Notas id={r.id}/>}</View>)}
    {total>10&&<View><TouchableOpacity accessibilityRole="button" disabled={pagina===1||cargando} onPress={()=>setPagina(p=>p-1)}><Text>Anterior</Text></TouchableOpacity><Text>Página {pagina}</Text><TouchableOpacity accessibilityRole="button" disabled={pagina*10>=total||cargando} onPress={()=>setPagina(p=>p+1)}><Text>Siguiente</Text></TouchableOpacity></View>}
  </View>;
}
function Notas({id}:{id:number}){const [notas,setNotas]=useState<{parcial:number;calificacion:number}[]|null>(null),[error,setError]=useState('');useFocusEffect(useCallback(()=>{let vigente=true;api.get(`/recursamientos/${id}`).then(r=>{if(vigente)setNotas(r.data.calificaciones);}).catch(e=>{if(vigente)setError(mensajeDeError(e));});return()=>{vigente=false;};},[id]));return <View>{error?<Text accessibilityRole="alert">{error}</Text>:notas===null?<Text>Cargando notas…</Text>:notas.length?notas.map(n=><Text key={n.parcial}>Parcial {n.parcial}: {n.calificacion}</Text>):<Text>Sin notas en este intento.</Text>}</View>;}
