import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Linking, ScrollView, TouchableOpacity, View } from 'react-native';
import { Text } from '../components/Texto';
import { api, archivosBase, mensajeDeError } from '../api/client';
import { resolverEnlacePrivado } from '../api/enlaces-privados';
import { base } from './comunes';
interface Boleta { institucion:string;alumno:string;matricula:string;plan:string;plantel:string;periodo:string;ciclo:string;escala:string;disponible:boolean;aviso:string;promedioGeneral:number|null;filas:{clave:string;asignatura:string;creditos:number;seriacion:string;ciclo:string;promedioFinal:number|null;observaciones:string}[] }
export function BoletaInformativa({inscripcionId}:{inscripcionId:number}) {
 const vigente=useRef(0);
 const [datos,setDatos]=useState<Boleta|null>(null),[error,setError]=useState(''),[ocupado,setOcupado]=useState(false),[intento,setIntento]=useState(0);
 useFocusEffect(useCallback(()=>{const turno=++vigente.current;let activo=true;const controller=new AbortController();setDatos(null);setError('');
  void api.get<Boleta>('/reportes/formatos/mi-boleta',{params:{inscripcionId},signal:controller.signal}).then(r=>{if(activo)setDatos(r.data);}).catch(e=>{if(activo)setError(mensajeDeError(e));});
  return()=>{activo=false;vigente.current=turno+1;controller.abort();};
 },[inscripcionId,intento]));
 const descargar=async(formato:'informativa-pdf'|'informativa-excel')=>{
  if(ocupado||!datos?.disponible)return;const turno=vigente.current;setOcupado(true);setError('');
  try{const {data}=await api.get<{url:string}>('/reportes/mi-boleta/enlace',{params:{inscripcionId,formato}});if(turno!==vigente.current)return;await Linking.openURL(resolverEnlacePrivado(archivosBase,data.url,'boleta'));}
  catch(e){if(turno===vigente.current)setError(mensajeDeError(e));}finally{if(turno===vigente.current)setOcupado(false);}
 };
 return <View style={base.tarjeta}><Text accessibilityRole="header" style={base.tituloTarjeta}>Boleta informativa</Text>
  {error?<><Text accessibilityRole="alert">{error}</Text><TouchableOpacity accessibilityRole="button" style={{minHeight:44,justifyContent:'center'}} onPress={()=>setIntento(i=>i+1)}><Text>Actualizar boleta</Text></TouchableOpacity></>:null}
  {!datos&&!error?<ActivityIndicator accessibilityLabel="Cargando boleta informativa"/>:null}
  {datos&&!datos.disponible?<Text>Tu boleta estará disponible cuando estén completas y cerradas las calificaciones P1–P3 de todas tus materias.</Text>:null}
  {datos?.disponible?<><Text>{datos.institucion} · {datos.plantel}</Text><Text>{datos.alumno} · {datos.matricula}</Text><Text>Plan: {datos.plan||'Sin registro'} · Periodo: {datos.periodo||'Sin registro'} · Ciclo: {datos.ciclo}</Text><Text>Escala: {datos.escala}</Text>
   <ScrollView horizontal accessibilityLabel="Tabla de mi boleta"><View><View style={{flexDirection:'row'}}>{['Clave','Asignatura','Créditos','Seriación','Ciclo escolar','Prom. final','Observaciones'].map((h,i)=><Text key={h} style={{width:i===1?220:125,padding:8,fontWeight:'700'}}>{h}</Text>)}</View>
   {datos.filas.map((f,i)=><View key={`${f.clave}-${i}`} style={{flexDirection:'row'}}>{[f.clave,f.asignatura,f.creditos.toFixed(2),f.seriacion||'—',f.ciclo,f.promedioFinal??'Pendiente',f.observaciones||'—'].map((v,j)=><Text key={j} style={{width:j===1?220:125,padding:8}}>{v}</Text>)}</View>)}</View></ScrollView>
   <Text>Promedio general: {datos.promedioGeneral??'Pendiente'}</Text><Text>{datos.aviso}</Text>
   <TouchableOpacity accessibilityRole="button" accessibilityLabel="Descargar boleta informativa PDF" disabled={ocupado} style={{minHeight:48,justifyContent:'center'}} onPress={()=>void descargar('informativa-pdf')}><Text>Descargar boleta informativa PDF</Text></TouchableOpacity>
   <TouchableOpacity accessibilityRole="button" accessibilityLabel="Descargar mi boleta Excel" disabled={ocupado} style={{minHeight:48,justifyContent:'center'}} onPress={()=>void descargar('informativa-excel')}><Text>Descargar mi boleta Excel</Text></TouchableOpacity>
  </>:null}
 </View>;
}
