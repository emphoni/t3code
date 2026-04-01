import { ProjectId, type TaskPriority, type TaskStatus } from "@t3tools/contracts";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useStore } from "../store";
import { SidebarInset } from "~/components/ui/sidebar";
import { isElectron } from "../env";
import {
  FolderIcon,
  TerminalIcon,
  PlusIcon,
  CheckCircle2Icon,
  CircleIcon,
  CircleDotIcon,
  Trash2Icon,
  CalendarIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowRightIcon,
  AlertTriangleIcon,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { readNativeApi } from "../nativeApi";
import { newCommandId, newTaskId } from "../lib/utils";
import type { Task } from "../types";

function getServerHttpOrigin(): string {
  const bridgeUrl = window.desktopBridge?.getWsUrl();
  const envUrl = import.meta.env.VITE_WS_URL as string | undefined;
  const wsUrl =
    bridgeUrl && bridgeUrl.length > 0
      ? bridgeUrl
      : envUrl && envUrl.length > 0
        ? envUrl
        : `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.hostname}:${window.location.port}`;
  const httpUrl = wsUrl.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
  try {
    return new URL(httpUrl).origin;
  } catch {
    return httpUrl;
  }
}

const serverHttpOrigin = getServerHttpOrigin();

function ProjectFavicon({ cwd, className }: { cwd: string; className?: string }) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const src = `${serverHttpOrigin}/api/project-favicon?cwd=${encodeURIComponent(cwd)}`;

  if (status === "error") {
    return <FolderIcon className={className ?? "size-3.5 shrink-0 text-muted-foreground/50"} />;
  }

  return (
    <img
      src={src}
      alt=""
      className={`shrink-0 rounded-sm object-contain ${className ?? "size-3.5"} ${status === "loading" ? "hidden" : ""}`}
      onLoad={() => setStatus("loaded")}
      onError={() => setStatus("error")}
    />
  );
}

const PRIORITY_CONFIG: Record<TaskPriority, { icon: typeof ArrowUpIcon; label: string; className: string }> = {
  urgent: { icon: AlertTriangleIcon, label: "Urgent", className: "text-red-500" },
  high: { icon: ArrowUpIcon, label: "High", className: "text-orange-500" },
  medium: { icon: ArrowRightIcon, label: "Medium", className: "text-yellow-500" },
  low: { icon: ArrowDownIcon, label: "Low", className: "text-blue-500" },
};

const STATUS_CONFIG: Record<TaskStatus, { icon: typeof CircleIcon; label: string; className: string }> = {
  todo: { icon: CircleIcon, label: "To Do", className: "text-muted-foreground" },
  "in-progress": { icon: CircleDotIcon, label: "In Progress", className: "text-blue-500" },
  done: { icon: CheckCircle2Icon, label: "Done", className: "text-green-500" },
};

function TaskStatusButton({ task }: { task: Task }) {
  const config = STATUS_CONFIG[task.status];
  const StatusIcon = config.icon;

  const cycleStatus = useCallback(async () => {
    const api = readNativeApi();
    if (!api) return;
    const nextStatus: TaskStatus =
      task.status === "todo" ? "in-progress" : task.status === "in-progress" ? "done" : "todo";
    await api.orchestration.dispatchCommand({
      type: "task.update",
      commandId: newCommandId(),
      taskId: task.id,
      status: nextStatus,
    });
  }, [task.id, task.status]);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        void cycleStatus();
      }}
      className={`shrink-0 transition-colors hover:opacity-80 ${config.className}`}
      title={`Status: ${config.label} (click to cycle)`}
    >
      <StatusIcon className="size-4" />
    </button>
  );
}

