import { Global, Module } from '@nestjs/common';
import { PasswordService } from './password.service';

/**
 * Servicios de seguridad transversales. Global para no reimportar en cada módulo.
 */
@Global()
@Module({
  providers: [PasswordService],
  exports: [PasswordService],
})
export class SecurityModule {}
