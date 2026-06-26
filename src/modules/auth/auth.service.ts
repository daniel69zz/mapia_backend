import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Role } from '@common/enums/role.enum';
import { UserStatus } from '@common/enums/user-status.enum';
import { JwtConfig } from '@core/config/configuration';
import { PasswordService } from '@core/security/password.service';
import { User } from '@modules/users/entities/user.entity';
import { Profile } from '@modules/profiles/entities/profile.entity';
import { UserSettings } from '@modules/settings/entities/user-settings.entity';
import { UsersService } from '@modules/users/users.service';
import { ProfilesService } from '@modules/profiles/profiles.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly usersService: UsersService,
    private readonly profilesService: ProfilesService,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /** Registro: crea usuario + perfil + settings en una transacción. */
  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const email = dto.email.toLowerCase();

    const emailTaken = await this.usersService.findByEmail(email);
    if (emailTaken) {
      throw new ConflictException('El email ya está registrado');
    }

    const passwordHash = await this.passwordService.hash(dto.password);

    const user = await this.dataSource.transaction(async (manager) => {
      const usernameExists = await manager.findOne(Profile, {
        where: { username: dto.username },
      });
      if (usernameExists) {
        throw new ConflictException('El username ya está en uso');
      }

      const newUser = manager.create(User, {
        email,
        passwordHash,
        role: Role.USER,
        status: UserStatus.ACTIVE,
      });
      const savedUser = await manager.save(newUser);

      await manager.save(
        manager.create(Profile, {
          userId: savedUser.id,
          firstName: dto.firstName,
          lastName: dto.lastName,
          name: `${dto.firstName} ${dto.lastName}`.trim(),
          username: dto.username,
          phone: dto.phone ?? null,
        }),
      );
      await manager.save(
        manager.create(UserSettings, {
          userId: savedUser.id,
          languageCode: 'es',
          defaultRadiusKm: 3,
          notificationsEnabled: true,
        }),
      );

      return savedUser;
    });

    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.usersService.findByEmailWithSecret(dto.email);
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const valid = await this.passwordService.verify(user.passwordHash, dto.password);
    if (!valid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Cuenta no activa');
    }
    return this.buildAuthResponse(user);
  }

  async refresh(refreshToken: string): Promise<AuthResponseDto> {
    const jwtCfg = this.configService.get<JwtConfig>('jwt')!;
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: jwtCfg.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido');
    }

    const user = await this.usersService.findByIdWithRefresh(payload.sub);
    if (!user || !user.hashedRefreshToken) {
      throw new UnauthorizedException('Sesión cerrada');
    }
    const matches = await this.passwordService.verify(user.hashedRefreshToken, refreshToken);
    if (!matches) {
      throw new UnauthorizedException('Refresh token no reconocido');
    }
    return this.buildAuthResponse(user);
  }

  async logout(userId: string): Promise<{ success: true }> {
    await this.usersService.setRefreshToken(userId, null);
    return { success: true };
  }

  async me(userId: string): Promise<AuthResponseDto['user']> {
    const user = await this.usersService.findByIdOrFail(userId);
    const profile = await this.profilesService.getByUserId(userId);
    return this.toAuthUser(user, profile);
  }

  // --- helpers ---

  private async buildAuthResponse(user: User): Promise<AuthResponseDto> {
    const tokens = await this.generateTokens(user);
    const hashedRefresh = await this.passwordService.hash(tokens.refreshToken);
    await this.usersService.setRefreshToken(user.id, hashedRefresh);

    const profile = await this.profilesService.getByUserId(user.id);
    return {
      user: this.toAuthUser(user, profile),
      tokens,
    };
  }

  private toAuthUser(
    user: { id: string; email: string; role: string },
    profile: {
      username: string;
      name: string;
      firstName: string;
      lastName: string;
      phone: string | null;
      phoneVerified: boolean;
    },
  ): AuthResponseDto['user'] {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      username: profile.username,
      name: profile.name,
      firstName: profile.firstName,
      lastName: profile.lastName,
      phone: profile.phone,
      phoneVerified: profile.phoneVerified,
    };
  }

  private async generateTokens(user: User): Promise<{ accessToken: string; refreshToken: string }> {
    const jwtCfg = this.configService.get<JwtConfig>('jwt')!;
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: jwtCfg.accessSecret,
        expiresIn: jwtCfg.accessExpiresIn as unknown as number,
      }),
      this.jwtService.signAsync(payload, {
        secret: jwtCfg.refreshSecret,
        expiresIn: jwtCfg.refreshExpiresIn as unknown as number,
      }),
    ]);

    return { accessToken, refreshToken };
  }
}
