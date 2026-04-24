import { MEMORY, TYPE_WEIGHT, CAPS } from "../data/memory.js";
import { tokenize } from "./utils.js";

export function retrieveMemory(prompt, context) {
  const tokens = new Set(tokenize(prompt + " " + (context || "")));
  const rows = [];
  const categories = Object.keys(MEMORY);

  for (const cat of categories) {
    const scored = [];
    for (const row of MEMORY[cat]) {
      const overlap = (row.tags || []).reduce((n, tag) => {
        for (const part of String(tag)
          .toLowerCase()
          .replace(/_/g, " ")
          .split(/\s+/)) {
          if (tokens.has(part)) n++;
        }
        return n;
      }, 0);

      if (overlap === 0 && cat !== "founder_principles") continue;

      let score = overlap * TYPE_WEIGHT[cat];
      if (row.priority != null) score += (6 - row.priority) * 0.1;
      if (row.confidence != null) score += row.confidence * 0.15;
      if (cat === "failure_lessons" && row.severity != null)
        score += (6 - row.severity) * 0.05;

      scored.push({ row, score });
    }

    scored.sort((a, b) => b.score - a.score);

    for (const { row, score } of scored.slice(0, CAPS[cat])) {
      rows.push({
        memory_type: cat,
        id: `${cat}:${row.title}`,
        title: row.title,
        content: row.content,
        tags: row.tags || [],
        score: +score.toFixed(3),
      });
    }
  }

  return { rows };
}
