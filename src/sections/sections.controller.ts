import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SectionsService } from './sections.service';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { Role } from '../common/roles/role.enum';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { MongoIdPipe } from 'src/common/pipes/mongo-id.pipe';

@Controller('sections')
export class SectionsController {
  constructor(private readonly sectionsService: SectionsService) { }

  /* ---------- Authenticated public helpers (non-admin) ---------- */

  // Keep static routes BEFORE any dynamic ':id'
  @Get('public/all')
  @UseGuards(JwtAuthGuard)
  getAllPublic() {
    return this.sectionsService.findAll();
  }

  @Get('public/by-class')
  @UseGuards(JwtAuthGuard)
  getSectionsByClass(@Query('classId') classId: string) {
    return this.sectionsService.findByClass(classId);
  }

  /* ------------------------- Admin-only CRUD ------------------------- */

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateSectionDto) {
    return this.sectionsService.create(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  findAll() {
    return this.sectionsService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  findOne(@Param('id', new MongoIdPipe()) id: string) {
    return this.sectionsService.findOne(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  update(
    @Param('id', new MongoIdPipe()) id: string,
    @Body() dto: UpdateSectionDto,
  ) {
    return this.sectionsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  delete(@Param('id', new MongoIdPipe()) id: string) {
    return this.sectionsService.delete(id);
  }
}
