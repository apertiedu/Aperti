import { pgTable, serial, integer, text, bigint, timestamp, index } from "drizzle-orm/pg-core";

export const uploadRegistryTable = pgTable("upload_registry", {
  id: serial("id").primaryKey(),
  uploaderId: integer("uploader_id").notNull(),
  tenantId: integer("tenant_id"),
  filename: text("filename").notNull().unique(),
  originalFilename: text("original_filename"),
  mimeType: text("mime_type"),
  size: bigint("size", { mode: "number" }),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("upload_registry_filename_idx").on(t.filename),
  index("upload_registry_uploader_idx").on(t.uploaderId),
  index("upload_registry_tenant_idx").on(t.tenantId),
]);

export type UploadRegistry = typeof uploadRegistryTable.$inferSelect;
export type NewUploadRegistry = typeof uploadRegistryTable.$inferInsert;
