import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { ParseIdPipe } from '../common/http/parse-id.pipe';

@ApiTags('Roles')
@Controller('api/Role')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('GetAll')
  async getAll() {
    return this.rolesService.getAll();
  }

  @Get('GetById/:id')
  async getById(@Param('id', ParseIdPipe) id: number) {
    return this.rolesService.getById(id);
  }
}
