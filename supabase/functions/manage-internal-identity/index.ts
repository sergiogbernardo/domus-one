import { withSupabase } from 'npm:@supabase/server';

type InternalRole = 'syndic' | 'deputy_syndic' | 'caretaker' | 'doorman' | 'resident';

type InternalIdentityRequest = {
  action?: 'create' | 'reset_password' | 'change_password';
  condominiumId?: string;
  identityId?: string;
  username?: string;
  fullName?: string;
  role?: InternalRole;
  unitId?: string;
  password?: string;
};

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

function createLoginEmail(username: string, registrationCode: string) {
  const normalizedCode = registrationCode.toLowerCase().replace(/[^a-z0-9-]/g, '');
  return `${username}.${normalizedCode}@internal.domusone.invalid`;
}

function createTemporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const random = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
  return `D1!${random}`;
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (request, context) => {
    if (request.method !== 'POST') {
      return Response.json({ ok: false, error: 'method_not_allowed' }, { status: 405 });
    }

    const body = await request.json() as InternalIdentityRequest;
    const action = body.action || 'create';
    const condominiumId = body.condominiumId?.trim();
    const actorId = context.userClaims!.sub;

    if (!condominiumId) {
      return Response.json({ ok: false, error: 'condominium_required' });
    }

    if (action === 'change_password') {
      const password = body.password || '';
      if (password.length < 8 || password.length > 128) {
        return Response.json({ ok: false, error: 'invalid_password' });
      }
      const { data: identity, error: identityError } = await context.supabaseAdmin
        .from('internal_identities')
        .select('id,user_id,username,condominium_id')
        .eq('user_id', actorId)
        .eq('condominium_id', condominiumId)
        .maybeSingle();
      if (identityError || !identity) {
        return Response.json({ ok: false, error: identityError?.message || 'identity_not_found' });
      }
      const { error: passwordError } = await context.supabaseAdmin.auth.admin.updateUserById(actorId, { password });
      if (passwordError) return Response.json({ ok: false, error: passwordError.message });

      const { error: updateError } = await context.supabaseAdmin
        .from('internal_identities')
        .update({ must_change_password: false })
        .eq('id', identity.id);
      if (updateError) return Response.json({ ok: false, error: updateError.message });

      await context.supabaseAdmin.from('audit_events').insert({
        condominium_id: condominiumId,
        actor_id: actorId,
        action: 'internal_password_changed',
        entity_type: 'internal_identity',
        entity_id: identity.id,
        metadata: { username: identity.username },
      });
      return Response.json({ ok: true });
    }

    const { data: condominiumAccess, error: condominiumAccessError } = await context.supabaseAdmin
      .from('staff_memberships')
      .select('id')
      .eq('condominium_id', condominiumId)
      .eq('user_id', actorId)
      .in('role', ['admin', 'syndic', 'deputy_syndic'])
      .eq('status', 'active')
      .maybeSingle();

    if (condominiumAccessError) {
      console.error('Failed to validate condominium manager', {
        condominiumId,
        actorId,
        message: condominiumAccessError.message,
      });
      return Response.json({ ok: false, error: condominiumAccessError.message });
    }
    if (!condominiumAccess) {
      return Response.json({ ok: false, error: 'not_authorized' });
    }

    if (action === 'reset_password') {
      const identityId = body.identityId?.trim();
      if (!identityId) return Response.json({ ok: false, error: 'identity_required' });

      const { data: identity, error: identityError } = await context.supabaseAdmin
        .from('internal_identities')
        .select('id,user_id,username,condominium_id')
        .eq('id', identityId)
        .eq('condominium_id', condominiumId)
        .maybeSingle();
      if (identityError || !identity) {
        return Response.json({ ok: false, error: identityError?.message || 'identity_not_found' });
      }

      const temporaryPassword = createTemporaryPassword();
      const { error: passwordError } = await context.supabaseAdmin.auth.admin.updateUserById(identity.user_id, {
        password: temporaryPassword,
      });
      if (passwordError) return Response.json({ ok: false, error: passwordError.message });

      const { error: updateError } = await context.supabaseAdmin
        .from('internal_identities')
        .update({ must_change_password: true, password_reset_at: new Date().toISOString() })
        .eq('id', identity.id);
      if (updateError) return Response.json({ ok: false, error: updateError.message });

      await context.supabaseAdmin.from('audit_events').insert({
        condominium_id: condominiumId,
        actor_id: actorId,
        action: 'internal_password_reset',
        entity_type: 'internal_identity',
        entity_id: identity.id,
        metadata: { username: identity.username },
      });

      return Response.json({
        ok: true,
        credentials: { username: identity.username, temporaryPassword },
      });
    }

    const username = normalizeUsername(body.username || '');
    const fullName = body.fullName?.trim() || '';
    const role = body.role;
    const unitId = body.unitId?.trim();
    if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) {
      return Response.json({ ok: false, error: 'invalid_username' });
    }
    if (fullName.length < 2 || fullName.length > 160) {
      return Response.json({ ok: false, error: 'invalid_full_name' });
    }
    if (!role || !['syndic', 'deputy_syndic', 'caretaker', 'doorman', 'resident'].includes(role)) {
      return Response.json({ ok: false, error: 'invalid_role' });
    }
    if (role === 'resident' && !unitId) {
      return Response.json({ ok: false, error: 'unit_required' });
    }

    const { data: condominium, error: condominiumError } = await context.supabaseAdmin
      .from('condominiums')
      .select('id,registration_code')
      .eq('id', condominiumId)
      .eq('status', 'active')
      .maybeSingle();
    if (condominiumError || !condominium) {
      return Response.json({ ok: false, error: condominiumError?.message || 'condominium_not_found' });
    }

    if (role === 'resident') {
      const { data: unit } = await context.supabaseAdmin
        .from('units')
        .select('id')
        .eq('id', unitId!)
        .eq('condominium_id', condominiumId)
        .eq('status', 'active')
        .maybeSingle();
      if (!unit) return Response.json({ ok: false, error: 'unit_not_found' });
    }

    const { data: existingIdentity } = await context.supabaseAdmin
      .from('internal_identities')
      .select('id')
      .eq('condominium_id', condominiumId)
      .eq('username', username)
      .maybeSingle();
    if (existingIdentity) return Response.json({ ok: false, error: 'username_already_exists' });

    const loginEmail = createLoginEmail(username, condominium.registration_code);
    const temporaryPassword = createTemporaryPassword();
    const { data: createdUser, error: createUserError } = await context.supabaseAdmin.auth.admin.createUser({
      email: loginEmail,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        internal_account: true,
        condominium_id: condominiumId,
      },
    });
    if (createUserError || !createdUser.user) {
      return Response.json({ ok: false, error: createUserError?.message || 'user_creation_failed' });
    }

    const userId = createdUser.user.id;
    const { data: identity, error: identityError } = await context.supabaseAdmin
      .from('internal_identities')
      .insert({
        condominium_id: condominiumId,
        user_id: userId,
        username,
        login_email: loginEmail,
        created_by: actorId,
      })
      .select('id')
      .single();

    if (identityError || !identity) {
      await context.supabaseAdmin.auth.admin.deleteUser(userId);
      return Response.json({ ok: false, error: identityError?.message || 'identity_creation_failed' });
    }

    const membershipResult = role === 'resident'
      ? await context.supabaseAdmin.from('unit_memberships').insert({
          condominium_id: condominiumId,
          unit_id: unitId!,
          user_id: userId,
          status: 'active',
          approved_at: new Date().toISOString(),
          approved_by: actorId,
        })
      : await context.supabaseAdmin.from('staff_memberships').insert({
          condominium_id: condominiumId,
          user_id: userId,
          invited_email: loginEmail,
          role,
          is_owner: false,
          status: 'active',
          created_by: actorId,
          activated_at: new Date().toISOString(),
        });

    if (membershipResult.error) {
      await context.supabaseAdmin.auth.admin.deleteUser(userId);
      return Response.json({ ok: false, error: membershipResult.error.message });
    }

    await context.supabaseAdmin.from('audit_events').insert({
      condominium_id: condominiumId,
      actor_id: actorId,
      action: 'internal_identity_created',
      entity_type: 'internal_identity',
      entity_id: identity.id,
      metadata: { username, role, unit_id: unitId || null },
    });

    return Response.json({
      ok: true,
      credentials: {
        username,
        temporaryPassword,
        condominiumCode: condominium.registration_code,
      },
    });
  }),
};
