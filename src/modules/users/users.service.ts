import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '@common/enums/role.enum';
import { UserStatus } from '@common/enums/user-status.enum';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  create(data: { email: string; passwordHash: string; role?: Role }): User {
    return this.userRepo.create({
      email: data.email,
      passwordHash: data.passwordHash,
      role: data.role ?? Role.USER,
      status: UserStatus.ACTIVE,
    });
  }

  save(user: User): Promise<User> {
    return this.userRepo.save(user);
  }

  findById(id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  async findByIdOrFail(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return user;
  }

  findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email: email.toLowerCase() } });
  }

  /** Incluye passwordHash (normalmente oculto) para login. */
  findByEmailWithSecret(email: string): Promise<User | null> {
    return this.userRepo
      .createQueryBuilder('user')
      .addSelect(['user.passwordHash'])
      .where('user.email = :email', { email: email.toLowerCase() })
      .getOne();
  }

  /** Incluye hashedRefreshToken para validar refresh. */
  findByIdWithRefresh(id: string): Promise<User | null> {
    return this.userRepo
      .createQueryBuilder('user')
      .addSelect(['user.hashedRefreshToken'])
      .where('user.id = :id', { id })
      .getOne();
  }

  async setRefreshToken(userId: string, hashedRefreshToken: string | null): Promise<void> {
    await this.userRepo.update({ id: userId }, { hashedRefreshToken });
  }

  async setStatus(userId: string, status: UserStatus): Promise<void> {
    await this.userRepo.update({ id: userId }, { status });
  }
}
