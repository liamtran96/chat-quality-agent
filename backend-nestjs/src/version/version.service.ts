import { Injectable } from '@nestjs/common';

const GITHUB_RELEASES_URL =
  'https://api.github.com/repos/tanviet12/chat-quality-agent/releases/latest';
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

export const APP_VERSION = process.env.APP_VERSION || 'dev';

@Injectable()
export class VersionService {
  private cache: Record<string, unknown> | null = null;
  private cacheTime = 0;

  async checkVersion(): Promise<Record<string, unknown>> {
    // Return cached result if still valid
    if (this.cache && Date.now() - this.cacheTime < CACHE_DURATION_MS) {
      return this.cache;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      const resp = await fetch(GITHUB_RELEASES_URL, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const release = (await resp.json()) as {
        tag_name?: string;
        html_url?: string;
        body?: string;
      };

      const currentNorm = APP_VERSION.replace(/^v/, '').trim();
      const latestNorm = (release.tag_name || '').replace(/^v/, '').trim();
      const hasUpdate = latestNorm !== '' && latestNorm !== currentNorm;

      const result: Record<string, unknown> = {
        current: APP_VERSION,
        latest: release.tag_name || '',
        has_update: hasUpdate,
        release_url: release.html_url || '',
        release_notes: release.body || '',
      };

      // Cache the result
      this.cache = result;
      this.cacheTime = Date.now();

      return result;
    } catch (err) {
      return {
        current: APP_VERSION,
        has_update: false,
        error: `check failed: ${err instanceof Error ? err.message : err}`,
      };
    }
  }
}
