import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';

@Injectable()
export class MentionsService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Extract @mentions from content and send notifications.
   */
  async processMentions(
    content: string,
    actorId: string,
    entityId: string,
    entityType: string,
  ): Promise<string[]> {
    const usernames = this.extractMentions(content);

    if (usernames.length === 0) {
      return [];
    }

    const mentionedUserIds: string[] = [];

    for (const username of usernames) {
      const user = await this.usersRepository.findOne({
        where: { username, isActive: true },
      });

      if (user && user.id !== actorId) {
        mentionedUserIds.push(user.id);

        // Send mention notification
        await this.notificationsService.create({
          type: NotificationType.MENTION,
          actorId,
          recipientId: user.id,
          entityId,
          entityType,
        });
      }
    }

    return mentionedUserIds;
  }

  /**
   * Extract @usernames from text content.
   */
  private extractMentions(content: string): string[] {
    const regex = /@([a-zA-Z0-9_]+)/g;
    const matches = content.match(regex);

    if (!matches) {
      return [];
    }

    // Remove @, deduplicate
    const unique = [...new Set(matches.map((m) => m.slice(1)))];
    return unique.slice(0, 20); // Limit to 20 mentions per content
  }
}
