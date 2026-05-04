import { createClient } from "@supabase/supabase-js";

const json = (body, status = 200) => Response.json(body, { status });
const INVITE_API_VERSION = "2026-05-04-resend-direct-v2";
const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

async function sendResendInvite({ apiKey, from, to, inviteLink, displayName }) {
  const safeName = escapeHtml(displayName || to);
  const safeLink = escapeHtml(inviteLink);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "gonzo-agencia/1.0",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Tu invitacion a Gonzo Agencia",
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#171717">
          <p>Hola ${safeName},</p>
          <p>Te hemos invitado a entrar en Gonzo Agencia.</p>
          <p>
            <a href="${safeLink}" style="display:inline-block;background:#171717;color:#fff;padding:12px 16px;border-radius:6px;text-decoration:none">
              Aceptar invitacion
            </a>
          </p>
          <p>Si el boton no funciona, copia este enlace en tu navegador:</p>
          <p style="word-break:break-all;color:#555">${safeLink}</p>
        </div>
      `,
      text: `Hola ${displayName || to},\n\nTe hemos invitado a entrar en Gonzo Agencia.\n\nAcepta la invitacion aqui:\n${inviteLink}\n`,
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body?.message || body?.error || response.statusText || "Resend no pudo enviar el email.";
    throw new Error(`Resend: ${message}`);
  }
  return body;
}

export async function POST(request) {
  try {
    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
    const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
    const secretKey = (process.env.SUPABASE_SECRET_KEY || "").trim();
    const dbAdminKey = serviceRoleKey || secretKey;
    const resendApiKey = (
      process.env.RESEND_API_KEY ||
      process.env.RESEND_KEY ||
      ""
    ).trim();
    const resendFrom = (
      process.env.RESEND_FROM ||
      process.env.RESEND_FROM_EMAIL ||
      process.env.EMAIL_FROM ||
      (resendApiKey ? "Gonzo Agencia <onboarding@resend.dev>" : "") ||
      ""
    ).trim();
    const resendConfigured = Boolean(resendApiKey && resendFrom);

    if (!supabaseUrl || !dbAdminKey) {
      return json({
        error: "Falta configurar NEXT_PUBLIC_SUPABASE_URL y una clave server de Supabase (SUPABASE_SERVICE_ROLE_KEY o SUPABASE_SECRET_KEY) en Vercel.",
      }, 501);
    }

    const payload = await request.json();
    const email = String(payload?.email || "").trim().toLowerCase();
    const role = String(payload?.role || "client").trim();
    const workspace = payload?.workspace ? String(payload.workspace).trim() : null;
    const workspaces = Array.isArray(payload?.workspaces) ? payload.workspaces.filter(Boolean).map(String) : null;
    const invitedBy = payload?.invited_by || null;
    const displayName = String(payload?.name || email.split("@")[0] || "").trim();

    if (!email) {
      return json({ error: "El email es obligatorio." }, 400);
    }

    const supabase = createClient(supabaseUrl, dbAdminKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });

    const invitation = {
      email,
      role,
      workspace: role === "client" ? workspace : null,
      workspaces: role === "client" ? null : (workspaces && workspaces.length ? workspaces : ["frame"]),
      invited_by: invitedBy,
    };

    const { error: storeError } = await supabase
      .from("invitations")
      .upsert(invitation, { onConflict: "email" });

    if (storeError) {
      return json({ error: storeError.message || "No se pudo guardar la invitación." }, 400);
    }

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/$/, "");
    const redirectTo = siteUrl ? `${siteUrl}/?invited=1` : new URL("/?invited=1", request.url).toString();
    const inviteOptions = {
      data: {
        name: displayName,
        role,
        workspace: invitation.workspace,
        workspaces: invitation.workspaces,
      },
      redirectTo,
    };

    let authInvite = null;
    let authWarning = null;
    let inviteLink = null;
    let resendEmail = null;
    let mailer = "none";

    if (!serviceRoleKey) {
      authWarning = "La invitacion se guardo, pero Supabase Auth Admin necesita SUPABASE_SERVICE_ROLE_KEY para enviar el email. SUPABASE_SECRET_KEY sirve como clave elevada de servidor, pero inviteUserByEmail documenta service_role.";
    } else {
      const authSupabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      });

      if (resendConfigured) {
        mailer = "resend";
        const { data: linkData, error: linkError } = await authSupabase.auth.admin.generateLink({
          type: "invite",
          email,
          options: inviteOptions,
        });
        inviteLink = linkData?.properties?.action_link || linkData?.properties?.actionLink || null;
        if (linkError) {
          authWarning = linkError.message;
        } else if (!inviteLink) {
          authWarning = "Supabase genero la invitacion, pero no devolvio un enlace para enviar por Resend.";
        } else {
          try {
            resendEmail = await sendResendInvite({
              apiKey: resendApiKey,
              from: resendFrom,
              to: email,
              inviteLink,
              displayName,
            });
          } catch (emailError) {
            console.error("resend invite:", emailError);
            authWarning = emailError?.message || "Resend no pudo enviar el email.";
          }
        }
      } else {
        mailer = "supabase-auth";
        const { data, error } = await authSupabase.auth.admin.inviteUserByEmail(email, inviteOptions);
        authInvite = error ? null : data;
        authWarning = error
          ? error.message
          : (!resendApiKey && !resendFrom ? null : "Resend no esta configurado completo en Vercel. Revisa RESEND_API_KEY y RESEND_FROM.");

        if (error) {
          const { data: linkData, error: linkError } = await authSupabase.auth.admin.generateLink({
            type: "invite",
            email,
            options: inviteOptions,
          });
          inviteLink = linkData?.properties?.action_link || linkData?.properties?.actionLink || null;
          if (linkError && !authWarning) {
            authWarning = linkError.message;
          }
        }
      }
    }

    return json({
      ok: true,
      invite_api_version: INVITE_API_VERSION,
      invitation,
      auth_invite: authInvite,
      auth_warning: authWarning,
      invite_link: inviteLink,
      mailer,
      resend_configured: resendConfigured,
      resend_from_configured: Boolean(resendFrom),
      resend_api_key_configured: Boolean(resendApiKey),
      resend_email: resendEmail,
    });
  } catch (error) {
    console.error("invite route:", error);
    return json({ error: error?.message || "No se pudo crear la invitación." }, 500);
  }
}
