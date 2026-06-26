import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length, Matches } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'carla@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Sup3rSegura!', minLength: 8 })
  @IsString()
  @Length(8, 72)
  password: string;

  @ApiProperty({ example: 'Carla' })
  @IsString()
  @Length(1, 80)
  firstName: string;

  @ApiProperty({ example: 'Méndez' })
  @IsString()
  @Length(1, 80)
  lastName: string;

  @ApiProperty({ example: 'carla_m', description: 'Único; letras, números, punto, guion bajo' })
  @IsString()
  @Length(3, 40)
  @Matches(/^[a-zA-Z0-9._]+$/, {
    message: 'username solo admite letras, números, punto y guion bajo',
  })
  username: string;

  @ApiPropertyOptional({ example: '+59171234567' })
  @IsOptional()
  @IsString()
  @Length(7, 20)
  phone?: string;
}
