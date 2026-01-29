import {
  Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query,
  UseGuards, UseInterceptors,
} from '@nestjs/common';
import { AcademicYearService } from './academic-year.service';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { UpdateAcademicYearDto } from './dto/update-academic-year.dto';
import { ReqCtx } from 'src/common/context/request-context';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/roles/role.enum';
import { ETagInterceptor } from './interceptors/etag.interceptor';

@Controller('academic-years')
export class AcademicYearController {
  constructor(private readonly service: AcademicYearService) { }

  // Public endpoint - no authentication required
  @Get('public/all')
  async findAllPublic(@Query('activeOnly') activeOnly: string) {
    const onlyActive = activeOnly === 'true';
    return this.service.findAll(!onlyActive); // includeInactive = !onlyActive
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @UseInterceptors(ETagInterceptor)
  @Roles(Role.ADMIN)
  async create(@Body() dto: CreateAcademicYearDto, @ReqCtx() ctx) {
    return this.service.create(dto, ctx);
  }

  // Full endpoint for Management Page (includes all years with complete details)
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @UseInterceptors(ETagInterceptor)
  @Roles(Role.ADMIN, Role.TEACHER, Role.STUDENT)
  async findAll(@Query('activeOnly') activeOnly: string) {
    const onlyActive = activeOnly === 'true';
    return this.service.findAll(!onlyActive); // includeInactive = !onlyActive
  }

  @Get('current')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @UseInterceptors(ETagInterceptor)
  @Roles(Role.ADMIN, Role.TEACHER, Role.STUDENT)
  async getCurrent() {
    return this.service.getCurrent();
  }

  // Lightweight endpoint for Topbar dropdown (only active years with minimal fields)
  @Get('topbar/list')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER, Role.STUDENT)
  async findForTopbar(@ReqCtx() ctx) {
    return this.service.findForTopbar(ctx.userId, ctx.role);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @UseInterceptors(ETagInterceptor)
  @Roles(Role.ADMIN)
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @UseInterceptors(ETagInterceptor)
  @Roles(Role.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAcademicYearDto,
    @Headers('if-match') ifMatch: string | undefined,
    @ReqCtx() ctx,
  ) {
    return this.service.update(id, dto, ifMatch, ctx);
  }

  @Patch(':id/set-current')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @UseInterceptors(ETagInterceptor)
  @Roles(Role.ADMIN)
  async setCurrent(@Param('id') id: string, @ReqCtx() ctx) {
    return this.service.setCurrent(id, ctx);
  }

  @Patch(':id/activate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @UseInterceptors(ETagInterceptor)
  @Roles(Role.ADMIN)
  async setActive(@Param('id') id: string, @Body('active') active: boolean, @ReqCtx() ctx) {
    return this.service.setActive(id, active, ctx);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @UseInterceptors(ETagInterceptor)
  @Roles(Role.ADMIN)
  async remove(@Param('id') id: string, @ReqCtx() ctx) {
    return this.service.remove(id, ctx);
  }
}
