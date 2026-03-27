import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../auth/tenant.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser, Roles, TenantId, TenantRole } from '../auth/decorators';
import { UsersService } from './users.service';
import { InviteUserDto } from './dto/invite-user.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Controller('api/v1/tenants/:tenantId/users')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  listUsers(@TenantId() tenantId: string) {
    return this.usersService.listUsers(tenantId);
  }

  @Post('invite')
  @Roles('owner', 'admin')
  inviteUser(@TenantId() tenantId: string, @Body() dto: InviteUserDto) {
    return this.usersService.inviteUser(tenantId, dto);
  }

  @Put(':userId/role')
  @Roles('owner')
  updateUserRole(
    @TenantId() tenantId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: { user_id: string },
    @TenantRole() currentRole: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.usersService.updateUserRole(
      tenantId,
      userId,
      user.user_id,
      currentRole,
      dto,
    );
  }

  @Put(':userId/reset-password')
  @Roles('owner', 'admin')
  resetUserPassword(
    @TenantId() tenantId: string,
    @Param('userId') userId: string,
    @Body() dto: ResetPasswordDto,
  ) {
    return this.usersService.resetUserPassword(tenantId, userId, dto);
  }

  @Delete(':userId')
  @Roles('owner')
  removeUser(
    @TenantId() tenantId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: { user_id: string },
  ) {
    return this.usersService.removeUser(tenantId, userId, user.user_id);
  }
}
