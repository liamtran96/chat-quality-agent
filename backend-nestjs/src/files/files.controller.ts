import {
  Controller,
  Get,
  Req,
  Res,
  ForbiddenException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as path from 'path';

const FILES_BASE_DIR = '/var/lib/cqa/files';

@Controller('api/v1/files')
export class FilesController {
  @Get('*')
  serveFile(@Req() req: Request, @Res() res: Response) {
    const rawPath = req.params[0] || '';

    // Resolve to absolute path and verify it stays within base directory
    const fullPath = path.resolve(FILES_BASE_DIR, rawPath.replace(/^\/+/, ''));
    if (!fullPath.startsWith(FILES_BASE_DIR + path.sep) && fullPath !== FILES_BASE_DIR) {
      throw new ForbiddenException({ error: 'forbidden' });
    }

    // Extract tenant ID from path: /{tenantID}/{convID}/{filename}
    const relativePath = fullPath.slice(FILES_BASE_DIR.length + 1);
    const pathParts = relativePath.split(path.sep);
    if (pathParts.length < 1 || !pathParts[0]) {
      throw new ForbiddenException({ error: 'forbidden' });
    }

    // JWT auth and tenant ownership verification would be done by a guard
    // in the full implementation.

    res.sendFile(fullPath, (err) => {
      if (err && !res.headersSent) {
        res.status(404).json({ error: 'not_found' });
      }
    });
  }
}
