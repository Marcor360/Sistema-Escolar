import { Link } from 'react-router-dom';

/** Página a la que Openpay redirige al terminar el flujo de pago. */
export default function PagoCompletadoPage() {
  return (
    <div className="login-fondo">
      <div className="login-caja" style={{ textAlign: 'center' }}>
        <div className="monograma" aria-hidden>SE</div>
        <h1>Pago procesado</h1>
        <p>
          Recibimos la respuesta de la pasarela. La confirmación definitiva llega por
          webhook: tu estado de cuenta se actualizará en cuanto el banco confirme.
        </p>
        <Link className="boton" style={{ display: 'inline-block', textDecoration: 'none' }} to="/">
          Volver al panel
        </Link>
      </div>
    </div>
  );
}
