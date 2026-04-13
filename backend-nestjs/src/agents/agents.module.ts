import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { Conversation } from '../entities/conversation.entity';
import { Message } from '../entities/message.entity';
import { JobResult } from '../entities/job-result.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Conversation, Message, JobResult])],
  controllers: [AgentsController],
  providers: [AgentsService],
})
export class AgentsModule {}
