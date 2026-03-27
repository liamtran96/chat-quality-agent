import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { Conversation } from '../entities/conversation.entity';
import { Message } from '../entities/message.entity';
import { Channel } from '../entities/channel.entity';
import { JobResult } from '../entities/job-result.entity';
import { JobRun } from '../entities/job-run.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, Message, Channel, JobResult, JobRun]),
  ],
  controllers: [ConversationsController],
  providers: [ConversationsService],
  exports: [ConversationsService],
})
export class ConversationsModule {}
