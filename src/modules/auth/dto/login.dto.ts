import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'carla@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Sup3rSegura!' })
  @IsString()
  @Length(8, 72)
  password: string;
}
