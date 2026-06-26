import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface OtpEntry {
  code: string;
  phone: string;
  expiresAt: number;
  attempts: number;
}

const DEV_CODE = '123456';
const TTL_MS = 5 * 60 * 1000; // 5 min
const MAX_ATTEMPTS = 5;

/**
 * Verificación de teléfono por código (OTP).
 * En desarrollo usa el código fijo `123456` (igual que el mock del frontend).
 * En producción genera un código aleatorio (el envío real por SMS se integra después;
 * por ahora se registra en el log).
 *
 * Almacenamiento en memoria: suficiente para MVP. En producción con varias instancias
 * conviene Redis.
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly store = new Map<string, OtpEntry>();
  private readonly isProduction: boolean;

  constructor(configService: ConfigService) {
    this.isProduction = configService.get<string>('app.nodeEnv') === 'production';
  }

  /** Genera y "envía" un código para el usuario. Devuelve el código solo en dev. */
  sendCode(userId: string, phone: string): { devCode?: string } {
    const code = this.isProduction
      ? Math.floor(100000 + Math.random() * 900000).toString()
      : DEV_CODE;
    this.store.set(userId, { code, phone, expiresAt: Date.now() + TTL_MS, attempts: 0 });
    this.logger.log(`OTP para ${phone} (user ${userId}): ${this.isProduction ? '******' : code}`);
    return this.isProduction ? {} : { devCode: code };
  }

  /** Verifica el código. Devuelve true si es válido y no expiró. */
  verify(userId: string, code: string): boolean {
    const entry = this.store.get(userId);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(userId);
      return false;
    }
    if (entry.attempts >= MAX_ATTEMPTS) {
      this.store.delete(userId);
      return false;
    }
    entry.attempts += 1;
    const ok = entry.code === code.trim();
    if (ok) this.store.delete(userId);
    return ok;
  }
}
