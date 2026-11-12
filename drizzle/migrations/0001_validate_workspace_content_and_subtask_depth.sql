ALTER TABLE public.work_topics ADD CONSTRAINT work_topics_description_length CHECK (char_length(description) <= 2000);
ALTER TABLE public.tasks ADD CONSTRAINT tasks_description_length CHECK (char_length(description) <= 4000);
ALTER TABLE public.notes ADD CONSTRAINT notes_content_length CHECK (char_length(content) <= 20000);
ALTER TABLE public.progress_logs ADD CONSTRAINT progress_logs_note_length CHECK (char_length(note) <= 2000);
CREATE OR REPLACE FUNCTION public.enforce_task_subtask_depth()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.parent_task_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.tasks parent
    WHERE parent.owner_id = NEW.owner_id
      AND parent.id = NEW.parent_task_id
      AND parent.parent_task_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Subtasks can only be nested one level below a task';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_task_subtask_depth() FROM PUBLIC;
CREATE TRIGGER tasks_enforce_subtask_depth
BEFORE INSERT OR UPDATE OF owner_id, parent_task_id ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.enforce_task_subtask_depth();