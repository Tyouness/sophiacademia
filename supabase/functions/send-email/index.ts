// @ts-nocheck
/// <reference types="https://deno.land/x/supabase_edge_runtime@1.67.1/types.d.ts" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type Payload = {
  to: string | string[];
  subject: string;
  text: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  if (!payload?.to || !payload.subject || !payload.text) {
    return jsonResponse({ error: "invalid_payload" }, 400);
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("EMAIL_FROM");

  if (!apiKey || !from) {
    return jsonResponse({ error: "missing_email_config" }, 500);
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return jsonResponse(
      { error: "email_send_failed", details: body },
      response.status,
    );
  }

  return jsonResponse({ sent: true });
});
