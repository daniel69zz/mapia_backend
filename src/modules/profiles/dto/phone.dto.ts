import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class SendPhoneCodeDto {
  @ApiPropertyOptional({
    example: '+59171234567',
    description: 'Si se envía, actualiza el teléfono del perfil antes de mandar el código',
  })
  @IsOptional()
  @IsString()
  @Length(7, 20)
  phone?: string;
}

export class VerifyPhoneDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(4, 8)
  code: string;
}
