import { describe, expect, it } from "vitest";

import { calculateCompletion, canNestTask, isValidProgressPercent } from "@/lib/progress";

describe("workspace progress rules", () => {
  it("accepts manually entered progress from 0 through 100 percent", () => {
    expect(isValidProgressPercent(0)).toBe(true);
    expect(isValidProgressPercent(100)).toBe(true);
    expect(isValidProgressPercent(100.5)).toBe(false);
    expect(isValidProgressPercent(Number.NaN)).toBe(false);
  });

  it("allows subtasks only beneath a top-level task", () => {
    expect(canNestTask({ parent_task_id: null })).toBe(true);
    expect(canNestTask({ parent_task_id: "parent-task" })).toBe(false);
  });

  it("shows an empty completion rate when a topic has no tasks", () => {
    expect(calculateCompletion(0, 0)).toBe(0);
  });
});