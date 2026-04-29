import { createClient } from "@supabase/supabase-js";

const json = (body, status = 200) => Response.json(body, { status });

export async function POST(request) {
  try {
    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
    const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
    if (!supabaseUrl || !serviceRoleKey) {
      return json({
        error: "Falta configurar NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el servidor.",
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

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const invitation = {
      email,
      role,
      workspace: role === "client" ? workspace : null,
      workspaces: role === "client" ? null : (workspaces && workspaces.length ? workspaces : ["frame"]),
      invited_by: invitedBy,
    };

    const { data: storedInvite, error: storeError } = await supabase
      .from("invitations")
      .upsert(invitation, { onConflict: "email" })
      .select()
      .single();

    if (storeError) {
      return json({ error: storeError.message || "No se pudo guardar la invitación." }, 400);
    }

    const redirectTo = new URL("/?invited=1", request.url).toString();
    const { data: authInvite, error: authError } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: {
        name: displayName,
        role,
        workspace: invitation.workspace,
        workspaces: invitation.workspaces,
      },
      redirectTo,
    });

    return json({
      ok: true,
      invitation: storedInvite,
      auth_invite: authError ? null : authInvite,
      auth_warning: authError ? authError.message : null,
    });
  } catch (error) {
    console.error("invite route:", error);
    return json({ error: error?.message || "No se pudo crear la invitación." }, 500);
  }
}
