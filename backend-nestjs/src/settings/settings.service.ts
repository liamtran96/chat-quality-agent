import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AppSetting, Tenant, User } from '../entities';
import { CryptoService } from '../common/crypto/crypto.service';
import { newUUID, validatePasswordComplexity } from '../common/helpers';
import { SaveAISettingsDto } from './dto/save-ai-settings.dto';
import { SaveAnalysisSettingsDto } from './dto/save-analysis-settings.dto';
import { SaveGeneralSettingsDto } from './dto/save-general-settings.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

const ALLOWED_SETTING_KEYS: Record<string, boolean> = {
  onboarding_dismissed: true,
  language: true,
  timezone: true,
  date_format: true,
  notification_enabled: true,
  sync_interval: true,
  default_ai_provider: true,
  default_ai_model: true,
};

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(AppSetting)
    private readonly settingRepo: Repository<AppSetting>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly cryptoService: CryptoService,
  ) {}

  async getSettings(tenantId: string) {
    const settings = await this.settingRepo.find({
      where: { tenant_id: tenantId },
    });

    const result: Record<string, string> = {};
    for (const s of settings) {
      if (s.value_plain) {
        result[s.setting_key] = s.value_plain;
      } else if (s.value_encrypted && s.value_encrypted.length > 0) {
        result[s.setting_key] = '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022';
      }
    }

    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });

    const getVal = (key: string, defaultVal: string): string => {
      const s = settings.find((x) => x.setting_key === key);
      return s?.value_plain || defaultVal;
    };

    return {
      settings: result,
      tenant: {
        name: tenant?.name || '',
        timezone: getVal('timezone', 'Asia/Ho_Chi_Minh'),
        language: getVal('language', 'vi'),
      },
    };
  }

  async saveSetting(tenantId: string, key: string, value: string) {
    if (!ALLOWED_SETTING_KEYS[key]) {
      throw new BadRequestException('setting_key_not_allowed');
    }
    await this.upsertSetting(tenantId, key, value, null);
    return { message: 'saved' };
  }

  async saveAISettings(tenantId: string, dto: SaveAISettingsDto) {
    await this.upsertSetting(tenantId, 'ai_provider', dto.provider, null);

    if (dto.model) {
      await this.upsertSetting(tenantId, 'ai_model', dto.model, null);
    }

    if (dto.base_url) {
      await this.upsertSetting(tenantId, 'ai_base_url', dto.base_url, null);
    } else {
      await this.settingRepo.delete({
        tenant_id: tenantId,
        setting_key: 'ai_base_url',
      });
    }

    const encrypted = this.cryptoService.encrypt(dto.api_key);
    await this.upsertSetting(tenantId, 'ai_api_key', '', encrypted);

    if (dto.batch_mode) {
      await this.upsertSetting(tenantId, 'ai_batch_mode', dto.batch_mode, null);
    }
    if (dto.batch_size) {
      await this.upsertSetting(tenantId, 'ai_batch_size', dto.batch_size, null);
    }

    return { message: 'saved' };
  }

  async saveAnalysisSettings(tenantId: string, dto: SaveAnalysisSettingsDto) {
    await this.upsertSetting(tenantId, 'ai_batch_mode', dto.batch_mode, null);
    if (dto.batch_size) {
      await this.upsertSetting(tenantId, 'ai_batch_size', dto.batch_size, null);
    }
    return { message: 'saved' };
  }

  async testAIKey(tenantId: string) {
    const [setting, providerSetting] = await Promise.all([
      this.settingRepo.findOne({
        where: { tenant_id: tenantId, setting_key: 'ai_api_key' },
      }),
      this.settingRepo.findOne({
        where: { tenant_id: tenantId, setting_key: 'ai_provider' },
      }),
    ]);

    if (!setting?.value_encrypted) {
      throw new BadRequestException('no_api_key_configured');
    }

    const provider = providerSetting?.value_plain || 'claude';

    try {
      this.cryptoService.decrypt(setting.value_encrypted);
    } catch {
      throw new InternalServerErrorException('decrypt_failed');
    }

    return { status: 'ok', provider, message: 'API key configured' };
  }

  async saveGeneralSettings(tenantId: string, dto: SaveGeneralSettingsDto) {
    if (dto.company_name) {
      await this.tenantRepo.update(tenantId, {
        name: dto.company_name,
        updated_at: new Date(),
      });
    }

    if (dto.timezone) {
      await this.upsertSetting(tenantId, 'timezone', dto.timezone, null);
    }
    if (dto.language) {
      await this.upsertSetting(tenantId, 'language', dto.language, null);
    }
    if (dto.exchange_rate_vnd && dto.exchange_rate_vnd > 0) {
      await this.upsertSetting(
        tenantId,
        'exchange_rate_vnd',
        Math.round(dto.exchange_rate_vnd).toString(),
        null,
      );
    }

    const appUrl = (dto.app_url || '').replace(/\/+$/, '');
    await this.upsertSetting(tenantId, 'app_url', appUrl, null);

    return { message: 'saved' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const error = validatePasswordComplexity(dto.new_password);
    if (error) {
      throw new BadRequestException({ error: 'weak_password', message: error });
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('user_not_found');
    }

    const valid = await bcrypt.compare(dto.current_password, user.password_hash);
    if (!valid) {
      throw new BadRequestException('wrong_current_password');
    }

    const hash = await bcrypt.hash(dto.new_password, 10);
    await this.userRepo.update(userId, {
      password_hash: hash,
      updated_at: new Date(),
    });

    return { message: 'password_changed' };
  }

  private async upsertSetting(
    tenantId: string,
    key: string,
    plainValue: string,
    encryptedValue: Buffer | null,
  ) {
    const existing = await this.settingRepo.findOne({
      where: { tenant_id: tenantId, setting_key: key },
    });

    if (existing) {
      const updates: Partial<AppSetting> = { updated_at: new Date() };
      if (plainValue) {
        updates.value_plain = plainValue;
        updates.value_encrypted = null;
      }
      if (encryptedValue) {
        updates.value_encrypted = encryptedValue;
        updates.value_plain = '';
      }
      await this.settingRepo.update(existing.id, updates);
    } else {
      const setting = this.settingRepo.create({
        id: newUUID(),
        tenant_id: tenantId,
        setting_key: key,
        value_plain: plainValue || '',
        value_encrypted: encryptedValue,
        created_at: new Date(),
        updated_at: new Date(),
      });
      await this.settingRepo.save(setting);
    }
  }
}
