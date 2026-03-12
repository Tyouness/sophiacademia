type EmailPayload = {
  to: string | string[];
  subject: string;
  text: string;
};

export async function sendEmail(payload: EmailPayload, accessToken?: string | null) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && anonKey && accessToken) {
    const url = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/send-email`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      const apiKey = process.env.RESEND_API_KEY;
      const from = process.env.EMAIL_FROM;
      if ((response.status === 401 || response.status === 404) && apiKey && from) {
        const fallback = await fetch("https://api.resend.com/emails", {
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

        if (!fallback.ok) {
          const fallbackBody = await fallback.text().catch(() => "");
          throw new Error(
            `email_send_failed: ${fallback.status} ${fallbackBody}`,
          );
        }

        return { sent: true, via: "resend-fallback" } as const;
      }

      throw new Error(`supabase_email_failed: ${response.status} ${body}`);
    }

    return { sent: true, via: "supabase" } as const;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    console.warn("[email] missing email config; skipping send");
    return { skipped: true } as const;
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
    throw new Error(`email_send_failed: ${response.status} ${body}`);
  }

  return { sent: true, via: "resend" } as const;
}
