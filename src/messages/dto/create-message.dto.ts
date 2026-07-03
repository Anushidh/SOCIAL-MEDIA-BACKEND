import { IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMessageDto {
  @ApiProperty({ example: 'Hey, how are you?' })
  @IsString()
  @MaxLength(2000)
  content: string;

  @ApiProperty({ description: 'Conversation ID' })
  @IsUUID()
  conversationId: string;
}
