import { withSupabase } from 'npm:@supabase/server';

type InvitationRequest = {
  condominiumId?: string;
  email?: string;
};

export default {
  fetch: withSupabase({ auth: 'user' }, async (request, context) => {
    if (request.method !== 'POST') {
      return Response.json({ ok: false, error: 'method_not_allowed' }, { status: 405 });
    }

    const body = await request.json() as InvitationRequest;
    const condominiumId = body.condominiumId?.trim();
    const email = body.email?.trim().toLowerCase();

    if (!condominiumId || !email) {
      return Response.json({ ok: false, error: 'condominium_and_email_required' });
    }

    const { data: platformAccess } = await context.supabase
      .from('platform_admins')
      .select('user_id')
      .eq('user_id', context.userClaims!.sub)
      .maybeSingle();

    if (!platformAccess) {
      return Response.json({ ok: false, error: 'not_authorized' }, { status: 403 });
    }

    const { error: assignmentError } = await context.supabase.rpc('assign_condominium_admin', {
      p_condominium_id: condominiumId,
      p_email: email,
    });

    if (assignmentError) {
      return Response.json({ ok: false, error: assignmentError.message });
    }

    const siteUrl = 'https://sabion.io/domus-one/';
    const { error: inviteError } = await context.supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${siteUrl}?convite=administrador`,
      data: { condominium_id: condominiumId, invited_role: 'admin' },
    });

    if (inviteError) {
      const alreadyRegistered = /already (been )?registered|already exists/i.test(inviteError.message);
      if (alreadyRegistered) {
        return Response.json({ ok: true, delivery: 'existing_user' });
      }

      console.error('Failed to deliver condominium invitation', {
        condominiumId,
        message: inviteError.message,
      });
      return Response.json({
        ok: false,
        assignmentCreated: true,
        error: `email_delivery_failed: ${inviteError.message}`,
      });
    }

    return Response.json({ ok: true, delivery: 'sent' });
  }),
};
