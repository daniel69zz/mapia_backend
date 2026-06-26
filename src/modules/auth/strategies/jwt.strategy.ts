import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserStatus } from '@common/enums/user-status.enum';
import { AuthenticatedUser } from '@common/decorators/current-user.decorator';
import { JwtConfig } from '@core/config/configuration';
import { UsersService } from '@modules/users/users.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

/** Valida el access token y carga el usuario en request.user. */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<JwtConfig>('jwt')!.accessSecret,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.usersService.findById(payload.sub);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Sesión inválida');
    }
    return { userId: user.id, email: user.email, role: user.role };
  }
}
