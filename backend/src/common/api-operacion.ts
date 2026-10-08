import { applyDecorators } from '@nestjs/common';
import { ApiBadRequestResponse, ApiConflictResponse, ApiForbiddenResponse, ApiNotFoundResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
/** Errores públicos compartidos; no documentar como éxito las transiciones rechazadas. */
export const ApiErroresOperacion = () => applyDecorators(
  ApiBadRequestResponse({ description: 'Campos, archivo, fechas o confirmación inválidos' }),
  ApiUnauthorizedResponse({ description: 'Sesión ausente, expirada o revocada' }),
  ApiForbiddenResponse({ description: 'Capacidad, clase o plantel fuera del alcance del actor' }),
  ApiNotFoundResponse({ description: 'Registro inexistente o preview expirado/consumido/no disponible para el actor' }),
  ApiConflictResponse({ description: 'Estado incompatible, duplicado o modificación concurrente; no se aplica parcialmente' }),
);
