import { PartialType } from '@nestjs/swagger';
import { CreatePostDto } from './create-post.dto';

/** Todos los campos opcionales para edición parcial. */
export class UpdatePostDto extends PartialType(CreatePostDto) {}
