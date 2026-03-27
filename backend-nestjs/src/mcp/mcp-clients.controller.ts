import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Req,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { McpOAuthService } from './mcp-oauth.service';

/**
 * MCP Client management endpoints.
 * These require JWT authentication (set by auth middleware upstream).
 * In the Go backend, user_id is extracted from the JWT and set on the context.
 * Here we read it from req['user_id'] (set by JWT auth middleware).
 */
@Controller('api/v1/mcp/clients')
export class McpClientsController {
  constructor(private readonly oauthService: McpOAuthService) {}

  @Get()
  async listClients(@Req() req: Request, @Res() res: Response): Promise<void> {
    const userId = (req as any).user_id as string;
    if (!userId) {
      res.status(HttpStatus.UNAUTHORIZED).json({ error: 'authorization_required' });
      return;
    }
    const clients = await this.oauthService.listClients(userId);
    res.status(HttpStatus.OK).json(clients);
  }

  @Post()
  async createClient(@Req() req: Request, @Res() res: Response): Promise<void> {
    const userId = (req as any).user_id as string;
    if (!userId) {
      res.status(HttpStatus.UNAUTHORIZED).json({ error: 'authorization_required' });
      return;
    }

    const { name, redirect_uris, scopes } = req.body || {};
    if (!name) {
      res.status(HttpStatus.BAD_REQUEST).json({ error: 'invalid_request' });
      return;
    }

    const result = await this.oauthService.createClient(
      userId,
      name,
      redirect_uris || [],
      scopes || [],
    );
    res.status(HttpStatus.CREATED).json(result);
  }

  @Delete(':id')
  async deleteClient(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const userId = (req as any).user_id as string;
    if (!userId) {
      res.status(HttpStatus.UNAUTHORIZED).json({ error: 'authorization_required' });
      return;
    }

    const deleted = await this.oauthService.deleteClient(id, userId);
    if (!deleted) {
      res.status(HttpStatus.NOT_FOUND).json({ error: 'not_found' });
      return;
    }
    res.status(HttpStatus.OK).json({ message: 'deleted' });
  }
}
