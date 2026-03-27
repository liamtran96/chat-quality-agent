import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../entities/user.entity';
import { newUUID } from '../common/helpers';
import { Response } from 'express';

/** In-memory lockout tracking (not persisted to DB). */
interface LoginAttempt {
  count: number;
  lockedAt: Date | null;
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly failedAttempts = new Map<string, LoginAttempt>();

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // ── Token generation ────────────────────────────────────────────

  /** Generate a short-lived access token (15 min). Claims match Go exactly. */
  generateAccessToken(userId: string, email: string, isAdmin: boolean): string {
    const payload = {
      user_id: userId,
      email,
      is_admin: isAdmin,
    };
    return this.jwtService.sign(payload, { expiresIn: '15m' });
  }

  /** Generate a long-lived refresh token (7 days). Claims match Go exactly. */
  generateRefreshToken(userId: string, tokenVersion: number): string {
    const payload = {
      sub: userId,
      token_version: tokenVersion,
    };
    return this.jwtService.sign(payload, { expiresIn: '7d' });
  }

  // ── Password validation ─────────────────────────────────────────

  /** Validate password complexity: min 8 chars, at least 1 uppercase, 1 digit. */
  validatePasswordComplexity(password: string): void {
    if (password.length < 8) {
      throw new BadRequestException({
        error: 'weak_password',
        message: 'M\u1EADt kh\u1EA9u ph\u1EA3i c\u00F3 \u00EDt nh\u1EA5t 8 k\u00FD t\u1EF1',
      });
    }
    if (!/[A-Z]/.test(password)) {
      throw new BadRequestException({
        error: 'weak_password',
        message: 'M\u1EADt kh\u1EA9u ph\u1EA3i c\u00F3 \u00EDt nh\u1EA5t 1 ch\u1EEF hoa',
      });
    }
    if (!/[0-9]/.test(password)) {
      throw new BadRequestException({
        error: 'weak_password',
        message: 'M\u1EADt kh\u1EA9u ph\u1EA3i c\u00F3 \u00EDt nh\u1EA5t 1 ch\u1EEF s\u1ED1',
      });
    }
  }

  // ── Lockout logic ───────────────────────────────────────────────

  checkLockout(key: string): boolean {
    const attempt = this.failedAttempts.get(key);
    if (!attempt) return false;

    if (attempt.lockedAt) {
      const elapsed = Date.now() - attempt.lockedAt.getTime();
      if (elapsed < LOCKOUT_DURATION_MS) {
        return true;
      }
      // Lockout expired — clear it
      this.failedAttempts.delete(key);
    }
    return false;
  }

  recordFailedLogin(key: string): void {
    let attempt = this.failedAttempts.get(key);
    if (!attempt) {
      attempt = { count: 0, lockedAt: null };
      this.failedAttempts.set(key, attempt);
    }
    attempt.count++;
    if (attempt.count >= MAX_FAILED_ATTEMPTS) {
      attempt.lockedAt = new Date();
    }
  }

  clearFailedLogin(key: string): void {
    this.failedAttempts.delete(key);
  }

  // ── Auth flows ──────────────────────────────────────────────────

  async validateUser(email: string, password: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) {
      throw new UnauthorizedException({ error: 'invalid_credentials' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      throw new UnauthorizedException({ error: 'invalid_credentials' });
    }

    return user;
  }

  async login(
    email: string,
    password: string,
    clientIp: string,
    res: Response,
  ): Promise<{ status: number; body: Record<string, any> }> {
    const lockoutKey = `${email}:${clientIp}`;

    if (this.checkLockout(lockoutKey)) {
      this.logger.warn(`[security] brute force lockout: email=${email} ip=${clientIp}`);
      return {
        status: HttpStatus.TOO_MANY_REQUESTS,
        body: {
          error: 'account_locked',
          message:
            'T\u00E0i kho\u1EA3n b\u1ECB kh\u00F3a t\u1EA1m th\u1EDDi do \u0111\u0103ng nh\u1EADp sai nhi\u1EC1u l\u1EA7n. Vui l\u00F2ng th\u1EED l\u1EA1i sau 15 ph\u00FAt.',
        },
      };
    }

    // Find user
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) {
      this.recordFailedLogin(lockoutKey);
      this.logger.warn(`[security] failed login: email=${email} ip=${clientIp} reason=user_not_found`);
      return {
        status: HttpStatus.UNAUTHORIZED,
        body: { error: 'invalid_credentials' },
      };
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      this.recordFailedLogin(lockoutKey);
      this.logger.warn(`[security] failed login: email=${email} ip=${clientIp} reason=wrong_password`);
      return {
        status: HttpStatus.UNAUTHORIZED,
        body: { error: 'invalid_credentials' },
      };
    }

    this.clearFailedLogin(lockoutKey);

    const accessToken = this.generateAccessToken(user.id, user.email, user.is_admin);
    const refreshToken = this.generateRefreshToken(user.id, user.token_version);

    this.setRefreshCookie(res, refreshToken);

    return {
      status: HttpStatus.OK,
      body: {
        access_token: accessToken,
        expires_in: 900,
      },
    };
  }

