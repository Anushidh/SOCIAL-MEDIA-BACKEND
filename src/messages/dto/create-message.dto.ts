import { IsString, IsUUID, MaxLength, IsOptional, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMessageDto {
  @ApiPropertyOptional({ example: 'Hey, how are you?' })
  @ValidateIf((o) => !o.mediaUrl)
  @IsString()
  @MaxLength(2000)
  content?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mediaType?: string;

  @ApiProperty({ description: 'Conversation ID' })
  @IsUUID()
  conversationId: string;
}
