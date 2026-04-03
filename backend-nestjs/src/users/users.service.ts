import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserTenant } from '../entities';
import { newUUID, validatePasswordComplexity } from '../common/helpers';
import { InviteUserDto } from './dto/invite-user.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

export interface TenantUserResponse {
  user_id: string;
  email: string;
  name: string;
  role: string;
  permissions: string;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserTenant)
    private readonly userTenantRepo: Repository<UserTenant>,
  ) {}

  async listUsers(tenantId: string): Promise<TenantUserResponse[]> {
    const rows = await this.userTenantRepo
      .createQueryBuilder('ut')
      .innerJoin('users', 'u', 'u.id = ut.user_id')
      .select('u.id', 'user_id')
      .addSelect('u.email', 'email')
      .addSelect('u.name', 'name')
      .addSelect('ut.role', 'role')
      .addSelect('ut.permissions', 'permissions')
      .where('ut.tenant_id = :tenantId', { tenantId })
      .getRawMany();

    return rows;
  }

  async inviteUser(
    tenantId: string,
    dto: InviteUserDto,
  ): Promise<TenantUserResponse> {
    const error = validatePasswordComplexity(dto.password);
    if (error) {
      throw new BadRequestException({ error: 'weak_password', message: error });
    }

    let user = await this.userRepo.findOne({ where: { email: dto.email } });
    if (!user) {
      const hash = await bcrypt.hash(dto.password, 10);
      user = this.userRepo.create({
        id: newUUID(),
        email: dto.email,
        name: dto.name,
        password_hash: hash,
        language: 'vi',
        created_at: new Date(),
        updated_at: new Date(),
      });
      try {
        await this.userRepo.save(user);
      } catch {
        throw new BadRequestException('failed_to_create_user');
      }
    }

    const existing = await this.userTenantRepo.findOne({
      where: { user_id: user.id, tenant_id: tenantId },
    });
    if (existing) {
      throw new ConflictException('user_already_in_tenant');
    }

    const ut = this.userTenantRepo.create({
      user_id: user.id,
      tenant_id: tenantId,
      role: dto.role,
      permissions: dto.permissions || '',
    });
    await this.userTenantRepo.save(ut);

    return {
      user_id: user.id,
      email: user.email,
      name: user.name,
      role: dto.role,
      permissions: dto.permissions || '',
    };
  }

  async updateUserRole(
    tenantId: string,
    userId: string,
    currentUserId: string,
    currentRole: string,
    dto: UpdateRoleDto,
  ) {
    if (userId === currentUserId) {
      throw new BadRequestException('cannot_change_own_role');
    }

    const targetUT = await this.userTenantRepo.findOne({
      where: { user_id: userId, tenant_id: tenantId },
    });
    if (!targetUT) {
      throw new NotFoundException('user_not_in_tenant');
    }

    if (
      currentRole === 'admin' &&
      (targetUT.role === 'owner' || targetUT.role === 'admin')
    ) {
      throw new ForbiddenException('admin_cannot_manage_owner_or_admin');
    }

    const updates: Partial<UserTenant> = { role: dto.role };
    if (dto.permissions) {
      updates.permissions = dto.permissions;
    }

    await this.userTenantRepo.update(
      { user_id: userId, tenant_id: tenantId },
      updates,
    );

    return { message: 'role_updated' };
  }

  async resetUserPassword(
    tenantId: string,
    userId: string,
    dto: ResetPasswordDto,
  ) {
    const ut = await this.userTenantRepo.findOne({
      where: { user_id: userId, tenant_id: tenantId },
    });
    if (!ut) {
      throw new NotFoundException('user_not_in_tenant');
    }

    const error = validatePasswordComplexity(dto.password);
    if (error) {
      throw new BadRequestException({ error: 'weak_password', message: error });
    }

    const hash = await bcrypt.hash(dto.password, 10);
    const result = await this.userRepo
      .createQueryBuilder()
      .update(User)
      .set({
        password_hash: hash,
        token_version: () => 'token_version + 1',
      })
      .where('id = :userId', { userId })
      .execute();

    if (result.affected === 0) {
      throw new InternalServerErrorException('password_reset_failed');
    }

    this.logger.log(`password reset: user=${userId} tenant=${tenantId}`);
    return { message: 'password_reset' };
  }

  async removeUser(
    tenantId: string,
    userId: string,
    currentUserId: string,
  ) {
    if (userId === currentUserId) {
      throw new BadRequestException('cannot_remove_self');
    }

    const result = await this.userTenantRepo.delete({
      user_id: userId,
      tenant_id: tenantId,
    });

    if (result.affected === 0) {
      throw new NotFoundException('user_not_in_tenant');
    }

    return { message: 'user_removed' };
  }
}
