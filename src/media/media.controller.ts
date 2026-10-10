import { Controller, Get, Post, Param, Body, HttpCode } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MediaService } from './media.service';
import { MediaCreateDto } from './media.dto';
import { ParseIdPipe } from '../common/http/parse-id.pipe';

@ApiTags('Media')
@Controller('api/Media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get('GetScreenshotsByGame/:id')
  async getScreenshotsByGame(@Param('id', ParseIdPipe) id: number) {
    return this.mediaService.getScreenshotsByGame(id);
  }

  @Get('GetRandomFeatured')
  async getRandomFeatured() {
    return this.mediaService.getRandomFeatured();
  }

  @Get('GetMediaByGame/:id')
  async getMediaByGame(@Param('id', ParseIdPipe) id: number) {
    return this.mediaService.getMediaByGame(id);
  }

  @Post('CreateMedia')
  @HttpCode(200)
  async createMedia(@Body() body: MediaCreateDto) {
    return this.mediaService.createMedia(body);
  }
}
