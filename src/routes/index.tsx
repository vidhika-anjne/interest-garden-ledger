import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowDownUp, ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown, ChevronRight, Circle, CircleCheck, Clock3, Command, Compass, FileText, Folder, Layers3, LogOut, Menu, MoreHorizontal, Plus, Search, Sparkles, Target, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createInterest,
  createTask,
  createWorkTopic,
  deleteWorkspaceItem,
  getWorkspace,
  saveDailyProgress,
  saveNote,
  setTaskCompletion,
  updateDisplayName,
  workspaceQueryOptions,
} from "@/lib/workspace.functions";
import { calculateCompletion } from "@/lib/progress";

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(workspaceQueryOptions()),
  head: () => ({
    meta: [
      { title: "Stillwork — your interests, in view" },
      { name: "description", content: "A calm, personal workspace for your interests, work, daily progress, and notes." },
      { property: "og:title", content: "Stillwork — your interests, in view" },
      { property: "og:description", content: "A calm, personal workspace for your interests, work, daily progress, and notes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WorkspaceRoute,
  errorComponent: WorkspaceError,
  notFoundComponent: () => <main className="min-h-screen bg-background p-12 text-foreground">This page is unavailable.</main>,
});

type Workspace = Awaited<ReturnType<typeof getWorkspace>>;
type Interest = Workspace["interests"][number];
type Topic = Workspace["topics"][number];
type Task = Workspace["tasks"][number];
type Note = Workspace["notes"][number];
type Panel = "work" | "notes" | "progress";

const palette: Record<string, { dot: string; text: string; bar: string; soft: string }> = {
  mint: { dot: "bg-mint", text: "text-mint", bar: "bg-mint", soft: "bg-mint/10" },
  coral: { dot: "bg-coral", text: "text-coral", bar: "bg-coral", soft: "bg-coral/10" },
  blue: { dot: "bg-soft-blue", text: "text-soft-blue", bar: "bg-soft-blue", soft: "bg-soft-blue/10" },
  gold: { dot: "bg-gold", text: "text-gold", bar: "bg-gold", soft: "bg-gold/10" },
  rose: { dot: "bg-rose", text: "text-rose", bar: "bg-rose", soft: "bg-rose/10" },
  lime: { dot: "bg-lime", text: "text-lime", bar: "bg-lime", soft: "bg-lime/10" },
};

const paletteChoices = ["mint", "coral", "blue", "gold", "rose", "lime"] as const;
const currentDate = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};
const displayDate = (value: string) =>
  new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date(`${value}T12:00:00`));

