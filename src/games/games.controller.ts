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
import { GamesService } from './games.service';
import {
  GameCreateDto,
  GameUpdateDto,
  GameMinUpdateDto,
  RateDto,
  GameCreateResponseDto,
} from './games.dto';
import { ParseIdPipe } from '../common/http/parse-id.pipe';
import { PageQueryDto } from '../common/pagination/page-query.dto';
import { PlainText } from '../common/http/plain-text.decorator';
import { CurrentUser } from '../auth/current-user.decorator';

@ApiTags('Games')
@Controller('api/Game')
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Get('GetAll')
  async getAll(
    @Query() query: PageQueryDto,
    @CurrentUser('nameid') currentUserId?: number,
  ) {
    return this.gamesService.getAll(query, currentUserId);
  }

  @Get('GetById/:id')
  async getById(
    @Param('id', ParseIdPipe) id: number,
    @CurrentUser('nameid') currentUserId?: number,
  ) {
    return this.gamesService.getById(id, currentUserId);
  }

  @Post('Rate/:id')
  @HttpCode(200)
  @PlainText()
  async rate(
    @Param('id', ParseIdPipe) id: number,
    @Body() body: RateDto,
    @CurrentUser('nameid') currentUserId?: number,
  ) {
    return this.gamesService.rate(id, currentUserId, body.likes);
  }

  @Get('TEST')
  async test() {
    return this.gamesService.getTestRatings();
  }

  @Get('GetGamesByGenre/:id')
  async getByGenre(@Param('id', ParseIdPipe) id: number) {
    return this.gamesService.getByGenre(id);
  }

  @Get('GetGamesByName/:name')
  async getByName(@Param('name') name: string) {
    return this.gamesService.getByName(name);
  }

  @Get('GetGamesByDeveloper')
  async getByDeveloper(
    @Query('idDeveloper') idDeveloperRaw: string | undefined,
    @Query('IdDeveloper') legacyIdDeveloperRaw: string | undefined,
    @Query() query: PageQueryDto,
    @CurrentUser('nameid') currentUserId?: number,
  ) {
    const raw = idDeveloperRaw ?? legacyIdDeveloperRaw;
    if (!raw) {
      throw new BadRequestException({ Error: 'Debe ingrasar el id de un developer' });
    }
    const idDeveloper = Number(raw);
    if (!Number.isInteger(idDeveloper) || idDeveloper <= 0) {
      throw new BadRequestException({ Error: 'Debe ingrasar el id de un developer' });
    }
    return this.gamesService.getByDeveloper(idDeveloper, query, currentUserId);
  }

  @Post('Create')
  @HttpCode(200)
  async create(@Body() body: GameCreateDto): Promise<GameCreateResponseDto> {
    return this.gamesService.create(body);
  }

  @Put('Update')
  async updateLegacy(@Body() body: GameUpdateDto) {
    const id = body.idGame;
    if (!id || !Number.isInteger(id)) {
      throw new BadRequestException('Invalid id');
    }
    return this.gamesService.update(id, body);
  }

  @Put('Update/:id')
  async update(
    @Param('id', ParseIdPipe) id: number,
    @Body() body: GameUpdateDto,
  ) {
    return this.gamesService.update(id, body);
  }

  @Put('MinUpdate/:id')
  async minUpdate(
    @Param('id', ParseIdPipe) id: number,
    @Body() body: GameMinUpdateDto,
  ) {
    return this.gamesService.minUpdate(id, body);
  }

  @Delete('Delete/:id')
  async delete(@Param('id', ParseIdPipe) id: number) {
    return this.gamesService.delete(id);
  }
}
