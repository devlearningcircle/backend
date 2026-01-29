import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StudentsService } from './students.service';
import { StudentsController } from './students.controller';
import { Student, StudentSchema } from './schemas/student.schema';
import { Section, SectionSchema } from '../sections/schemas/section.schema';
import { Class, ClassSchema } from '../classes/schemas/class.schema';
import { Enrollment, EnrollmentSchema } from './schemas/enrollment.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Student.name, schema: StudentSchema },
      { name: Section.name, schema: SectionSchema },
      { name: Class.name, schema: ClassSchema },
      { name: Enrollment.name, schema: EnrollmentSchema },
      // NOTE: AcademicYear model must be registered in its own module.
      // We access it dynamically in the service via connection.model('AcademicYear').
    ]),
  ],
  providers: [StudentsService],
  controllers: [StudentsController],
  exports: [StudentsService],
})
export class StudentsModule { }