function WorkspaceRoute() {
  const { data } = useSuspenseQuery(workspaceQueryOptions());
  const [activeInterestId, setActiveInterestId] = useState<string | null>(null);
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>("work");
  const [selectedDate, setSelectedDate] = useState(currentDate);
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<string[]>([]);
  const [progressEditOpen, setProgressEditOpen] = useState(false);
  const [progressDraft, setProgressDraft] = useState("0");
  const [progressNote, setProgressNote] = useState("");
  const [noteDraft, setNoteDraft] = useState<{ id: string | null; title: string; content: string; taskId: string | null } | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileDraft, setProfileDraft] = useState(data.profile?.display_name ?? "");
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["workspace"] });

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  const sortedInterests = data.interests;
  const selectedInterest = sortedInterests.find((item) => item.id === activeInterestId) ?? sortedInterests[0] ?? null;
  const topics = data.topics.filter((topic) => topic.interest_id === selectedInterest?.id);
  const selectedTopic = topics.find((topic) => topic.id === activeTopicId) ?? topics[0] ?? null;
  const topicTasks = data.tasks.filter((task) => task.work_topic_id === selectedTopic?.id);
  const topTasks = topicTasks.filter((task) => !task.parent_task_id);
  const completedTasks = topicTasks.filter((task) => task.is_complete).length;
  const overallPercent = calculateCompletion(data.tasks.filter((task) => task.is_complete).length, data.tasks.length);
  const dailyLog = data.progress.find((entry) => entry.work_topic_id === selectedTopic?.id && entry.logged_on === selectedDate);
  const topicProgress = dailyLog?.progress_percent ?? (selectedTopic ? calculateCompletion(completedTasks, topicTasks.length) : 0);
  const latestNotes = data.notes.filter((note) => topics.some((topic) => topic.id === note.work_topic_id));
  const visibleNotes = data.notes.filter((note) => `${note.title} ${note.content} ${data.topics.find((topic) => topic.id === note.work_topic_id)?.name ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  const topicOptions = (topicId: string | null | undefined) => ({ data: { topicId: topicId ?? "", name: "", description: "" } });
  void topicOptions;

  const mutation = (fn: (...args: never[]) => Promise<unknown>, message: string) =>
    useMutation({ mutationFn: fn, onSuccess: () => { void refresh(); toast.success(message); }, onError: (error) => toast.error(error instanceof Error ? error.message : "Please try again.") });
  const createInterestMutation = mutation(createInterest as (...args: never[]) => Promise<unknown>, "Interest created");
  const createTopicMutation = mutation(createWorkTopic as (...args: never[]) => Promise<unknown>, "Work topic created");
  const createTaskMutation = mutation(createTask as (...args: never[]) => Promise<unknown>, "Task created");
  const completeMutation = mutation(setTaskCompletion as (...args: never[]) => Promise<unknown>, "Task updated");
  const progressMutation = mutation(saveDailyProgress as (...args: never[]) => Promise<unknown>, "Daily progress saved");
  const noteMutation = mutation(saveNote as (...args: never[]) => Promise<unknown>, "Note saved");
  const profileMutation = mutation(updateDisplayName as (...args: never[]) => Promise<unknown>, "Profile updated");
  const deleteMutation = useMutation({ mutationFn: deleteWorkspaceItem, onSuccess: () => { void refresh(); toast.success("Removed"); }, onError: (error) => toast.error(error instanceof Error ? error.message : "Please try again.") });

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    const { error } = await supabase.auth.signOut();
    if (error) toast.error("You could not be signed out. Please try again.");
    else await navigate({ to: "/", replace: true });
  };

  const createNote = (note?: Note, taskId?: string | null) => {
    const defaultTopic = note ? data.topics.find((topic) => topic.id === note.work_topic_id) : selectedTopic;
    setNoteDraft({ id: note?.id ?? null, title: note?.title ?? "", content: note?.content ?? "", taskId: note?.task_id ?? taskId ?? null });
    setPanel("notes");
    if (defaultTopic) setActiveTopicId(defaultTopic.id);
  };

  const submitNote = () => {
    if (!noteDraft || !selectedTopic || !noteDraft.title.trim()) return toast.error("Give your note a title first.");
    noteMutation.mutate({ data: { noteId: noteDraft.id, topicId: selectedTopic.id, taskId: noteDraft.taskId, title: noteDraft.title.trim(), content: noteDraft.content } });
    setNoteDraft(null);
  };

  const toggleTaskExpanded = (id: string) => setExpandedTasks((current) => current.includes(id) ? current.filter((key) => key !== id) : [...current, id]);
  const runProgressSave = () => {
    if (!selectedTopic) return;
    const next = Number(progressDraft);
    if (!Number.isFinite(next) || next < 0 || next > 100) return toast.error("Progress must be between 0 and 100%.");
    progressMutation.mutate({ data: { topicId: selectedTopic.id, date: selectedDate, percent: next, note: progressNote.trim() } });
    setProgressEditOpen(false);
  };

  const onAddInterest = () => {
    const name = window.prompt("Name this interest");
    if (!name?.trim()) return;
    createInterestMutation.mutate({ data: { name: name.trim(), description: "", color: paletteChoices[data.interests.length % paletteChoices.length] } });
  };
  const onAddTopic = () => {
    if (!selectedInterest) return toast.error("Add an interest before creating work topics.");
    const name = window.prompt(`New work topic in ${selectedInterest.name}`);
    if (!name?.trim()) return;
    createTopicMutation.mutate({ data: { interestId: selectedInterest.id, name: name.trim(), description: "" } });
  };
  const onAddTask = (parentId: string | null = null) => {
    if (!selectedTopic) return toast.error("Select a work topic first.");
    const title = window.prompt(parentId ? "Name this subtask" : "Name this task");
    if (!title?.trim()) return;
    createTaskMutation.mutate({ data: { topicId: selectedTopic.id, title: title.trim(), description: "", parentId } });
  };

  const renderTask = (task: Task, depth = 0) => {
    const children = topicTasks.filter((child) => child.parent_task_id === task.id);
    const isExpanded = expandedTasks.includes(task.id);
    return (
      <div key={task.id} className={depth ? "ml-10 border-l border-border/70 pl-5" : ""}>
        <div className="group/task flex min-h-[62px] items-center gap-3 border-b border-border/55 py-3">
          {children.length > 0 ? (
            <Button variant="ghost" size="icon" aria-label={isExpanded ? "Collapse subtasks" : "Expand subtasks"} className="h-8 w-8 shrink-0 text-muted-foreground" onClick={() => toggleTaskExpanded(task.id)}>
              {isExpanded ? <ChevronDown /> : <ChevronRight />}
            </Button>
          ) : <span className="w-8 shrink-0" />}
          <button aria-label={task.is_complete ? `Mark ${task.title} incomplete` : `Mark ${task.title} complete`} onClick={() => completeMutation.mutate({ data: { taskId: task.id, completed: !task.is_complete } })} className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${task.is_complete ? "border-mint bg-mint text-background" : "border-muted-foreground/45 hover:border-mint"}`}>
            {task.is_complete ? <Check className="h-3 w-3" /> : null}
          </button>
          <div className="min-w-0 flex-1">
            <span className={`block truncate text-[14px] ${task.is_complete ? "text-muted-foreground line-through" : "text-foreground"}`}>{task.title}</span>
            {task.description ? <span className="mt-1 block truncate text-xs text-muted-foreground">{task.description}</span> : null}
          </div>
          <span className="hidden shrink-0 items-center gap-1 text-[11px] text-muted-foreground sm:flex"><Clock3 className="h-3 w-3" /> {task.is_complete ? "Done" : "Open"}</span>
          <Button variant="ghost" size="icon" title="Add a subtask" className="h-8 w-8 text-muted-foreground opacity-0 transition-opacity group-hover/task:opacity-100 focus:opacity-100" onClick={() => onAddTask(task.id)}><Plus /><span className="sr-only">Add subtask under {task.title}</span></Button>
          <Button variant="ghost" size="icon" title="Add a note to this task" className="h-8 w-8 text-muted-foreground opacity-0 transition-opacity group-hover/task:opacity-100 focus:opacity-100" onClick={() => createNote(undefined, task.id)}><FileText /><span className="sr-only">Add note for {task.title}</span></Button>
          <Button variant="ghost" size="icon" title="Remove task" className="h-8 w-8 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover/task:opacity-100 focus:opacity-100" onClick={() => deleteMutation.mutate({ data: { kind: "task", id: task.id } })}><Trash2 /><span className="sr-only">Remove {task.title}</span></Button>
        </div>
        {isExpanded ? children.map((child) => renderTask(child, depth + 1)) : null}
      </div>
    );
  };

  const choosePanel = (next: Panel) => { setPanel(next); setMobileNavOpen(false); };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className={`fixed inset-y-0 left-0 z-30 flex w-[258px] flex-col border-r border-border/75 bg-sidebar transition-transform duration-200 lg:translate-x-0 ${collapsed ? "lg:w-[84px]" : ""} ${mobileNavOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className={`flex h-[76px] items-center border-b border-border/65 px-5 ${collapsed ? "lg:justify-center lg:px-3" : "justify-between"}`}>
          <button aria-label="Stillwork home" onClick={() => choosePanel("work")} className="flex min-w-0 items-center gap-3 text-left">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] border border-mint/25 bg-mint/10 text-mint"><Layers3 className="h-[17px] w-[17px]" /></span>
            <span className={`truncate text-[15px] font-semibold tracking-[0.015em] ${collapsed ? "lg:hidden" : ""}`}>stillwork<span className="text-mint">.</span></span>
          </button>
          <Button variant="ghost" size="icon" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} className={`hidden h-8 w-8 text-muted-foreground lg:inline-flex ${collapsed ? "lg:hidden" : ""}`} onClick={() => setCollapsed(true)}><ArrowLeft /></Button>
          {collapsed ? <Button variant="ghost" size="icon" aria-label="Expand sidebar" className="hidden h-8 w-8 text-muted-foreground lg:inline-flex" onClick={() => setCollapsed(false)}><ArrowRight /></Button> : null}
          <Button variant="ghost" size="icon" aria-label="Close navigation" className="h-8 w-8 text-muted-foreground lg:hidden" onClick={() => setMobileNavOpen(false)}><X /></Button>
        </div>

        <div className={`space-y-1 p-3 ${collapsed ? "lg:px-3" : ""}`}>
          <div className={`px-3 pb-2 pt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground ${collapsed ? "lg:hidden" : ""}`}>Workspace</div>
          <SideNavButton icon={<Compass />} label="My work" active={panel === "work"} onClick={() => choosePanel("work")} collapsed={collapsed} />
          <SideNavButton icon={<Target />} label="Daily progress" active={panel === "progress"} onClick={() => choosePanel("progress")} collapsed={collapsed} />
          <SideNavButton icon={<BookOpen />} label="Notes" active={panel === "notes"} onClick={() => choosePanel("notes")} collapsed={collapsed} count={data.notes.length} />
        </div>

        <div className="mt-3 flex items-center justify-between px-5 pb-2">
          <span className={`text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground ${collapsed ? "lg:hidden" : ""}`}>Your interests</span>
          <Button variant="ghost" size="icon" aria-label="Add interest" title="Add interest" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={onAddInterest}><Plus /></Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          {data.interests.length === 0 && !collapsed ? <div className="px-3 py-5 text-xs leading-5 text-muted-foreground">Your interests will live here. Add the first one when you’re ready.</div> : null}
          {sortedInterests.map((interest, index) => {
            const style = palette[interest.color] ?? paletteChoices[index % paletteChoices.length];
            const topicsForInterest = data.topics.filter((topic) => topic.interest_id === interest.id);
            const isActiveInterest = interest.id === selectedInterest?.id;
            return (
              <div key={interest.id} className="mb-1">
                <button title={collapsed ? interest.name : undefined} onClick={() => { setActiveInterestId(interest.id); setActiveTopicId(null); choosePanel("work"); }} className={`group flex min-h-10 w-full items-center gap-3 rounded-[6px] px-3 text-left transition-colors ${isActiveInterest ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/75 hover:bg-sidebar-accent/65 hover:text-sidebar-foreground"}`}>
                  <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${style.dot}`} />
                  <span className={`min-w-0 flex-1 truncate text-[13px] ${collapsed ? "lg:hidden" : ""}`}>{interest.name}</span>
                  <span className={`text-[10px] tabular-nums text-muted-foreground ${collapsed ? "lg:hidden" : ""}`}>{topicsForInterest.length}</span>
                  <Button variant="ghost" size="icon" aria-label={`Remove ${interest.name}`} className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={(event) => { event.stopPropagation(); deleteMutation.mutate({ data: { kind: "interest", id: interest.id } }); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                </button>
                {isActiveInterest && !collapsed ? <div className="ml-[22px] border-l border-border/70 py-1">
                  {topicsForInterest.map((topic) => <button key={topic.id} onClick={() => { setActiveTopicId(topic.id); choosePanel("work"); }} className={`flex min-h-8 w-[calc(100%-12px)] items-center gap-2 truncate pl-4 pr-2 text-left text-[12px] transition-colors ${topic.id === selectedTopic?.id && panel === "work" ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}><Folder className="h-3 w-3 shrink-0" /><span className="truncate">{topic.name}</span></button>)}
                  <button aria-label={`Add work topic to ${interest.name}`} onClick={onAddTopic} className="ml-4 mt-1 flex min-h-8 items-center gap-2 px-1 text-[11px] text-muted-foreground hover:text-mint"><Plus className="h-3 w-3" /> New topic</button>
                </div> : null}
              </div>
            );
          })}
        </div>

        <div className="border-t border-border/70 p-3">
          <button onClick={() => setProfileOpen((value) => !value)} className="flex w-full items-center gap-3 rounded-[6px] px-3 py-2 text-left hover:bg-sidebar-accent">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-rose/15 text-[11px] font-semibold text-rose">{(data.profile?.display_name || "Y").slice(0, 1).toUpperCase()}</span>
            <span className={`min-w-0 flex-1 ${collapsed ? "lg:hidden" : ""}`}><span className="block truncate text-[12px] font-medium">{data.profile?.display_name || "Your account"}</span><span className="block truncate text-[10px] text-muted-foreground">Personal workspace</span></span>
            <MoreHorizontal className={`h-4 w-4 text-muted-foreground ${collapsed ? "lg:hidden" : ""}`} />
          </button>
          {profileOpen ? <div className={`mt-2 space-y-2 px-3 ${collapsed ? "lg:hidden" : ""}`}>
            <Input aria-label="Display name" value={profileDraft} maxLength={100} placeholder="Your name" onChange={(event) => setProfileDraft(event.target.value)} className="h-8 text-xs" />
            <Button size="sm" className="h-8 w-full" disabled={profileMutation.isPending} onClick={() => profileMutation.mutate({ data: { displayName: profileDraft.trim() } })}>Save name</Button>
            <Button variant="ghost" size="sm" className="h-8 w-full justify-start text-muted-foreground" onClick={() => void signOut()}><LogOut className="h-4 w-4" /> Sign out</Button>
          </div> : null}
        </div>
      </aside>

      {mobileNavOpen ? <button className="fixed inset-0 z-20 bg-overlay/80 lg:hidden" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} /> : null}

      <main className={`min-h-screen transition-[margin] ${collapsed ? "lg:ml-[84px]" : "lg:ml-[258px]"}`}>
        <header className="sticky top-0 z-10 flex h-[68px] items-center justify-between border-b border-border/75 bg-background/95 px-4 backdrop-blur-md sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="icon" aria-label="Open navigation" className="h-9 w-9 shrink-0 text-muted-foreground lg:hidden" onClick={() => setMobileNavOpen(true)}><Menu /></Button>
            <div className="min-w-0"><div className="truncate text-[11px] text-muted-foreground">{selectedInterest?.name ?? "Your workspace"}<span className="mx-2 text-border">/</span><span className="text-foreground/85">{panel === "notes" ? "Notes" : panel === "progress" ? "Daily progress" : selectedTopic?.name ?? "My work"}</span></div></div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <span className="hidden text-[11px] text-muted-foreground md:inline">{displayDate(currentDate())}</span>
            <Button variant="ghost" size="icon" aria-label="Search notes" title="Search notes" className="h-9 w-9 text-muted-foreground" onClick={() => { setPanel("notes"); setMobileNavOpen(false); }}><Search /></Button>
            <span className="hidden h-5 w-px bg-border sm:block" />
            <span className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex"><Command className="h-3 w-3" /> One thing at a time</span>
          </div>
        </header>

        <div className="mx-auto max-w-[1260px] px-5 pb-16 pt-9 sm:px-8 sm:pt-12 xl:px-12">
          {panel === "work" ? <>
            <section className="mb-10 flex flex-wrap items-end justify-between gap-6">
              <div>
                <div className="mb-3 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground"><span className={`h-[7px] w-[7px] rounded-full ${selectedInterest ? (palette[selectedInterest.color] ?? palette.mint).dot : "bg-mint"}`} />{selectedInterest?.name ?? "Your space"}</div>
                <h1 className="max-w-[820px] break-words text-[32px] font-semibold leading-[1.13] tracking-normal sm:text-[38px]">{selectedTopic?.name ?? "Make room for what matters."}</h1>
                <p className="mt-3 max-w-2xl text-[13px] leading-6 text-muted-foreground">{selectedTopic?.description || (selectedInterest ? `A little progress, made visible — for ${selectedInterest.name.toLowerCase()}.` : "Bring your interests and everyday work into one considered place.")}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" className="h-9 border-border/80 bg-transparent" onClick={() => createNote()}><FileText className="h-3.5 w-3.5" /> Add a note</Button>
                <Button size="sm" className="h-9" onClick={() => onAddTask()}><Plus className="h-3.5 w-3.5" /> New task</Button>
              </div>
            </section>

            <section className="mb-10 grid gap-8 border-y border-border/75 py-6 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <div className="mb-3 flex items-center justify-between text-[11px] text-muted-foreground"><span>Overall progress</span><span className="tabular-nums text-foreground">{overallPercent}%</span></div>
                <div className="h-[6px] overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-mint transition-[width] duration-500" style={{ width: `${overallPercent}%` }} /></div>
                <div className="mt-3 text-[11px] text-muted-foreground">{data.tasks.filter((task) => task.is_complete).length} of {data.tasks.length} tasks complete across your interests</div>
              </div>
              <div className="flex gap-8 sm:border-l sm:border-border/70 sm:pl-8">
                <Metric label="Interests" value={String(data.interests.length).padStart(2, "0")} />
                <Metric label="Work topics" value={String(data.topics.length).padStart(2, "0")} />
                <Metric label="Notes" value={String(data.notes.length).padStart(2, "0")} />
              </div>
            </section>

            {selectedTopic ? <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_332px]">
              <section>
                <div className="mb-3 flex items-center justify-between border-b border-border/70 pb-4">
                  <div><h2 className="text-[15px] font-semibold">Tasks</h2><p className="mt-1 text-[11px] text-muted-foreground">{topTasks.length} {topTasks.length === 1 ? "task" : "tasks"} · {completedTasks} complete</p></div>
                  <Button variant="ghost" size="sm" className="h-8 text-muted-foreground" onClick={onAddTask}><Plus /> Add task</Button>
                </div>
                {topTasks.length ? topTasks.map((task) => renderTask(task)) : <div className="py-14 text-center"><span className="mx-auto mb-4 grid h-10 w-10 place-items-center rounded-[10px] border border-border text-muted-foreground"><CircleCheck className="h-4 w-4" /></span><p className="text-[13px] text-foreground">A good place to begin.</p><p className="mt-1 text-[11px] text-muted-foreground">Add a task to give this topic its first step.</p><Button variant="outline" size="sm" className="mt-4" onClick={onAddTask}><Plus /> Add a task</Button></div>}
              </section>

              <aside className="space-y-10">
                <section>
                  <div className="mb-4 flex items-center justify-between"><div><h2 className="text-[13px] font-semibold">Today’s progress</h2><p className="mt-1 text-[10px] text-muted-foreground">{displayDate(selectedDate)}</p></div><Button variant="ghost" size="icon" title="Edit daily progress" aria-label="Edit daily progress" className="h-8 w-8 text-muted-foreground" onClick={() => { setProgressDraft(String(topicProgress)); setProgressNote(dailyLog?.note ?? ""); setProgressEditOpen((value) => !value); }}><ArrowDownUp /></Button></div>
                  <div className="relative h-[106px] overflow-hidden border border-border/80 bg-surface/60 px-4 py-3">
                    <svg viewBox="0 0 280 76" preserveAspectRatio="none" className="absolute inset-x-3 bottom-3 h-[76px] w-[calc(100%-24px)]" aria-hidden="true">
                      <path d="M0 66 C25 64, 38 52, 56 54 S91 37, 111 43 S144 30, 165 34 S195 18, 218 26 S253 15, 280 9 L280 76 L0 76 Z" className={(palette[selectedInterest?.color ?? "mint"] ?? palette.mint).soft} />
                      <path d="M0 66 C25 64, 38 52, 56 54 S91 37, 111 43 S144 30, 165 34 S195 18, 218 26 S253 15, 280 9" fill="none" className={(palette[selectedInterest?.color ?? "mint"] ?? palette.mint).text} stroke="currentColor" strokeWidth="2" />
                    </svg>
                    <div className="relative flex items-start justify-between"><span className="text-[10px] text-muted-foreground">This work topic</span><span className="text-[26px] font-semibold tabular-nums">{topicProgress}<span className="ml-0.5 text-[13px] font-normal text-muted-foreground">%</span></span></div>
                  </div>
                  {progressEditOpen ? <div className="mt-4 space-y-3 border-b border-border pb-5">
                    <div><label className="text-[11px] text-muted-foreground" htmlFor="progress-date">Date</label><Input id="progress-date" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="mt-1 h-9 text-xs" /></div>
                    <div><label className="text-[11px] text-muted-foreground" htmlFor="progress-percent">Progress completed today (%)</label><div className="mt-1 flex items-center gap-2"><input id="progress-percent" type="range" min="0" max="100" value={progressDraft} onChange={(event) => setProgressDraft(event.target.value)} className="h-2 flex-1 cursor-pointer accent-primary" /><Input aria-label="Progress percentage" type="number" min="0" max="100" value={progressDraft} onChange={(event) => setProgressDraft(event.target.value)} className="h-9 w-[75px] text-center text-xs tabular-nums" /></div></div>
                    <Textarea aria-label="Daily progress note" maxLength={2000} rows={2} value={progressNote} onChange={(event) => setProgressNote(event.target.value)} placeholder="A word about today…" className="resize-y text-xs" />
                    <div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={() => setProgressEditOpen(false)}>Cancel</Button><Button size="sm" disabled={progressMutation.isPending} onClick={runProgressSave}>Save progress</Button></div>
                  </div> : null}
                  {dailyLog?.note && !progressEditOpen ? <p className="mt-3 border-l border-border pl-3 text-[11px] italic leading-5 text-muted-foreground">{dailyLog.note}</p> : null}
                </section>

                <section>
                  <div className="mb-4 flex items-center justify-between"><div><h2 className="text-[13px] font-semibold">A little context</h2><p className="mt-1 text-[10px] text-muted-foreground">Notes linked to {selectedTopic.name}</p></div><Button variant="ghost" size="icon" aria-label="Add a note" title="Add a note" className="h-8 w-8 text-muted-foreground" onClick={() => createNote()}><Plus /></Button></div>
                  {latestNotes.filter((note) => note.work_topic_id === selectedTopic.id).length ? latestNotes.filter((note) => note.work_topic_id === selectedTopic.id).slice(0, 3).map((note) => <button key={note.id} onClick={() => createNote(note)} className="group mb-3 block w-full border-b border-border/65 pb-3 text-left"><span className="block truncate text-[12px] font-medium group-hover:text-mint">{note.title}</span><span className="mt-1 block line-clamp-2 text-[10px] leading-5 text-muted-foreground">{note.content || "No additional context yet."}</span></button>) : <button onClick={() => createNote()} className="w-full border-y border-dashed border-border/80 py-5 text-left text-[11px] text-muted-foreground hover:text-foreground">Keep a note close to this work <span className="float-right text-mint">+</span></button>}
                  <Button variant="ghost" size="sm" className="mt-1 h-8 px-0 text-[11px] text-muted-foreground hover:text-foreground" onClick={() => choosePanel("notes")}>All notes <ArrowRight /></Button>
                </section>
              </aside>
            </div> : <EmptyInterests onAddInterest={onAddInterest} onAddTopic={onAddTopic} interestCount={data.interests.length} />}
          </> : null}

          {panel === "progress" ? <ProgressPanel data={data} selectedDate={selectedDate} setSelectedDate={setSelectedDate} selectTopic={(topic) => { const interest = data.interests.find((item) => item.id === topic.interest_id); if (interest) setActiveInterestId(interest.id); setActiveTopicId(topic.id); choosePanel("work"); }} /> : null}

          {panel === "notes" ? <section>
            <div className="mb-9 flex flex-wrap items-end justify-between gap-5"><div><div className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-muted-foreground"><BookOpen className="h-3.5 w-3.5" /> Everything worth keeping</div><h1 className="text-[34px] font-semibold leading-tight">Your notes.</h1><p className="mt-3 max-w-xl text-[13px] leading-6 text-muted-foreground">Ideas stay connected to the work they came from.</p></div><Button onClick={() => createNote()}><Plus /> New note</Button></div>
            <div className="mb-6 flex max-w-lg items-center gap-3 border-b border-border pb-2"><Search className="h-4 w-4 text-muted-foreground" /><input aria-label="Search notes" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a thought, topic, or phrase…" className="w-full bg-transparent text-[13px] outline-none placeholder:text-muted-foreground" /></div>
            {noteDraft ? <div className="mb-8 max-w-[760px] space-y-3 border-l-2 border-mint/50 pl-5">
              <div className="flex items-center justify-between"><p className="text-[11px] text-muted-foreground">Linked to <span className="font-medium text-foreground">{selectedTopic?.name ?? "a work topic"}</span></p><Button variant="ghost" size="icon" aria-label="Close note editor" className="h-8 w-8" onClick={() => setNoteDraft(null)}><X /></Button></div>
              <Input aria-label="Note title" maxLength={160} value={noteDraft.title} onChange={(event) => setNoteDraft({ ...noteDraft, title: event.target.value })} placeholder="A name for this thought…" className="h-12 border-0 border-b border-border bg-transparent px-0 text-lg font-medium shadow-none focus-visible:ring-0" />
              <Textarea aria-label="Note content" maxLength={20000} rows={6} value={noteDraft.content} onChange={(event) => setNoteDraft({ ...noteDraft, content: event.target.value })} placeholder="Let the thought unfold…" className="resize-y border-0 bg-transparent px-0 text-[13px] leading-7 shadow-none focus-visible:ring-0" />
              <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setNoteDraft(null)}>Cancel</Button><Button disabled={noteMutation.isPending} onClick={submitNote}>Save note</Button></div>
            </div> : null}
            {visibleNotes.length ? <div className="max-w-[800px]">{visibleNotes.map((note) => { const topic = data.topics.find((item) => item.id === note.work_topic_id); const interest = data.interests.find((item) => item.id === topic?.interest_id); return <article key={note.id} className="group flex gap-4 border-b border-border/70 py-5"><span className={`mt-1 h-[7px] w-[7px] shrink-0 rounded-full ${(palette[interest?.color ?? "mint"] ?? palette.mint).dot}`} /><button onClick={() => createNote(note)} className="min-w-0 flex-1 text-left"><div className="flex flex-wrap items-center gap-2"><h2 className="break-words text-[14px] font-medium group-hover:text-mint">{note.title}</h2><span className="text-[10px] text-muted-foreground">{topic?.name ?? "Topic removed"}</span></div><p className="mt-2 whitespace-pre-wrap break-words text-[12px] leading-6 text-muted-foreground">{note.content || "No additional context yet."}</p><p className="mt-2 text-[10px] text-muted-foreground">{new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(note.updated_at))}{interest ? ` · ${interest.name}` : ""}</p></button><Button variant="ghost" size="icon" aria-label={`Delete ${note.title}`} className="h-8 w-8 shrink-0 self-start text-muted-foreground opacity-0 group-hover:opacity-100" onClick={() => deleteMutation.mutate({ data: { kind: "note", id: note.id } })}><Trash2 /></Button></article>; })}</div> : !noteDraft ? <div className="border-y border-dashed border-border py-16 text-center"><BookOpen className="mx-auto h-5 w-5 text-muted-foreground" /><h2 className="mt-3 text-[13px] font-medium">{search ? "No notes match that search." : "A quiet page, for now."}</h2><p className="mt-2 text-[11px] text-muted-foreground">{search ? "Try a different word or topic." : "Save a thought beside the work it belongs to."}</p>{!search ? <Button variant="outline" size="sm" className="mt-4" onClick={() => createNote()}><Plus /> Write a note</Button> : null}</div> : null}
          </section> : null}
        </div>
      </main>

      <div className="pointer-events-none fixed bottom-4 right-5 z-10 hidden text-[10px] text-muted-foreground/70 xl:block"><Sparkles className="mr-1 inline h-3 w-3" /> progress, at your pace</div>
    </div>
  );
}

