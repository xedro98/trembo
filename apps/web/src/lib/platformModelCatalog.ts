import { configuredHostedAppUrl } from "../hostedPairing";

export interface PlatformCatalogModel {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly enabled: boolean;
}

export async function fetchPlatformModelCatalog(
  accessToken: string | undefined,
): Promise<PlatformCatalogModel[]> {
  const token = accessToken?.trim();
  if (!token) {
    return [];
  }

  const baseUrl = configuredHostedAppUrl().replace(/\/+$/u, "");
  const response = await fetch(`${baseUrl}/api/v1/models/catalog`, {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as {
    success?: boolean;
    data?: PlatformCatalogModel[];
  };

  return (payload.data ?? []).filter((model) => model.enabled);
}
