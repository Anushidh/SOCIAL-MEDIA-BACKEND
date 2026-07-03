import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateNotificationPreferencesDto {
  @ApiPropertyOptional({ description: 'Receive like notifications' })
  @IsOptional()
  @IsBoolean()
  likeEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Receive comment notifications' })
  @IsOptional()
  @IsBoolean()
  commentEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Receive follow notifications' })
  @IsOptional()
  @IsBoolean()
  followEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Receive message notifications' })
  @IsOptional()
  @IsBoolean()
  messageEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Receive mention notifications' })
  @IsOptional()
  @IsBoolean()
  mentionEnabled?: boolean;
}
