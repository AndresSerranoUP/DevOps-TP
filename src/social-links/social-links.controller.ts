import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SocialLinksService } from './social-links.service';
import { ParseIdPipe } from '../common/http/parse-id.pipe';

@ApiTags('SocialLinks')
@Controller('api/SocialLink')
export class SocialLinksController {
  constructor(private readonly socialLinksService: SocialLinksService) {}

  @Get('GetAll')
  async getAll() {
    return this.socialLinksService.getAll();
  }

  @Get('GetById/:id')
  async getById(@Param('id', ParseIdPipe) id: number) {
    return this.socialLinksService.getById(id);
  }
}
