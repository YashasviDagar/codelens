import { z } from "zod";

export const DiffFileStatusSchema = z.enum(["added", "modified", "deleted", "renamed"]);
export type DiffFileStatus = z.infer<typeof DiffFileStatusSchema>;

export const DiffHunkLineSchema = z.object({
  type: z.enum(["context", "added", "removed"]),
  // Line number in the "before" file (for context/removed)
  oldLine: z.number().int().nullable().optional(),
  // Line number in the "after" file (for context/added)
  newLine: z.number().int().nullable().optional(),
  content: z.string(),
});
export type DiffHunkLine = z.infer<typeof DiffHunkLineSchema>;

export const DiffHunkSchema = z.object({
  oldStart: z.number().int(),
  oldLines: z.number().int(),
  newStart: z.number().int(),
  newLines: z.number().int(),
  lines: z.array(DiffHunkLineSchema),
});
export type DiffHunk = z.infer<typeof DiffHunkSchema>;

export const DiffFileSchema = z.object({
  path: z.string(),
  oldPath: z.string().optional(),
  status: DiffFileStatusSchema,
  additions: z.number().int(),
  deletions: z.number().int(),
  hunks: z.array(DiffHunkSchema),
  language: z.string().optional(),
});
export type DiffFile = z.infer<typeof DiffFileSchema>;

export const ParsedDiffSchema = z.object({
  files: z.array(DiffFileSchema),
  totalAdditions: z.number().int(),
  totalDeletions: z.number().int(),
});
export type ParsedDiff = z.infer<typeof ParsedDiffSchema>;

// A changed function detected by the AST layer, mapped to diff lines
export interface ChangedSymbol {
  name: string;
  kind: "function" | "method" | "class";
  file: string;
  startLine: number;
  endLine: number;
  // true if any hunk overlap touches the symbol body
  touched: boolean;
}
