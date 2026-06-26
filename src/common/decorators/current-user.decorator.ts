import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Payload del usuario autenticado inyectado por JwtStrategy en request.user. */
export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: string;
}

/**
 * Inyecta el usuario autenticado (o una de sus propiedades).
 * Uso: `@CurrentUser() user` o `@CurrentUser('userId') id`.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;
    return data ? user?.[data] : user;
  },
);
