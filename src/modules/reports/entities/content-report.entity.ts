import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ReportReason } from '@common/enums/report-reason.enum';
import { Post } from '@modules/posts/entities/post.entity';
import { User } from '@modules/users/entities/user.entity';

/** Reporte de contenido problemático sobre una publicación. */
@Entity('content_reports')
export class ContentReport {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ name: 'reporter_id', type: 'uuid' })
  reporterId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reporter_id' })
  reporter?: User;

  @ApiProperty({ format: 'uuid' })
  @Index('idx_content_reports_post')
  @Column({ name: 'post_id', type: 'uuid' })
  postId: string;

  @ManyToOne(() => Post, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post?: Post;

  @ApiProperty({ enum: ReportReason })
  @Column({ type: 'enum', enum: ReportReason })
  reason: ReportReason;

  @ApiPropertyOptional()
  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
