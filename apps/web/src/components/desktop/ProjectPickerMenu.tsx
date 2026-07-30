import { scopeProjectRef, scopeThreadRef } from "@trumbo-code/client-runtime/environment";
import {
  CheckIcon,
  ChevronDownIcon,
  CloudIcon,
  ContainerIcon,
  FolderIcon,
  FolderPlusIcon,
  PlusIcon,
  SquarePenIcon,
} from "lucide-react";
import { useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";

import { openCommandPalette } from "~/commandPaletteBus";
import { useNewThreadHandler } from "~/hooks/useHandleNewThread";
import { useProjectPicker } from "~/hooks/useProjectPicker";
import { cn } from "~/lib/utils";
import {
  describeProjectEnvironmentSummary,
  formatProjectPickerPath,
  formatThreadCountLabel,
  mostRecentThreadForProjectGroup,
} from "~/projectPicker.logic";
import type { SidebarProjectSnapshot } from "~/sidebarProjectGrouping";
import { buildThreadRouteParams } from "~/threadRoutes";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "~/components/ui/menu";
import { ProjectFavicon } from "~/components/ProjectFavicon";

function representativeProjectMember(project: SidebarProjectSnapshot) {
  return project.memberProjects[0] ?? project;
}

function ProjectEnvironmentBadge({ project }: { project: SidebarProjectSnapshot }) {
  if (project.environmentPresence === "local-only") {
    return null;
  }

  const label =
    project.environmentPresence === "mixed"
      ? "Mixed"
      : project.allRemoteMembersAreDesktopLocal
        ? "Sandbox"
        : "Remote";

  return (
    <Badge size="sm" variant="muted" className="gap-1 px-1.5 py-0">
      {project.allRemoteMembersAreDesktopLocal ? (
        <ContainerIcon className="size-2.5" />
      ) : (
        <CloudIcon className="size-2.5" />
      )}
      {label}
    </Badge>
  );
}

function ActiveProjectPanel({
  project,
  threadCount,
  onNewThread,
}: {
  project: SidebarProjectSnapshot;
  threadCount: number;
  onNewThread: () => void;
}) {
  const member = representativeProjectMember(project);

  return (
    <div className="border-b border-border/70 px-3 py-3" data-testid="project-picker-active-panel">
      <p className="mb-2 text-[10px] font-medium tracking-[0.12em] text-muted-foreground/70 uppercase">
        Active project
      </p>
      <div className="flex items-start gap-2.5">
        <ProjectFavicon
          environmentId={member.environmentId}
          cwd={member.workspaceRoot}
          className="mt-0.5 size-4 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-foreground">{project.displayName}</p>
            <ProjectEnvironmentBadge project={project} />
          </div>
          <p
            className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground/80"
            title={member.workspaceRoot}
          >
            {formatProjectPickerPath(member.workspaceRoot)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground/75">
            {formatThreadCountLabel(threadCount)} · {describeProjectEnvironmentSummary(project)}
          </p>
        </div>
      </div>
      <Button
        type="button"
        size="xs"
        variant="outline"
        className="mt-3 h-7 w-full gap-1.5"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onNewThread();
        }}
      >
        <SquarePenIcon className="size-3.5" />
        New thread
      </Button>
    </div>
  );
}

