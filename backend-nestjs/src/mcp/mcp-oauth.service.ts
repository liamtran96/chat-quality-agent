import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { OAuthClient } from '../entities/oauth-client.entity';
import { OAuthAuthorizationCode } from '../entities/oauth-authorization-code.entity';
import { OAuthToken } from '../entities/oauth-token.entity';
import { User } from '../entities/user.entity';

interface LoginAttempt {
  count: number;
  lockedAt: Date | null;
}

@Injectable()
export class McpOAuthService implements OnModuleDestroy {
  private readonly logger = new Logger(McpOAuthService.name);
  private readonly loginTracker = new Map<string, LoginAttempt>();
  private readonly MAX_ATTEMPTS = 5;
  private readonly LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor(
    @InjectRepository(OAuthClient)
    private readonly oauthClientRepo: Repository<OAuthClient>,
    @InjectRepository(OAuthAuthorizationCode)
    private readonly authCodeRepo: Repository<OAuthAuthorizationCode>,
    @InjectRepository(OAuthToken)
    private readonly oauthTokenRepo: Repository<OAuthToken>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {
    // Cleanup expired brute force entries every 5 minutes
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupExpiredLockouts();
      },
      5 * 60 * 1000,
    );
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  private cleanupExpiredLockouts(): void {
    const now = Date.now();
    for (const [ip, attempt] of this.loginTracker.entries()) {
      if (attempt.lockedAt && now - attempt.lockedAt.getTime() >= this.LOCK_DURATION_MS) {
        this.loginTracker.delete(ip);
      }
    }
  }

  checkLockout(ip: string): boolean {
    const attempt = this.loginTracker.get(ip);
    if (!attempt) return false;

    if (attempt.lockedAt) {
      if (Date.now() - attempt.lockedAt.getTime() < this.LOCK_DURATION_MS) {
        return true;
      }
      // Lock expired, clean up
      this.loginTracker.delete(ip);
    }
    return false;
  }

  recordFailure(ip: string): void {
    let attempt = this.loginTracker.get(ip);
    if (!attempt) {
      attempt = { count: 0, lockedAt: null };
      this.loginTracker.set(ip, attempt);
    }
    attempt.count++;
    if (attempt.count >= this.MAX_ATTEMPTS) {
      attempt.lockedAt = new Date();
      this.logger.warn(`OAuth brute force lockout: ip=${ip}`);
    }
  }

  clearFailure(ip: string): void {
    this.loginTracker.delete(ip);
  }

  // Expose for testing
  getLoginTracker(): Map<string, LoginAttempt> {
    return this.loginTracker;
  }

  async findClientByClientId(clientId: string): Promise<OAuthClient | null> {
    return this.oauthClientRepo.findOne({ where: { client_id: clientId } });
  }

  isRedirectUriAllowed(uri: string, allowedJson: string): boolean {
    if (!allowedJson || allowedJson === '[]') {
      return false;
    }
    try {
      const allowed: string[] = JSON.parse(allowedJson);
      return allowed.includes(uri);
    } catch {
      return false;
    }
  }

  async authenticateUser(
    email: string,
    password: string,
  ): Promise<User | null> {
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) return null;

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return null;

