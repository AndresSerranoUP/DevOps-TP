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
import { UsersService } from './users.service';
import { UserCreateDto, UserUpdateDto } from './users.dto';
import { ParseIdPipe } from '../common/http/parse-id.pipe';
import { PageQueryDto } from '../common/pagination/page-query.dto';
import { PlainText, HtmlContent } from '../common/http/plain-text.decorator';
import { CurrentUser } from '../auth/current-user.decorator';

@ApiTags('Users')
@Controller('api/User')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('GetAll')
  async getAll(@Query() query: PageQueryDto) {
    return this.usersService.getAll(query);
  }

  @Get('GetById/:id')
  async getById(@Param('id', ParseIdPipe) id: number) {
    return this.usersService.getById(id);
  }

  @Post('Create')
  @HttpCode(200)
  @PlainText()
  async create(@Body() body: UserCreateDto) {
    return this.usersService.create(body);
  }

  @Get('verify-email')
  async verifyEmail(
    @Query('email') email?: string,
    @Query('emailUser') legacyEmail?: string,
  ) {
    const targetEmail = email || legacyEmail || '';
    return this.usersService.verifyEmail(targetEmail);
  }

  @Put('PasswordVerification')
  @HttpCode(200)
  @PlainText()
  async passwordVerification(
    @Query('emailUser') emailUser?: string,
    @Query('email') email?: string,
  ) {
    const targetEmail = emailUser || email || '';
    return this.usersService.passwordVerification(targetEmail);
  }

  @Get('UpdatePassword/:id')
  @HtmlContent()
  async updatePassword(
    @Param('id', ParseIdPipe) id: number,
    @Query('password') password?: string,
    @Query('confirmPassword') confirmPassword?: string,
    @Query('idUser') legacyId?: string,
  ) {
    const targetId = legacyId ? Number(legacyId) : id;
    return this.usersService.updatePassword(targetId, password, confirmPassword);
  }

  @Put('Update')
  @PlainText()
  async update(
    @Body() body: UserUpdateDto,
    @CurrentUser('nameid') currentUserId?: number,
  ) {
    const id = body.idUser ?? currentUserId;
    if (!id || !Number.isInteger(id)) {
      throw new BadRequestException('Invalid id');
    }
    return this.usersService.update(id, body);
  }

  @Put('Update/:id')
  @PlainText()
  async updateById(
    @Param('id', ParseIdPipe) id: number,
    @Body() body: UserUpdateDto,
  ) {
    return this.usersService.update(id, body);
  }

  @Delete('Delete/:id')
  async delete(@Param('id', ParseIdPipe) id: number) {
    return this.usersService.delete(id);
  }
}
