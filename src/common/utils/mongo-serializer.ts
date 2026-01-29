/**
 * Helper utility to properly serialize MongoDB documents for JSON responses.
 * This is needed because .lean() returns plain objects with ObjectId instances
 * that need to be converted to strings.
 */

/**
 * Transforms a MongoDB document (or array of documents) to a JSON-safe format.
 * - Converts _id ObjectId to string
 * - Adds id field as an alias to _id
 * - Recursively handles nested ObjectId fields
 *
 * @param doc - Single document, array of documents, or null/undefined
 * @returns Transformed document(s) with proper string IDs
 */
export function toJSON<T = any>(doc: T): T;
export function toJSON<T = any>(doc: T[]): T[];
export function toJSON<T = any>(doc: T | T[] | null | undefined): T | T[] | null | undefined {
  if (!doc) return doc;

  if (Array.isArray(doc)) {
    return doc.map(item => toJSON(item)) as T[];
  }

  // Create a deep copy to avoid mutating the original
  const obj: any = {};

  // Copy all enumerable properties
  for (const key in doc) {
    if (Object.prototype.hasOwnProperty.call(doc, key)) {
      obj[key] = (doc as any)[key];
    }
  }

  // Transform _id to string and add as id
  if (obj._id) {
    const idStr = typeof obj._id === 'string' ? obj._id : obj._id.toString();
    obj._id = idStr;
    obj.id = idStr;
  }

  // Transform common reference fields that might be ObjectIds
  const refFields = ['classId', 'sectionId', 'teacherId', 'studentId', 'academicYearId', 'assignedTeacherId'];
  for (const field of refFields) {
    if (obj[field]) {
      if (typeof obj[field] === 'string') {
        // Already a string, keep it
        continue;
      } else if (typeof obj[field] === 'object' && obj[field].toString) {
        // ObjectId or similar, convert to string
        obj[field] = obj[field].toString();
      }
    }
  }

  return obj as T;
}
