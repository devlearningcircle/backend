import { Model } from 'mongoose';

/**
 * Generate a unique roll number for a student based on class and section
 * Format: CLASS-SECTION-NNN
 *
 * Examples:
 * - Class "1", Section "A": 1-A-001, 1-A-002, ...
 * - Class "10", Section "B": 10-B-001, 10-B-002, ...
 *
 * @param enrollmentModel - Enrollment Mongoose model
 * @param className - Name of the class (e.g., "1", "10", "12")
 * @param sectionName - Name of the section (e.g., "A", "B", "C")
 * @param academicYearId - Academic year ID
 * @returns Promise<string> - Generated roll number
 */
export async function generateRollNumber(
    enrollmentModel: Model<any>,
    className: string,
    sectionName: string,
    academicYearId: string,
): Promise<string> {
    // Normalize class and section names (uppercase for consistency)
    const normalizedClass = className.toUpperCase().trim();
    const normalizedSection = sectionName.toUpperCase().trim();
    const rollPrefix = `${normalizedClass}-${normalizedSection}-`;

    // Find the latest roll number for this class, section, and academic year
    const latestEnrollment = await enrollmentModel
        .findOne({
            academicYearId,
            rollNumber: { $regex: `^${rollPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` },
        })
        .sort({ rollNumber: -1 })
        .select('rollNumber')
        .lean() as { rollNumber?: string } | null;

    let nextNumber = 1;

    if (latestEnrollment?.rollNumber) {
        // Extract the number from the latest roll number (e.g., "10-A-042" -> 42)
        const match = latestEnrollment.rollNumber.match(/(\d+)$/);
        if (match) {
            nextNumber = parseInt(match[1], 10) + 1;
        }
    }

    // Format with leading zeros (e.g., 1 -> 001, 42 -> 042)
    const paddedNumber = String(nextNumber).padStart(3, '0');

    return `${rollPrefix}${paddedNumber}`;
}

/**
 * Generate a unique ID for a user (Student, Teacher, or Admin)
 * Format: PREFIX-YYYY-NNNN
 *
 * Examples:
 * - Student: STU-2025-0001
 * - Teacher: TCH-2025-0001
 * - Admin: ADM-2025-0001
 *
 * @param model - Mongoose model to query for existing IDs
 * @param prefix - Prefix for the ID (STU, TCH, or ADM)
 * @returns Promise<string> - Generated unique ID
 */
export async function generateUniqueId(
    model: Model<any>,
    prefix: 'STU' | 'TCH' | 'ADM',
): Promise<string> {
    const currentYear = new Date().getFullYear();
    const yearPattern = `${prefix}-${currentYear}-`;

    // Find the latest ID for this year and prefix
    const latestUser = await model
        .findOne({
            uniqueId: { $regex: `^${yearPattern}` },
        })
        .sort({ uniqueId: -1 })
        .select('uniqueId')
        .lean() as { uniqueId?: string } | null;

    let nextNumber = 1;

    if (latestUser?.uniqueId) {
        // Extract the number from the latest ID (e.g., "STU-2025-0042" -> 42)
        const match = latestUser.uniqueId.match(/(\d+)$/);
        if (match) {
            nextNumber = parseInt(match[1], 10) + 1;
        }
    }

    // Format with leading zeros (e.g., 1 -> 0001, 42 -> 0042)
    const paddedNumber = String(nextNumber).padStart(4, '0');

    return `${yearPattern}${paddedNumber}`;
}

/**
 * Generate unique student ID
 * @param studentModel - Student Mongoose model
 * @returns Promise<string> - Generated student ID (e.g., STU-2025-0001)
 */
export async function generateStudentId(studentModel: Model<any>): Promise<string> {
    return generateUniqueId(studentModel, 'STU');
}

/**
 * Generate unique teacher ID
 * @param teacherModel - Teacher Mongoose model
 * @returns Promise<string> - Generated teacher ID (e.g., TCH-2025-0001)
 */
export async function generateTeacherId(teacherModel: Model<any>): Promise<string> {
    return generateUniqueId(teacherModel, 'TCH');
}

/**
 * Generate unique admin ID
 * @param adminModel - Admin Mongoose model
 * @returns Promise<string> - Generated admin ID (e.g., ADM-2025-0001)
 */
export async function generateAdminId(adminModel: Model<any>): Promise<string> {
    return generateUniqueId(adminModel, 'ADM');
}
