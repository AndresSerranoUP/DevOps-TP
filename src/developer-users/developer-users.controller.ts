import { Controller, Get, Post, Body, HttpCode } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DeveloperUsersService } from './developer-users.service';
import { DeveloperUserCreateDto } from './developer-users.dto';

@ApiTags('DeveloperUsers')
@Controller('api/DeveloperUser')
export class DeveloperUsersController {
  constructor(private readonly developerUsersService: DeveloperUsersService) {}

  @Get('GetAll')
  async getAll() {
    return this.developerUsersService.getAll();
  }

  @Post('Create')
  @HttpCode(200)
  async create(@Body() body: DeveloperUserCreateDto) {
    return this.developerUsersService.create(body);
  }
}
