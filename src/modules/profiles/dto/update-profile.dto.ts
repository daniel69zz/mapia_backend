import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Carla' })
  @IsOptional()
  @IsString()
  @Length(1, 80)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Méndez' })
  @IsOptional()
  @IsString()
  @Length(1, 80)
  lastName?: string;

  @ApiPropertyOptional({
    example: 'carla_m',
    description: 'Solo letras, números, punto y guion bajo',
  })
  @IsOptional()
  @IsString()
  @Length(3, 40)
  @Matches(/^[a-zA-Z0-9._]+$/, {
    message: 'username solo admite letras, números, punto y guion bajo',
  })
  username?: string;

  @ApiPropertyOptional({ example: 'Vecina de Sopocachi 📍' })
  @IsOptional()
  @IsString()
  @Length(0, 280)
  bio?: string;

  @ApiPropertyOptional({
    example: '+59171234567',
    description: 'Cambiar el teléfono lo marca como NO verificado',
  })
  @IsOptional()
  @IsString()
  @Length(7, 20)
  phone?: string;
}
