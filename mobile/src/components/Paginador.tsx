import { View, TouchableOpacity } from 'react-native';
import { Text } from './Texto';
import { base } from '../screens/comunes';
export function Paginador({pagina,total,porPagina=10,ocupado,cambiar}:{pagina:number;total:number;porPagina?:number;ocupado:boolean;cambiar:(p:number)=>void}) {
  const paginas=Math.max(1,Math.ceil(total/porPagina));
  return <View accessibilityLabel="Paginación" style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap'}}>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Página anterior" accessibilityState={{disabled:ocupado || pagina<=1}} disabled={ocupado || pagina<=1} onPress={()=>cambiar(pagina-1)} style={[base.tarjeta,{minHeight:44,minWidth:44}]}><Text>Anterior</Text></TouchableOpacity>
    <Text accessibilityLiveRegion="polite">Página {pagina} de {paginas} · {total} registros</Text>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Página siguiente" accessibilityState={{disabled:ocupado || pagina>=paginas}} disabled={ocupado || pagina>=paginas} onPress={()=>cambiar(pagina+1)} style={[base.tarjeta,{minHeight:44,minWidth:44}]}><Text>Siguiente</Text></TouchableOpacity>
  </View>;
}
