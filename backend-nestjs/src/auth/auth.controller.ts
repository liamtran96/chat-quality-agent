import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from './jwt.strategy';
import { LoginDto, SetupDto, UpdateProfileDto, ChangePasswordDto } from './dto';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ── Public endpoints ────────────────────────────────────────────

  @Post('api/v1/auth/login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    const clientIp = req.ip || req.socket.remoteAddress || '';
    const result = await this.authService.login(dto.email, dto.password, clientIp, res);
    res.status(result.status).json(result.body);
  }

  @Post('api/v1/auth/refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    const refreshTokenStr = req.cookies?.cqa_refresh_token || '';
    const clientIp = req.ip || req.socket.remoteAddress || '';
    const result = await this.authService.refreshToken(refreshTokenStr, res, clientIp);
    res.status(result.status).json(result.body);
  }

  @Post('api/v1/auth/logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: false }) res: Response): Promise<void> {
    const body = await this.authService.logout(res);
    res.status(HttpStatus.OK).json(body);
  }

  @Get('api/v1/setup/status')
  async setupStatus(): Promise<{ needs_setup: boolean }> {
    return this.authService.getSetupStatus();
  }

  @Post('api/v1/setup')
  async setup(
    @Body() dto: SetupDto,
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    const result = await this.authService.setup(dto.email, dto.password, dto.name, res);
    res.status(result.status).json(result.body);
  }

  // ── Authenticated endpoints ─────────────────────────────────────

  @Get('api/v1/profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser() user: JwtPayload): Promise<Record<string, any>> {
    const fullUser = await this.authService.getProfile(user.user_id);
    return this.authService.serializeUser(fullUser);
  }

  @Put('api/v1/profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ): Promise<Record<string, any>> {
    return this.authService.updateProfile(user.user_id, dto.name);
  }

  @Put('api/v1/profile/password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ): Promise<Record<string, any>> {
    return this.authService.changePassword(
      user.user_id,
      dto.current_password,
      dto.new_password,
    );
  }
}
