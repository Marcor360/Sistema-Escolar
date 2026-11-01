import { useState } from 'react';
import type { InputHTMLAttributes } from 'react';

interface CampoPasswordProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  id: string;
  etiquetaControl?: string;
}

export function CampoPassword({ id, etiquetaControl = 'contraseña', ...props }: CampoPasswordProps) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="campo-password">
      <input {...props} id={id} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        className="campo-password-ojo"
        aria-label={`${visible ? 'Ocultar' : 'Mostrar'} ${etiquetaControl}`}
        aria-controls={id}
        aria-pressed={visible}
        onClick={() => setVisible((previa) => !previa)}
      >
        <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
          {!visible && <path d="M3 3l18 18" />}
        </svg>
      </button>
    </span>
  );
}
