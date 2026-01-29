import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AcademicYear, AcademicYearSchema } from './academic-year.schema';
import { AcademicYearController } from './academic-year.controller';
import { AcademicYearService } from './academic-year.service';
import { AcademicYearRepository } from './academic-year.repository';
import { AuditModule } from 'src/audit/audit.module';
import { Student, StudentSchema } from 'src/students/schemas/student.schema';

@Module({
  imports: [
    AuditModule,
    MongooseModule.forFeature([
      { name: AcademicYear.name, schema: AcademicYearSchema },
      { name: Student.name, schema: StudentSchema },
    ]),
  ],
  controllers: [AcademicYearController],
  providers: [AcademicYearService, AcademicYearRepository],
  exports: [AcademicYearService],
})
export class AcademicYearModule { }
