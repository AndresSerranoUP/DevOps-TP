import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GenresService } from './genres.service';
import { ParseIdPipe } from '../common/http/parse-id.pipe';

@ApiTags('Genres')
@Controller('api/Genre')
export class GenresController {
  constructor(private readonly genresService: GenresService) {}

  @Get('GetAll')
  async getAll() {
    return this.genresService.getAll();
  }

  @Get('GetById/:id')
  async getById(@Param('id', ParseIdPipe) id: number) {
    return this.genresService.getById(id);
  }
}
