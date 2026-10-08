export function esConflictoUnico(error: unknown): boolean {
  const e = error as { code?: string; errno?: number; number?: number; originalError?: { info?: { number?: number } } };
  return e?.code === 'ER_DUP_ENTRY' || e?.errno === 1062 || e?.number === 2601 || e?.number === 2627 ||
    e?.originalError?.info?.number === 2601 || e?.originalError?.info?.number === 2627;
}

export function esConflictoTransaccional(error: unknown): boolean {
  const e = error as {
    code?: string;
    errno?: number;
    number?: number;
    originalError?: { info?: { number?: number } };
    driverError?: {
      code?: string;
      errno?: number;
      number?: number;
      originalError?: { info?: { number?: number } };
    };
  };
  const code = e?.code ?? e?.driverError?.code;
  const errno = e?.errno ?? e?.driverError?.errno;
  const numero = e?.number ?? e?.originalError?.info?.number ??
    e?.driverError?.number ?? e?.driverError?.originalError?.info?.number;
  return code === 'ER_LOCK_DEADLOCK' || code === 'ER_LOCK_WAIT_TIMEOUT' ||
    errno === 1205 || errno === 1213 || numero === 1205 || numero === 1222 || numero === 3960;
}
