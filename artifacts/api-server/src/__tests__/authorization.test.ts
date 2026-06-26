import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canAccess,
  canModify,
  canDelete,
  canExport,
  canGrade,
  PERMISSION_MATRIX,
  type AuthContext,
  type ResourceRecord,
} from "../lib/authorization.js";

const adminCtx: AuthContext = { userId: 1, role: "admin" };
const superAdminCtx: AuthContext = { userId: 1, role: "super_admin" };
const teacherCtx: AuthContext = { userId: 10, role: "teacher" };
const studentCtx: AuthContext = { userId: 20, role: "student" };
const noCtx: AuthContext = {};

const ownedByTeacher10: ResourceRecord = { teacher_account_id: 10, tenant_id: 10 };
const ownedByTeacher99: ResourceRecord = { teacher_account_id: 99, tenant_id: 99 };
const uploadedByUser10: ResourceRecord = { uploader_id: 10 };

describe("PERMISSION_MATRIX", () => {
  it("super_admin has all permissions", () => {
    const m = PERMISSION_MATRIX.super_admin;
    assert.equal(m.access, true);
    assert.equal(m.modify, true);
    assert.equal(m.delete, true);
    assert.equal(m.export, true);
    assert.equal(m.grade, true);
  });

  it("student cannot modify, delete, export or grade", () => {
    const m = PERMISSION_MATRIX.student;
    assert.equal(m.modify, false);
    assert.equal(m.delete, false);
    assert.equal(m.export, false);
    assert.equal(m.grade, false);
  });

  it("teacher has own-scoped permissions", () => {
    const m = PERMISSION_MATRIX.teacher;
    assert.equal(m.access, "own");
    assert.equal(m.modify, "own");
    assert.equal(m.delete, "own");
  });
});

describe("canAccess()", () => {
  it("admin always gets access", async () => {
    assert.equal(await canAccess(adminCtx, "exam"), true);
    assert.equal(await canAccess(adminCtx, "student", ownedByTeacher99), true);
  });

  it("super_admin always gets access", async () => {
    assert.equal(await canAccess(superAdminCtx, "grade", ownedByTeacher99), true);
  });

  it("teacher gets access to own resource", async () => {
    assert.equal(await canAccess(teacherCtx, "exam", ownedByTeacher10), true);
  });

  it("teacher denied access to another teacher's resource without tenant match", async () => {
    assert.equal(await canAccess(teacherCtx, "exam", ownedByTeacher99), false);
  });

  it("empty context is denied", async () => {
    assert.equal(await canAccess(noCtx, "exam", ownedByTeacher10), false);
  });
});

describe("canModify()", () => {
  it("admin can modify anything", async () => {
    assert.equal(await canModify(adminCtx, "exam", ownedByTeacher99), true);
    assert.equal(await canModify(adminCtx, "grade"), true);
  });

  it("teacher can modify own resource", async () => {
    assert.equal(await canModify(teacherCtx, "exam", ownedByTeacher10), true);
  });

  it("teacher cannot modify another teacher's resource", async () => {
    assert.equal(await canModify(teacherCtx, "exam", ownedByTeacher99), false);
  });

  it("student cannot modify exams", async () => {
    assert.equal(await canModify(studentCtx, "exam", ownedByTeacher10), false);
  });
});

describe("canDelete()", () => {
  it("admin can delete anything", async () => {
    assert.equal(await canDelete(adminCtx, "exam", ownedByTeacher99), true);
    assert.equal(await canDelete(adminCtx, "user"), true);
  });

  it("teacher can delete own resource", async () => {
    assert.equal(await canDelete(teacherCtx, "exam", ownedByTeacher10), true);
  });

  it("teacher cannot delete another teacher's resource", async () => {
    assert.equal(await canDelete(teacherCtx, "exam", ownedByTeacher99), false);
  });

  it("no resource provided returns false for non-admin", async () => {
    assert.equal(await canDelete(teacherCtx, "exam"), false);
  });

  it("student cannot delete", async () => {
    assert.equal(await canDelete(studentCtx, "exam", ownedByTeacher10), false);
  });
});

describe("canExport()", () => {
  it("admin can export anything", async () => {
    assert.equal(await canExport(adminCtx, "student", ownedByTeacher99), true);
    assert.equal(await canExport(adminCtx, "audit"), true);
  });

  it("teacher can export own upload", async () => {
    assert.equal(await canExport(teacherCtx, "upload", uploadedByUser10), true);
  });

  it("teacher cannot export another user's upload", async () => {
    const othersUpload: ResourceRecord = { uploader_id: 99 };
    assert.equal(await canExport(teacherCtx, "upload", othersUpload), false);
  });

  it("student cannot export grade data", async () => {
    assert.equal(await canExport(studentCtx, "grade", ownedByTeacher10), false);
  });
});

describe("canGrade()", () => {
  it("admin can grade anything", async () => {
    assert.equal(await canGrade(adminCtx, "exam", ownedByTeacher99), true);
    assert.equal(await canGrade(adminCtx, "homework"), true);
  });

  it("teacher can grade own exam", async () => {
    assert.equal(await canGrade(teacherCtx, "exam", ownedByTeacher10), true);
  });

  it("teacher cannot grade another teacher's exam", async () => {
    assert.equal(await canGrade(teacherCtx, "exam", ownedByTeacher99), false);
  });

  it("student cannot grade exams", async () => {
    assert.equal(await canGrade(studentCtx, "exam", ownedByTeacher10), false);
  });
});

describe("Tenant isolation", () => {
  it("admin bypasses all tenant checks", async () => {
    const crossTenantResource: ResourceRecord = { teacher_account_id: 999, tenant_id: 999 };
    assert.equal(await canAccess(adminCtx, "exam", crossTenantResource), true);
    assert.equal(await canModify(adminCtx, "exam", crossTenantResource), true);
    assert.equal(await canDelete(adminCtx, "exam", crossTenantResource), true);
  });

  it("teacher is denied cross-tenant access", async () => {
    const crossTenantResource: ResourceRecord = { teacher_account_id: 777, tenant_id: 777 };
    assert.equal(await canAccess(teacherCtx, "exam", crossTenantResource), false);
    assert.equal(await canModify(teacherCtx, "exam", crossTenantResource), false);
  });
});
