import {
  Controller,
  Post,
  Req,
  Res,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { McpToolsService } from './mcp-tools.service';
import { McpOAuthService } from './mcp-oauth.service';

interface JsonRpcRequest {
  jsonrpc: string;
  id: unknown;
  method: string;
  params?: unknown;
}

interface RpcError {
  code: number;
  message: string;
  data?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: string;
  id: unknown;
  result?: unknown;
  error?: RpcError;
}

@Controller('mcp')
export class McpController {
  private readonly logger = new Logger(McpController.name);

  constructor(
    private readonly toolsService: McpToolsService,
    private readonly oauthService: McpOAuthService,
  ) {}

  @Post()
  async handleMcpRequest(@Req() req: Request, @Res() res: Response): Promise<void> {
    // Bearer token authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.setHeader(
        'WWW-Authenticate',
        'Bearer realm="MCP", resource="/.well-known/oauth-protected-resource"',
      );
      res.status(HttpStatus.UNAUTHORIZED).json({ error: 'bearer_token_required' });
      return;
    }

    const token = authHeader.slice(7); // Remove "Bearer "
    const tokenInfo = await this.oauthService.validateBearerToken(token);
    if (!tokenInfo) {
      this.logger.warn(`MCP auth failed: ip=${req.ip} error=invalid_or_expired_token`);
      res.status(HttpStatus.UNAUTHORIZED).json({ error: 'invalid_token' });
      return;
    }

    // Parse JSON-RPC request
    const body = req.body as JsonRpcRequest;
    if (!body || !body.method) {
      const response: JsonRpcResponse = {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error' },
      };
      res.status(HttpStatus.BAD_REQUEST).json(response);
      return;
    }

    let result: unknown = undefined;
    let rpcErr: RpcError | undefined = undefined;

    switch (body.method) {
      case 'initialize':
        result = {
          protocolVersion: '2025-03-26',
          capabilities: {
            tools: { listChanged: false },
          },
          serverInfo: {
            name: 'Chat Quality Agent',
            version: '1.0.0',
          },
        };
        break;

      case 'tools/list':
        result = {
          tools: this.toolsService.getAllTools(),
        };
        break;

      case 'tools/call': {
        const params = body.params as { name?: string; arguments?: Record<string, unknown> } | undefined;
        if (!params || !params.name) {
          rpcErr = { code: -32602, message: 'Invalid params' };
          break;
        }
        const toolResult = await this.toolsService.callTool(
          params.name,
          params.arguments || {},
          tokenInfo.userId,
        );
        if (toolResult.rpcError) {
          rpcErr = toolResult.rpcError;
        } else {
          result = toolResult.result;
        }
        break;
      }

      default:
        rpcErr = { code: -32601, message: 'Method not found: ' + body.method };
    }

    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      id: body.id,
    };
    if (rpcErr) {
      response.error = rpcErr;
    } else {
      response.result = result;
    }

    res.status(HttpStatus.OK).json(response);
  }
}
