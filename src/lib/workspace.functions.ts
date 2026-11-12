import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { canNestTask, isValidProgressPercent } from "@/lib/progress";

const idSchema = z.string().uuid();
const textName = z.string().trim().min(1).max(160);
const emptySafeText = z.string().trim().max(4000);
const themeSchema = z.enum(["mint", "coral", "blue", "gold", "rose", "lime"]);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const getWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [profileResult, interestsResult, topicsResult, tasksResult, progressResult, notesResult] =
      await Promise.all([
        context.supabase.from("profiles").select("*").maybeSingle(),
        context.supabase.from("interests").select("*").order("position").order("created_at"),
        context.supabase.from("work_topics").select("*").order("position").order("created_at"),
        context.supabase.from("tasks").select("*").order("position").order("created_at"),
        context.supabase.from("progress_logs").select("*").order("logged_on", { ascending: false }),
        context.supabase.from("notes").select("*").order("updated_at", { ascending: false }),
      ]);

    for (const result of [profileResult, interestsResult, topicsResult, tasksResult, progressResult, notesResult]) {
      if (result.error) throw new Error("Your workspace could not be loaded. Please try again.");
    }

    let profile = profileResult.data;
    if (!profile) {
      const { data, error } = await context.supabase
        .from("profiles")
        .upsert({ user_id: context.userId, display_name: "" })
        .select()
        .single();
      if (error) throw new Error("Your account details could not be loaded.");
      profile = data;
    }

    return {
      profile,
      interests: interestsResult.data ?? [],
      topics: topicsResult.data ?? [],
      tasks: tasksResult.data ?? [],
      progress: progressResult.data ?? [],
      notes: notesResult.data ?? [],
    };
  });

export const workspaceQueryOptions = () =>
  queryOptions({ queryKey: ["workspace"], queryFn: () => getWorkspace() });

export const createInterest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ name: textName.max(120), description: emptySafeText, color: themeSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("interests").insert({ ...data, owner_id: context.userId });
    if (error) throw new Error("This interest could not be saved.");
    return { ok: true };
  });

export const createWorkTopic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ interestId: idSchema, name: textName, description: emptySafeText }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("work_topics").insert({
      interest_id: data.interestId,
      name: data.name,
      description: data.description,
      owner_id: context.userId,
    });
    if (error) throw new Error("This work topic could not be saved.");
    return { ok: true };
  });

export const createTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ topicId: idSchema, title: textName.max(200), description: emptySafeText, parentId: idSchema.nullable() }).parse(input))
  .handler(async ({ data, context }) => {
    if (data.parentId) {
      const { data: parent, error: parentError } = await context.supabase
        .from("tasks")
        .select("id, parent_task_id")
        .eq("id", data.parentId)
        .eq("work_topic_id", data.topicId)
        .eq("owner_id", context.userId)
        .maybeSingle();
      if (parentError || !parent || !canNestTask(parent)) {
        throw new Error("Subtasks can only be added one level below a task in this work topic.");
      }
    }

    const { error } = await context.supabase.from("tasks").insert({
      owner_id: context.userId,
      work_topic_id: data.topicId,
      parent_task_id: data.parentId,
      title: data.title,
      description: data.description,
    });
    if (error) throw new Error("This task could not be saved.");
    return { ok: true };
  });

export const setTaskCompletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ taskId: idSchema, completed: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("tasks")
      .update({ is_complete: data.completed, completed_at: data.completed ? new Date().toISOString() : null })
      .eq("id", data.taskId)
      .eq("owner_id", context.userId);
    if (error) throw new Error("Task progress could not be updated.");
    return { ok: true };
  });

export const saveDailyProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ topicId: idSchema, date: dateSchema, percent: z.number().min(0).max(100).refine(isValidProgressPercent), note: z.string().trim().max(2000) }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("progress_logs").upsert(
      {
        owner_id: context.userId,
        work_topic_id: data.topicId,
        logged_on: data.date,
        progress_percent: data.percent,
        note: data.note,
      },
      { onConflict: "owner_id,work_topic_id,logged_on" },
    );
    if (error) throw new Error("Daily progress could not be saved.");
    return { ok: true };
  });

export const saveNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ noteId: idSchema.nullable(), topicId: idSchema, taskId: idSchema.nullable(), title: textName, content: z.string().trim().max(20000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const note = {
      owner_id: context.userId,
      work_topic_id: data.topicId,
      task_id: data.taskId,
      title: data.title,
      content: data.content,
      updated_at: new Date().toISOString(),
    };
    const result = data.noteId
      ? await context.supabase.from("notes").update(note).eq("id", data.noteId).eq("owner_id", context.userId)
      : await context.supabase.from("notes").insert(note);
    if (result.error) throw new Error("This note could not be saved.");
    return { ok: true };
  });

export const updateDisplayName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ displayName: z.string().trim().max(100) }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .upsert({ user_id: context.userId, display_name: data.displayName, updated_at: new Date().toISOString() });
    if (error) throw new Error("Your account details could not be updated.");
    return { ok: true };
  });

export const deleteWorkspaceItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ kind: z.enum(["interest", "topic", "task", "note"]), id: idSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const table = { interest: "interests", topic: "work_topics", task: "tasks", note: "notes" } as const;
    const { error } = await context.supabase.from(table[data.kind]).delete().eq("id", data.id).eq("owner_id", context.userId);
    if (error) throw new Error("This item could not be removed.");
    return { ok: true };
  });