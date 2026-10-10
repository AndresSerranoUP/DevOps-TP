import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DevelopersService } from './developers.service';
import { DeveloperCreateDto, DeveloperUpdateDto } from './developers.dto';
import { ParseIdPipe } from '../common/http/parse-id.pipe';
import { PageQueryDto } from '../common/pagination/page-query.dto';

@ApiTags('Developers')
@Controller('api/Developer')
export class DevelopersController {
  constructor(private readonly developersService: DevelopersService) {}

  @Get('GetAll')
  async getAll(@Query() query: PageQueryDto) {
    return this.developersService.getAll(query);
  }

  @Get('GetById/:id')
  async getById(@Param('id', ParseIdPipe) id: number) {
    return this.developersService.getById(id);
  }

  @Get('GetDevelopersByName/:name')
  async getByName(@Param('name') name: string) {
    return this.developersService.getByName(name);
  }

  @Post('Create')
  @HttpCode(200)
  async create(@Body() body: DeveloperCreateDto) {
    return this.developersService.create(body);
  }

  @Put('Update')
  async updateLegacy(@Body() body: DeveloperUpdateDto) {
    const id = body.idDeveloper;
    if (!id || !Number.isInteger(id)) {
      throw new BadRequestException('Invalid id');
    }
    return this.developersService.update(id, body);
  }

  @Put('Update/:id')
  async update(
    @Param('id', ParseIdPipe) id: number,
    @Body() body: DeveloperUpdateDto,
  ) {
    return this.developersService.update(id, body);
  }

  @Delete('Delete/:id')
  async delete(@Param('id', ParseIdPipe) id: number) {
    return this.developersService.delete(id);
  }
}
