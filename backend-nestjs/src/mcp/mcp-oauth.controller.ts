import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { McpOAuthService } from './mcp-oauth.service';

const CONSENT_PAGE_HTML = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Chat Quality Agent — Xác thực MCP</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
  .card { background: white; border-radius: 12px; padding: 40px; max-width: 420px; width: 100%; box-shadow: 0 2px 12px rgba(0,0,0,0.1); }
  h1 { font-size: 20px; margin-bottom: 8px; color: #1a1a1a; }
  .subtitle { font-size: 14px; color: #666; margin-bottom: 24px; }
  .client-info { background: #f0f4ff; border-radius: 8px; padding: 12px; margin-bottom: 20px; font-size: 13px; }
  .client-info strong { color: #3b5998; }
  label { display: block; font-size: 13px; font-weight: 500; margin-bottom: 4px; color: #333; }
  input { width: 100%; padding: 10px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; margin-bottom: 12px; }
  input:focus { outline: none; border-color: #3b5998; box-shadow: 0 0 0 2px rgba(59,89,152,0.1); }
  .btn { width: 100%; padding: 12px; background: #3b5998; color: white; border: none; border-radius: 6px; font-size: 15px; cursor: pointer; font-weight: 500; }
  .btn:hover { background: #344e86; }
  .btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .error { background: #fef2f2; color: #dc2626; padding: 10px; border-radius: 6px; font-size: 13px; margin-bottom: 12px; }
  .cancel { text-align: center; margin-top: 12px; }
  .cancel a { color: #666; font-size: 13px; text-decoration: none; }
</style>
</head>
<body>
<div class="card">
  <h1>Chat Quality Agent</h1>
  <p class="subtitle">Xác thực để kết nối MCP</p>
  <div class="client-info">
    Ứng dụng <strong>{{CLIENT_NAME}}</strong> yêu cầu quyền truy cập dữ liệu của bạn.
  </div>
  {{ERROR_BLOCK}}
  <form method="POST" action="/oauth/authorize">
    <input type="hidden" name="client_id" value="{{CLIENT_ID}}">
    <input type="hidden" name="redirect_uri" value="{{REDIRECT_URI}}">
    <input type="hidden" name="state" value="{{STATE}}">
    <input type="hidden" name="code_challenge" value="{{CODE_CHALLENGE}}">
    <input type="hidden" name="code_challenge_method" value="{{CODE_CHALLENGE_METHOD}}">
    <label for="email">Email</label>
    <input type="email" id="email" name="email" required autocomplete="email" value="{{EMAIL}}">
    <label for="password">Mật khẩu</label>
    <input type="password" id="password" name="password" required autocomplete="current-password">
    <button type="submit" class="btn">Cho phép truy cập</button>
  </form>
  <div class="cancel"><a href="{{REDIRECT_URI}}?error=access_denied&state={{STATE}}">Từ chối</a></div>
</div>
</body>
</html>`;

function renderConsentPage(data: {
  clientId: string;
  clientName: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  email: string;
  error: string;
}): string {
  const errorBlock = data.error
    ? `<div class="error">${escapeHtml(data.error)}</div>`
    : '';
  return CONSENT_PAGE_HTML.replace(/\{\{CLIENT_NAME\}\}/g, escapeHtml(data.clientName))
    .replace(/\{\{CLIENT_ID\}\}/g, escapeHtml(data.clientId))
    .replace(/\{\{REDIRECT_URI\}\}/g, escapeHtml(data.redirectUri))
    .replace(/\{\{STATE\}\}/g, escapeHtml(data.state))
    .replace(/\{\{CODE_CHALLENGE\}\}/g, escapeHtml(data.codeChallenge))
    .replace(/\{\{CODE_CHALLENGE_METHOD\}\}/g, escapeHtml(data.codeChallengeMethod))
    .replace(/\{\{EMAIL\}\}/g, escapeHtml(data.email))
    .replace(/\{\{ERROR_BLOCK\}\}/g, errorBlock);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

@Controller()
export class McpOAuthController {
  private readonly logger = new Logger(McpOAuthController.name);

  constructor(private readonly oauthService: McpOAuthService) {}

  @Get('oauth/authorize')
  async authorize(@Req() req: Request, @Res() res: Response): Promise<void> {
    const clientId = (req.query.client_id as string) || '';
    const redirectUri = (req.query.redirect_uri as string) || '';
    const state = (req.query.state as string) || '';
    const codeChallenge = (req.query.code_challenge as string) || '';
    const codeChallengeMethod = (req.query.code_challenge_method as string) || '';

    if (!clientId || !redirectUri) {
      res.status(HttpStatus.BAD_REQUEST).json({ error: 'missing_parameters' });
      return;
    }

    const client = await this.oauthService.findClientByClientId(clientId);
    if (!client) {
      res.status(HttpStatus.BAD_REQUEST).json({ error: 'invalid_client' });
      return;
    }

    if (!this.oauthService.isRedirectUriAllowed(redirectUri, client.redirect_uris)) {
      res.status(HttpStatus.BAD_REQUEST).json({ error: 'invalid_redirect_uri' });
      return;
    }

    // Render consent/login page
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(
      renderConsentPage({
        clientId,
        clientName: client.name || '',
        redirectUri,
        state,
        codeChallenge,
        codeChallengeMethod,
        email: '',
        error: '',
      }),
    );
  }

  @Post('oauth/authorize')
  async authorizeLogin(@Req() req: Request, @Res() res: Response): Promise<void> {
    const clientId = req.body.client_id || '';
    const redirectUri = req.body.redirect_uri || '';
    const state = req.body.state || '';
    const codeChallenge = req.body.code_challenge || '';
    const codeChallengeMethod = req.body.code_challenge_method || '';
    const email = req.body.email || '';
    const password = req.body.password || '';

    const ip = req.ip || '0.0.0.0';

    // Brute force check
    if (this.oauthService.checkLockout(ip)) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(
        renderConsentPage({
          clientId,
          clientName: '',
          redirectUri,
          state,
          codeChallenge,
          codeChallengeMethod,
          email,
          error: 'Đã vượt quá số lần thử. Vui lòng đợi 15 phút.',
        }),
      );
      return;
    }

    // Verify client
    const client = await this.oauthService.findClientByClientId(clientId);
    if (!client) {
      res.status(HttpStatus.BAD_REQUEST).json({ error: 'invalid_client' });
      return;
    }

    if (!this.oauthService.isRedirectUriAllowed(redirectUri, client.redirect_uris)) {
      res.status(HttpStatus.BAD_REQUEST).json({ error: 'invalid_redirect_uri' });
      return;
    }

    // Authenticate user
    const user = await this.oauthService.authenticateUser(email, password);
    if (!user) {
      this.oauthService.recordFailure(ip);
      this.logger.warn(`OAuth login failed: email=${email} ip=${ip}`);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(
        renderConsentPage({
          clientId,
          clientName: client.name || '',
          redirectUri,
          state,
          codeChallenge,
          codeChallengeMethod,
          email,
          error: 'Email hoặc mật khẩu không đúng',
        }),
      );
      return;
    }

    this.oauthService.clearFailure(ip);

    // Generate authorization code
    const code = this.oauthService.generateRandomHex(32);
    await this.oauthService.createAuthorizationCode({
      code,
      clientId: client.client_id,
      userId: user.id,
      redirectUri,
      scopes: client.scopes,
      codeChallenge,
      codeChallengeMethod,
    });

    // Redirect back with auth code
    let redirectUrl = `${redirectUri}?code=${code}`;
    if (state) {
      redirectUrl += '&state=' + encodeURIComponent(state);
    }
    res.redirect(HttpStatus.FOUND, redirectUrl);
  }

  @Post('oauth/token')
  async token(@Req() req: Request, @Res() res: Response): Promise<void> {
    const grantType = req.body.grant_type;

    switch (grantType) {
      case 'authorization_code': {
        const code = req.body.code || '';
        const clientId = req.body.client_id || '';
        const clientSecret = req.body.client_secret || '';
        const codeVerifier = req.body.code_verifier || '';

        const result = await this.oauthService.exchangeAuthCode(
          code,
          clientId,
          clientSecret,
          codeVerifier,
        );

        if ('error' in result) {
          const status =
            result.error === 'invalid_client'
              ? HttpStatus.UNAUTHORIZED
              : HttpStatus.BAD_REQUEST;
          const body: Record<string, string> = { error: result.error };
          if (result.errorDescription) {
            body.error_description = result.errorDescription;
          }
          res.status(status).json(body);
          return;
        }

        res.status(HttpStatus.OK).json({
          access_token: result.accessToken,
          refresh_token: result.refreshToken,
          token_type: 'Bearer',
          expires_in: result.expiresIn,
          scope: result.scope,
        });
        return;
      }

      case 'refresh_token': {
        const refreshToken = req.body.refresh_token || '';
        const result = await this.oauthService.refreshAccessToken(refreshToken);

        if ('error' in result) {
          res.status(HttpStatus.UNAUTHORIZED).json({ error: result.error });
          return;
        }

        res.status(HttpStatus.OK).json({
          access_token: result.accessToken,
          refresh_token: result.refreshToken,
          token_type: 'Bearer',
          expires_in: result.expiresIn,
        });
        return;
      }

      default:
        res.status(HttpStatus.BAD_REQUEST).json({ error: 'unsupported_grant_type' });
    }
  }

  @Post('oauth/revoke')
  async revoke(@Req() req: Request, @Res() res: Response): Promise<void> {
    const token = req.body.token || '';
    const affected = await this.oauthService.revokeToken(token);
    this.logger.log(`Token revoked: ip=${req.ip} affected=${affected}`);
    res.status(HttpStatus.OK).json({ message: 'revoked' });
  }

  @Get('.well-known/oauth-authorization-server')
  async oauthMetadata(@Req() req: Request, @Res() res: Response): Promise<void> {
    const baseUrl = this.getBaseUrl(req);
    res.status(HttpStatus.OK).json({
      issuer: baseUrl,
      authorization_endpoint: baseUrl + '/oauth/authorize',
      token_endpoint: baseUrl + '/oauth/token',
      revocation_endpoint: baseUrl + '/oauth/revoke',
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['client_secret_post'],
    });
  }

  @Get('.well-known/oauth-protected-resource')
  async protectedResourceMetadata(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const baseUrl = this.getBaseUrl(req);
    res.status(HttpStatus.OK).json({
      resource: baseUrl + '/mcp',
      authorization_servers: [baseUrl],
      bearer_methods_supported: ['header'],
    });
  }

  private getBaseUrl(req: Request): string {
    const proto =
      req.headers['x-forwarded-proto'] === 'https' || (req.socket as any)?.encrypted
        ? 'https'
        : 'http';
    return `${proto}://${req.headers.host}`;
  }
}
