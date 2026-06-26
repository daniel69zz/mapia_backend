import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Catálogo de idiomas soportados (los textos los maneja el frontend). */
@Entity('languages')
export class Language {
  @ApiProperty({ example: 'es' })
  @PrimaryColumn({ type: 'varchar', length: 8 })
  code: string;

  @ApiProperty({ example: 'Spanish' })
  @Column({ type: 'varchar', length: 60 })
  name: string;

  @ApiProperty({ example: 'Español' })
  @Column({ name: 'native_name', type: 'varchar', length: 60 })
  nativeName: string;

  @ApiProperty({ example: true })
  @Column({ type: 'boolean', default: true })
  enabled: boolean;
}
