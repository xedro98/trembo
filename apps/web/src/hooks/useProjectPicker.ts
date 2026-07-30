import {
  scopeProjectRef,
  scopedProjectKey,
  scopedThreadKey,
  scopeThreadRef,
} from "@trumbo-code/client-runtime/environment";
import { useMemo } from "react";
import { useParams } from "@tanstack/react-router";

import { orderItemsByPreferredIds, sortProjectsForSidebar } from "~/components/Sidebar.logic";
import { isDesktopLocalConnectionTarget } from "~/connection/desktopLocal";
import { useComposerDraftStore } from "~/composerDraftStore";
import { useClientSettings } from "~/hooks/useSettings";
import {
  derivePhysicalProjectKey,
  getProjectOrderKey,
  selectProjectGroupingSettings,
} from "~/logicalProject";
import { legacyProjectCwdPreferenceKey } from "~/uiStateStore";
import {
  buildPhysicalToLogicalProjectKeyMap,
  buildSidebarProjectSnapshots,
} from "~/sidebarProjectGrouping";
import { useProjects, useThreadShells } from "~/state/entities";
import { useEnvironments, usePrimaryEnvironmentId } from "~/state/environments";
import { resolveThreadRouteTarget } from "~/threadRoutes";
import { useUiStateStore } from "~/uiStateStore";
import {
  countActiveThreadsForProjectGroup,
  resolveActiveProjectGroupKey,
  type ProjectPickerThreadSummary,
} from "~/projectPicker.logic";

export function useProjectPicker() {
  const projects = useProjects();
  const threads = useThreadShells();
  const projectOrder = useUiStateStore((store) => store.projectOrder);
  const { environments } = useEnvironments();
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const projectGroupingSettings = useClientSettings(selectProjectGroupingSettings);
  const projectSortOrder = useClientSettings((settings) => settings.sidebarProjectSortOrder);

  const routeTarget = useParams({
    strict: false,
    select: (params) => resolveThreadRouteTarget(params),
  });
  const routeThreadRef = routeTarget?.kind === "server" ? routeTarget.threadRef : null;
  const draftId = routeTarget?.kind === "draft" ? routeTarget.draftId : null;
  const draftSession = useComposerDraftStore((store) =>
    draftId ? store.getDraftSession(draftId) : null,
  );

  const environmentLabelById = useMemo(
    () =>
      new Map(
        environments.map((environment) => [environment.environmentId, environment.label] as const),
      ),
    [environments],
  );

  const desktopLocalEnvironmentIds = useMemo(
    () =>
      new Set(
        environments
          .filter((environment) => isDesktopLocalConnectionTarget(environment.entry.target))
          .map((environment) => environment.environmentId),
      ),
    [environments],
  );

  const orderedProjects = useMemo(() => {
    return orderItemsByPreferredIds({
      items: projects,
      preferredIds: projectOrder,
      getId: getProjectOrderKey,
      getPreferenceIds: (project) => [
        getProjectOrderKey(project),
        legacyProjectCwdPreferenceKey(project.workspaceRoot),
      ],
    });
  }, [projectOrder, projects]);

  const physicalToLogicalKey = useMemo(() => {
    return buildPhysicalToLogicalProjectKeyMap({
      projects: orderedProjects,
      settings: projectGroupingSettings,
      primaryEnvironmentId,
    });
  }, [orderedProjects, projectGroupingSettings, primaryEnvironmentId]);

  const projectPhysicalKeyByScopedRef = useMemo(
    () =>
      new Map(
        orderedProjects.map((project) => [
          scopedProjectKey(scopeProjectRef(project.environmentId, project.id)),
          derivePhysicalProjectKey(project),
        ]),
      ),
    [orderedProjects],
  );

  const projectGroups = useMemo(() => {
    const snapshots = buildSidebarProjectSnapshots({
      projects: orderedProjects,
      settings: projectGroupingSettings,
      primaryEnvironmentId,
      resolveEnvironmentLabel: (environmentId) => environmentLabelById.get(environmentId) ?? null,
      isDesktopLocalEnvironment: (environmentId) => desktopLocalEnvironmentIds.has(environmentId),
    });
    return sortProjectsForSidebar(snapshots, threads, projectSortOrder);
  }, [
    desktopLocalEnvironmentIds,
    environmentLabelById,
    orderedProjects,
    primaryEnvironmentId,
    projectGroupingSettings,
    projectSortOrder,
    threads,
  ]);

  const threadByKey = useMemo(() => {
    return new Map(
      threads.map(
        (thread) =>
          [
            scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id)),
            thread satisfies ProjectPickerThreadSummary,
          ] as const,
      ),
    );
  }, [threads]);

  const activeProjectKey = useMemo(
    () =>
      resolveActiveProjectGroupKey({
        routeThreadRef,
        draftLogicalProjectKey: draftSession?.logicalProjectKey ?? null,
        threadByKey,
        physicalToLogicalKey,
        projectPhysicalKeyByScopedRef,
      }),
    [
      draftSession?.logicalProjectKey,
      physicalToLogicalKey,
      projectPhysicalKeyByScopedRef,
      routeThreadRef,
      threadByKey,
    ],
  );

  const activeProject = useMemo(() => {
    if (!activeProjectKey) {
      return null;
    }
    return projectGroups.find((project) => project.projectKey === activeProjectKey) ?? null;
  }, [activeProjectKey, projectGroups]);

  const threadCountByProjectKey = useMemo(() => {
    const counts = new Map<string, number>();
    for (const project of projectGroups) {
      counts.set(project.projectKey, countActiveThreadsForProjectGroup(project, threads));
    }
    return counts;
  }, [projectGroups, threads]);

  return {
    projectGroups,
    activeProject,
    activeProjectKey,
    threadCountByProjectKey,
    threads,
  };
}
