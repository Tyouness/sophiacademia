import type {
  UrssafClientPayload,
  UrssafInvoicePayload,
  UrssafPaymentStatus,
  UrssafSubmitInvoiceResult,
} from "@/lib/urssaf/types";

type TokenCache = { token: string; expiresAt: number } | null;
let tokenCache: TokenCache = null;

function getConfig() {
  const baseUrl = process.env.URSSAF_BASE_URL;
  const clientId = process.env.URSSAF_CLIENT_ID;
  const clientSecret = process.env.URSSAF_CLIENT_SECRET;
  if (!baseUrl || !clientId || !clientSecret) {
    throw new Error("Missing URSSAF configuration");
  }
  return { baseUrl: baseUrl.replace(/\/$/, ""), clientId, clientSecret };
}

async function getAccessToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) {
    return tokenCache.token;
  }

  const { baseUrl, clientId, clientSecret } = getConfig();
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "tiers-prestation",
  });

  const response = await fetch(`${baseUrl}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`urssaf_oauth_failed:${response.status}:${body}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in?: number };
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 300) * 1000,
  };
  return data.access_token;
}

async function urssafFetch(path: string, init?: RequestInit) {
  const token = await getAccessToken();
  const { baseUrl } = getConfig();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`urssaf_api_failed:${response.status}:${body}`);
  }

  return response;
}

const isSandbox = () => {
  const mode = process.env.URSSAF_MODE ?? "sandbox";
  return mode !== "production";
};

export async function registerClient(payload: UrssafClientPayload) {
  if (isSandbox()) {
    return {
      customerId: `sandbox-${payload.familyId}`,
      status: "registered" as const,
    };
  }

  const response = await urssafFetch("/tiers-prestation/clients", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as { customerId: string; status: string };
  return {
    customerId: data.customerId,
    status: data.status,
  };
}

/**
 * Re-fetch the registration status of an existing URSSAF client by their
 * URSSAF-assigned customer ID. Used to resolve clients stuck in 'pending'.
 */
export async function getClientStatus(
  urssafCustomerId: string,
): Promise<{ status: "pending" | "registered" | "rejected" }> {
  if (isSandbox()) {
    // Sandbox: any client that was registered always comes back as registered.
    return { status: "registered" };
  }

  const response = await urssafFetch(`/tiers-prestation/clients/${urssafCustomerId}`, {
    method: "GET",
  });
  const data = (await response.json()) as { status: string };
  const status = data.status as "pending" | "registered" | "rejected";
  return { status };
}

export async function submitInvoice(
  payload: UrssafInvoicePayload,
): Promise<UrssafSubmitInvoiceResult> {
  if (isSandbox()) {
    return {
      paymentId: `sandbox-payment-${payload.invoiceId}`,
      status: "pending_validation",
    };
  }

  const response = await urssafFetch("/tiers-prestation/invoices", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as { paymentId: string; status: UrssafSubmitInvoiceResult["status"] };
  return {
    paymentId: data.paymentId,
    status: data.status,
  };
}

export async function getPaymentStatus(paymentId: string): Promise<UrssafPaymentStatus> {
  if (isSandbox()) {
    return {
      paymentId,
      status: "validated",
      validatedAt: new Date().toISOString(),
    };
  }

  const response = await urssafFetch(`/tiers-prestation/payments/${paymentId}`, {
    method: "GET",
  });
  const data = (await response.json()) as UrssafPaymentStatus;
  return data;
}
