import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * Hashing de contraseñas con argon2id (decisión de proyecto).
 * No exponer nunca el hash; este servicio es la única vía de verificación.
 */
@Injectable()
export class PasswordService {
  async hash(plain: string): Promise<string> {
    return argon2.hash(plain, { type: argon2.argon2id });
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }
}
