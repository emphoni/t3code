import { ProjectId } from "@t3tools/contracts";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useStore } from "../store";
import { SidebarInset } from "~/components/ui/sidebar";
import { isElectron } from "../env";
import { FolderIcon, TerminalIcon } from "lucide-react";
import { useMemo, useState } from "react";

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

function ProjectDetailRouteView() {
  const navigate = useNavigate();
  const projectId = Route.useParams({
    select: (params) => ProjectId.makeUnsafe(params.projectId),
  });
  const projects = useStore((store) => store.projects);
  const allThreads = useStore((store) => store.threads);
  const project = useMemo(
    () => projects.find((p) => p.id === projectId),
    [projects, projectId],
  );
  const threads = useMemo(
    () => allThreads.filter((t) => t.projectId === projectId),
    [allThreads, projectId],
  );

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
    play: "▶",
    test: "🧪",
    lint: "🔍",
    build: "🔨",
    debug: "🐛",
    configure: "⚙",
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
                        <span className="text-base">{scriptIconMap[script.icon] ?? "▶"}</span>
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
