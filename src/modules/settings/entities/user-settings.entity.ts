import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, OneToOne } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { User } from '@modules/users/entities/user.entity';

/** Preferencias del usuario (1-1 con User). */
@Entity('user_settings')
export class UserSettings extends BaseEntity {
  @ApiProperty({ format: 'uuid' })
  @Index({ unique: true })
  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId: string;

  @OneToOne(() => User, (user) => user.settings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @ApiProperty({ example: 'es' })
  @Column({ name: 'language_code', type: 'varchar', length: 8, default: 'es' })
  languageCode: string;

  @ApiProperty({ example: 3 })
  @Column({ name: 'default_radius_km', type: 'numeric', precision: 5, scale: 2, default: 3 })
  defaultRadiusKm: number;

  @ApiProperty({ example: true })
  @Column({ name: 'notifications_enabled', type: 'boolean', default: true })
  notificationsEnabled: boolean;
}