  async refreshToken(
    refreshTokenStr: string,
    res: Response,
    clientIp: string,
  ): Promise<{ status: number; body: Record<string, any> }> {
    if (!refreshTokenStr) {
      return {
        status: HttpStatus.UNAUTHORIZED,
        body: { error: 'missing_refresh_token' },
      };
    }

    let payload: any;
    try {
      payload = this.jwtService.verify(refreshTokenStr);
    } catch {
      this.logger.warn(`[security] refresh token invalid: ip=${clientIp}`);
      return {
        status: HttpStatus.UNAUTHORIZED,
        body: { error: 'invalid_refresh_token' },
      };
    }

    const userId = payload.sub;
    const tokenVersion = payload.token_version;

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      return {
        status: HttpStatus.UNAUTHORIZED,
        body: { error: 'user_not_found' },
      };
    }

    if (tokenVersion !== user.token_version) {
      this.logger.warn(
        `[security] refresh token revoked: ip=${clientIp} user=${userId} token_ver=${tokenVersion} current_ver=${user.token_version}`,
      );
      this.clearRefreshCookie(res);
      return {
        status: HttpStatus.UNAUTHORIZED,
        body: { error: 'invalid_refresh_token' },
      };
    }

    // Increment token version to revoke current refresh token
    const newVersion = user.token_version + 1;
    await this.userRepo.update(user.id, { token_version: newVersion });

    const accessToken = this.generateAccessToken(user.id, user.email, user.is_admin);
    const newRefreshToken = this.generateRefreshToken(user.id, newVersion);

    this.setRefreshCookie(res, newRefreshToken);

    return {
      status: HttpStatus.OK,
      body: {
        access_token: accessToken,
        expires_in: 900,
      },
    };
  }

  async logout(res: Response): Promise<Record<string, any>> {
    this.clearRefreshCookie(res);
    return { message: 'logged_out' };
  }

  // ── Setup ───────────────────────────────────────────────────────

  async getSetupStatus(): Promise<{ needs_setup: boolean }> {
    const count = await this.userRepo.count();
    return { needs_setup: count === 0 };
  }

  async setup(
    email: string,
    password: string,
    name: string | undefined,
    res: Response,
  ): Promise<{ status: number; body: Record<string, any> }> {
    const count = await this.userRepo.count();
    if (count > 0) {
      return {
        status: HttpStatus.FORBIDDEN,
        body: { error: 'setup_already_completed' },
      };
    }

    this.validatePasswordComplexity(password);

    const hash = await bcrypt.hash(password, 10);
    const user = this.userRepo.create({
      id: newUUID(),
      email,
      password_hash: hash,
      name: name || 'Admin',
      is_admin: true,
      language: 'vi',
    });

    await this.userRepo.save(user);
    this.logger.log(`[setup] Admin account created: ${user.email}`);

    const accessToken = this.generateAccessToken(user.id, user.email, user.is_admin);
    const refreshToken = this.generateRefreshToken(user.id, user.token_version);

    this.setRefreshCookie(res, refreshToken);

    return {
      status: HttpStatus.CREATED,
      body: {
        access_token: accessToken,
        expires_in: 900,
      },
    };
  }

  // ── Profile ─────────────────────────────────────────────────────

  async getProfile(userId: string): Promise<User> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['tenants'],
    });
    if (!user) {
      throw new BadRequestException({ error: 'user_not_found' });
    }
    return user;
  }

  async updateProfile(userId: string, name: string): Promise<Record<string, any>> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException({ error: 'user_not_found' });
    }
    user.name = name;
    await this.userRepo.save(user);
    return { name: user.name, email: user.email };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<Record<string, any>> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException({ error: 'user_not_found' });
    }

    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) {
      throw new BadRequestException({ error: 'wrong_current_password' });
    }

    this.validatePasswordComplexity(newPassword);

    user.password_hash = await bcrypt.hash(newPassword, 10);
    await this.userRepo.save(user);

    return { message: 'password_changed' };
  }

  // ── Cookie helpers ──────────────────────────────────────────────

  setRefreshCookie(res: Response, token: string): void {
    const isSecure = this.configService.get<string>('app.env') === 'production';
    res.cookie('cqa_refresh_token', token, {
      maxAge: 7 * 24 * 3600 * 1000,
      path: '/api/v1/auth',
      secure: isSecure,
      httpOnly: true,
      sameSite: 'strict',
    });
  }

  clearRefreshCookie(res: Response): void {
    const isSecure = this.configService.get<string>('app.env') === 'production';
    res.cookie('cqa_refresh_token', '', {
      maxAge: 0,
      path: '/api/v1/auth',
      secure: isSecure,
      httpOnly: true,
      sameSite: 'strict',
    });
  }

  // ── Serialization helper ────────────────────────────────────────

  /** Serialize a User entity for JSON response (omit password_hash, token_version). */
  serializeUser(user: User): Record<string, any> {
    const { password_hash, token_version, ...safe } = user as any;
    return safe;
  }
}