function SideNavButton({ icon, label, active, onClick, collapsed, count }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void; collapsed: boolean; count?: number }) {
  return <button title={collapsed ? label : undefined} onClick={onClick} className={`flex h-10 w-full items-center gap-3 rounded-[6px] px-3 text-left transition-colors ${active ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground" : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"}`}><span className="shrink-0 [&_svg]:h-4 [&_svg]:w-4">{icon}</span><span className={`min-w-0 flex-1 truncate text-[12px] ${collapsed ? "lg:hidden" : ""}`}>{label}</span>{count !== undefined && count > 0 ? <span className={`text-[10px] text-muted-foreground ${collapsed ? "lg:hidden" : ""}`}>{count}</span> : null}</button>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div><div className="text-[22px] font-medium tabular-nums">{value}</div><div className="mt-0.5 text-[10px] text-muted-foreground">{label}</div></div>; }

function EmptyInterests({ onAddInterest, onAddTopic, interestCount }: { onAddInterest: () => void; onAddTopic: () => void; interestCount: number }) {
  return <div className="grid min-h-[260px] place-items-center border-y border-dashed border-border py-14 text-center"><div><span className="mx-auto grid h-11 w-11 place-items-center rounded-[11px] border border-mint/20 bg-mint/10 text-mint"><Compass className="h-5 w-5" /></span><h2 className="mt-4 text-[15px] font-medium">{interestCount ? "Begin with a work topic." : "Start with what interests you."}</h2><p className="mx-auto mt-2 max-w-sm text-[12px] leading-6 text-muted-foreground">{interestCount ? "Give your interest a first topic and something small to do." : "Give each interest its own place. Build a simple structure you can return to."}</p><div className="mt-5 flex justify-center gap-2">{interestCount ? <Button onClick={onAddTopic}><Plus /> New work topic</Button> : <Button onClick={onAddInterest}><Plus /> Add an interest</Button>}</div></div></div>;
}

