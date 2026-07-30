import {
  scopeProjectRef,
  scopedProjectKey,
  scopeThreadRef,
} from "@trumbo-code/client-runtime/environment";
import { EnvironmentId, ProjectId, ThreadId } from "@trumbo-code/contracts";
import { describe, expect, it } from "vite-plus/test";

import type { SidebarProjectSnapshot } from "./sidebarProjectGrouping";
import {
  countActiveThreadsForProjectGroup,
  formatProjectPickerPath,
  formatThreadCountLabel,
  mostRecentThreadForProjectGroup,
  resolveActiveProjectGroupKey,
} from "./projectPicker.logic";

function makeProjectSnapshot(
  overrides: Partial<SidebarProjectSnapshot> &
    Pick<SidebarProjectSnapshot, "projectKey" | "displayName">,
): SidebarProjectSnapshot {
  const environmentId = EnvironmentId.make("env-local");
  const projectId = ProjectId.make("project-1");
  return {
    id: projectId,
    environmentId,
    workspaceRoot: "/workspace/repo",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    groupedProjectCount: 1,
    environmentPresence: "local-only",
    allRemoteMembersAreDesktopLocal: false,
    memberProjects: [],
    memberProjectRefs: [scopeProjectRef(environmentId, projectId)],
    remoteEnvironmentLabels: [],
    ...overrides,
  } as SidebarProjectSnapshot;
}

const LOCAL_ENV = EnvironmentId.make("env-local");
const PROJECT_ONE = ProjectId.make("project-1");
const PROJECT_TWO = ProjectId.make("project-2");
const THREAD_ONE = ThreadId.make("thread-1");
const THREAD_TWO = ThreadId.make("thread-2");
const THREAD_THREE = ThreadId.make("thread-3");

describe("resolveActiveProjectGroupKey", () => {
  it("prefers draft logical project key over route thread", () => {
    const routeThreadRef = scopeThreadRef(LOCAL_ENV, THREAD_ONE);
    const projectRef = scopeProjectRef(LOCAL_ENV, PROJECT_ONE);
    const physicalKey = "physical:repo";
    const logicalKey = "logical:repo";

    const key = resolveActiveProjectGroupKey({
      routeThreadRef,
      draftLogicalProjectKey: logicalKey,
      threadByKey: new Map([
        [
          "env-local:thread-1",
          {
            environmentId: LOCAL_ENV,
            projectId: PROJECT_ONE,
            id: THREAD_ONE,
            updatedAt: "2026-01-02T00:00:00.000Z",
            archivedAt: null,
          },
        ],
      ]),
      physicalToLogicalKey: new Map([[physicalKey, logicalKey]]),
      projectPhysicalKeyByScopedRef: new Map([[scopedProjectKey(projectRef), physicalKey]]),
    });

    expect(key).toBe(logicalKey);
  });

  it("resolves grouped project key from active thread", () => {
    const routeThreadRef = scopeThreadRef(LOCAL_ENV, THREAD_ONE);
    const projectRef = scopeProjectRef(LOCAL_ENV, PROJECT_ONE);
    const physicalKey = "physical:repo";
    const logicalKey = "logical:repo";

    const key = resolveActiveProjectGroupKey({
      routeThreadRef,
      draftLogicalProjectKey: null,
      threadByKey: new Map([
        [
          "env-local:thread-1",
          {
            environmentId: LOCAL_ENV,
            projectId: PROJECT_ONE,
            id: THREAD_ONE,
            updatedAt: "2026-01-02T00:00:00.000Z",
            archivedAt: null,
          },
        ],
      ]),
      physicalToLogicalKey: new Map([[physicalKey, logicalKey]]),
      projectPhysicalKeyByScopedRef: new Map([[scopedProjectKey(projectRef), physicalKey]]),
    });

    expect(key).toBe(logicalKey);
  });
});

describe("countActiveThreadsForProjectGroup", () => {
  it("counts only non-archived threads in the project group", () => {
    const project = makeProjectSnapshot({
      projectKey: "logical:repo",
      displayName: "Repo",
      memberProjectRefs: [scopeProjectRef(LOCAL_ENV, PROJECT_ONE)],
    });

    const count = countActiveThreadsForProjectGroup(project, [
      {
        environmentId: LOCAL_ENV,
        projectId: PROJECT_ONE,
        id: THREAD_ONE,
        updatedAt: "2026-01-02T00:00:00.000Z",
        archivedAt: null,
      },
      {
        environmentId: LOCAL_ENV,
        projectId: PROJECT_ONE,
        id: THREAD_TWO,
        updatedAt: "2026-01-03T00:00:00.000Z",
        archivedAt: "2026-01-04T00:00:00.000Z",
      },
      {
        environmentId: LOCAL_ENV,
        projectId: PROJECT_TWO,
        id: THREAD_THREE,
        updatedAt: "2026-01-05T00:00:00.000Z",
        archivedAt: null,
      },
    ]);

    expect(count).toBe(1);
  });
});

describe("mostRecentThreadForProjectGroup", () => {
  it("returns the newest active thread for the group", () => {
    const project = makeProjectSnapshot({
      projectKey: "logical:repo",
      displayName: "Repo",
      memberProjectRefs: [scopeProjectRef(LOCAL_ENV, PROJECT_ONE)],
    });

    const recent = mostRecentThreadForProjectGroup(project, [
      {
        environmentId: LOCAL_ENV,
        projectId: PROJECT_ONE,
        id: THREAD_ONE,
        updatedAt: "2026-01-02T00:00:00.000Z",
        archivedAt: null,
      },
      {
        environmentId: LOCAL_ENV,
        projectId: PROJECT_ONE,
        id: THREAD_TWO,
        updatedAt: "2026-01-04T00:00:00.000Z",
        archivedAt: null,
      },
    ]);

    expect(recent?.id).toBe(THREAD_TWO);
  });
});

describe("formatProjectPickerPath", () => {
  it("shortens long paths with a leading ellipsis", () => {
    expect(formatProjectPickerPath("C:/Users/me/code/very/long/nested/repo", 24)).toBe(
      "…/very/long/nested/repo",
    );
  });
});

describe("formatThreadCountLabel", () => {
  it("uses singular and plural labels", () => {
    expect(formatThreadCountLabel(0)).toBe("No threads");
    expect(formatThreadCountLabel(1)).toBe("1 thread");
    expect(formatThreadCountLabel(3)).toBe("3 threads");
  });
});
