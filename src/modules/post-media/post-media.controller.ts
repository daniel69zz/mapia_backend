import {
  BadRequestException,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { PostMedia } from './entities/post-media.entity';
import { PostMediaService } from './post-media.service';

const MAX_MEDIA_BYTES = 25 * 1024 * 1024; // 25 MB

@ApiTags('post-media')
@ApiBearerAuth()
@Controller()
export class PostMediaController {
  constructor(private readonly postMediaService: PostMediaService) {}

  @Post('posts/:postId/media')
  @ApiOperation({ summary: 'Adjuntar imagen/video a una publicación' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_MEDIA_BYTES } }))
  add(
    @Param('postId', ParseUUIDPipe) postId: string,
    @CurrentUser('userId') userId: string,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<PostMedia> {
    if (!file) {
      throw new BadRequestException('Archivo "file" requerido');
    }
    return this.postMediaService.addToPost(postId, userId, file);
  }

  @Delete('post-media/:mediaId')
  @ApiOperation({ summary: 'Eliminar media' })
  remove(
    @Param('mediaId', ParseUUIDPipe) mediaId: string,
    @CurrentUser('userId') userId: string,
  ): Promise<{ success: true }> {
    return this.postMediaService.remove(mediaId, userId);
  }
}