function ProgressPanel({ data, selectedDate, setSelectedDate, selectTopic }: { data: Workspace; selectedDate: string; setSelectedDate: (value: string) => void; selectTopic: (topic: Topic) => void }) {
  const byDate = useMemo(() => data.progress.filter((entry) => entry.logged_on === selectedDate), [data.progress, selectedDate]);
  const avg = byDate.length ? Math.round(byDate.reduce((sum, entry) => sum + entry.progress_percent, 0) / byDate.length) : 0;
  return <section>
    <div className="mb-9 flex flex-wrap items-end justify-between gap-5"><div><div className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-muted-foreground"><Target className="h-3.5 w-3.5" /> Small steps count</div><h1 className="text-[34px] font-semibold leading-tight">Your progress.</h1><p className="mt-3 max-w-xl text-[13px] leading-6 text-muted-foreground">Choose a day and set the progress that feels true.</p></div><Input aria-label="Progress date" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="h-10 w-[165px] text-xs" /></div>
    <div className="mb-8 flex flex-wrap items-end justify-between gap-5 border-y border-border py-6"><div><p className="text-[11px] text-muted-foreground">{displayDate(selectedDate)}</p><div className="mt-2 text-[30px] font-medium tabular-nums">{avg}<span className="ml-1 text-sm text-muted-foreground">%</span></div><p className="mt-1 text-[11px] text-muted-foreground">Average across {byDate.length} topics with saved progress</p></div><div className="w-full max-w-[450px]"><div className="mb-2 flex justify-between text-[10px] text-muted-foreground"><span>Today, across your work</span><span>{avg}%</span></div><div className="h-[7px] overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-mint transition-[width]" style={{ width: `${avg}%` }} /></div></div></div>
    <h2 className="mb-2 text-[14px] font-semibold">Each work topic</h2>
    {data.topics.length ? <div className="max-w-[900px]">{data.topics.map((topic) => { const interest = data.interests.find((item) => item.id === topic.interest_id); const entry = byDate.find((item) => item.work_topic_id === topic.id); const topicTasks = data.tasks.filter((task) => task.work_topic_id === topic.id); const completed = topicTasks.filter((task) => task.is_complete).length; const percent = entry?.progress_percent ?? calculateCompletion(completed, topicTasks.length); return <button key={topic.id} onClick={() => selectTopic(topic)} className="group flex w-full items-center gap-4 border-b border-border/65 py-4 text-left"><span className={`h-[7px] w-[7px] shrink-0 rounded-full ${(palette[interest?.color ?? "mint"] ?? palette.mint).dot}`} /><span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-medium group-hover:text-mint">{topic.name}</span><span className="mt-1 block truncate text-[10px] text-muted-foreground">{interest?.name ?? "Interest"}{entry?.note ? ` · ${entry.note}` : ""}</span></span><span className="hidden w-32 sm:block"><span className="block h-[5px] overflow-hidden rounded-full bg-muted"><span className={`block h-full rounded-full ${(palette[interest?.color ?? "mint"] ?? palette.mint).bar}`} style={{ width: `${percent}%` }} /></span></span><span className="w-10 text-right text-[12px] tabular-nums">{percent}%</span><ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" /></button>; })}</div> : <p className="border-y border-dashed border-border py-10 text-[12px] text-muted-foreground">Progress by work topic appears here as you create work.</p>}
  </section>;
}

