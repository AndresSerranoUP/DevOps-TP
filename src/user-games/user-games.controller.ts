import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserGamesService } from './user-games.service';
import { UserGamesCreateDto } from './user-games.dto';
import { JwtGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ParseIdPipe } from '../common/http/parse-id.pipe';

@ApiTags('UserGames')
@Controller('api/UserGames')
export class UserGamesController {
  constructor(private readonly userGamesService: UserGamesService) {}

  @ApiBearerAuth()
  @UseGuards(JwtGuard)
  @HttpCode(200)
  @Post()
  async addGame(
    @CurrentUser('nameid') userId: number | undefined,
    @Body() body: UserGamesCreateDto,
  ): Promise<boolean> {
    if (!userId || !Number.isInteger(userId) || userId <= 0) {
      throw new UnauthorizedException();
    }
    return this.userGamesService.addGame(userId, body);
  }

  @Get('GetUserLibrary/:userId')
  async getUserLibrary(@Param('userId', ParseIdPipe) userId: number) {
    return this.userGamesService.getUserLibrary(userId);
  }
}
