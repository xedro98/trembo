import { createEcosystemEnvironmentAtoms } from "@trumbo-code/client-runtime/state/ecosystem";

import { connectionAtomRuntime } from "../connection/runtime";

export const ecosystemEnvironment = createEcosystemEnvironmentAtoms(connectionAtomRuntime);
