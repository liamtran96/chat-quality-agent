import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DemoController } from './demo.controller';
import { DemoService } from './demo.service';
import { Tenant } from '../entities/tenant.entity';
import { Channel } from '../entities/channel.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant, Channel])],
  controllers: [DemoController],
  providers: [DemoService],
})
export class DemoModule {}
