import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@common/decorators/public.decorator';
import { ChatbotService } from './chatbot.service';
import { AskDto } from './dto/ask.dto';

@ApiTags('chatbot')
@Controller('chatbot')
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  @Public()
  @Post('ask')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pregunta al asistente sobre incidencias registradas' })
  ask(@Body() dto: AskDto) {
    return this.chatbotService.ask(dto);
  }
}
