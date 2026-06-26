import { pool } from "@workspace/db";

export type ResourceType =
  | "student"
  | "assessment"
  | "submission"
  | "coursework"
  | "oral_recording"
  | "exam"
  | "course"
  | "course_unit"
  | "course_topic"
  | "question"
  | "recording"
  | "subject"
  | "resource"
  | "upload"
  | "enrollment"
  | "grade"
  | "report"
  | "gradebook_export";

export type Permission =
  | "access"
  | "modify"
  | "delete"
  | "export"
  | "grade";

export interface PermissionContext {
  userId: number;
  role: string;
  tenantId?: number;
}

export const ROLE_HIERARCHY: Record<string, number> = {
  super_admin: 100,
  admin: 80,
  teacher: 40,
  assistant: 30,
  parent: 20,
  student: 10,
};

export function isAdmin(ctx: PermissionContext): boolean {
  return ctx.role === "admin" || ctx.role === "super_admin";
}

export function isTeacherOrAdmin(ctx: PermissionContext): boolean {
  return ctx.role === "teacher" || isAdmin(ctx);
}

export function hasMinRole(ctx: PermissionContext, minRole: string): boolean {
  return (ROLE_HIERARCHY[ctx.role] ?? 0) >= (ROLE_HIERARCHY[minRole] ?? 0);
}

async function getAssessmentTeacher(assessmentId: string | number): Promise<number | null> {
  const { rows } = await pool.query(
    "SELECT teacher_id FROM assessments WHERE id=$1 LIMIT 1",
    [assessmentId]
  );
  return rows[0]?.teacher_id ?? null;
}

async function getSubmissionTeacher(submissionId: string | number): Promise<number | null> {
  const { rows } = await pool.query(
    `SELECT a.teacher_id FROM assessment_submissions asub
     JOIN assessments a ON a.id = asub.assessment_id
     WHERE asub.id=$1 LIMIT 1`,
    [submissionId]
  );
  return rows[0]?.teacher_id ?? null;
}

async function getCourseTeacher(courseId: string | number): Promise<number | null> {
  const { rows } = await pool.query(
    "SELECT teacher_account_id FROM teacher_courses WHERE id=$1 LIMIT 1",
    [courseId]
  );
  return rows[0]?.teacher_account_id ?? null;
}

async function getStudentTeacher(studentId: string | number): Promise<number | null> {
  const { rows } = await pool.query(
    "SELECT teacher_account_id FROM students WHERE id=$1 LIMIT 1",
    [studentId]
  );
  return rows[0]?.teacher_account_id ?? null;
}

async function getUploadOwner(filename: string): Promise<{ uploaderId: number; tenantId: number | null } | null> {
  const { rows } = await pool.query(
    "SELECT uploader_id, tenant_id FROM upload_registry WHERE filename=$1 LIMIT 1",
    [filename]
  );
  if (!rows.length) return null;
  return { uploaderId: rows[0].uploader_id, tenantId: rows[0].tenant_id };
}

export async function canAccess(
  ctx: PermissionContext,
  resource: ResourceType,
  resourceId: string | number
): Promise<boolean> {
  if (isAdmin(ctx)) return true;

  switch (resource) {
    case "student": {
      if (ctx.role === "student") {
        const { rows } = await pool.query(
          "SELECT id FROM students WHERE id=$1 AND account_id=$2 LIMIT 1",
          [resourceId, ctx.userId]
        );
        return rows.length > 0;
      }
      if (ctx.role === "teacher") {
        const teacherId = await getStudentTeacher(resourceId);
        return teacherId === ctx.userId;
      }
      if (ctx.role === "parent") {
        const { rows } = await pool.query(
          `SELECT id FROM guardian_links
           WHERE parent_account_id=$1 AND student_id=$2 AND status='active' LIMIT 1`,
          [ctx.userId, resourceId]
        );
        return rows.length > 0;
      }
      return false;
    }

    case "submission":
    case "grade": {
      const teacherId = await getSubmissionTeacher(resourceId);
      if (ctx.role === "teacher") return teacherId === ctx.userId;
      if (ctx.role === "student") {
        const { rows } = await pool.query(
          "SELECT id FROM assessment_submissions WHERE id=$1 AND student_id=(SELECT id FROM students WHERE account_id=$2 LIMIT 1) LIMIT 1",
          [resourceId, ctx.userId]
        );
        return rows.length > 0;
      }
      return false;
    }

    case "assessment":
    case "exam": {
      if (ctx.role === "teacher") {
        const teacherId = await getAssessmentTeacher(resourceId);
        return teacherId === ctx.userId;
      }
      return ctx.role === "student";
    }

    case "course": {
      const teacherId = await getCourseTeacher(resourceId);
      return teacherId === ctx.userId;
    }

    case "upload": {
      const owner = await getUploadOwner(String(resourceId));
      if (!owner) return false;
      return owner.uploaderId === ctx.userId;
    }

    default:
      return isTeacherOrAdmin(ctx);
  }
}

