import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { STORAGE_SERVICE, IStorageService } from '@core/storage/storage.types';
import { Profile } from './entities/profile.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { OtpService } from './otp.service';

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(Profile)
    private readonly profileRepo: Repository<Profile>,
    @Inject(STORAGE_SERVICE)
    private readonly storage: IStorageService,
    private readonly otpService: OtpService,
  ) {}

  /** Crea el perfil inicial al registrarse un usuario. */
  async createForUser(
    userId: string,
    firstName: string,
    lastName: string,
    username: string,
    phone?: string,
  ): Promise<Profile> {
    await this.assertUsernameAvailable(username);
    const profile = this.profileRepo.create({
      userId,
      firstName,
      lastName,
      name: this.fullName(firstName, lastName),
      username,
      phone: phone ?? null,
    });
    return this.profileRepo.save(profile);
  }

  async getByUserId(userId: string): Promise<Profile> {
    const profile = await this.profileRepo.findOne({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('Perfil no encontrado');
    }
    return profile;
  }

  async getByUsername(username: string): Promise<Profile> {
    const profile = await this.profileRepo.findOne({ where: { username } });
    if (!profile) {
      throw new NotFoundException('Perfil no encontrado');
    }
    return profile;
  }

  async updateMe(userId: string, dto: UpdateProfileDto): Promise<Profile> {
    const profile = await this.getByUserId(userId);

    if (dto.username && dto.username !== profile.username) {
      await this.assertUsernameAvailable(dto.username);
      profile.username = dto.username;
    }
    if (dto.firstName !== undefined) profile.firstName = dto.firstName;
    if (dto.lastName !== undefined) profile.lastName = dto.lastName;
    if (dto.firstName !== undefined || dto.lastName !== undefined) {
      profile.name = this.fullName(profile.firstName, profile.lastName);
    }
    if (dto.bio !== undefined) profile.bio = dto.bio;
    if (dto.phone !== undefined && dto.phone !== profile.phone) {
      // Cambiar el teléfono invalida la verificación previa.
      profile.phone = dto.phone;
      profile.phoneVerified = false;
    }

    return this.profileRepo.save(profile);
  }

  async setAvatar(
    userId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
  ): Promise<Profile> {
    const profile = await this.getByUserId(userId);

    const stored = await this.storage.upload({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      folder: 'avatars',
    });

    if (profile.avatarKey) {
      await this.storage.delete(profile.avatarKey);
    }

    profile.avatarUrl = stored.url;
    profile.avatarKey = stored.storageKey;
    return this.profileRepo.save(profile);
  }

  // --- Verificación de teléfono (OTP) ---

  async sendPhoneCode(userId: string, phone?: string): Promise<{ sent: true; devCode?: string }> {
    const profile = await this.getByUserId(userId);
    if (phone) {
      if (phone !== profile.phone) {
        profile.phoneVerified = false;
      }
      profile.phone = phone;
      await this.profileRepo.save(profile);
    }
    if (!profile.phone) {
      throw new BadRequestException('No hay teléfono en el perfil. Envía "phone".');
    }
    const { devCode } = this.otpService.sendCode(userId, profile.phone);
    return { sent: true, ...(devCode ? { devCode } : {}) };
  }

  async verifyPhone(userId: string, code: string): Promise<Profile> {
    const profile = await this.getByUserId(userId);
    if (!profile.phone) {
      throw new BadRequestException('No hay teléfono que verificar');
    }
    const ok = this.otpService.verify(userId, code);
    if (!ok) {
      throw new UnauthorizedException('Código inválido o expirado');
    }
    profile.phoneVerified = true;
    return this.profileRepo.save(profile);
  }

  // --- Contadores (usados por otros módulos) ---

  incrementPosts(userId: string, delta: number): Promise<unknown> {
    return this.profileRepo.increment({ userId }, 'postsCount', delta);
  }

  incrementLikes(userId: string, delta: number): Promise<unknown> {
    return this.profileRepo.increment({ userId }, 'likesCount', delta);
  }

  incrementFollowers(userId: string, delta: number): Promise<unknown> {
    return this.profileRepo.increment({ userId }, 'followersCount', delta);
  }

  incrementFollowing(userId: string, delta: number): Promise<unknown> {
    return this.profileRepo.increment({ userId }, 'followingCount', delta);
  }

  private fullName(firstName: string, lastName: string): string {
    return `${firstName} ${lastName}`.trim();
  }

  private async assertUsernameAvailable(username: string): Promise<void> {
    const exists = await this.profileRepo.findOne({ where: { username } });
    if (exists) {
      throw new ConflictException('El username ya está en uso');
    }
  }
}
