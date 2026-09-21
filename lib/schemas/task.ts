import { z } from "zod";

// Shared by the task forms, Server Actions, and (from phase 3) AI output
// validation — one schema, three consumers (spec working conventions).

export const PRIORITIES = ["p1", "p2", "p3"] as const;
export const ESTIMATES = ["s", "m", "l", "xl"] as const;

export const taskBaseSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(300),
  description: z.string().max(20_000).optional().nullable(),
  assigneeId: z.string().min(1, "Assignee is required"),
  projectId: z.string().uuid().optional().nullable(),
  typeId: z.string().uuid(),
  requesterName: z.string().trim().max(200).optional().nullable(),
  requesterDepartment: z.string().trim().max(200).optional().nullable(),
  priority: z.enum(PRIORITIES),
  estimate: z.enum(ESTIMATES).optional().nullable(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .optional()
    .nullable(),
  labels: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
});

export const createTaskSchema = taskBaseSchema.extend({
  columnId: z.string().uuid(),
});

export const updateTaskSchema = taskBaseSchema.partial().extend({
  id: z.string().uuid(),
  blockedReason: z.string().trim().max(1000).optional().nullable(),
});

export const moveTaskSchema = z.object({
  id: z.string().uuid(),
  toColumnId: z.string().uuid(),
  position: z.number().finite(),
  blockedReason: z.string().trim().max(1000).optional().nullable(),
});

export const commentSchema = z.object({
  taskId: z.string().uuid(),
  parentId: z.string().uuid().optional().nullable(),
  body: z.string().trim().min(1, "Comment cannot be empty").max(5000),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type MoveTaskInput = z.infer<typeof moveTaskSchema>;
