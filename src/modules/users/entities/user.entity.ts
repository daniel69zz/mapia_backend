import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, Index, OneToOne } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { Role } from '@common/enums/role.enum';
import { UserStatus } from '@common/enums/user-status.enum';
import { Profile } from '@modules/profiles/entities/profile.entity';
import { UserSettings } from '@modules/settings/entities/user-settings.entity';

/** Cuenta base / identidad del usuario. */
@Entity('users')
export class User extends BaseEntity {
  @ApiProperty()
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  /** Hash de contraseña (argon2). Nunca se serializa: select:false. */
  @Column({ name: 'password_hash', type: 'varchar', length: 255, select: false })
  passwordHash: string;

  /** Hash del refresh token activo (rotación). select:false. */
  @Column({
    name: 'hashed_refresh_token',
    type: 'varchar',
    length: 255,
    nullable: true,
    select: false,
  })
  hashedRefreshToken: string | null;

  @ApiProperty({ enum: Role })
  @Column({ type: 'enum', enum: Role, default: Role.USER })
  role: Role;

  @ApiProperty({ enum: UserStatus })
  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status: UserStatus;

  @OneToOne(() => Profile, (profile) => profile.user)
  profile?: Profile;

  @OneToOne(() => UserSettings, (settings) => settings.user)
  settings?: UserSettings;
}
