import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { Post } from '@modules/posts/entities/post.entity';
import { User } from '@modules/users/entities/user.entity';

/** Comentario de una publicación. parentId queda listo para hilos. */
@Entity('comments')
export class Comment extends BaseEntity {
  @ApiProperty({ format: 'uuid' })
  @Index('idx_comments_post')
  @Column({ name: 'post_id', type: 'uuid' })
  postId: string;

  @ManyToOne(() => Post, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post?: Post;

  @ApiProperty({ format: 'uuid' })
  @Column({ name: 'author_id', type: 'uuid' })
  authorId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author?: User;

  @ApiProperty()
  @Column({ type: 'text' })
  content: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Comentario padre (respuesta)' })
  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId: string | null;
}
