import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@common/decorators/public.decorator';
import { ChatbotService } from './chatbot.service';
import { AskDto } from './dto/ask.dto';

const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // límite de la API de OpenAI

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

  @Public()
  @Post('transcribe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Transcribe audio a texto (OpenAI Whisper)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('audio', { limits: { fileSize: MAX_AUDIO_BYTES } }),
  )
  transcribe(@UploadedFile() audio: Express.Multer.File | undefined) {
    return this.chatbotService.transcribe(audio);
  }
}
