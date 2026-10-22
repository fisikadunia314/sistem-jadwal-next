export const ENTITIES: Record<string, { table: string; cols: string[] }> = {
  teachers: { table: "teachers", cols: ["code", "name", "max_jp_day", "max_jp_week", "color_hex"] },
  subjects: { table: "subjects", cols: ["code", "name", "prefer_pagi"] },
  classes: { table: "classes", cols: ["name"] },
  assignments: { table: "assignments", cols: ["teacher_id", "subject_id", "class_id", "jp_week", "max_jp_day"] },
};
