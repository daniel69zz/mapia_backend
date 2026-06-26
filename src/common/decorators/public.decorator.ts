import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marca una ruta como pública (omite JwtAuthGuard global). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