export function ProjectPickerMenu() {
  const navigate = useNavigate();
  const handleNewThread = useNewThreadHandler();
  const { projectGroups, activeProject, activeProjectKey, threadCountByProjectKey, threads } =
    useProjectPicker();

  const openAddProject = useCallback(() => openCommandPalette({ open: "add-project" }), []);

  const openProject = useCallback(
    async (project: SidebarProjectSnapshot) => {
      const representative = representativeProjectMember(project);
      const projectRef = scopeProjectRef(representative.environmentId, representative.id);
      const recent = mostRecentThreadForProjectGroup(project, threads);
      if (recent) {
        void navigate({
          to: "/$environmentId/$threadId",
          params: buildThreadRouteParams(scopeThreadRef(recent.environmentId, recent.id)),
        });
        return;
      }
      await handleNewThread(projectRef);
    },
    [handleNewThread, navigate, threads],
  );

  const createThreadInProject = useCallback(
    async (project: SidebarProjectSnapshot) => {
      const representative = representativeProjectMember(project);
      await handleNewThread(scopeProjectRef(representative.environmentId, representative.id));
    },
    [handleNewThread],
  );

  const triggerMember = activeProject ? representativeProjectMember(activeProject) : null;
  const activeThreadCount = activeProject
    ? (threadCountByProjectKey.get(activeProject.projectKey) ?? 0)
    : 0;

  return (
    <Menu>
      <MenuTrigger
        render={
          <Button
            variant="outline"
            size="xs"
            className={cn(
              "input-surface h-8 max-w-60 shrink-0 gap-2 rounded-md px-2.5 [-webkit-app-region:no-drag]",
              "text-foreground hover:text-foreground",
            )}
            aria-label="Switch project"
            data-testid="project-picker-trigger"
          />
        }
      >
        {triggerMember ? (
          <ProjectFavicon
            environmentId={triggerMember.environmentId}
            cwd={triggerMember.workspaceRoot}
            className="size-3.5 shrink-0"
          />
        ) : (
          <FolderIcon className="size-3.5 shrink-0 text-muted-foreground/70" />
        )}
        <span className="flex min-w-0 flex-1 flex-col items-start leading-tight">
          <span className="w-full truncate text-left text-xs font-medium">
            {activeProject?.displayName ??
              (projectGroups.length === 0 ? "No projects" : "Projects")}
          </span>
          {activeProject ? (
            <span className="w-full truncate text-left text-[10px] text-muted-foreground/75">
              {formatThreadCountLabel(activeThreadCount)}
            </span>
          ) : null}
        </span>
        <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground/70" />
      </MenuTrigger>
      <MenuPopup
        align="start"
        side="bottom"
        sideOffset={6}
        className="w-80 max-w-[min(20rem,calc(100vw-2rem))] p-0"
      >
        {activeProject ? (
          <ActiveProjectPanel
            project={activeProject}
            threadCount={activeThreadCount}
            onNewThread={() => void createThreadInProject(activeProject)}
          />
        ) : null}
        <div className="px-1 py-1">
          <MenuGroup>
            <MenuGroupLabel className="px-2 text-[10px] tracking-[0.12em] uppercase">
              {activeProject ? "Switch project" : "Projects"}
            </MenuGroupLabel>
            {projectGroups.length === 0 ? (
              <MenuItem disabled>No projects yet</MenuItem>
            ) : (
              projectGroups.map((project) => {
                const member = representativeProjectMember(project);
                const isActive = project.projectKey === activeProjectKey;
                const threadCount = threadCountByProjectKey.get(project.projectKey) ?? 0;
                return (
                  <MenuItem
                    key={project.projectKey}
                    onClick={() => void openProject(project)}
                    className="gap-2 py-2"
                    data-testid={`project-picker-item-${project.projectKey}`}
                    data-active={isActive ? "true" : undefined}
                  >
                    <ProjectFavicon
                      environmentId={member.environmentId}
                      cwd={member.workspaceRoot}
                      className="size-3.5"
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-sm leading-none">{project.displayName}</span>
                      <span className="truncate font-mono text-[10px] text-muted-foreground/70">
                        {formatProjectPickerPath(member.workspaceRoot, 36)}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground/75">
                      {threadCount > 0 ? <span>{threadCount}</span> : null}
                      {isActive ? <CheckIcon className="size-3.5 text-foreground" /> : null}
                    </span>
                  </MenuItem>
                );
              })
            )}
          </MenuGroup>
          <MenuSeparator />
          <MenuItem onClick={openAddProject} className="gap-2">
            <FolderPlusIcon className="size-3.5" />
            Add project
          </MenuItem>
          <MenuItem onClick={() => openCommandPalette({ open: "new-thread-in" })} className="gap-2">
            <PlusIcon className="size-3.5" />
            New thread in…
          </MenuItem>
        </div>
      </MenuPopup>
    </Menu>
  );
}