    return user;
  }

  generateRandomHex(byteLength: number): string {
    return crypto.randomBytes(byteLength).toString('hex');
  }

  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  verifyPKCE(codeVerifier: string, codeChallenge: string): boolean {
    const hash = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    return hash === codeChallenge;
  }

  async createAuthorizationCode(params: {
    code: string;
    clientId: string;
    userId: string;
    redirectUri: string;
    scopes: string;
    codeChallenge: string;
    codeChallengeMethod: string;
  }): Promise<OAuthAuthorizationCode> {
    const authCode = this.authCodeRepo.create({
      code: params.code,
      client_id: params.clientId,
      user_id: params.userId,
      redirect_uri: params.redirectUri,
      scopes: params.scopes,
      code_challenge: params.codeChallenge,
      code_challenge_method: params.codeChallengeMethod,
      expires_at: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      used: false,
    });
    return this.authCodeRepo.save(authCode);
  }

  async exchangeAuthCode(
    code: string,
    clientId: string,
    clientSecret: string,
    codeVerifier: string,
  ): Promise<
    | {
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
        scope: string;
      }
    | { error: string; errorDescription?: string }
  > {
    // Atomically mark code as used
    const updateResult = await this.authCodeRepo
      .createQueryBuilder()
      .update()
      .set({ used: true })
      .where('code = :code AND used = false', { code })
      .execute();

    if (updateResult.affected === 0) {
      return { error: 'invalid_grant' };
    }

    // Read the auth code details
    const authCode = await this.authCodeRepo.findOne({ where: { code } });
    if (!authCode) {
      return { error: 'invalid_grant' };
    }

    // Validate expiry and client
    if (new Date() > authCode.expires_at || authCode.client_id !== clientId) {
      return { error: 'invalid_grant' };
    }

    // PKCE verification
    if (authCode.code_challenge) {
      if (!codeVerifier) {
        return { error: 'invalid_grant', errorDescription: 'code_verifier required' };
      }
      if (!this.verifyPKCE(codeVerifier, authCode.code_challenge)) {
        this.logger.warn(`PKCE verification failed: client=${clientId}`);
        return { error: 'invalid_grant', errorDescription: 'PKCE verification failed' };
      }
    }

    // Verify client secret
    const client = await this.oauthClientRepo.findOne({ where: { client_id: clientId } });
    if (!client) {
      return { error: 'invalid_client' };
    }
    const secretMatch = await bcrypt.compare(clientSecret, client.client_secret_hash);
    if (!secretMatch) {
      return { error: 'invalid_client' };
    }

    // Generate tokens
    const accessToken = this.generateRandomHex(48);
    const refreshToken = this.generateRandomHex(48);

    const tokenEntry = this.oauthTokenRepo.create({
      client_id: clientId,
      user_id: authCode.user_id,
      access_token_hash: this.hashToken(accessToken),
      refresh_token_hash: this.hashToken(refreshToken),
      scopes: authCode.scopes,
      expires_at: new Date(Date.now() + 3600 * 1000), // 1 hour
    });
    await this.oauthTokenRepo.save(tokenEntry);

    return {
      accessToken,
      refreshToken,
      expiresIn: 3600,
      scope: authCode.scopes,
    };
  }

  async refreshAccessToken(
    refreshToken: string,
  ): Promise<
    | {
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
      }
    | { error: string }
  > {
    const hash = this.hashToken(refreshToken);
    const tokenEntry = await this.oauthTokenRepo.findOne({
      where: { refresh_token_hash: hash },
    });
    if (!tokenEntry) {
      return { error: 'invalid_grant' };
    }

    // Delete old token (rotation)
    await this.oauthTokenRepo.remove(tokenEntry);

    // Issue new tokens
    const newAccessToken = this.generateRandomHex(48);
    const newRefreshToken = this.generateRandomHex(48);

    const newEntry = this.oauthTokenRepo.create({
      client_id: tokenEntry.client_id,
      user_id: tokenEntry.user_id,
      access_token_hash: this.hashToken(newAccessToken),
      refresh_token_hash: this.hashToken(newRefreshToken),
      scopes: tokenEntry.scopes,
      expires_at: new Date(Date.now() + 3600 * 1000),
    });
    await this.oauthTokenRepo.save(newEntry);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 3600,
    };
  }

  async revokeToken(token: string): Promise<number> {
    const hash = this.hashToken(token);
    const result = await this.oauthTokenRepo
      .createQueryBuilder()
      .delete()
      .where('access_token_hash = :hash OR refresh_token_hash = :hash', { hash })
      .execute();
    return result.affected || 0;
  }

  async validateBearerToken(
    token: string,
  ): Promise<{ userId: string; clientId: string } | null> {
    const hash = this.hashToken(token);
    const oauthToken = await this.oauthTokenRepo.findOne({
      where: { access_token_hash: hash },
    });
    if (!oauthToken) return null;
    if (new Date() > oauthToken.expires_at) return null;
    return { userId: oauthToken.user_id, clientId: oauthToken.client_id };
  }

  // MCP Client CRUD

  async listClients(userId: string): Promise<
    Array<{
      id: string;
      client_id: string;
      name: string;
      redirect_uris: string;
      scopes: string;
      created_at: Date;
    }>
  > {
    const clients = await this.oauthClientRepo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
    return clients.map((c) => ({
      id: c.id,
      client_id: c.client_id,
      name: c.name,
      redirect_uris: c.redirect_uris,
      scopes: c.scopes,
      created_at: c.created_at,
    }));
  }

  async createClient(
    userId: string,
    name: string,
    redirectUris: string[],
    scopes: string[],
  ): Promise<{
    id: string;
    client_id: string;
    client_secret: string;
    name: string;
    scopes: string;
  }> {
    const clientId = 'cqa_' + this.generateRandomHex(24);
    const clientSecret = 'sk_' + this.generateRandomHex(48);
    const secretHash = await bcrypt.hash(clientSecret, 10);

    const redirectUrisJson =
      redirectUris.length > 0 ? JSON.stringify(redirectUris) : '[]';

    // Validate scopes
    const allowedScopes = new Set(['read', 'write']);
    const validScopes = scopes.filter((s) => allowedScopes.has(s));
    const finalScopes = validScopes.length > 0 ? validScopes : ['read', 'write'];
    const scopesJson = JSON.stringify(finalScopes);

    const client = this.oauthClientRepo.create({
      client_id: clientId,
      client_secret_hash: secretHash,
      name,
      redirect_uris: redirectUrisJson,
      scopes: scopesJson,
      user_id: userId,
    });
    const saved = await this.oauthClientRepo.save(client);

    return {
      id: saved.id,
      client_id: clientId,
      client_secret: clientSecret,
      name: saved.name,
      scopes: saved.scopes,
    };
  }

  async deleteClient(
    clientDbId: string,
    userId: string,
  ): Promise<boolean> {
    // Delete associated tokens and auth codes
    const client = await this.oauthClientRepo.findOne({
      where: { id: clientDbId, user_id: userId },
    });
    if (!client) return false;

    await this.oauthTokenRepo.delete({ client_id: client.client_id });
    await this.authCodeRepo.delete({ client_id: client.client_id });
    await this.oauthClientRepo.remove(client);
    return true;
  }
}
