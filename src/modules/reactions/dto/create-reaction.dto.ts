import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { ReactionType } from '../entities/reaction.entity';

export class CreateReactionDto {
  @ApiProperty({ enum: ['LIKE', 'DISLIKE'] })
  @IsIn(['LIKE', 'DISLIKE'])
  type: ReactionType;
}