function WorkspaceError({ error, reset }: { error: Error; reset: () => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [authError, setAuthError] = useState("");
  const isAuthError = /unauthorized|no authorization|invalid token|auth session missing/i.test(error.message);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setAuthError(""); setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin, data: { full_name: displayName.trim() } } });
        if (signUpError) throw signUpError;
        if (!data.session) { setConfirmationSent(true); return; }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }
      reset();
    } catch (caught) { setAuthError(caught instanceof Error ? caught.message : "Please try again."); }
    finally { setBusy(false); }
  };
  const socialSignIn = async (provider: "google" | "lovable") => {
    setAuthError(""); setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
      if (result.error) throw result.error;
      if (!result.redirected) reset();
    } catch (caught) { setAuthError(caught instanceof Error ? caught.message : "Sign-in could not be started."); setBusy(false); }
  };
  const resetPassword = async () => {
    if (!email.trim()) return setAuthError("Enter your email address first.");
    setAuthError("");
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    if (resetError) setAuthError(resetError.message); else toast.success("If that email has an account, a reset link is on its way.");
  };

  return <main className="relative grid min-h-screen place-items-center overflow-hidden bg-background px-5 py-12 text-foreground">
    <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-[33%] border-r border-border/70 lg:block"><div className="absolute left-10 top-12 flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-[11px] border border-mint/25 bg-mint/10 text-mint"><Layers3 className="h-4 w-4" /></span><span className="text-[15px] font-semibold">stillwork<span className="text-mint">.</span></span></div><div className="absolute bottom-24 left-10 max-w-[280px]"><p className="text-[30px] font-medium leading-[1.22]">A little progress, <span className="text-mint">made visible.</span></p><p className="mt-4 text-[12px] leading-6 text-muted-foreground">A quieter space for the things you keep coming back to.</p></div><div className="absolute bottom-9 left-10 text-[10px] text-muted-foreground">Stillwork · your personal workspace</div></div>
    <section className="w-full max-w-[390px] lg:ml-[19%]">
      <div className="mb-7 lg:hidden"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-[11px] border border-mint/25 bg-mint/10 text-mint"><Layers3 className="h-4 w-4" /></span><span className="text-[15px] font-semibold">stillwork<span className="text-mint">.</span></span></div><h1 className="mt-7 text-[28px] font-medium leading-tight">A little progress, made visible.</h1><p className="mt-2 text-[12px] text-muted-foreground">A quieter space for the things you keep coming back to.</p></div>
      <div className="mb-7 hidden lg:block"><p className="text-[11px] font-medium uppercase tracking-[0.12em] text-mint">Your space, ready when you are</p><h1 className="mt-3 text-[25px] font-semibold">{mode === "login" ? "Welcome back." : "Make a space of your own."}</h1><p className="mt-2 text-[12px] text-muted-foreground">{mode === "login" ? "Sign in to return to your work." : "Create an account to save your work."}</p></div>
      {confirmationSent ? <div className="border-y border-border py-7"><span className="grid h-10 w-10 place-items-center rounded-full bg-mint/10 text-mint"><Check className="h-5 w-5" /></span><h2 className="mt-5 text-[17px] font-semibold">Check your email.</h2><p className="mt-2 text-[12px] leading-6 text-muted-foreground">We’ve sent a confirmation link to <span className="text-foreground">{email}</span>. Open it to finish creating your account.</p><Button variant="outline" className="mt-5" onClick={() => { setConfirmationSent(false); setMode("login"); }}>Back to sign in</Button></div> : <>
        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" ? <div><label htmlFor="auth-name" className="mb-2 block text-[11px] text-muted-foreground">Your name</label><Input id="auth-name" autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={100} placeholder="How you’d like to be called" className="h-11 border-border/80 text-sm" /></div> : null}
          <div><label htmlFor="auth-email" className="mb-2 block text-[11px] text-muted-foreground">Email</label><Input id="auth-email" type="email" autoComplete="email" required maxLength={255} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="h-11 border-border/80 text-sm" /></div>
          <div><label htmlFor="auth-password" className="mb-2 block text-[11px] text-muted-foreground">Password</label><Input id="auth-password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" className="h-11 border-border/80 text-sm" />{mode === "login" ? <button type="button" onClick={() => void resetPassword()} className="mt-2 text-[10px] text-muted-foreground hover:text-mint">Forgot password?</button> : null}</div>
          {authError ? <p role="alert" className="text-[11px] leading-5 text-destructive">{authError}</p> : null}
          <Button type="submit" disabled={busy} className="h-11 w-full">{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}<ArrowRight className="ml-auto h-4 w-4" /></Button>
        </form>
        <div className="my-5 flex items-center gap-3 text-[10px] text-muted-foreground"><span className="h-px flex-1 bg-border" />or continue with<span className="h-px flex-1 bg-border" /></div>
        <div className="grid gap-2"><Button variant="outline" disabled={busy} onClick={() => void socialSignIn("google")} className="h-11 border-border/85 bg-google-surface text-google-foreground hover:bg-google-surface/90"><GoogleMark /> Continue with Google</Button><Button variant="outline" disabled={busy} onClick={() => void socialSignIn("lovable")} className="h-11 border-border/85 text-foreground"><Sparkles className="h-[17px] w-[17px]" /> Continue with Lovable</Button></div>
        <p className="mt-5 text-center text-[11px] text-muted-foreground">{mode === "login" ? "New here?" : "Already have an account?"} <button onClick={() => { setAuthError(""); setMode(mode === "login" ? "signup" : "login"); }} className="font-medium text-mint hover:underline">{mode === "login" ? "Create an account" : "Sign in"}</button></p>
      </>}
      {isAuthError && authError ? <p className="mt-5 text-center text-[10px] text-muted-foreground">A private workspace keeps your interests, notes, and progress just for you.</p> : null}
    </section>
  </main>;
}

function GoogleMark() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>;
}