export async function canModify(
  ctx: PermissionContext,
  resource: ResourceType,
  resourceId: string | number
): Promise<boolean> {
  if (isAdmin(ctx)) return true;

  switch (resource) {
    case "submission":
    case "grade":
    case "coursework": {
      const teacherId = await getSubmissionTeacher(resourceId);
      return ctx.role === "teacher" && teacherId === ctx.userId;
    }

    case "assessment":
    case "exam": {
      if (ctx.role !== "teacher") return false;
      const teacherId = await getAssessmentTeacher(resourceId);
      return teacherId === ctx.userId;
    }

    case "course":
    case "course_unit":
    case "course_topic": {
      if (ctx.role !== "teacher") return false;
      const teacherId = await getCourseTeacher(resourceId);
      return teacherId === ctx.userId;
    }

    case "student": {
      if (ctx.role !== "teacher") return false;
      const teacherId = await getStudentTeacher(resourceId);
      return teacherId === ctx.userId;
    }

    default:
      return ctx.role === "teacher";
  }
}

export async function canDelete(
  ctx: PermissionContext,
  resource: ResourceType,
  resourceId: string | number
): Promise<boolean> {
  if (isAdmin(ctx)) return true;
  return canModify(ctx, resource, resourceId);
}

export async function canExport(
  ctx: PermissionContext,
  resource: ResourceType,
  ownerId?: number
): Promise<boolean> {
  if (isAdmin(ctx)) return true;

  switch (resource) {
    case "gradebook_export":
    case "report":
      return ctx.role === "teacher" && (!ownerId || ownerId === ctx.userId);

    case "student":
      return ctx.role === "student" || ctx.role === "teacher";

    default:
      return isTeacherOrAdmin(ctx);
  }
}

export async function canGrade(
  ctx: PermissionContext,
  resource: ResourceType,
  resourceId: string | number
): Promise<boolean> {
  if (isAdmin(ctx)) return true;
  if (ctx.role !== "teacher") return false;

  switch (resource) {
    case "submission": {
      const teacherId = await getSubmissionTeacher(resourceId);
      return teacherId === ctx.userId;
    }
    case "assessment":
    case "exam": {
      const teacherId = await getAssessmentTeacher(resourceId);
      return teacherId === ctx.userId;
    }
    default:
      return true;
  }
}

export const PERMISSION_MATRIX: Record<string, Record<string, string[]>> = {
  super_admin: {
    student: ["access", "modify", "delete", "export"],
    assessment: ["access", "modify", "delete", "grade", "export"],
    submission: ["access", "modify", "delete", "grade", "export"],
    course: ["access", "modify", "delete"],
    upload: ["access", "delete"],
    enrollment: ["access", "modify", "delete"],
    report: ["access", "export"],
    gradebook_export: ["access", "export"],
  },
  admin: {
    student: ["access", "modify", "delete", "export"],
    assessment: ["access", "modify", "delete", "grade", "export"],
    submission: ["access", "modify", "delete", "grade", "export"],
    course: ["access", "modify", "delete"],
    upload: ["access", "delete"],
    enrollment: ["access", "modify", "delete"],
    report: ["access", "export"],
    gradebook_export: ["access", "export"],
  },
  teacher: {
    student: ["access (own)", "modify (own)", "delete (own)", "export (own)"],
    assessment: ["access (own)", "modify (own)", "delete (own)", "grade (own)", "export (own)"],
    submission: ["access (own)", "modify (own)", "grade (own)"],
    course: ["access (own)", "modify (own)", "delete (own)"],
    upload: ["access (own)"],
    enrollment: ["access (own)", "modify (own)"],
    report: ["access (own)", "export (own)"],
    gradebook_export: ["access (own)", "export (own)"],
  },
  assistant: {
    student: ["access (assigned courses only)"],
    assessment: ["access (assigned courses only)"],
    submission: ["access (assigned courses only)"],
    course: ["access (assigned)"],
    upload: [],
    enrollment: ["access (assigned)"],
    report: [],
    gradebook_export: [],
  },
  parent: {
    student: ["access (linked child)"],
    assessment: [],
    submission: ["access (linked child)"],
    course: [],
    upload: [],
    enrollment: ["access (linked child)"],
    report: ["access (linked child)"],
    gradebook_export: [],
  },
  student: {
    student: ["access (self)"],
    assessment: ["access (enrolled)"],
    submission: ["access (self)"],
    course: ["access (enrolled)"],
    upload: [],
    enrollment: ["access (self)"],
    report: ["access (self)"],
    gradebook_export: [],
  },
};