function TaskRow({
  task,
  onDelete,
}: {
  task: Task;
  onDelete: (taskId: Task["id"]) => void;
}) {
  const priorityConfig = PRIORITY_CONFIG[task.priority];
  const PriorityIcon = priorityConfig.icon;

  return (
    <div
      className={`group flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5 transition-colors hover:bg-accent/50 ${
        task.status === "done" ? "opacity-60" : ""
      }`}
    >
      <TaskStatusButton task={task} />

      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-medium ${
            task.status === "done"
              ? "text-muted-foreground line-through"
              : "text-foreground"
          }`}
        >
          {task.title}
        </p>
        {task.description && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {task.description}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {task.dueDate && (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <CalendarIcon className="size-3" />
            {new Date(task.dueDate).toLocaleDateString()}
          </span>
        )}
        <span title={priorityConfig.label} className={priorityConfig.className}>
          <PriorityIcon className="size-3.5" />
        </span>
        <button
          type="button"
          className="opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(task.id);
          }}
          title="Delete task"
        >
          <Trash2Icon className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

function CreateTaskForm({
  projectId,
  onCreated,
}: {
  projectId: ProjectId;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = title.trim();
      if (!trimmed) return;

      const api = readNativeApi();
      if (!api) return;

      setIsSubmitting(true);
      try {
        await api.orchestration.dispatchCommand({
          type: "task.create",
          commandId: newCommandId(),
          taskId: newTaskId(),
          projectId,
          title: trimmed,
          ...(description.trim() ? { description: description.trim() } : {}),
          priority,
          ...(dueDate ? { dueDate: new Date(dueDate).toISOString() } : {}),
          createdAt: new Date().toISOString(),
        });
        setTitle("");
        setDescription("");
        setPriority("medium");
        setDueDate("");
        onCreated();
        inputRef.current?.focus();
      } catch (error) {
        console.error("Failed to create task", error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [title, description, priority, dueDate, projectId, onCreated],
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task title..."
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/25"
          disabled={isSubmitting}
        />
        <button
          type="submit"
          disabled={!title.trim() || isSubmitting}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <PlusIcon className="size-3.5" />
          Add
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/25"
          disabled={isSubmitting}
        />
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as TaskPriority)}
          className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/25"
          disabled={isSubmitting}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/25 [color-scheme:dark]"
          disabled={isSubmitting}
        />
      </div>
    </form>
  );
}

function ProjectDetailRouteView() {
  const navigate = useNavigate();
  const projectId = Route.useParams({
    select: (params) => ProjectId.makeUnsafe(params.projectId),
  });
  const projects = useStore((store) => store.projects);
  const allThreads = useStore((store) => store.threads);
  const allTasks = useStore((store) => store.tasks);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [taskFilter, setTaskFilter] = useState<"all" | "active" | "done">("all");

  const project = useMemo(
    () => projects.find((p) => p.id === projectId),
    [projects, projectId],
  );
  const threads = useMemo(
    () => allThreads.filter((t) => t.projectId === projectId),
    [allThreads, projectId],
  );
  const tasks = useMemo(() => {
    const projectTasks = allTasks.filter((t) => t.projectId === projectId);
    switch (taskFilter) {
      case "active":
        return projectTasks.filter((t) => t.status !== "done");
      case "done":
        return projectTasks.filter((t) => t.status === "done");
      default:
        return projectTasks;
    }
  }, [allTasks, projectId, taskFilter]);

  const taskCounts = useMemo(() => {
    const projectTasks = allTasks.filter((t) => t.projectId === projectId);
    return {
      total: projectTasks.length,
      todo: projectTasks.filter((t) => t.status === "todo").length,
      inProgress: projectTasks.filter((t) => t.status === "in-progress").length,
      done: projectTasks.filter((t) => t.status === "done").length,
    };
  }, [allTasks, projectId]);

  const handleDeleteTask = useCallback(async (taskId: Task["id"]) => {
    const api = readNativeApi();
    if (!api) return;
    try {
      await api.orchestration.dispatchCommand({
        type: "task.delete",
        commandId: newCommandId(),
        taskId,
      });
    } catch (error) {
      console.error("Failed to delete task", error);
    }
  }, []);

  if (!project) {
    return (
      <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center bg-background text-foreground">
          <p className="text-sm text-muted-foreground">Project not found.</p>
        </div>
      </SidebarInset>
    );
  }

  const scriptIconMap: Record<string, string> = {
    play: "\u25B6",
    test: "\uD83E\uDDEA",
    lint: "\uD83D\uDD0D",
    build: "\uD83D\uDD28",
    debug: "\uD83D\uDC1B",
    configure: "\u2699",
  };

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground">
        {isElectron && (
          <div className="drag-region flex h-[52px] shrink-0 items-center border-b border-border px-5">
            <span className="text-xs font-medium tracking-wide text-muted-foreground/70">
              Project
            </span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
            {/* Header */}
            <header className="flex items-start gap-4">
              <div className="flex size-12 items-center justify-center rounded-xl border border-border bg-card">
                <ProjectFavicon cwd={project.cwd} className="size-7" />
              </div>
              <div className="flex-1 space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  {project.name}
                </h1>
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <FolderIcon className="size-3.5" />
                  {project.cwd}
                </p>
              </div>
            </header>

            {/* Tasks */}
            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-medium text-foreground">Tasks</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {taskCounts.total > 0
                      ? `${taskCounts.done}/${taskCounts.total} completed`
                      : "Track work for this project."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateTask(!showCreateTask)}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                >
                  <PlusIcon className="size-3.5" />
                  New Task
                </button>
              </div>

              {/* Progress bar */}
              {taskCounts.total > 0 && (
                <div className="mb-4">
                  <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="bg-green-500 transition-all duration-300"
                      style={{
                        width: `${(taskCounts.done / taskCounts.total) * 100}%`,
                      }}
                    />
                    <div
                      className="bg-blue-500 transition-all duration-300"
                      style={{
                        width: `${(taskCounts.inProgress / taskCounts.total) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="mt-2 flex gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className="size-2 rounded-full bg-muted-foreground/40" />
                      {taskCounts.todo} to do
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="size-2 rounded-full bg-blue-500" />
                      {taskCounts.inProgress} in progress
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="size-2 rounded-full bg-green-500" />
                      {taskCounts.done} done
                    </span>
                  </div>
                </div>
              )}

              {/* Create task form */}
              {showCreateTask && (
                <div className="mb-4 rounded-lg border border-dashed border-border bg-background p-3">
                  <CreateTaskForm
                    projectId={projectId}
                    onCreated={() => {}}
                  />
                </div>
              )}

              {/* Filter tabs */}
              {taskCounts.total > 0 && (
                <div className="mb-3 flex gap-1 rounded-lg border border-border bg-background p-0.5">
                  {(["all", "active", "done"] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setTaskFilter(filter)}
                      className={`flex-1 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                        taskFilter === filter
                          ? "bg-accent text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {filter === "all"
                        ? `All (${taskCounts.total})`
                        : filter === "active"
                          ? `Active (${taskCounts.todo + taskCounts.inProgress})`
                          : `Done (${taskCounts.done})`}
                    </button>
                  ))}
                </div>
              )}

              {/* Task list */}
              {tasks.length > 0 ? (
                <div className="space-y-1.5">
                  {tasks.map((task) => (
                    <TaskRow key={task.id} task={task} onDelete={handleDeleteTask} />
                  ))}
                </div>
              ) : taskCounts.total > 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-background px-3 py-4 text-center text-xs text-muted-foreground">
                  No tasks match this filter.
                </div>
              ) : !showCreateTask ? (
                <div className="rounded-lg border border-dashed border-border bg-background px-3 py-4 text-center text-xs text-muted-foreground">
                  No tasks yet. Click "New Task" to get started.
                </div>
              ) : null}
            </section>

            {/* Model */}
            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-4">
                <h2 className="text-sm font-medium text-foreground">Default Model</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  The default AI model used for new threads in this project.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-background px-3 py-2">
                <code className="text-sm text-foreground">
                  {project.model || "Not set (inherits global default)"}
                </code>
              </div>
            </section>

            {/* Scripts */}
            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-4">
                <h2 className="text-sm font-medium text-foreground">Scripts</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Configured commands that can be run in this project's workspace.
                </p>
              </div>
              {project.scripts.length > 0 ? (
                <div className="space-y-2">
                  {project.scripts.map((script) => (
                    <div
                      key={script.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-base">{scriptIconMap[script.icon] ?? "\u25B6"}</span>
                        <div>
                          <p className="text-sm font-medium text-foreground">{script.name}</p>
                          <p className="font-mono text-xs text-muted-foreground">{script.command}</p>
                        </div>
                      </div>
                      {script.runOnWorktreeCreate && (
                        <span className="rounded bg-primary/14 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                          Runs on worktree create
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-background px-3 py-4 text-xs text-muted-foreground">
                  No scripts configured for this project.
                </div>
              )}
            </section>

            {/* Threads */}
            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-4">
                <h2 className="text-sm font-medium text-foreground">Threads</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  All conversation threads in this project.
                </p>
              </div>
              {threads.length > 0 ? (
                <div className="space-y-2">
                  {threads.map((thread) => (
                    <button
                      key={thread.id}
                      type="button"
                      className="flex w-full items-center gap-3 rounded-lg border border-border bg-background px-3 py-2 text-left transition-colors hover:bg-accent"
                      onClick={() => {
                        void navigate({
                          to: "/$threadId",
                          params: { threadId: thread.id },
                        });
                      }}
                    >
                      <TerminalIcon className="size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {thread.title || "Untitled thread"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(thread.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-background px-3 py-4 text-xs text-muted-foreground">
                  No threads yet. Create one from the sidebar.
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </SidebarInset>
  );
}

export const Route = createFileRoute("/_chat/project/$projectId")({
  component: ProjectDetailRouteView,
});
