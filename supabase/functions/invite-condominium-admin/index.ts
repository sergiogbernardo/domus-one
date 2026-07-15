import { withSupabase } from 'npm:@supabase/server';

type InvitationRole = 'admin' | 'doorman' | 'resident';

type InvitationRequest = {
  condominiumId?: string;
  email?: string;
  role?: InvitationRole;
  unitId?: string;
  fullName?: string;
};

export default {
  fetch: withSupabase({ auth: 'user' }, async (request, context) => {
    if (request.method !== 'POST') {
      return Response.json({ ok: false, error: 'method_not_allowed' }, { status: 405 });
    }

    const body = await request.json() as InvitationRequest;
    const condominiumId = body.condominiumId?.trim();
    const email = body.email?.trim().toLowerCase();
    const role = body.role || 'admin';
    const unitId = body.unitId?.trim();
    const fullName = body.fullName?.trim();

    if (!condominiumId || !email) {
      return Response.json({ ok: false, error: 'condominium_and_email_required' });
    }
    if (!['admin', 'doorman', 'resident'].includes(role)) {
      return Response.json({ ok: false, error: 'invalid_role' });
    }
    if (role === 'resident' && !unitId) {
      return Response.json({ ok: false, error: 'unit_required' });
    }

    const userId = context.userClaims!.sub;
    const { data: platformAccess } = await context.supabase
      .from('platform_admins')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!platformAccess) {
      if (role === 'admin') {
        return Response.json({ ok: false, error: 'not_authorized' }, { status: 403 });
      }
      const { data: condominiumAccess } = await context.supabase
        .from('staff_memberships')
        .select('id')
        .eq('condominium_id', condominiumId)
        .eq('user_id', userId)
        .eq('role', 'admin')
        .eq('status', 'active')
        .maybeSingle();
      if (!condominiumAccess) {
        return Response.json({ ok: false, error: 'not_authorized' }, { status: 403 });
      }
    }

    if (role === 'resident') {
      const { data: unit } = await context.supabase
        .from('units')
        .select('id')
        .eq('id', unitId!)
        .eq('condominium_id', condominiumId)
        .eq('status', 'active')
        .maybeSingle();
      if (!unit) return Response.json({ ok: false, error: 'unit_not_found' });
    }

    if (role === 'admin') {
      const { error } = await context.supabase.rpc('assign_condominium_admin', {
        p_condominium_id: condominiumId,
        p_email: email,
      });
      if (error) return Response.json({ ok: false, error: error.message });
    }

    if (role === 'doorman') {
      const { data: existingMembership } = await context.supabase
        .from('staff_memberships')
        .select('id,status')
        .eq('condominium_id', condominiumId)
        .eq('role', 'doorman')
        .eq('invited_email', email)
        .maybeSingle();
      const operation = existingMembership?.status === 'inactive'
        ? context.supabase.rpc('set_staff_member_status', { p_membership_id: existingMembership.id, p_active: true })
        : existingMembership
          ? Promise.resolve({ error: null })
          : context.supabase.rpc('invite_staff_member', { p_condominium_id: condominiumId, p_email: email, p_role: 'doorman' });
      const { error } = await operation;
      if (error) return Response.json({ ok: false, error: error.message });
    }

    const siteUrl = 'https://sabion.io/domus-one/';
    const { data: inviteData, error: inviteError } = await context.supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${siteUrl}?convite=${role}`,
      data: { condominium_id: condominiumId, invited_role: role, full_name: fullName || undefined },
    });

    let invitedUserId = inviteData.user?.id;
    let delivery: 'sent' | 'existing_user' = 'sent';
    if (inviteError) {
      const alreadyRegistered = /already (been )?registered|already exists/i.test(inviteError.message);
      if (!alreadyRegistered) {
        console.error('Failed to deliver condominium invitation', { condominiumId, role, message: inviteError.message });
        return Response.json({ ok: false, assignmentCreated: role !== 'resident', error: `email_delivery_failed: ${inviteError.message}` });
      }
      delivery = 'existing_user';
      const { data: usersData, error: usersError } = await context.supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (usersError) return Response.json({ ok: false, error: usersError.message });
      invitedUserId = usersData.users.find((user) => user.email?.toLowerCase() === email)?.id;
      if (!invitedUserId) return Response.json({ ok: false, error: 'existing_user_not_found' });
    }

    if (role === 'resident') {
      const { data: existingResident } = await context.supabaseAdmin
        .from('unit_memberships')
        .select('id,status')
        .eq('unit_id', unitId!)
        .eq('user_id', invitedUserId!)
        .maybeSingle();
      const membershipPayload = {
        condominium_id: condominiumId,
        unit_id: unitId!,
        user_id: invitedUserId!,
        status: 'active',
        approved_at: new Date().toISOString(),
        approved_by: userId,
        status_reason: null,
        deactivated_at: null,
        deactivated_by: null,
      };
      const { error: membershipError } = existingResident
        ? await context.supabaseAdmin.from('unit_memberships').update(membershipPayload).eq('id', existingResident.id)
        : await context.supabaseAdmin.from('unit_memberships').insert(membershipPayload);
      if (membershipError) return Response.json({ ok: false, error: membershipError.message });
    }

    return Response.json({ ok: true, delivery });
  }),
};
