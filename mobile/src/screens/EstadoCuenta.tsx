import { useDisenoAlumno } from "../use-diseno-alumno";
import { useSesion } from "../sesion";
import { crearControlLectura } from "../api/lectura-vigente";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "../components/Texto";
import { useFocusEffect } from "@react-navigation/native";
import { api, mensajeDeError } from "../api/client";
import { colores, radio, espacio, tipografia, textoSobreFondo } from "../theme";
import { pesos } from "../formato";
import { useMarca } from "../marca";
import {
  GuiaPantalla,
  base,
  ErrorCarga,
  Sello,
  Tarjeta,
  Vacio,
} from "./comunes";

interface CargoDetalle {
  id: number;
  descripcion: string;
  fechaVencimiento: string | null;
  estatus: string;
  total: number;
  pagado: number;
  saldo: number;
}
interface Estado {
  saldoTotal: number;
  cargos: CargoDetalle[];
  pagos: {
    id: number;
    monto: number;
    metodo: string;
    fechaPago: string;
    estatus: string;
    aplicado: boolean;
  }[];
}

export default function EstadoCuentaScreen() {
  const diseno = useDisenoAlumno();
  const { sesion } = useSesion();
  const usuarioActual = sesion?.sub ?? null;
  const { marca } = useMarca();
  const [estadoPorUsuario, setEstadoPorUsuario] = useState<{ usuario: number; datos: Estado } | null>(null);
  const estado = estadoPorUsuario?.usuario === usuarioActual ? estadoPorUsuario.datos : null;
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [ultimaActualizacion, setUltimaActualizacion] = useState<string | null>(
    null,
  );
  const [pagando, setPagando] = useState(false);
  const [datosVigentes, setDatosVigentes] = useState(false);
  const [fechaConsulta, setFechaConsulta] = useState(0);
  useEffect(() => {
    if (!datosVigentes || !fechaConsulta) return;
    const timer = setTimeout(() => setDatosVigentes(false), Math.max(0, fechaConsulta + 5 * 60000 - Date.now()));
    return () => clearTimeout(timer);
  }, [datosVigentes, fechaConsulta]);

  const activa = useRef(true);
  useEffect(() => {
    activa.current = true;
    return () => {
      activa.current = false;
    };
  }, []);

  const lectura = useRef(crearControlLectura());
  useEffect(() => {
    lectura.current.invalidar();
    setEstadoPorUsuario(null);
    setDatosVigentes(false);
    setUltimaActualizacion(null);
    setFechaConsulta(0);
    setError("");
  }, [usuarioActual]);
  const cargar = useCallback(() => {
    if (usuarioActual === null) return;
    setError("");
    setDatosVigentes(false);
    setCargando(true);
    void lectura.current.cargar(
      () => api.get<Estado>("/finanzas/me/estado-cuenta"),
      (r) => {
        setEstadoPorUsuario({ usuario: usuarioActual, datos: r.data });
        setFechaConsulta(Date.now());
        setDatosVigentes(true);
        setUltimaActualizacion(new Date().toLocaleString());
      },
      (fallo) => {
        setDatosVigentes(false);
        setError(mensajeDeError(fallo));
      },
      () => setCargando(false),
    );
  }, [usuarioActual]);

  useFocusEffect(
    useCallback(() => {
      cargar();
      return () => lectura.current.invalidar();
    }, [cargar]),
  );

  const pagoEnCurso = useRef(false);
  const pagarEnLinea = async (cargo: CargoDetalle) => {
    if (!activa.current || pagoEnCurso.current) return;
    if (!datosVigentes || !estado || usuarioActual === null) {
      Alert.alert("Actualiza tu saldo", "Necesitas conexión y un estado de cuenta actualizado antes de iniciar un pago.");
      return;
    }
    pagoEnCurso.current = true;
    setPagando(true);
    try {
      const { data: actualizado } = await api.get<Estado>("/finanzas/me/estado-cuenta");
      if (!activa.current) return;
      const cargoVigente = actualizado.cargos.find((item) => item.id === cargo.id);
      setEstadoPorUsuario({ usuario: usuarioActual, datos: actualizado });
      setFechaConsulta(Date.now());
      if (!cargoVigente || cargoVigente.saldo <= 0 || cargoVigente.saldo !== cargo.saldo) {
        setDatosVigentes(false);
        Alert.alert("El saldo cambió", "Tu estado de cuenta cambió. Actualiza y revisa el importe antes de continuar.");
        return;
      }
      const { data } = await api.post("/finanzas/ordenes", {
        cargoId: cargo.id,
      });
      if (!activa.current) return;
      if (data.estatus === "COMPLETADA") {
        Alert.alert(
          "Pago confirmado",
          "El pago ya quedó registrado. Se actualizará tu estado de cuenta.",
        );
        cargar();
      } else if (data.urlPago) {
        const destino = new URL(data.urlPago);
        if (
          destino.protocol !== "https:" ||
          destino.username ||
          destino.password
        ) {
          Alert.alert(
            "Enlace de pago no seguro",
            "No se abrirá esta dirección. Contacta a finanzas para verificar la orden.",
          );
          return;
        }
        await Linking.openURL(destino.toString());
      } else {
        Alert.alert(
          "Orden creada",
          "La pasarela no devolvió una URL de pago. Consulta a finanzas.",
        );
      }
    } catch (err) {
      if (activa.current) {
        setDatosVigentes(false);
        Alert.alert("No se pudo generar la orden", mensajeDeError(err));
      }
    } finally {
      pagoEnCurso.current = false;
      if (activa.current) setPagando(false);
    }
  };

  const saldosVigentes = datosVigentes && estado !== null;
  const tono = (estatus: string) =>
    estatus === "PAGADO"
      ? "ok"
      : estatus === "VENCIDO"
        ? "mal"
        : estatus === "PARCIAL"
          ? "aviso"
          : "neutro";

  return (
    <ScrollView
      contentContainerStyle={base.contenidoLista}
      style={[base.pantalla, diseno.pantalla]}
      refreshControl={
        <RefreshControl refreshing={cargando} onRefresh={cargar} />
      }
    >
      <GuiaPantalla
        titulo="Estado de cuenta"
        detalle="Consulta solo tus pagos pendientes. El saldo cambia cuando el servidor confirma el pago."
      />
      {error !== "" && <ErrorCarga mensaje={error} reintentar={cargar} />}
      {!estado && cargando && (
        <ActivityIndicator accessibilityLabel="Cargando estado de cuenta" />
      )}
      {ultimaActualizacion && (
        <Text accessibilityRole="text">
          Última actualización: {ultimaActualizacion}
        </Text>
      )}
      {estado && !datosVigentes && (
        <Text accessibilityRole="alert" style={base.errorTexto}>
          Los saldos mostrados pueden estar desactualizados. Actualiza tu estado de cuenta antes de pagar.
        </Text>
      )}
      {estado && (
        <>
          <View style={[estilos.resumen, { backgroundColor: marca.colorPrimario, borderLeftColor: marca.colorAcento }]}>
            <Text
              style={[
                estilos.resumenEtiqueta,
                { color: textoSobreFondo(marca.colorPrimario) },
              ]}
            >
              Saldo pendiente
            </Text>
            <Text
              style={[
                estilos.resumenValor,
                { color: textoSobreFondo(marca.colorPrimario) },
              ]}
            >
              {pesos(estado.saldoTotal)}
            </Text>
          </View>

          {estado.cargos.filter((c) => c.saldo > 0).length === 0 && (
            <Vacio mensaje="No tienes pagos pendientes." />
          )}
          {estado.cargos.filter((c) => c.saldo > 0).map((c) => (
            <Tarjeta key={c.id}>
              <Text style={base.tituloTarjeta}>{c.descripcion}</Text>
              <Text style={base.secundario}>
                {c.fechaVencimiento ? `Vence: ${c.fechaVencimiento} · ` : ""}
                Total {pesos(c.total)} · Pagado {pesos(c.pagado)}
              </Text>
              <Text style={[base.monto, { marginTop: 4 }]}>
                Saldo: {pesos(c.saldo)}
              </Text>
              <Sello texto={c.estatus} tono={tono(c.estatus)} />
              {c.saldo > 0 && (
                <TouchableOpacity
                  disabled={pagando || !saldosVigentes}
                  accessibilityState={{ disabled: pagando || !saldosVigentes, busy: pagando }}
                  style={[estilos.boton, { backgroundColor: marca.colorAcento }]}
                  onPress={() =>
                    Alert.alert(
                      "Confirmar pago en línea",
                      `${c.descripcion}: saldo ${pesos(c.saldo)}. Se generará una orden y se abrirá la pasarela segura.`,
                      [
                        { text: "Cancelar", style: "cancel" },
                        {
                          text: "Continuar",
                          onPress: () => {
                            void pagarEnLinea(c);
                          },
                        },
                      ],
                    )
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Pagar ${c.descripcion} en línea. Saldo ${pesos(c.saldo)}`}
                >
                  <Text
                    style={[
                      estilos.botonTexto,
                      { color: textoSobreFondo(marca.colorAcento) },
                    ]}
                  >
                    Pagar en línea
                  </Text>
                </TouchableOpacity>
              )}
            </Tarjeta>
          ))}


        </>
      )}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  resumen: {
    backgroundColor: colores.pizarra,
    padding: espacio.xl,
    marginBottom: espacio.lg,
    borderRadius: radio.md,
    borderLeftWidth: 4,
    borderLeftColor: colores.dorado,
  },
  resumenEtiqueta: {
    color: "#C8D2CD",
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  resumenValor: {
    color: "#fff",
    fontSize: tipografia.dato,
    fontVariant: ["tabular-nums"],
  },
  subtitulo: {
    fontSize: 13,
    color: colores.gris,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginVertical: 10,
  },
  boton: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: colores.dorado,
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: espacio.lg,
    paddingVertical: espacio.md,
    borderRadius: radio.sm,
  },
  botonTexto: {
    color: colores.pizarraOscuro,
    fontSize: tipografia.cuerpo,
    fontWeight: "600",
  },
});
