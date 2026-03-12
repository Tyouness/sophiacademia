import { NextResponse } from "next/server";
import { z } from "zod";
import nodemailer from "nodemailer";
import { getClientIp } from "@/lib/security/rate-limit";
import { rateLimitMemory } from "@/lib/security/memory-rate-limit";

const contactSchema = z.object({
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  city: z.string().trim().max(120).optional().or(z.literal("")),
  message: z.string().trim().min(10).max(5000),
  company: z.string().max(0).optional().or(z.literal("")),
});

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? "0");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;
  const to = process.env.CONTACT_TO_EMAIL ?? "Younesstaleb10@gmail.com";
  const secure = (process.env.SMTP_SECURE ?? "false") === "true";

  if (!host || !port || !user || !pass || !from) {
    throw new Error("smtp_not_configured");
  }

  return { host, port, user, pass, from, to, secure };
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limiter = rateLimitMemory(`contact:${ip}`, 8, 10 * 60 * 1000);
  if (!limiter.success) {
    return NextResponse.json({ error: "Trop de tentatives, réessayez plus tard." }, { status: 429 });
  }

  let payload: z.infer<typeof contactSchema>;
  try {
    payload = contactSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Payload invalide." }, { status: 400 });
  }

  if (payload.company && payload.company.trim().length > 0) {
    return NextResponse.json({ ok: true });
  }

  try {
    const smtp = getSmtpConfig();
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: {
        user: smtp.user,
        pass: smtp.pass,
      },
    });

    const subject = `Nouveau lead Sophiacademia - ${payload.firstName} ${payload.lastName}`;
    const text = [
      `Prénom: ${payload.firstName}`,
      `Nom: ${payload.lastName}`,
      `Email: ${payload.email}`,
      `Téléphone: ${payload.phone || "-"}`,
      `Ville: ${payload.city || "-"}`,
      "",
      "Message:",
      payload.message,
    ].join("\n");

    await transporter.sendMail({
      from: smtp.from,
      to: smtp.to,
      replyTo: payload.email,
      subject,
      text,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Envoi impossible pour le moment." }, { status: 500 });
  }
}
