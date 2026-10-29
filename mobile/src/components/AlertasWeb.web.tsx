import { useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import type { AlertButton } from "react-native";
export function AlertasWeb() {
  const [aviso, setAviso] = useState<{
    titulo: string;
    mensaje?: string;
    botones: AlertButton[];
  } | null>(null);
  const dialogo = useRef<HTMLDialogElement>(null),
    origen = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const anterior = Alert.alert;
    Alert.alert = (titulo, mensaje, botones) => {
      origen.current = document.activeElement as HTMLElement;
      setAviso({
        titulo,
        mensaje,
        botones: botones?.length ? botones : [{ text: "Aceptar" }],
      });
    };
    return () => {
      Alert.alert = anterior;
    };
  }, []);
  useEffect(() => {
    if (aviso) {
      dialogo.current?.showModal();
      dialogo.current?.querySelector<HTMLButtonElement>("button")?.focus();
    }
  }, [aviso]);
  const cerrar = (boton?: AlertButton) => {
    dialogo.current?.close();
    setAviso(null);
    origen.current?.focus();
    boton?.onPress?.();
  };
  if (!aviso) return null;
  return (
    <dialog
      ref={dialogo}
      aria-labelledby="alerta-app-titulo"
      onCancel={(e) => {
        e.preventDefault();
        cerrar(aviso.botones.find((b) => b.style === "cancel"));
      }}
      style={{
        maxWidth: "min(480px,90vw)",
        border: "1px solid #D8DCD6",
        borderRadius: 16,
        padding: 24,
        color: "#1C2528",
        background: "white",
      }}
    >
      <h2 id="alerta-app-titulo">{aviso.titulo}</h2>
      <p>{aviso.mensaje}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {aviso.botones.map((b, i) => (
          <button
            key={i}
            onClick={() => cerrar(b)}
            style={{ minHeight: 44, padding: "10px 16px", cursor: "pointer" }}
          >
            {b.text || "Aceptar"}
          </button>
        ))}
      </div>
    </dialog>
  );
}
