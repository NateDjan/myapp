import curriculum from "../content/curriculum.fr.json";

const GRADE_ALIASES: Record<string, string> = {
  "6ème": "6e",
  "6eme": "6e",
  "5ème": "5e",
  "5eme": "5e",
  "4ème": "4e",
  "4eme": "4e",
  "3ème": "3e",
  "3eme": "3e",
};

export function subjectsForGrade(grade: string): string[] {
  const key = GRADE_ALIASES[grade] || grade;
  const row = curriculum.grades.find((g) => g.grade === key);
  if (!row?.subjects) return ["Francais", "Maths"];
  return Object.keys(row.subjects).sort((a, b) => a.localeCompare(b, "fr"));
}
