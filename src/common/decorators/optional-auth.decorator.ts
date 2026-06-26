import { SetMetadata } from '@nestjs/common';

export const IS_OPTIONAL_AUTH_KEY = 'isOptionalAuth';

/**
 * Ruta pública que IGUAL intenta autenticar si llega un token válido.
 * Sirve para personalizar respuestas (p. ej. `isLiked`) sin exigir login.
 * Si no hay token o es inválido, deja pasar con request.user = undefined.
 */
export const OptionalAuth = () => SetMetadata(IS_OPTIONAL_AUTH_KEY, true);
