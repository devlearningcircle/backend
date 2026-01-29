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
import { ClassesService } from './classes.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { Role } from '../common/roles/role.enum';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { MongoIdPipe } from 'src/common/pipes/mongo-id.pipe';

@Controller('classes')
export class ClassesController {
  constructor(private readonly classesService: ClassesService) { }

  // ---- Public (auth required) ----
  @Get('public/all')
  @UseGuards(JwtAuthGuard)
  getAllPublic() {
    return this.classesService.findAll();
  }

  // Convenience: resolve the next class by order (for promotions)
  @Get(':id/next')
  @UseGuards(JwtAuthGuard)
  getNext(@Param('id', new MongoIdPipe()) id: string) {
    return this.classesService.findNextClass(id);
  }

  // ---- Admin-only CRUD ----
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateClassDto) {
    return this.classesService.create(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  findAll() {
    return this.classesService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  findOne(@Param('id', new MongoIdPipe()) id: string) {
    return this.classesService.findOne(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  update(
    @Param('id', new MongoIdPipe()) id: string,
    @Body() dto: UpdateClassDto,
  ) {
    return this.classesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  delete(@Param('id', new MongoIdPipe()) id: string) {
    return this.classesService.delete(id);
  }
}
