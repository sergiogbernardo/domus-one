import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  Archive,
  ArrowLeft,
  Bell,
  Boxes,
  Building2,
  Check,
  ChevronDown,
  Clock3,
  Copy,
  KeyRound,
  LayoutDashboard,
  Mail,
  LoaderCircle,
  LogOut,
  Menu,
  PackageCheck,
  PackagePlus,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  UserRound,
  UserPlus,
  UsersRound,
  X,
} from 'lucide-react';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import PublicSite from './PublicSite';
import type { AppView, PackageRecord } from './types';

type NewPackageForm = {
  unitId: string;
  resident: string;
  carrier: string;
  note: string;
};

const emptyForm: NewPackageForm = {
  unitId: '',
  resident: '',
  carrier: '',
  note: '',
};

type OperationalCondominium = {
  id: string;
  name: string;
  registrationCode: string;
  staffLimit: number;
  legalName: string | null;
  documentNumber: string | null;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  contactName: string | null;
  contactEmail: string | null;
};

type OperationalUnit = {
  id: string;
  unitNumber: string;
  buildingId: string;
  buildingName: string;
  floorLabel: string | null;
};

type OperationalBuilding = {
  id: string;
  name: string;
  code: string;
  floors: number | null;
};

type InternalCredentials = {
  username: string;
  temporaryPassword: string;
  condominiumCode?: string;
};

type CreateResult = { ok: boolean; error?: string; credentials?: InternalCredentials };

type StaffRole = 'admin' | 'syndic' | 'deputy_syndic' | 'caretaker' | 'doorman';
type StaffInvitationRole = Exclude<StaffRole, 'admin'>;
type PersonInvitationRole = StaffInvitationRole | 'resident';

const staffRoleLabels: Record<StaffRole, string> = {
  admin: 'Administrador principal',
  syndic: 'Síndico',
  deputy_syndic: 'Subsíndico',
  caretaker: 'Zelador',
  doorman: 'Porteiro',
};

type StaffPerson = {
  id: string;
  identityId: string | null;
  userId: string | null;
  username: string | null;
  email: string;
  fullName: string;
  role: StaffRole;
  status: 'invited' | 'active' | 'inactive';
  isOwner: boolean;
};

type ResidentPerson = {
  id: string;
  identityId: string | null;
  userId: string;
  username: string | null;
  email: string;
  fullName: string;
  status: 'pending' | 'active' | 'inactive' | 'rejected';
  unitId: string;
  unitNumber: string;
  buildingName: string;
};

type PackageRow = {
  id: string;
  unit_id: string;
  recipient_name: string;
  carrier: string;
  description: string | null;
  status: 'waiting' | 'collected' | 'cancelled';
  received_at: string;
  collected_at: string | null;
};

function formatDateTime(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (left: Date, right: Date) => left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
  const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date);
  if (sameDay(date, today)) return `Hoje, ${time}`;
  if (sameDay(date, yesterday)) return `Ontem, ${time}`;
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date).replace('.', '');
}

function startOfTodayIso() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function formatAverageWait(packages: PackageRecord[]) {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const durations = packages
    .filter((item) => item.collectedAtIso && new Date(item.collectedAtIso).getTime() >= thirtyDaysAgo)
    .map((item) => new Date(item.collectedAtIso!).getTime() - new Date(item.receivedAt).getTime())
    .filter((duration) => duration >= 0);
  if (durations.length === 0) return '—';
  const averageHours = durations.reduce((total, duration) => total + duration, 0) / durations.length / 3_600_000;
  if (averageHours < 24) return `${Math.max(1, Math.round(averageHours))}h`;
  const days = Math.floor(averageHours / 24);
  const hours = Math.round(averageHours % 24);
  return hours ? `${days}d ${hours}h` : `${days}d`;
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? 'brand--compact' : ''}`} aria-label="Domus One">
      <span className="brand__mark" aria-hidden="true">
        <span>D</span><b>1</b>
      </span>
      {!compact && (
        <span className="brand__name">
          <strong>DOMUS</strong>
          <small>ONE</small>
        </span>
      )}
    </div>
  );
}

function userInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('pt-BR'))
    .join('') || 'DO';
}

type CondominiumSummary = {
  id: string;
  name: string;
  slug: string;
  registration_code: string;
  city: string | null;
  state: string | null;
  legal_name: string | null;
  document_number: string | null;
  address_line: string | null;
  postal_code: string | null;
  contact_name: string | null;
  contact_email: string | null;
  status: 'active' | 'suspended' | 'archived';
  staff_limit: number;
  created_at: string;
};

type PlatformAdminView = 'overview' | 'condominiums' | 'administrators';

type CondominiumAdministrator = {
  id: string;
  condominium_id: string;
  invited_email: string | null;
  user_id: string | null;
  status: 'invited' | 'active' | 'inactive';
  is_owner: boolean;
  created_at: string;
  activated_at: string | null;
  condominiums: { name: string; registration_code: string } | null;
};

type CondominiumForm = {
  name: string;
  legalName: string;
  documentNumber: string;
  addressLine: string;
  city: string;
  state: string;
  postalCode: string;
  contactName: string;
  contactEmail: string;
  adminEmail: string;
  staffLimit: string;
};

const emptyCondominiumForm: CondominiumForm = {
  name: '', legalName: '', documentNumber: '', addressLine: '', city: '', state: '',
  postalCode: '', contactName: '', contactEmail: '', adminEmail: '', staffLimit: '10',
};

type AdminForm = { condominiumId: string; email: string };

type InvitationResponse = {
  ok: boolean;
  delivery?: 'sent' | 'existing_user';
  assignmentCreated?: boolean;
  error?: string;
};

type InternalIdentityResponse = {
  ok: boolean;
  credentials?: InternalCredentials;
  error?: string;
};

type ConfirmAction =
  | { kind: 'archive-condominium'; id: string; label: string }
  | { kind: 'deactivate-administrator'; id: string; label: string };

function slugify(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function PlatformDashboard({ displayName, email, onSignOut }: { displayName: string; email: string; onSignOut: () => void }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [platformView, setPlatformView] = useState<PlatformAdminView>('overview');
  const [condominiums, setCondominiums] = useState<CondominiumSummary[]>([]);
  const [administrators, setAdministrators] = useState<CondominiumAdministrator[]>([]);
  const [loading, setLoading] = useState(true);
  const [administratorsLoading, setAdministratorsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCondominium, setEditingCondominium] = useState<CondominiumSummary | null>(null);
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [adminForm, setAdminForm] = useState<AdminForm>({ condominiumId: '', email: '' });
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyCondominiumForm);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadCondominiums() {
    if (!supabase) return;
    setLoading(true);
    const { data, error: loadError } = await supabase.from('condominiums')
      .select('id,name,slug,registration_code,legal_name,document_number,address_line,city,state,postal_code,contact_name,contact_email,status,staff_limit,created_at')
      .order('created_at', { ascending: false });
    setLoading(false);
    if (loadError) setError(loadError.message);
    else setCondominiums((data || []) as CondominiumSummary[]);
  }

  async function loadAdministrators() {
    if (!supabase) return;
    setAdministratorsLoading(true);
    const { data, error: loadError } = await supabase.from('staff_memberships')
      .select('id,condominium_id,invited_email,user_id,status,is_owner,created_at,activated_at,condominiums(name,registration_code)')
      .eq('role', 'admin')
      .order('created_at', { ascending: false });
    setAdministratorsLoading(false);
    if (loadError) setError(loadError.message);
    else setAdministrators(((data || []) as unknown as CondominiumAdministrator[]).filter((item) => item.invited_email?.toLocaleLowerCase('pt-BR') !== email.toLocaleLowerCase('pt-BR')));
  }

  useEffect(() => { void Promise.all([loadCondominiums(), loadAdministrators()]); }, []);

  function updateForm(field: keyof CondominiumForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function createCondominium(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    if (form.adminEmail.trim().toLocaleLowerCase('pt-BR') === email.toLocaleLowerCase('pt-BR')) {
      setError('O administrador da plataforma não pode ser administrador de um condomínio. Informe outro e-mail.');
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    const { data: createdCondominium, error: createError } = await supabase.rpc('create_condominium_with_admin_invite', {
      p_name: form.name.trim(),
      p_slug: slugify(form.name),
      p_admin_email: form.adminEmail.trim(),
      p_legal_name: form.legalName.trim() || null,
      p_document_number: form.documentNumber.trim() || null,
      p_address_line: form.addressLine.trim() || null,
      p_city: form.city.trim() || null,
      p_state: form.state.trim().toLocaleUpperCase('pt-BR') || null,
      p_postal_code: form.postalCode.trim() || null,
      p_contact_name: form.contactName.trim() || null,
      p_contact_email: form.contactEmail.trim() || null,
    });
    if (createError) {
      setSaving(false);
      setError(createError.message.includes('platform_admin_cannot_join_condominium')
        ? 'Este e-mail pertence à administração da plataforma e não pode ser vinculado a um condomínio.'
        : createError.message);
      return;
    }
    const invitation = await sendAdministratorInvitation(createdCondominium.id, form.adminEmail);
    setSaving(false);
    if (!invitation.ok) {
      setNotice('Condomínio criado, mas o e-mail não foi entregue. Use “Reenviar convite” na página de administradores.');
    } else {
      setNotice(invitation.delivery === 'sent' ? `Convite enviado para ${form.adminEmail.trim()}.` : 'O administrador já possui uma conta e foi vinculado imediatamente.');
    }
    setForm(emptyCondominiumForm);
    setShowForm(false);
    await Promise.all([loadCondominiums(), loadAdministrators()]);
  }

  function friendlyManagementError(message: string) {
    if (message.includes('platform_admin_cannot_join_condominium')) return 'Este e-mail pertence à administração da plataforma e não pode ser vinculado a um condomínio.';
    if (message.includes('invalid_admin_email')) return 'Informe um e-mail válido para o administrador.';
    if (message.includes('staff_limit_reached')) return 'O novo limite é menor que a quantidade atual de usuários ativos.';
    return message;
  }

  async function sendAdministratorInvitation(condominiumId: string, invitationEmail: string) {
    if (!supabase) return { ok: false, error: 'Supabase não configurado.' } as InvitationResponse;
    const { data, error: invokeError } = await supabase.functions.invoke<InvitationResponse>('invite-condominium-admin', {
      body: { condominiumId, email: invitationEmail.trim() },
    });
    if (invokeError) return { ok: false, error: invokeError.message } as InvitationResponse;
    return data ?? { ok: false, error: 'A função de convite não retornou uma resposta.' };
  }

  function openNewCondominium() {
    setEditingCondominium(null);
    setForm(emptyCondominiumForm);
    setError(null);
    setShowForm(true);
  }

  function openCondominiumEditor(item: CondominiumSummary) {
    setEditingCondominium(item);
    setForm({
      name: item.name,
      legalName: item.legal_name || '',
      documentNumber: item.document_number || '',
      addressLine: item.address_line || '',
      city: item.city || '',
      state: item.state || '',
      postalCode: item.postal_code || '',
      contactName: item.contact_name || '',
      contactEmail: item.contact_email || '',
      adminEmail: '',
      staffLimit: String(item.staff_limit),
    });
    setError(null);
    setShowForm(true);
  }

  async function updateCondominium(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !editingCondominium) return;
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase.rpc('update_condominium', {
      p_condominium_id: editingCondominium.id,
      p_name: form.name.trim(),
      p_legal_name: form.legalName.trim() || null,
      p_document_number: form.documentNumber.trim() || null,
      p_address_line: form.addressLine.trim() || null,
      p_city: form.city.trim() || null,
      p_state: form.state.trim().toLocaleUpperCase('pt-BR') || null,
      p_postal_code: form.postalCode.trim() || null,
      p_contact_name: form.contactName.trim() || null,
      p_contact_email: form.contactEmail.trim() || null,
      p_staff_limit: Number(form.staffLimit),
    });
    setSaving(false);
    if (updateError) {
      setError(friendlyManagementError(updateError.message));
      return;
    }
    setShowForm(false);
    setEditingCondominium(null);
    await loadCondominiums();
  }

  async function setCondominiumStatus(id: string, status: CondominiumSummary['status']) {
    if (!supabase) return;
    setSaving(true);
    setError(null);
    const { error: statusError } = await supabase.rpc('set_condominium_status', {
      p_condominium_id: id,
      p_status: status,
    });
    setSaving(false);
    if (statusError) setError(friendlyManagementError(statusError.message));
    else await loadCondominiums();
  }

  function openAdministratorEditor(item?: CondominiumAdministrator) {
    setAdminForm({
      condominiumId: item?.condominium_id || condominiums.find((condominium) => condominium.status !== 'archived')?.id || '',
      email: item?.invited_email || '',
    });
    setError(null);
    setShowAdminForm(true);
  }

  async function assignAdministrator(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    if (adminForm.email.trim().toLocaleLowerCase('pt-BR') === email.toLocaleLowerCase('pt-BR')) {
      setError('O administrador da plataforma não pode ser administrador de um condomínio. Informe outro e-mail.');
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    const invitation = await sendAdministratorInvitation(adminForm.condominiumId, adminForm.email);
    setSaving(false);
    if (!invitation.ok) {
      setError(friendlyManagementError(invitation.error || 'Não foi possível enviar o convite.'));
      return;
    }
    setShowAdminForm(false);
    setNotice(invitation.delivery === 'sent' ? `Convite enviado para ${adminForm.email.trim()}.` : 'O administrador já possui uma conta e foi vinculado imediatamente.');
    await loadAdministrators();
  }

  async function reactivateAdministrator(item: CondominiumAdministrator) {
    if (!supabase || !item.invited_email) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    const invitation = await sendAdministratorInvitation(item.condominium_id, item.invited_email);
    setSaving(false);
    if (!invitation.ok) setError(friendlyManagementError(invitation.error || 'Não foi possível reativar o administrador.'));
    else {
      setNotice(invitation.delivery === 'sent' ? `Novo convite enviado para ${item.invited_email}.` : 'Administrador reativado.');
      await loadAdministrators();
    }
  }

  async function resendAdministratorInvitation(item: CondominiumAdministrator) {
    if (!item.invited_email) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    const invitation = await sendAdministratorInvitation(item.condominium_id, item.invited_email);
    setSaving(false);
    if (!invitation.ok) setError(friendlyManagementError(invitation.error || 'Não foi possível reenviar o convite.'));
    else {
      setNotice(invitation.delivery === 'sent' ? `Convite reenviado para ${item.invited_email}.` : 'O administrador já possui uma conta e foi ativado.');
      await loadAdministrators();
    }
  }

  async function executeConfirmedAction() {
    if (!supabase || !confirmAction) return;
    setSaving(true);
    setError(null);
    const action = confirmAction;
    const { error: actionError } = action.kind === 'archive-condominium'
      ? await supabase.rpc('set_condominium_status', { p_condominium_id: action.id, p_status: 'archived' })
      : await supabase.rpc('deactivate_condominium_admin', { p_membership_id: action.id });
    setSaving(false);
    setConfirmAction(null);
    if (actionError) {
      setError(friendlyManagementError(actionError.message));
      return;
    }
    await Promise.all([loadCondominiums(), loadAdministrators()]);
  }

  const viewCopy = {
    overview: { eyebrow: 'DOMUS ONE · CONTROLE CENTRAL', title: 'Administração da plataforma', description: 'Acompanhe a operação geral e mantenha cada condomínio com sua própria equipe.' },
    condominiums: { eyebrow: 'GESTÃO DE OPERAÇÕES', title: 'Condomínios', description: 'Consulte ambientes, códigos de cadastro, limites e situação operacional.' },
    administrators: { eyebrow: 'GESTÃO DE ACESSOS', title: 'Administradores', description: 'Acompanhe quem recebeu ou ativou o acesso principal de cada condomínio.' },
  }[platformView];

  return (
    <div className={`platform-shell ${sidebarCollapsed ? 'platform-shell--collapsed' : ''} ${mobileMenuOpen ? 'platform-shell--mobile-open' : ''}`}>
      {mobileMenuOpen && <button className="mobile-menu-backdrop" onClick={() => setMobileMenuOpen(false)} type="button" aria-label="Fechar menu" />}
      <aside className="platform-sidebar">
        <div className="sidebar-brand-row"><Brand /><button className="sidebar-toggle" onClick={() => setSidebarCollapsed((current) => !current)} type="button" aria-label={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}><Menu size={18} /></button><button className="platform-mobile-menu" onClick={() => setMobileMenuOpen((current) => !current)} type="button" aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'} aria-expanded={mobileMenuOpen}>{mobileMenuOpen ? <X size={19} /> : <Menu size={19} />}</button></div>
        <div className="platform-badge"><ShieldCheck size={15} />Administração da plataforma</div>
        <nav aria-label="Administração da plataforma"><button className={platformView === 'overview' ? 'active' : ''} onClick={() => { setPlatformView('overview'); setMobileMenuOpen(false); }} type="button"><LayoutDashboard size={18} />Visão geral</button><button className={platformView === 'condominiums' ? 'active' : ''} onClick={() => { setPlatformView('condominiums'); setMobileMenuOpen(false); }} type="button"><Building2 size={18} />Condomínios</button><button className={platformView === 'administrators' ? 'active' : ''} onClick={() => { setPlatformView('administrators'); setMobileMenuOpen(false); }} type="button"><UsersRound size={18} />Administradores</button></nav>
        <div className="operator-card"><span className="avatar">{userInitials(displayName)}</span><span><strong>{displayName}</strong><small>{email}</small></span><button className="operator-card__logout" onClick={onSignOut} type="button" aria-label="Sair"><LogOut size={16} /></button></div>
      </aside>
      <main className="platform-main">
        <header><div><span className="eyebrow">{viewCopy.eyebrow}</span><h1>{viewCopy.title}</h1><p>{viewCopy.description}</p></div>{platformView !== 'administrators' ? <button className="button button--primary button--large" onClick={openNewCondominium} type="button"><Plus size={18} />Novo condomínio</button> : <button className="button button--primary button--large" onClick={() => openAdministratorEditor()} type="button"><UserPlus size={18} />Vincular administrador</button>}</header>
        {notice && <div className="platform-notice"><Check size={17} /><span>{notice}</span><button onClick={() => setNotice(null)} type="button" aria-label="Fechar mensagem"><X size={15} /></button></div>}
        {platformView === 'overview' && <section className="platform-metrics">
          <article><Building2 size={20} /><div><strong>{condominiums.length}</strong><span>Condomínios cadastrados</span></div></article>
          <article><ShieldCheck size={20} /><div><strong>{condominiums.filter((item) => item.status === 'active').length}</strong><span>Operações ativas</span></div></article>
          <article><UsersRound size={20} /><div><strong>{administrators.filter((item) => item.status !== 'inactive').length}</strong><span>Administradores vinculados</span></div></article>
        </section>}
        {platformView !== 'administrators' ? <section className="platform-list">
          <header><div><h2>{platformView === 'overview' ? 'Condomínios recentes' : 'Todos os condomínios'}</h2><p>Ambientes isolados e protegidos por perfil de acesso.</p></div><button className="icon-button" onClick={() => void loadCondominiums()} type="button" aria-label="Atualizar condomínios"><RefreshCw size={17} /></button></header>
          {error && <div className="auth-message auth-message--error">{error}</div>}
          {loading ? <div className="platform-loading"><LoaderCircle className="spin" size={22} />Carregando condomínios…</div> : (
            <div className="platform-table">
              <div className="platform-table__head"><span>CONDOMÍNIO</span><span>LOCALIZAÇÃO</span><span>CÓDIGO</span><span>LIMITE</span><span>STATUS</span><span>AÇÕES</span></div>
              {condominiums.map((item) => <article key={item.id}><div><span className="condominium-icon"><Building2 size={18} /></span><span><strong>{item.name}</strong><small>{item.slug}</small></span></div><span>{[item.city, item.state].filter(Boolean).join(' · ') || 'Não informado'}</span><code>{item.registration_code}</code><span>{item.staff_limit} usuários</span><em className={`condominium-status condominium-status--${item.status}`}>{item.status === 'active' ? 'Ativo' : item.status === 'suspended' ? 'Suspenso' : 'Arquivado'}</em><span className="platform-row-actions"><button onClick={() => openCondominiumEditor(item)} type="button" aria-label={`Editar ${item.name}`} title="Editar condomínio"><Pencil size={15} /></button>{item.status === 'archived' ? <button onClick={() => void setCondominiumStatus(item.id, 'active')} type="button" aria-label={`Reativar ${item.name}`} title="Reativar condomínio"><RotateCcw size={15} /></button> : <button className="danger" onClick={() => setConfirmAction({ kind: 'archive-condominium', id: item.id, label: item.name })} type="button" aria-label={`Arquivar ${item.name}`} title="Arquivar condomínio"><Trash2 size={15} /></button>}</span></article>)}
              {condominiums.length === 0 && <div className="platform-empty"><Building2 size={28} /><strong>Nenhum condomínio cadastrado</strong><span>Crie a primeira operação para começar.</span></div>}
            </div>
          )}
        </section> : <section className="platform-list platform-admin-list">
          <header><div><h2>Administradores de condomínio</h2><p>O administrador da plataforma não aparece nesta lista e não pode ocupar este perfil.</p></div><button className="icon-button" onClick={() => void loadAdministrators()} type="button" aria-label="Atualizar administradores"><RefreshCw size={17} /></button></header>
          {error && <div className="auth-message auth-message--error">{error}</div>}
          {administratorsLoading ? <div className="platform-loading"><LoaderCircle className="spin" size={22} />Carregando administradores…</div> : <div className="platform-admin-table">
            <div className="platform-admin-table__head"><span>ADMINISTRADOR</span><span>CONDOMÍNIO</span><span>PERFIL</span><span>STATUS</span><span>AÇÕES</span></div>
            {administrators.map((item) => <article key={item.id}><div><span className="administrator-avatar">{userInitials(item.invited_email || 'Administrador')}</span><span><strong>{item.invited_email || 'E-mail não informado'}</strong><small>{item.user_id ? 'Conta vinculada' : 'Aguardando ativação'}</small></span></div><span><strong>{item.condominiums?.name || 'Condomínio indisponível'}</strong><small>{item.condominiums?.registration_code || '—'}</small></span><span>{item.is_owner ? 'Principal' : 'Administrador'}</span><em className={`membership-status membership-status--${item.status}`}>{item.status === 'active' ? 'Ativo' : item.status === 'invited' ? 'Convidado' : 'Inativo'}</em><span className="platform-row-actions"><button onClick={() => openAdministratorEditor(item)} type="button" aria-label={`Editar ${item.invited_email || 'administrador'}`} title="Substituir administrador"><Pencil size={15} /></button>{item.status === 'invited' && <button onClick={() => void resendAdministratorInvitation(item)} type="button" aria-label={`Reenviar convite para ${item.invited_email || 'administrador'}`} title="Reenviar convite"><Mail size={15} /></button>}{item.status === 'inactive' ? <button onClick={() => void reactivateAdministrator(item)} type="button" aria-label={`Reativar ${item.invited_email || 'administrador'}`} title="Reativar administrador"><RotateCcw size={15} /></button> : <button className="danger" onClick={() => setConfirmAction({ kind: 'deactivate-administrator', id: item.id, label: item.invited_email || 'este administrador' })} type="button" aria-label={`Desativar ${item.invited_email || 'administrador'}`} title="Desativar administrador"><Trash2 size={15} /></button>}</span></article>)}
            {administrators.length === 0 && <div className="platform-empty"><UsersRound size={28} /><strong>Nenhum administrador cadastrado</strong><span>Um administrador será criado junto com o próximo condomínio.</span></div>}
          </div>}
        </section>}
      </main>
      {showForm && <div className="panel-layer resident-modal-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setShowForm(false)}>
        <section className="platform-form-modal" role="dialog" aria-modal="true" aria-labelledby="condominium-form-title">
          <header><div><span className="eyebrow">{editingCondominium ? 'CONFIGURAÇÃO DA OPERAÇÃO' : 'NOVA OPERAÇÃO'}</span><h2 id="condominium-form-title">{editingCondominium ? 'Editar condomínio' : 'Cadastrar condomínio'}</h2><p>{editingCondominium ? 'Atualize os dados institucionais e o limite da equipe.' : 'O administrador receberá um convite vinculado somente a este condomínio.'}</p></div><button className="icon-button" onClick={() => setShowForm(false)} type="button" aria-label="Fechar"><X size={20} /></button></header>
          <form onSubmit={editingCondominium ? updateCondominium : createCondominium}><div className="platform-form-grid">
            <label className="field-wide">Nome do condomínio<input required value={form.name} onChange={(event) => updateForm('name', event.target.value)} placeholder="Ex.: I9 Horto" /></label>
            <label>Razão social<input value={form.legalName} onChange={(event) => updateForm('legalName', event.target.value)} /></label><label>CNPJ / documento<input value={form.documentNumber} onChange={(event) => updateForm('documentNumber', event.target.value)} /></label>
            <label className="field-wide">Endereço<input value={form.addressLine} onChange={(event) => updateForm('addressLine', event.target.value)} /></label><label>Cidade<input value={form.city} onChange={(event) => updateForm('city', event.target.value)} /></label><label>Estado<input maxLength={2} value={form.state} onChange={(event) => updateForm('state', event.target.value)} placeholder="SP" /></label>
            <label>CEP<input value={form.postalCode} onChange={(event) => updateForm('postalCode', event.target.value)} /></label><label>Contato no condomínio<input value={form.contactName} onChange={(event) => updateForm('contactName', event.target.value)} /></label><label>E-mail de contato<input type="email" value={form.contactEmail} onChange={(event) => updateForm('contactEmail', event.target.value)} /></label>
            {editingCondominium ? <label>Limite de porteiros<input min="1" max="10" required type="number" value={form.staffLimit} onChange={(event) => updateForm('staffLimit', event.target.value)} /></label> : <label className="field-wide invite-field"><Mail size={18} /><span>Administrador do condomínio<small>Este e-mail receberá o perfil de administrador principal.</small></span><input required type="email" value={form.adminEmail} onChange={(event) => updateForm('adminEmail', event.target.value)} placeholder="administrador@condominio.com.br" /></label>}
          </div>{error && <div className="auth-message auth-message--error">{error}</div>}<footer><button className="button button--ghost" onClick={() => setShowForm(false)} type="button">Cancelar</button><button className="button button--primary" disabled={saving} type="submit">{saving ? <LoaderCircle className="spin" size={18} /> : editingCondominium ? <Check size={18} /> : <Plus size={18} />}{saving ? 'Salvando…' : editingCondominium ? 'Salvar alterações' : 'Criar condomínio e convite'}</button></footer></form>
        </section>
      </div>}
      {showAdminForm && <div className="panel-layer resident-modal-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setShowAdminForm(false)}>
        <section className="platform-form-modal platform-form-modal--compact" role="dialog" aria-modal="true" aria-labelledby="administrator-form-title"><header><div><span className="eyebrow">GESTÃO DE ACESSO</span><h2 id="administrator-form-title">Vincular administrador</h2><p>O novo vínculo substitui o administrador atual do condomínio sem apagar o histórico.</p></div><button className="icon-button" onClick={() => setShowAdminForm(false)} type="button" aria-label="Fechar"><X size={20} /></button></header><form onSubmit={assignAdministrator}><div className="platform-form-grid"><label className="field-wide">Condomínio<select required value={adminForm.condominiumId} onChange={(event) => setAdminForm((current) => ({ ...current, condominiumId: event.target.value }))}><option value="">Selecione um condomínio</option>{condominiums.filter((item) => item.status !== 'archived').map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="field-wide">E-mail do administrador<input required type="email" value={adminForm.email} onChange={(event) => setAdminForm((current) => ({ ...current, email: event.target.value }))} placeholder="administrador@condominio.com.br" /></label></div>{error && <div className="auth-message auth-message--error">{error}</div>}<footer><button className="button button--ghost" onClick={() => setShowAdminForm(false)} type="button">Cancelar</button><button className="button button--primary" disabled={saving || !adminForm.condominiumId} type="submit">{saving ? <LoaderCircle className="spin" size={18} /> : <UserPlus size={18} />}{saving ? 'Vinculando…' : 'Vincular administrador'}</button></footer></form></section>
      </div>}
      {confirmAction && <div className="panel-layer resident-modal-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setConfirmAction(null)}><section className="platform-confirm-modal" role="alertdialog" aria-modal="true"><span className="platform-confirm-modal__icon"><Trash2 size={20} /></span><h2>{confirmAction.kind === 'archive-condominium' ? 'Arquivar condomínio?' : 'Desativar administrador?'}</h2><p>{confirmAction.kind === 'archive-condominium' ? `O condomínio ${confirmAction.label} deixará de aparecer como operação ativa, mas todo o histórico será preservado.` : `${confirmAction.label} perderá o acesso ao condomínio. O vínculo continuará no histórico e poderá ser reativado.`}</p><footer><button className="button button--ghost" onClick={() => setConfirmAction(null)} type="button">Cancelar</button><button className="button button--danger" disabled={saving} onClick={() => void executeConfirmedAction()} type="button">{saving ? <LoaderCircle className="spin" size={18} /> : <Trash2 size={18} />}{confirmAction.kind === 'archive-condominium' ? 'Arquivar' : 'Desativar'}</button></footer></section></div>}
    </div>
  );
}

function NoAccess({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  return <main className="system-state"><Brand /><ShieldCheck size={30} /><h1>Acesso aguardando vínculo</h1><p>A conta <strong>{email}</strong> está autenticada, mas ainda não possui permissão em um condomínio. Se recebeu um convite, confirme o e-mail e entre novamente.</p><button className="button button--outline" onClick={onSignOut} type="button"><LogOut size={17} />Sair</button></main>;
}

type AccessContext =
  | { kind: 'platform' }
  | { kind: 'staff'; role: StaffRole; condominiumId: string }
  | { kind: 'resident'; condominiumId: string; unitId: string }
  | { kind: 'none' };

type CurrentInternalIdentity = {
  id: string;
  username: string;
  mustChangePassword: boolean;
};

type OperationalSection = 'dashboard' | 'history' | 'units' | 'people' | 'settings';

function Sidebar({ collapsed, activeSection, onNavigate, onToggle, onResidentView, condominiumName, waitingCount, displayName, email, onSignOut }: { collapsed: boolean; activeSection: OperationalSection; onNavigate: (section: OperationalSection) => void; onToggle: () => void; onResidentView: () => void; condominiumName: string; waitingCount: number; displayName: string; email: string; onSignOut: () => void }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand-row"><Brand /><button className="sidebar-toggle" onClick={onToggle} type="button" aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}><Menu size={18} /></button></div>
      <div className="building-context">
        <span className="building-context__icon"><Building2 size={18} /></span>
        <span><small>Condomínio</small><strong>{condominiumName}</strong></span>
      </div>
      <nav aria-label="Navegação principal">
        <p>OPERAÇÃO</p>
        <a className={`nav-link ${activeSection === 'dashboard' ? 'nav-link--active' : ''}`} href="#painel" onClick={() => onNavigate('dashboard')}><LayoutDashboard size={19} />Painel</a>
        <a className="nav-link" href="#encomendas" onClick={() => onNavigate('dashboard')}><Boxes size={19} />Encomendas{waitingCount > 0 && <span>{waitingCount}</span>}</a>
        <a className={`nav-link ${activeSection === 'history' ? 'nav-link--active' : ''}`} href="#historico" onClick={() => onNavigate('history')}><Archive size={19} />Histórico</a>
        <p>GESTÃO</p>
        <a className={`nav-link ${activeSection === 'units' ? 'nav-link--active' : ''}`} href="#unidades" onClick={() => onNavigate('units')}><Building2 size={19} />Unidades</a>
        <a className={`nav-link ${activeSection === 'people' ? 'nav-link--active' : ''}`} href="#pessoas" onClick={() => onNavigate('people')}><UsersRound size={19} />Pessoas</a>
        <a className={`nav-link ${activeSection === 'settings' ? 'nav-link--active' : ''}`} href="#configuracoes" onClick={() => onNavigate('settings')}><Settings size={19} />Configurações</a>
      </nav>
      <button className="resident-preview" onClick={onResidentView} type="button">
        <UserRound size={18} />
        <span><small>Pré-visualizar</small>Área do morador</span>
      </button>
      <div className="operator-card">
        <span className="avatar">{userInitials(displayName)}</span>
        <span><strong>{displayName}</strong><small>{email}</small></span>
        <button className="operator-card__logout" onClick={onSignOut} type="button" aria-label="Sair"><LogOut size={16} /></button>
      </div>
    </aside>
  );
}

function MetricCard({ icon, label, value, detail, tone }: { icon: React.ReactNode; label: string; value: string; detail: string; tone?: string }) {
  return (
    <article className={`metric-card ${tone ? `metric-card--${tone}` : ''}`}>
      <div className="metric-card__top"><span>{icon}</span><small>{detail}</small></div>
      <strong>{value}</strong>
      <p>{label}</p>
    </article>
  );
}

function Status({ status }: { status: PackageRecord['status'] }) {
  return status === 'waiting' ? (
    <span className="status status--waiting"><Clock3 size={13} />Aguardando retirada</span>
  ) : (
    <span className="status status--collected"><Check size={13} />Retirada</span>
  );
}

function NewPackagePanel({ units, saving, onClose, onSave }: { units: OperationalUnit[]; saving: boolean; onClose: () => void; onSave: (form: NewPackageForm) => void }) {
  const [form, setForm] = useState(emptyForm);

  function update(field: keyof NewPackageForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    onSave(form);
  }

  return (
    <div className="panel-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="new-package-panel" role="dialog" aria-modal="true" aria-labelledby="new-package-title">
        <header>
          <div><span className="eyebrow">NOVO REGISTRO</span><h2 id="new-package-title">Receber encomenda</h2></div>
          <button className="icon-button" onClick={onClose} type="button" aria-label="Fechar"><X size={21} /></button>
        </header>
        <form onSubmit={submit}>
          <div className="form-intro"><PackagePlus size={23} /><p>Informe primeiro a unidade. O morador verá a encomenda assim que o registro for concluído.</p></div>
          <label>
            Unidade
            <div className="field-prefix"><Building2 size={18} /><select autoFocus required value={form.unitId} onChange={(e) => update('unitId', e.target.value)}><option value="">Selecionar unidade</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.buildingName} · {unit.unitNumber}</option>)}</select></div>
          </label>
          <label>
            Destinatário
            <input required placeholder="Nome que consta na encomenda" value={form.resident} onChange={(e) => update('resident', e.target.value)} />
          </label>
          <label>
            Transportadora
            <select required value={form.carrier} onChange={(e) => update('carrier', e.target.value)}>
              <option value="">Selecionar</option>
              <option>Amazon</option><option>Correios</option><option>Jadlog</option><option>Loggi</option><option>Mercado Livre</option><option>Outra</option>
            </select>
          </label>
          <label>
            Observação <small>Opcional</small>
            <textarea rows={3} placeholder="Ex.: caixa grande, item frágil…" value={form.note} onChange={(e) => update('note', e.target.value)} />
          </label>
          <div className="form-security"><ShieldCheck size={18} /><span>O registro ficará associado ao seu usuário, com data e horário.</span></div>
          <footer><button className="button button--ghost" disabled={saving} onClick={onClose} type="button">Cancelar</button><button className="button button--primary" disabled={saving} type="submit">{saving ? <LoaderCircle className="spin" size={18} /> : <PackagePlus size={18} />}{saving ? 'Registrando…' : 'Registrar encomenda'}</button></footer>
        </form>
      </section>
    </div>
  );
}

function UnitsManagement({ condominium, buildings, units, canManage, onCreateBuilding, onCreateUnit }: { condominium: OperationalCondominium; buildings: OperationalBuilding[]; units: OperationalUnit[]; canManage: boolean; onCreateBuilding: (name: string, code: string, floors: string) => Promise<CreateResult>; onCreateUnit: (buildingId: string, unitNumber: string, floorLabel: string) => Promise<CreateResult> }) {
  const [buildingName, setBuildingName] = useState('');
  const [buildingCode, setBuildingCode] = useState('');
  const [buildingFloors, setBuildingFloors] = useState('');
  const [unitBuildingId, setUnitBuildingId] = useState('');
  const [unitNumber, setUnitNumber] = useState('');
  const [floorLabel, setFloorLabel] = useState('');
  const [savingBuilding, setSavingBuilding] = useState(false);
  const [savingUnit, setSavingUnit] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  async function submitBuilding(event: FormEvent) {
    event.preventDefault();
    setSavingBuilding(true);
    setMessage(null);
    const result = await onCreateBuilding(buildingName, buildingCode, buildingFloors);
    setSavingBuilding(false);
    if (!result.ok) setMessage({ tone: 'error', text: result.error || 'Não foi possível cadastrar o bloco.' });
    else {
      setBuildingName(''); setBuildingCode(''); setBuildingFloors('');
      setMessage({ tone: 'success', text: 'Bloco cadastrado com sucesso.' });
    }
  }

  async function submitUnit(event: FormEvent) {
    event.preventDefault();
    setSavingUnit(true);
    setMessage(null);
    const result = await onCreateUnit(unitBuildingId, unitNumber, floorLabel);
    setSavingUnit(false);
    if (!result.ok) setMessage({ tone: 'error', text: result.error || 'Não foi possível cadastrar a unidade.' });
    else {
      setUnitNumber(''); setFloorLabel('');
      setMessage({ tone: 'success', text: 'Unidade cadastrada e liberada para encomendas.' });
    }
  }

  return <section className="units-page">
    <header className="page-heading"><div><span className="eyebrow">GESTÃO · ESTRUTURA</span><h1>Blocos e unidades</h1><p>Organize a estrutura do {condominium.name} usada na portaria e no cadastro dos moradores.</p></div></header>
    <div className="unit-metrics"><article><Building2 size={20} /><span><strong>{buildings.length}</strong><small>Blocos cadastrados</small></span></article><article><Boxes size={20} /><span><strong>{units.length}</strong><small>Unidades ativas</small></span></article></div>
    {message && <div className={`auth-message auth-message--${message.tone}`}>{message.text}</div>}
    {canManage && <div className="structure-forms">
      <form onSubmit={submitBuilding}><div><span className="eyebrow">NOVO BLOCO</span><h2>Cadastrar bloco</h2><p>Ex.: Torre A, Bloco Único ou Edifício Principal.</p></div><label>Nome<input required value={buildingName} onChange={(event) => { setBuildingName(event.target.value); if (!buildingCode) setBuildingCode(slugify(event.target.value).replace(/-/g, '').slice(0, 12).toLocaleUpperCase('pt-BR')); }} placeholder="Torre A" /></label><div className="structure-form-row"><label>Código<input required maxLength={32} value={buildingCode} onChange={(event) => setBuildingCode(event.target.value.toLocaleUpperCase('pt-BR'))} placeholder="TORREA" /></label><label>Andares<input min="1" max="300" type="number" value={buildingFloors} onChange={(event) => setBuildingFloors(event.target.value)} placeholder="12" /></label></div><button className="button button--primary" disabled={savingBuilding} type="submit">{savingBuilding ? <LoaderCircle className="spin" size={17} /> : <Plus size={17} />}Cadastrar bloco</button></form>
      <form onSubmit={submitUnit}><div><span className="eyebrow">NOVA UNIDADE</span><h2>Cadastrar unidade</h2><p>A unidade ficará imediatamente disponível na portaria.</p></div><label>Bloco<select required value={unitBuildingId} onChange={(event) => setUnitBuildingId(event.target.value)}><option value="">Selecionar bloco</option>{buildings.map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}</select></label><div className="structure-form-row"><label>Número<input required value={unitNumber} onChange={(event) => setUnitNumber(event.target.value)} placeholder="1204" /></label><label>Andar <small>Opcional</small><input value={floorLabel} onChange={(event) => setFloorLabel(event.target.value)} placeholder="12º" /></label></div><button className="button button--primary" disabled={savingUnit || buildings.length === 0} type="submit">{savingUnit ? <LoaderCircle className="spin" size={17} /> : <Plus size={17} />}Cadastrar unidade</button></form>
    </div>}
    <section className="structure-list"><header><div><h2>Unidades cadastradas</h2><p>Estrutura atualmente ativa no condomínio.</p></div></header>{units.length > 0 ? <div className="structure-table"><div className="structure-table__head"><span>UNIDADE</span><span>BLOCO</span><span>ANDAR</span><span>STATUS</span></div>{units.map((unit) => <article key={unit.id}><strong>{unit.unitNumber}</strong><span>{unit.buildingName}</span><span>{unit.floorLabel || '—'}</span><em>Ativa</em></article>)}</div> : <div className="empty-state"><Building2 size={25} /><strong>Nenhuma unidade cadastrada</strong><span>Cadastre primeiro um bloco e depois inclua suas unidades.</span></div>}</section>
  </section>;
}

function PeopleManagement({ condominium, units, staffLimit, staff, residents, canManage, onCreateInternal, onResetPassword, onStaffStatus, onResidentStatus }: { condominium: OperationalCondominium; units: OperationalUnit[]; staffLimit: number; staff: StaffPerson[]; residents: ResidentPerson[]; canManage: boolean; onCreateInternal: (role: PersonInvitationRole, username: string, fullName: string, unitId?: string) => Promise<CreateResult>; onResetPassword: (identityId: string) => Promise<CreateResult>; onStaffStatus: (id: string, active: boolean) => Promise<CreateResult>; onResidentStatus: (person: ResidentPerson, action: 'approve' | 'deactivate' | 'reactivate') => Promise<CreateResult> }) {
  const [tab, setTab] = useState<'staff' | 'residents'>('staff');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [unitId, setUnitId] = useState('');
  const [staffRole, setStaffRole] = useState<StaffInvitationRole>('doorman');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [credentials, setCredentials] = useState<InternalCredentials | null>(null);
  const operationalStaff = staff.filter((person) => person.role === 'doorman' && person.status !== 'inactive').length;
  const selectedRoleCount = staff.filter((person) => person.role === staffRole && person.status !== 'inactive').length;
  const selectedRoleLimit = staffRole === 'doorman' ? staffLimit : 1;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setMessage(null);
    const result = await onCreateInternal(tab === 'staff' ? staffRole : 'resident', username, fullName, unitId);
    setSaving(false);
    if (!result.ok) setMessage({ tone: 'error', text: result.error || 'Não foi possível criar a conta.' });
    else {
      setUsername(''); setFullName(''); setUnitId('');
      setCredentials(result.credentials || null);
      setMessage({ tone: 'success', text: tab === 'staff' ? `Conta de ${staffRoleLabels[staffRole].toLocaleLowerCase('pt-BR')} criada.` : 'Conta do morador criada e vinculada à unidade.' });
    }
  }

  async function changeStatus(action: () => Promise<CreateResult>, success: string) {
    setMessage(null);
    const result = await action();
    setMessage(result.ok ? { tone: 'success', text: success } : { tone: 'error', text: result.error || 'Não foi possível atualizar o acesso.' });
  }

  async function resetPassword(identityId: string) {
    setMessage(null);
    const result = await onResetPassword(identityId);
    if (!result.ok) setMessage({ tone: 'error', text: result.error || 'Não foi possível redefinir a senha.' });
    else setCredentials(result.credentials || null);
  }

  return <section className="people-page">
    <header className="page-heading"><div><span className="eyebrow">GESTÃO · ACESSOS</span><h1>Pessoas</h1><p>Gerencie a equipe da portaria e os moradores vinculados ao {condominium.name}.</p></div></header>
    <div className="people-tabs"><button className={tab === 'staff' ? 'active' : ''} onClick={() => { setTab('staff'); setMessage(null); }} type="button"><UsersRound size={17} />Equipe <span>{staff.length}</span></button><button className={tab === 'residents' ? 'active' : ''} onClick={() => { setTab('residents'); setMessage(null); }} type="button"><UserRound size={17} />Moradores <span>{residents.length}</span></button></div>
    {message && <div className={`auth-message auth-message--${message.tone}`}>{message.text}</div>}
    {canManage && <form className="people-invite" onSubmit={submit}><div><span className="eyebrow">{tab === 'staff' ? 'NOVA CONTA INTERNA' : 'NOVO MORADOR'}</span><h2>{tab === 'staff' ? 'Criar acesso da equipe' : 'Criar acesso do morador'}</h2><p>{tab === 'staff' ? `${operationalStaff} de ${staffLimit} porteiros · ${selectedRoleCount} de ${selectedRoleLimit} para o perfil selecionado.` : 'A conta será criada diretamente no condomínio, sem depender de e-mail.'}</p></div>{tab === 'staff' && <label>Perfil<select value={staffRole} onChange={(event) => setStaffRole(event.target.value as StaffInvitationRole)}><option value="syndic">Síndico</option><option value="deputy_syndic">Subsíndico</option><option value="caretaker">Zelador</option><option value="doorman">Porteiro</option></select></label>}<label>Nome completo<input required value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Nome da pessoa" /></label><label>Usuário<input autoCapitalize="none" required minLength={3} maxLength={32} pattern="[a-z0-9][a-z0-9._-]{2,31}" value={username} onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/\s+/g, '.'))} placeholder="joao.silva" /></label>{tab === 'residents' && <label>Unidade<select required value={unitId} onChange={(event) => setUnitId(event.target.value)}><option value="">Selecionar unidade</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.buildingName} · {unit.unitNumber}</option>)}</select></label>}<button className="button button--primary" disabled={saving || (tab === 'staff' && selectedRoleCount >= selectedRoleLimit) || (tab === 'residents' && units.length === 0)} type="submit">{saving ? <LoaderCircle className="spin" size={17} /> : <UserPlus size={17} />}{saving ? 'Criando…' : 'Criar conta'}</button></form>}
    <section className="people-list"><header><div><h2>{tab === 'staff' ? 'Equipe cadastrada' : 'Moradores cadastrados'}</h2><p>{tab === 'staff' ? 'Síndico, subsíndico e zelador possuem vagas próprias; o limite de 10 é exclusivo dos porteiros.' : 'Contas e vínculos atuais por unidade.'}</p></div></header>{tab === 'staff' ? <div className="people-table">{staff.map((person) => <article key={person.id}><span className="administrator-avatar">{userInitials(person.fullName || person.email)}</span><div className="people-identity"><strong>{person.fullName || person.email}</strong><small>{person.username ? `@${person.username}` : person.email}</small></div><span className="people-role">{staffRoleLabels[person.role]}</span><em className={`membership-status membership-status--${person.status}`}>{person.status === 'active' ? 'Ativo' : person.status === 'invited' ? 'Convidado' : 'Inativo'}</em>{canManage && person.role !== 'admin' && <span className="people-row-actions">{person.identityId && <button onClick={() => void resetPassword(person.identityId!)} type="button" title="Redefinir senha"><KeyRound size={15} /></button>}<button onClick={() => void changeStatus(() => onStaffStatus(person.id, person.status === 'inactive'), person.status === 'inactive' ? `${staffRoleLabels[person.role]} reativado.` : `${staffRoleLabels[person.role]} desativado.`)} type="button" title={person.status === 'inactive' ? 'Reativar' : 'Desativar'}>{person.status === 'inactive' ? <RotateCcw size={15} /> : <Trash2 size={15} />}</button></span>}</article>)}</div> : <div className="people-table">{residents.map((person) => <article key={person.id}><span className="administrator-avatar">{userInitials(person.fullName || person.email)}</span><div className="people-identity"><strong>{person.fullName || person.email || 'Morador'}</strong><small>{person.username ? `@${person.username}` : person.email || `${person.buildingName} · ${person.unitNumber}`}</small></div><span className="people-role">{person.buildingName} · {person.unitNumber}</span><em className={`membership-status membership-status--${person.status}`}>{person.status === 'active' ? 'Ativo' : person.status === 'pending' ? 'Pendente' : person.status === 'inactive' ? 'Inativo' : 'Rejeitado'}</em>{canManage && <span className="people-row-actions">{person.identityId && <button onClick={() => void resetPassword(person.identityId!)} type="button" title="Redefinir senha"><KeyRound size={15} /></button>}{person.status === 'pending' && <button onClick={() => void changeStatus(() => onResidentStatus(person, 'approve'), 'Morador aprovado.')} type="button" title="Aprovar"><Check size={15} /></button>}{person.status === 'active' && <button onClick={() => void changeStatus(() => onResidentStatus(person, 'deactivate'), 'Morador desativado.')} type="button" title="Desativar"><Trash2 size={15} /></button>}{person.status === 'inactive' && <button onClick={() => void changeStatus(() => onResidentStatus(person, 'reactivate'), 'Morador reativado.')} type="button" title="Reativar"><RotateCcw size={15} /></button>}</span>}</article>)}</div>}{(tab === 'staff' ? staff.length : residents.length) === 0 && <div className="empty-state"><UsersRound size={25} /><strong>Nenhuma pessoa cadastrada</strong><span>Use o formulário acima para liberar o primeiro acesso.</span></div>}</section>
    {credentials && <div className="panel-layer resident-modal-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setCredentials(null)}><section className="credentials-modal" role="dialog" aria-modal="true" aria-labelledby="credentials-title"><header><div><span className="eyebrow">CREDENCIAIS TEMPORÁRIAS</span><h2 id="credentials-title">Entregue estes dados à pessoa</h2><p>A senha será exibida somente agora e deverá ser alterada no primeiro acesso.</p></div><button className="icon-button" onClick={() => setCredentials(null)} type="button" aria-label="Fechar"><X size={20} /></button></header><dl><div><dt>Código do condomínio</dt><dd>{credentials.condominiumCode || condominium.registrationCode}</dd></div><div><dt>Usuário</dt><dd>{credentials.username}</dd></div><div><dt>Senha temporária</dt><dd>{credentials.temporaryPassword}</dd></div></dl><button className="button button--outline button--full" onClick={() => void navigator.clipboard.writeText(`Código: ${credentials.condominiumCode || condominium.registrationCode}\nUsuário: ${credentials.username}\nSenha temporária: ${credentials.temporaryPassword}`)} type="button"><Copy size={17} />Copiar credenciais</button><button className="button button--primary button--full" onClick={() => setCredentials(null)} type="button">Concluir</button></section></div>}
  </section>;
}

function PackageDetails({ item, onClose }: { item: PackageRecord; onClose: () => void }) {
  return <div className="panel-layer resident-modal-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="detail-modal" role="dialog" aria-modal="true" aria-labelledby="package-detail-title"><header><div><span className="eyebrow">REGISTRO DA PORTARIA</span><h2 id="package-detail-title">Detalhes da encomenda</h2></div><button className="icon-button" onClick={onClose} type="button" aria-label="Fechar"><X size={20} /></button></header><Status status={item.status} /><dl><div><dt>Código</dt><dd>{item.id}</dd></div><div><dt>Unidade</dt><dd>{item.building} · {item.apartment}</dd></div><div><dt>Destinatário</dt><dd>{item.resident}</dd></div><div><dt>Transportadora</dt><dd>{item.carrier}</dd></div><div><dt>Recebimento</dt><dd>{item.arrivedAt}</dd></div>{item.collectedAt && <div><dt>Retirada</dt><dd>{item.collectedAt}</dd></div>}<div><dt>Observação</dt><dd>{item.note || 'Sem observações'}</dd></div></dl><button className="button button--outline button--full" onClick={onClose} type="button">Fechar ficha</button></section></div>;
}

function NotificationsPanel({ packages, onClose, onOpen }: { packages: PackageRecord[]; onClose: () => void; onOpen: (item: PackageRecord) => void }) {
  const waiting = packages.filter((item) => item.status === 'waiting').slice(0, 8);
  return <div className="panel-layer resident-modal-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="notification-panel" role="dialog" aria-modal="true" aria-labelledby="notifications-title"><header><div><span className="eyebrow">ATUALIZAÇÕES</span><h2 id="notifications-title">Notificações</h2><p>{waiting.length ? `${waiting.length} retirada${waiting.length === 1 ? '' : 's'} aguardando atenção.` : 'Não há pendências no momento.'}</p></div><button className="icon-button" onClick={onClose} type="button" aria-label="Fechar"><X size={20} /></button></header>{waiting.length ? <div className="notification-list">{waiting.map((item) => <button key={item.id} onClick={() => onOpen(item)} type="button"><span className="carrier-mark">{item.carrier.slice(0, 1)}</span><span><strong>{item.building} · {item.apartment}</strong><small>{item.carrier} · {item.arrivedAt}</small></span><span>→</span></button>)}</div> : <div className="empty-state"><Check size={25} /><strong>Portaria em dia</strong><span>Novas encomendas aparecerão aqui.</span></div>}</section></div>;
}

function OperationalHistory({ condominium, packages, onOpen }: { condominium: OperationalCondominium; packages: PackageRecord[]; onOpen: (item: PackageRecord) => void }) {
  const [query, setQuery] = useState('');
  const collected = useMemo(() => packages.filter((item) => item.status === 'collected' && [item.id, item.apartment, item.building, item.resident, item.carrier].some((value) => value.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR')))), [packages, query]);
  return <section className="history-page"><header className="page-heading"><div><span className="eyebrow">OPERAÇÃO · RASTREABILIDADE</span><h1>Histórico de retiradas</h1><p>Consulte as encomendas retiradas no {condominium.name}.</p></div></header><section className="package-section"><header><div><h2>Retiradas confirmadas</h2><p>{collected.length} registro{collected.length === 1 ? '' : 's'} localizado{collected.length === 1 ? '' : 's'}</p></div></header><div className="package-toolbar"><label className="search-field"><Search size={18} /><span className="sr-only">Buscar histórico</span><input placeholder="Buscar unidade, destinatário ou código" value={query} onChange={(event) => setQuery(event.target.value)} /></label></div><div className="package-table"><div className="package-table__head"><span>UNIDADE</span><span>DESTINATÁRIO</span><span>TRANSPORTADORA</span><span>RETIRADA</span><span>STATUS</span><span /></div>{collected.map((item) => <div className="package-row" key={item.id}><div className="unit-cell"><span>{item.apartment}</span><small>{item.building}</small></div><div><strong>{item.resident}</strong><small>{item.id}</small></div><div><span>{item.carrier}</span><small>{item.note || 'Sem observações'}</small></div><div><span>{item.collectedAt}</span><small>Confirmada pelo morador</small></div><div><Status status={item.status} /></div><button className="row-action" onClick={() => onOpen(item)} type="button" aria-label={`Abrir encomenda ${item.id}`}><ChevronDown size={17} /></button></div>)}{collected.length === 0 && <div className="empty-state"><Archive size={25} /><strong>Nenhuma retirada encontrada</strong><span>{packages.length ? 'Altere a busca ou aguarde a primeira confirmação.' : 'O histórico será criado a partir das retiradas confirmadas.'}</span></div>}</div></section></section>;
}

function CondominiumSettings({ condominium, buildings, units, staff, residents, canManage }: { condominium: OperationalCondominium; buildings: OperationalBuilding[]; units: OperationalUnit[]; staff: StaffPerson[]; residents: ResidentPerson[]; canManage: boolean }) {
  const activeRole = (role: StaffRole) => staff.filter((item) => item.role === role && item.status !== 'inactive').length;
  return <section className="settings-page"><header className="page-heading"><div><span className="eyebrow">GESTÃO · CONFIGURAÇÕES</span><h1>Condomínio</h1><p>Dados oficiais da operação cadastrados na plataforma.</p></div></header><div className="settings-grid"><section className="settings-card"><header><Building2 size={20} /><div><h2>Identificação</h2><p>Informações institucionais</p></div></header><dl><div><dt>Nome</dt><dd>{condominium.name}</dd></div><div><dt>Código</dt><dd>{condominium.registrationCode}</dd></div><div><dt>Razão social</dt><dd>{condominium.legalName || 'Não informada'}</dd></div><div><dt>CNPJ / documento</dt><dd>{condominium.documentNumber || 'Não informado'}</dd></div></dl></section><section className="settings-card"><header><Settings size={20} /><div><h2>Estrutura e acessos</h2><p>Capacidade atual da operação</p></div></header><dl><div><dt>Blocos</dt><dd>{buildings.length}</dd></div><div><dt>Unidades ativas</dt><dd>{units.length}</dd></div><div><dt>Síndico / subsíndico / zelador</dt><dd>{activeRole('syndic')} / {activeRole('deputy_syndic')} / {activeRole('caretaker')}</dd></div><div><dt>Porteiros</dt><dd>{activeRole('doorman')} de {condominium.staffLimit}</dd></div><div><dt>Moradores vinculados</dt><dd>{residents.filter((item) => item.status === 'active').length}</dd></div></dl></section><section className="settings-card"><header><UserRound size={20} /><div><h2>Contato</h2><p>Referência administrativa</p></div></header><dl><div><dt>Responsável</dt><dd>{condominium.contactName || 'Não informado'}</dd></div><div><dt>E-mail</dt><dd>{condominium.contactEmail || 'Não informado'}</dd></div><div><dt>Endereço</dt><dd>{condominium.addressLine || 'Não informado'}</dd></div><div><dt>Cidade / UF</dt><dd>{[condominium.city, condominium.state].filter(Boolean).join(' / ') || 'Não informado'}</dd></div><div><dt>CEP</dt><dd>{condominium.postalCode || 'Não informado'}</dd></div></dl></section></div>{canManage && <div className="operational-notice"><ShieldCheck size={18} /><span><strong>Dados protegidos.</strong> Alterações cadastrais do condomínio são realizadas pelo administrador da plataforma; blocos, unidades e acessos continuam sob sua gestão.</span></div>}</section>;
}

function DoormanDashboard({ condominium, buildings, units, packages, staff, residents, staffLimit, canManage, onCreateBuilding, onCreateUnit, onCreateInternalPerson, onResetInternalPassword, onStaffStatus, onResidentStatus, onNewPackage, onResidentView, displayName, email, onSignOut }: { condominium: OperationalCondominium; buildings: OperationalBuilding[]; units: OperationalUnit[]; packages: PackageRecord[]; staff: StaffPerson[]; residents: ResidentPerson[]; staffLimit: number; canManage: boolean; onCreateBuilding: (name: string, code: string, floors: string) => Promise<CreateResult>; onCreateUnit: (buildingId: string, unitNumber: string, floorLabel: string) => Promise<CreateResult>; onCreateInternalPerson: (role: PersonInvitationRole, username: string, fullName: string, unitId?: string) => Promise<CreateResult>; onResetInternalPassword: (identityId: string) => Promise<CreateResult>; onStaffStatus: (id: string, active: boolean) => Promise<CreateResult>; onResidentStatus: (person: ResidentPerson, action: 'approve' | 'deactivate' | 'reactivate') => Promise<CreateResult>; onNewPackage: () => void; onResidentView: () => void; displayName: string; email: string; onSignOut: () => void }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [section, setSection] = useState<OperationalSection>(() => window.location.hash === '#unidades' ? 'units' : window.location.hash === '#pessoas' ? 'people' : window.location.hash === '#historico' ? 'history' : window.location.hash === '#configuracoes' ? 'settings' : 'dashboard');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'waiting' | 'all'>('waiting');
  const [buildingFilter, setBuildingFilter] = useState('all');
  const [selectedPackage, setSelectedPackage] = useState<PackageRecord | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const visiblePackages = useMemo(() => packages.filter((item) => {
    const matchesFilter = filter === 'all' || item.status === 'waiting';
    const matchesBuilding = buildingFilter === 'all' || item.building === buildingFilter;
    const normalized = query.trim().toLocaleLowerCase('pt-BR');
    return matchesFilter && matchesBuilding && (!normalized || [item.apartment, item.resident, item.carrier, item.id].some((value) => value.toLocaleLowerCase('pt-BR').includes(normalized)));
  }), [buildingFilter, filter, packages, query]);
  const todayStart = startOfTodayIso();
  const waitingCount = packages.filter((item) => item.status === 'waiting').length;
  const receivedToday = packages.filter((item) => item.receivedAt >= todayStart).length;
  const collectedToday = packages.filter((item) => item.status === 'collected' && item.collectedAtIso && item.collectedAtIso >= todayStart).length;
  const currentDate = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date());

  return (
    <div className={`app-shell ${sidebarCollapsed ? 'app-shell--collapsed' : ''} ${mobileMenuOpen ? 'app-shell--mobile-open' : ''}`}>
      {mobileMenuOpen && <button className="mobile-menu-backdrop" onClick={() => setMobileMenuOpen(false)} type="button" aria-label="Fechar menu" />}
      <Sidebar collapsed={sidebarCollapsed} activeSection={section} onNavigate={(next) => { setSection(next); setMobileMenuOpen(false); }} onToggle={() => setSidebarCollapsed((current) => !current)} onResidentView={onResidentView} condominiumName={condominium.name} waitingCount={waitingCount} displayName={displayName} email={email} onSignOut={onSignOut} />
      <main className="dashboard" id="painel">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileMenuOpen(true)} type="button" aria-label="Abrir menu"><Menu /></button>
          <Brand compact />
          <span className="topbar__date">{currentDate}</span>
          <div className="topbar__actions"><button className="icon-button notification" onClick={() => setShowNotifications(true)} type="button" aria-label={`Notificações${waitingCount ? `, ${waitingCount} pendentes` : ''}`}><Bell size={20} />{waitingCount > 0 && <i />}</button><button className="mobile-avatar" onClick={() => setSection('settings')} type="button" aria-label="Abrir configurações">{userInitials(displayName)}</button></div>
        </header>
        <div className="dashboard__content">
          {section === 'units' ? <UnitsManagement condominium={condominium} buildings={buildings} units={units} canManage={canManage} onCreateBuilding={onCreateBuilding} onCreateUnit={onCreateUnit} /> : section === 'people' ? <PeopleManagement condominium={condominium} units={units} staffLimit={staffLimit} staff={staff} residents={residents} canManage={canManage} onCreateInternal={onCreateInternalPerson} onResetPassword={onResetInternalPassword} onStaffStatus={onStaffStatus} onResidentStatus={onResidentStatus} /> : section === 'history' ? <OperationalHistory condominium={condominium} packages={packages} onOpen={setSelectedPackage} /> : section === 'settings' ? <CondominiumSettings condominium={condominium} buildings={buildings} units={units} staff={staff} residents={residents} canManage={canManage} /> : <>
          <section className="page-heading">
            <div><span className="eyebrow">PORTARIA · OPERAÇÃO ATIVA</span><h1>Olá, {displayName.split(' ')[0]}.</h1><p>Acompanhe o que chegou e mantenha a portaria em ordem.</p></div>
            <button className="button button--primary button--large" disabled={units.length === 0} onClick={onNewPackage} title={units.length === 0 ? 'Cadastre uma unidade antes de receber encomendas' : undefined} type="button"><PackagePlus size={19} />Nova encomenda</button>
          </section>
          {units.length === 0 && <div className="operational-notice"><Building2 size={18} /><span><strong>Estrutura inicial pendente</strong> Cadastre os blocos e as unidades do {condominium.name} para começar a receber encomendas.</span></div>}
          <section className="metrics" aria-label="Resumo da portaria">
            <MetricCard icon={<Boxes size={21} />} label="Aguardando retirada" value={String(waitingCount).padStart(2, '0')} detail="Dados em tempo real" tone="amber" />
            <MetricCard icon={<PackageCheck size={21} />} label="Recebidas hoje" value={String(receivedToday).padStart(2, '0')} detail="Desde 00:00" tone="mineral" />
            <MetricCard icon={<Check size={21} />} label="Retiradas hoje" value={String(collectedToday).padStart(2, '0')} detail="Confirmadas hoje" />
            <MetricCard icon={<Clock3 size={21} />} label="Tempo médio de espera" value={formatAverageWait(packages)} detail="Últimos 30 dias" />
          </section>
          <section className="package-section" id="encomendas">
            <header>
              <div><h2>Encomendas recentes</h2><p>Registros da portaria atualizados agora</p></div>
              <div className="segmented"><button className={filter === 'waiting' ? 'active' : ''} onClick={() => setFilter('waiting')} type="button">Pendentes</button><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')} type="button">Todas</button></div>
            </header>
            <div className="package-toolbar">
              <label className="search-field"><Search size={18} /><span className="sr-only">Buscar encomenda</span><input placeholder="Buscar apartamento, morador ou código" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
              <label className="building-filter"><Building2 size={17} /><span className="sr-only">Filtrar por bloco</span><select value={buildingFilter} onChange={(event) => setBuildingFilter(event.target.value)}><option value="all">Todos os blocos</option>{buildings.map((building) => <option key={building.id} value={building.name}>{building.name}</option>)}</select><ChevronDown size={16} /></label>
            </div>
            <div className="package-table" role="table" aria-label="Encomendas recentes">
              <div className="package-table__head" role="row"><span>UNIDADE</span><span>DESTINATÁRIO</span><span>TRANSPORTADORA</span><span>CHEGADA</span><span>STATUS</span><span /></div>
              {visiblePackages.map((item) => (
                <div className="package-row" role="row" key={item.id}>
                  <div className="unit-cell"><span>{item.apartment}</span><small>{item.building}</small></div>
                  <div><strong>{item.resident}</strong><small>{item.id}</small></div>
                  <div><span>{item.carrier}</span><small>{item.note || 'Sem observações'}</small></div>
                  <div><span>{item.arrivedAt}</span><small>Registrada na portaria</small></div>
                  <div><Status status={item.status} /></div>
                  <button className="row-action" onClick={() => setSelectedPackage(item)} type="button" aria-label={`Abrir encomenda ${item.id}`}><ChevronDown size={17} /></button>
                </div>
              ))}
              {visiblePackages.length === 0 && <div className="empty-state">{packages.length === 0 ? <Boxes size={24} /> : <Search size={24} />}<strong>{packages.length === 0 ? 'Nenhuma encomenda registrada' : 'Nenhuma encomenda encontrada'}</strong><span>{packages.length === 0 ? `Os registros do ${condominium.name} aparecerão aqui.` : 'Tente buscar por outra unidade ou nome.'}</span></div>}
            </div>
            <footer className="table-footer"><span>Mostrando {visiblePackages.length} registros</span><button onClick={() => { setFilter('all'); setBuildingFilter('all'); setQuery(''); }} type="button">Ver todas as encomendas <span>→</span></button></footer>
          </section>
          </>}
        </div>
      </main>
      {selectedPackage && <PackageDetails item={selectedPackage} onClose={() => setSelectedPackage(null)} />}
      {showNotifications && <NotificationsPanel packages={packages} onClose={() => setShowNotifications(false)} onOpen={(item) => { setShowNotifications(false); setSelectedPackage(item); }} />}
    </div>
  );
}

function ResidentApp({ packages, unit, condominium, displayName, email, preview = false, onBack, onCollect }: { packages: PackageRecord[]; unit: OperationalUnit | null; condominium: OperationalCondominium; displayName: string; email: string; preview?: boolean; onBack: () => void; onCollect: (id: string) => void }) {
  const [tab, setTab] = useState<'home' | 'history' | 'profile'>('home');
  const [showNotifications, setShowNotifications] = useState(false);
  const residentPackages = unit ? packages.filter((item) => item.unitId === unit.id) : [];
  const waiting = residentPackages.filter((item) => item.status === 'waiting');
  const [selected, setSelected] = useState<string | null>(null);
  const selectedPackage = residentPackages.find((item) => item.id === selected);

  return (
    <main className="resident-app">
      <div className="resident-desktop-bar"><Brand /><button className="button button--outline" onClick={onBack} type="button"><ArrowLeft size={17} />Voltar à portaria</button></div>
      <div className="phone-surface">
        <header className="resident-header"><Brand /><button className="icon-button notification" onClick={() => setShowNotifications(true)} type="button" aria-label={`Notificações${waiting.length ? `, ${waiting.length} pendentes` : ''}`}><Bell size={20} />{waiting.length > 0 && <i />}</button></header>
        <section className="resident-content">
          <div className="resident-welcome"><div><span>OLÁ, {preview ? 'MORADOR' : displayName.toLocaleUpperCase('pt-BR')}</span><h1>Suas encomendas</h1></div><span className="avatar avatar--large">{userInitials(preview ? 'Morador' : displayName)}</span></div>
          {tab === 'home' && (
            <>
              <div className="arrival-card">
                <span className="arrival-card__icon"><PackageCheck size={25} /></span>
                <div><span>{waiting.length > 0 ? `${waiting.length} encomendas aguardando` : 'Tudo retirado'}</span><strong>{waiting.length > 0 ? 'Tem novidade na portaria.' : 'Nenhuma pendência por aqui.'}</strong><small>{unit ? `Unidade ${unit.unitNumber} · ${unit.buildingName}` : 'Pré-visualização sem unidade selecionada'}</small></div>
              </div>
              <div className="section-title"><div><h2>Aguardando retirada</h2><span>{waiting.length}</span></div><small>Atualizado agora</small></div>
              <div className="resident-package-list">
                {waiting.map((item) => (
                  <button className="resident-package-card" onClick={() => setSelected(item.id)} type="button" key={item.id}>
                    <span className="carrier-mark">{item.carrier.slice(0, 1)}</span>
                    <span><strong>{item.carrier}</strong><small>{item.arrivedAt}</small><em>{item.note ?? 'Encomenda'}</em></span>
                    <span className="card-arrow">→</span>
                  </button>
                ))}
                {waiting.length === 0 && <div className="resident-empty"><Check size={24} /><strong>Nenhuma encomenda pendente</strong><span>Você retirou tudo que estava na portaria.</span></div>}
              </div>
              <div className="resident-note"><ShieldCheck size={18} /><p>Para sua segurança, confirme a retirada somente quando estiver com a encomenda em mãos.</p></div>
            </>
          )}
          {tab === 'history' && (
            <section className="history-list"><div className="section-title"><div><h2>Histórico recente</h2></div></div>{residentPackages.filter((item) => item.status === 'collected').map((item) => <article key={item.id}><span className="carrier-mark">{item.carrier.slice(0, 1)}</span><div><strong>{item.carrier}</strong><small>Retirada em {item.collectedAt}</small></div><Check size={18} /></article>)}{residentPackages.every((item) => item.status !== 'collected') && <div className="resident-empty"><Archive size={24} /><strong>Nenhuma retirada registrada</strong><span>As confirmações aparecerão aqui.</span></div>}</section>
          )}
          {tab === 'profile' && <section className="resident-profile"><span className="avatar avatar--large">{userInitials(preview ? 'Morador' : displayName)}</span><h2>{preview ? 'Pré-visualização do morador' : displayName}</h2><p>{preview ? 'Esta tela mostra exatamente a experiência da unidade selecionada.' : email}</p><dl><div><dt>Condomínio</dt><dd>{condominium.name}</dd></div><div><dt>Unidade</dt><dd>{unit ? `${unit.buildingName} · ${unit.unitNumber}` : 'Não vinculada'}</dd></div><div><dt>Status</dt><dd>Ativo</dd></div></dl><button className="button button--outline button--full" onClick={onBack} type="button"><LogOut size={17} />{preview ? 'Voltar à portaria' : 'Sair da conta'}</button></section>}
        </section>
        <nav className="resident-nav" aria-label="Navegação do morador"><button className={tab === 'home' ? 'active' : ''} onClick={() => setTab('home')} type="button"><Boxes size={20} /><span>Encomendas</span></button><button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')} type="button"><Archive size={20} /><span>Histórico</span></button><button className={tab === 'profile' ? 'active' : ''} onClick={() => setTab('profile')} type="button"><UserRound size={20} /><span>Perfil</span></button></nav>
      </div>
      {selectedPackage && (
        <div className="panel-layer resident-modal-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}>
          <section className="pickup-modal" role="dialog" aria-modal="true" aria-labelledby="pickup-title">
            <button className="icon-button" onClick={() => setSelected(null)} type="button" aria-label="Fechar"><X size={20} /></button>
            <span className="pickup-modal__icon"><PackageCheck size={28} /></span>
            <span className="eyebrow">CONFIRMAÇÃO DE RETIRADA</span>
            <h2 id="pickup-title">Você está com a encomenda?</h2>
            <p>Esta ação registra seu nome, data e horário no histórico da portaria.</p>
            <dl><div><dt>Transportadora</dt><dd>{selectedPackage.carrier}</dd></div><div><dt>Chegada</dt><dd>{selectedPackage.arrivedAt}</dd></div><div><dt>Unidade</dt><dd>Apartamento {selectedPackage.apartment}</dd></div></dl>
            <button className="button button--primary button--full" onClick={() => { onCollect(selectedPackage.id); setSelected(null); }} type="button"><Check size={19} />Confirmar retirada agora</button>
            <button className="text-button" onClick={() => setSelected(null)} type="button">Voltar sem confirmar</button>
          </section>
        </div>
      )}
      {showNotifications && <NotificationsPanel packages={residentPackages} onClose={() => setShowNotifications(false)} onOpen={(item) => { setShowNotifications(false); setSelected(item.id); }} />}
    </main>
  );
}

function InitialPasswordChange({ username, condominiumId, onComplete, onSignOut }: { username: string; condominiumId: string; onComplete: () => void; onSignOut: () => void }) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    if (password !== confirmation) {
      setError('As senhas não coincidem.');
      return;
    }
    setSaving(true);
    setError(null);
    const { data, error: confirmationError } = await supabase.functions.invoke<InternalIdentityResponse>('manage-internal-identity', {
      body: { action: 'change_password', condominiumId, password },
    });
    setSaving(false);
    if (confirmationError || !data?.ok) {
      setError(data?.error || confirmationError?.message || 'Não foi possível concluir a troca de senha.');
      return;
    }
    onComplete();
  }

  return <main className="password-change-page"><section className="password-change-card"><Brand /><span className="password-change-icon"><KeyRound size={24} /></span><span className="eyebrow">PRIMEIRO ACESSO</span><h1>Crie sua senha definitiva</h1><p>A conta <strong>@{username}</strong> está usando uma senha temporária. Defina uma nova senha antes de entrar no Domus One.</p><form onSubmit={submit}><label>Nova senha<input autoComplete="new-password" required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo de 8 caracteres" /></label><label>Confirmar nova senha<input autoComplete="new-password" required minLength={8} type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Digite novamente" /></label>{error && <div className="auth-message auth-message--error">{error}</div>}<button className="button button--primary button--full" disabled={saving} type="submit">{saving ? <LoaderCircle className="spin" size={18} /> : <Check size={18} />}{saving ? 'Salvando…' : 'Salvar e acessar'}</button></form><button className="auth-switch" onClick={onSignOut} type="button">Sair e trocar de conta</button></section></main>;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [access, setAccess] = useState<AccessContext | null>(null);
  const [accessLoading, setAccessLoading] = useState(false);
  const [internalIdentity, setInternalIdentity] = useState<CurrentInternalIdentity | null>(null);
  const [view, setView] = useState<AppView>('doorman');
  const [condominium, setCondominium] = useState<OperationalCondominium | null>(null);
  const [buildings, setBuildings] = useState<OperationalBuilding[]>([]);
  const [units, setUnits] = useState<OperationalUnit[]>([]);
  const [packages, setPackages] = useState<PackageRecord[]>([]);
  const [staff, setStaff] = useState<StaffPerson[]>([]);
  const [residents, setResidents] = useState<ResidentPerson[]>([]);
  const [peopleRefreshKey, setPeopleRefreshKey] = useState(0);
  const [operationalLoading, setOperationalLoading] = useState(false);
  const [operationalError, setOperationalError] = useState<string | null>(null);
  const [packageSaving, setPackageSaving] = useState(false);
  const [showNewPackage, setShowNewPackage] = useState(false);
  const [showPreviewPicker, setShowPreviewPicker] = useState(false);
  const [previewUnitId, setPreviewUnitId] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session || !supabase) {
      setAccess(null);
      setInternalIdentity(null);
      setAccessLoading(false);
      return;
    }

    let active = true;
    async function resolveAccess() {
      if (!supabase) return;
      setAccessLoading(true);
      await supabase.rpc('claim_staff_invites');

      const [platformResult, staffResult, residentResult, internalIdentityResult] = await Promise.all([
        supabase.from('platform_admins').select('user_id').eq('user_id', session!.user.id).maybeSingle(),
        supabase.from('staff_memberships').select('role,condominium_id').eq('user_id', session!.user.id).eq('status', 'active').limit(1).maybeSingle(),
        supabase.from('unit_memberships').select('condominium_id,unit_id').eq('user_id', session!.user.id).eq('status', 'active').limit(1).maybeSingle(),
        supabase.from('internal_identities').select('id,username,must_change_password').eq('user_id', session!.user.id).maybeSingle(),
      ]);

      if (!active) return;
      if (platformResult.data) setAccess({ kind: 'platform' });
      else if (staffResult.data) setAccess({ kind: 'staff', role: staffResult.data.role as StaffRole, condominiumId: staffResult.data.condominium_id });
      else if (residentResult.data) setAccess({ kind: 'resident', condominiumId: residentResult.data.condominium_id, unitId: residentResult.data.unit_id });
      else setAccess({ kind: 'none' });
      setInternalIdentity(internalIdentityResult.data ? {
        id: internalIdentityResult.data.id,
        username: internalIdentityResult.data.username,
        mustChangePassword: internalIdentityResult.data.must_change_password,
      } : null);
      setAccessLoading(false);
    }
    void resolveAccess();
    return () => { active = false; };
  }, [session]);

  useEffect(() => {
    if (!supabase || !access || (access.kind !== 'staff' && access.kind !== 'resident')) {
      setCondominium(null);
      setBuildings([]);
      setUnits([]);
      setPackages([]);
      setStaff([]);
      setResidents([]);
      setOperationalError(null);
      setOperationalLoading(false);
      return;
    }

    let active = true;
    async function loadOperationalData() {
      if (!supabase || !access || (access.kind !== 'staff' && access.kind !== 'resident')) return;
      setOperationalLoading(true);
      setOperationalError(null);
      const condominiumId = access.condominiumId;
      const packageQuery = supabase.from('packages')
        .select('id,unit_id,recipient_name,carrier,description,status,received_at,collected_at')
        .eq('condominium_id', condominiumId)
        .in('status', ['waiting', 'collected'])
        .order('received_at', { ascending: false })
        .limit(200);
      if (access.kind === 'resident') packageQuery.eq('unit_id', access.unitId);

      const [condominiumResult, buildingsResult, unitsResult, packagesResult, staffResult, residentsResult, profilesResult, identitiesResult] = await Promise.all([
        supabase.from('condominiums').select('id,name,registration_code,staff_limit,legal_name,document_number,address_line,city,state,postal_code,contact_name,contact_email').eq('id', condominiumId).single(),
        supabase.from('buildings').select('id,name,code,floors').eq('condominium_id', condominiumId).order('sort_order'),
        supabase.from('units').select('id,unit_number,building_id,floor_label').eq('condominium_id', condominiumId).eq('status', 'active').order('unit_number'),
        packageQuery,
        supabase.from('staff_memberships').select('id,user_id,invited_email,role,status,is_owner').eq('condominium_id', condominiumId).order('created_at'),
        supabase.from('unit_memberships').select('id,user_id,unit_id,status').eq('condominium_id', condominiumId).order('created_at'),
        supabase.from('profiles').select('id,full_name,email'),
        supabase.from('internal_identities').select('id,user_id,username').eq('condominium_id', condominiumId),
      ]);
      if (!active) return;
      const loadError = condominiumResult.error || buildingsResult.error || unitsResult.error || packagesResult.error || staffResult.error || residentsResult.error || profilesResult.error || identitiesResult.error;
      if (loadError) {
        setOperationalError(loadError.message);
        setOperationalLoading(false);
        return;
      }

      const buildingNames = new Map((buildingsResult.data || []).map((building) => [building.id, building.name]));
      const nextUnits: OperationalUnit[] = (unitsResult.data || []).map((unit) => ({
        id: unit.id,
        unitNumber: unit.unit_number,
        buildingId: unit.building_id,
        buildingName: buildingNames.get(unit.building_id) || 'Bloco não informado',
        floorLabel: unit.floor_label,
      }));
      const unitsById = new Map(nextUnits.map((unit) => [unit.id, unit]));
      const profilesById = new Map((profilesResult.data || []).map((profile) => [profile.id, profile]));
      const identitiesByUserId = new Map((identitiesResult.data || []).map((identity) => [identity.user_id, identity]));
      const nextPackages: PackageRecord[] = ((packagesResult.data || []) as PackageRow[]).flatMap((item) => {
        const unit = unitsById.get(item.unit_id);
        if (!unit || item.status === 'cancelled') return [];
        return [{
          id: `DO-${item.id.slice(0, 8).toLocaleUpperCase('pt-BR')}`,
          databaseId: item.id,
          unitId: item.unit_id,
          apartment: unit.unitNumber,
          building: unit.buildingName,
          resident: item.recipient_name,
          carrier: item.carrier,
          arrivedAt: formatDateTime(item.received_at),
          receivedAt: item.received_at,
          note: item.description || undefined,
          status: item.status,
          collectedAt: item.collected_at ? formatDateTime(item.collected_at) : undefined,
          collectedAtIso: item.collected_at || undefined,
        }];
      });
      setCondominium({
        id: condominiumResult.data.id,
        name: condominiumResult.data.name,
        registrationCode: condominiumResult.data.registration_code,
        staffLimit: condominiumResult.data.staff_limit,
        legalName: condominiumResult.data.legal_name,
        documentNumber: condominiumResult.data.document_number,
        addressLine: condominiumResult.data.address_line,
        city: condominiumResult.data.city,
        state: condominiumResult.data.state,
        postalCode: condominiumResult.data.postal_code,
        contactName: condominiumResult.data.contact_name,
        contactEmail: condominiumResult.data.contact_email,
      });
      setBuildings((buildingsResult.data || []).map((building) => ({ id: building.id, name: building.name, code: building.code, floors: building.floors })));
      setUnits(nextUnits);
      setPackages(nextPackages);
      setStaff((staffResult.data || []).map((membership) => {
        const profile = membership.user_id ? profilesById.get(membership.user_id) : null;
        const identity = membership.user_id ? identitiesByUserId.get(membership.user_id) : null;
        return { id: membership.id, identityId: identity?.id || null, userId: membership.user_id, username: identity?.username || null, email: identity ? '' : membership.invited_email || profile?.email || '', fullName: profile?.full_name || '', role: membership.role as StaffRole, status: membership.status as 'invited' | 'active' | 'inactive', isOwner: membership.is_owner };
      }));
      setResidents((residentsResult.data || []).flatMap((membership) => {
        const unit = unitsById.get(membership.unit_id);
        if (!unit) return [];
        const profile = profilesById.get(membership.user_id);
        const identity = identitiesByUserId.get(membership.user_id);
        return [{ id: membership.id, identityId: identity?.id || null, userId: membership.user_id, username: identity?.username || null, email: identity ? '' : profile?.email || '', fullName: profile?.full_name || '', status: membership.status as 'pending' | 'active' | 'inactive' | 'rejected', unitId: membership.unit_id, unitNumber: unit.unitNumber, buildingName: unit.buildingName }];
      }));
      setOperationalLoading(false);
    }
    void loadOperationalData();
    return () => { active = false; };
  }, [access, peopleRefreshKey]);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 3200);
  }

  async function createInternalPerson(role: PersonInvitationRole, username: string, fullName: string, unitId?: string): Promise<CreateResult> {
    if (!supabase || !condominium) return { ok: false, error: 'Condomínio não carregado.' };
    const { data, error } = await supabase.functions.invoke<InternalIdentityResponse>('manage-internal-identity', {
      body: { action: 'create', condominiumId: condominium.id, username: username.trim(), role, fullName: fullName.trim(), unitId },
    });
    if (error || !data?.ok) {
      let functionError = error?.message;
      if (error && 'context' in error && error.context instanceof Response) {
        const response = await error.context.clone().json().catch(() => null) as InternalIdentityResponse | null;
        functionError = response?.error || functionError;
      }
      const message = data?.error || functionError || 'Não foi possível criar a conta.';
      if (message.includes('staff_limit_reached')) return { ok: false, error: 'O limite de usuários da portaria foi atingido.' };
      if (message.includes('special_role_limit_reached')) return { ok: false, error: 'Este perfil já possui uma pessoa ativa ou convidada. Desative o vínculo atual antes de substituir.' };
      if (message.includes('username_already_exists') || message.includes('duplicate')) return { ok: false, error: 'Este nome de usuário já está em uso no condomínio.' };
      if (message.includes('invalid_username')) return { ok: false, error: 'Use de 3 a 32 caracteres: letras minúsculas, números, ponto, traço ou sublinhado.' };
      if (message.includes('not_authorized')) return { ok: false, error: 'Seu vínculo não possui permissão para criar contas. Entre novamente ou confirme se o perfil está ativo.' };
      if (message.includes('invalid_session') || message.includes('JWT')) return { ok: false, error: 'Sua sessão expirou. Saia da conta, entre novamente e repita o cadastro.' };
      if (message.includes('invalid input syntax for type uuid')) return { ok: false, error: 'Não foi possível validar sua sessão. Atualize a página e entre novamente.' };
      return { ok: false, error: message };
    }
    setPeopleRefreshKey((current) => current + 1);
    return { ok: true, credentials: data.credentials };
  }

  async function resetInternalPassword(identityId: string): Promise<CreateResult> {
    if (!supabase || !condominium) return { ok: false, error: 'Condomínio não carregado.' };
    const { data, error } = await supabase.functions.invoke<InternalIdentityResponse>('manage-internal-identity', {
      body: { action: 'reset_password', condominiumId: condominium.id, identityId },
    });
    if (error || !data?.ok) return { ok: false, error: data?.error || error?.message || 'Não foi possível redefinir a senha.' };
    return { ok: true, credentials: data.credentials ? { ...data.credentials, condominiumCode: condominium.registrationCode } : undefined };
  }

  async function changeStaffStatus(id: string, active: boolean): Promise<CreateResult> {
    if (!supabase) return { ok: false, error: 'Supabase não configurado.' };
    const { error } = await supabase.rpc('set_staff_member_status', { p_membership_id: id, p_active: active });
    if (error) return { ok: false, error: error.message };
    setPeopleRefreshKey((current) => current + 1);
    return { ok: true };
  }

  async function changeResidentStatus(person: ResidentPerson, action: 'approve' | 'deactivate' | 'reactivate'): Promise<CreateResult> {
    if (!supabase) return { ok: false, error: 'Supabase não configurado.' };
    const result = action === 'approve'
      ? await supabase.rpc('approve_resident_membership', { p_membership_id: person.id })
      : action === 'reactivate'
        ? await supabase.rpc('reactivate_resident_membership', { p_membership_id: person.id })
        : await supabase.rpc('deactivate_resident_membership', { p_membership_id: person.id, p_reason: 'Desativado pela administração do condomínio' });
    if (result.error) return { ok: false, error: result.error.message };
    setPeopleRefreshKey((current) => current + 1);
    return { ok: true };
  }

  async function createBuilding(name: string, code: string, floors: string): Promise<CreateResult> {
    if (!supabase || !condominium) return { ok: false, error: 'Condomínio não carregado.' };
    const { data, error } = await supabase.from('buildings').insert({
      condominium_id: condominium.id,
      name: name.trim(),
      code: code.trim().toLocaleUpperCase('pt-BR'),
      floors: floors ? Number(floors) : null,
      sort_order: buildings.length,
    }).select('id,name,code,floors').single();
    if (error || !data) return { ok: false, error: error?.message.includes('duplicate') ? 'Já existe um bloco com este código.' : error?.message };
    setBuildings((current) => [...current, { id: data.id, name: data.name, code: data.code, floors: data.floors }]);
    return { ok: true };
  }

  async function createUnit(buildingId: string, unitNumber: string, floorLabel: string): Promise<CreateResult> {
    if (!supabase || !condominium) return { ok: false, error: 'Condomínio não carregado.' };
    const building = buildings.find((item) => item.id === buildingId);
    if (!building) return { ok: false, error: 'Selecione um bloco válido.' };
    const { data, error } = await supabase.from('units').insert({
      condominium_id: condominium.id,
      building_id: building.id,
      unit_number: unitNumber.trim(),
      floor_label: floorLabel.trim() || null,
    }).select('id,unit_number,building_id,floor_label').single();
    if (error || !data) return { ok: false, error: error?.message.includes('duplicate') ? 'Esta unidade já existe no bloco selecionado.' : error?.message };
    const nextUnit: OperationalUnit = { id: data.id, unitNumber: data.unit_number, buildingId: data.building_id, buildingName: building.name, floorLabel: data.floor_label };
    setUnits((current) => [...current, nextUnit].sort((left, right) => left.unitNumber.localeCompare(right.unitNumber, 'pt-BR', { numeric: true })));
    return { ok: true };
  }

  async function addPackage(form: NewPackageForm) {
    if (!supabase || !session || !condominium) return;
    const unit = units.find((item) => item.id === form.unitId);
    if (!unit) {
      notify('Selecione uma unidade válida.');
      return;
    }
    setPackageSaving(true);
    const { data, error } = await supabase.from('packages').insert({
      condominium_id: condominium.id,
      unit_id: unit.id,
      recipient_name: form.resident.trim(),
      carrier: form.carrier,
      description: form.note.trim() || null,
      received_by: session.user.id,
    }).select('id,unit_id,recipient_name,carrier,description,status,received_at,collected_at').single();
    setPackageSaving(false);
    if (error || !data) {
      notify(error?.message || 'Não foi possível registrar a encomenda.');
      return;
    }
    const row = data as PackageRow;
    const next: PackageRecord = {
      id: `DO-${row.id.slice(0, 8).toLocaleUpperCase('pt-BR')}`,
      databaseId: row.id,
      unitId: row.unit_id,
      apartment: unit.unitNumber,
      building: unit.buildingName,
      resident: row.recipient_name,
      carrier: row.carrier,
      note: row.description || undefined,
      arrivedAt: formatDateTime(row.received_at),
      receivedAt: row.received_at,
      status: 'waiting',
    };
    setPackages((current) => [next, ...current]);
    setShowNewPackage(false);
    notify(`Encomenda registrada para a unidade ${next.apartment}.`);
  }

  async function collectPackage(id: string) {
    if (!supabase) return;
    const current = packages.find((item) => item.id === id);
    if (!current) return;
    const { data, error } = await supabase.rpc('confirm_package_pickup', { p_package_id: current.databaseId });
    if (error || !data) {
      notify(error?.message || 'Não foi possível confirmar a retirada.');
      return;
    }
    const collectedAtIso = (data as PackageRow).collected_at || new Date().toISOString();
    setPackages((items) => items.map((item) => item.id === id ? { ...item, status: 'collected', collectedAt: formatDateTime(collectedAtIso), collectedAtIso } : item));
    notify('Retirada confirmada com sucesso.');
  }

  if (!isSupabaseConfigured) {
    return <main className="system-state"><Brand /><ShieldCheck size={30} /><h1>Configuração pendente</h1><p>Defina as variáveis públicas do Supabase para liberar o acesso.</p></main>;
  }

  if (authLoading || (session && accessLoading)) {
    return <main className="system-state"><Brand /><LoaderCircle className="spin" size={30} /><p>Validando sua sessão…</p></main>;
  }

  if (!session) return <PublicSite />;

  const displayName = String(session.user.user_metadata.full_name || session.user.email?.split('@')[0] || 'Usuário');
  const email = session.user.email || '';
  const signOut = () => supabase?.auth.signOut();
  const accountLabel = internalIdentity ? `@${internalIdentity.username}` : email;

  if (internalIdentity?.mustChangePassword && access && (access.kind === 'staff' || access.kind === 'resident')) return <InitialPasswordChange username={internalIdentity.username} condominiumId={access.condominiumId} onComplete={() => setInternalIdentity((current) => current ? { ...current, mustChangePassword: false } : current)} onSignOut={signOut} />;
  if (access?.kind === 'platform') return <PlatformDashboard displayName={displayName} email={email} onSignOut={signOut} />;
  if (!access || access.kind === 'none') return <NoAccess email={email} onSignOut={signOut} />;
  if (operationalLoading) return <main className="system-state"><Brand /><LoaderCircle className="spin" size={30} /><p>Carregando dados do condomínio…</p></main>;
  if (operationalError || !condominium) return <main className="system-state"><Brand /><ShieldCheck size={30} /><h1>Não foi possível carregar o condomínio</h1><p>{operationalError || 'O vínculo está ativo, mas os dados do condomínio não foram encontrados.'}</p><button className="button button--outline" onClick={() => window.location.reload()} type="button"><RefreshCw size={17} />Tentar novamente</button></main>;
  if (access.kind === 'resident') return <ResidentApp packages={packages} unit={units.find((unit) => unit.id === access.unitId) || null} condominium={condominium} displayName={displayName} email={accountLabel} onBack={signOut} onCollect={collectPackage} />;

  return (
    <>
      {view === 'doorman' ? (
        <DoormanDashboard condominium={condominium} buildings={buildings} units={units} packages={packages} staff={staff} residents={residents} staffLimit={condominium.staffLimit} canManage={['admin', 'syndic', 'deputy_syndic'].includes(access.role)} onCreateBuilding={createBuilding} onCreateUnit={createUnit} onCreateInternalPerson={createInternalPerson} onResetInternalPassword={resetInternalPassword} onStaffStatus={changeStaffStatus} onResidentStatus={changeResidentStatus} onNewPackage={() => setShowNewPackage(true)} onResidentView={() => setShowPreviewPicker(true)} displayName={displayName} email={accountLabel} onSignOut={signOut} />
      ) : (
        <ResidentApp packages={packages} unit={units.find((unit) => unit.id === previewUnitId) || null} condominium={condominium} displayName={displayName} email={email} preview onBack={() => setView('doorman')} onCollect={collectPackage} />
      )}
      {showPreviewPicker && <div className="panel-layer resident-modal-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setShowPreviewPicker(false)}><section className="preview-picker" role="dialog" aria-modal="true" aria-labelledby="preview-picker-title"><header><div><span className="eyebrow">PRÉ-VISUALIZAÇÃO</span><h2 id="preview-picker-title">Escolha uma unidade</h2><p>A prévia exibirá somente as encomendas vinculadas à unidade escolhida.</p></div><button className="icon-button" onClick={() => setShowPreviewPicker(false)} type="button" aria-label="Fechar"><X size={20} /></button></header><label>Unidade<select autoFocus value={previewUnitId} onChange={(event) => setPreviewUnitId(event.target.value)}><option value="">Selecionar unidade</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.buildingName} · {unit.unitNumber}</option>)}</select></label><footer><button className="button button--ghost" onClick={() => setShowPreviewPicker(false)} type="button">Cancelar</button><button className="button button--primary" disabled={!previewUnitId} onClick={() => { setShowPreviewPicker(false); setView('resident'); }} type="button"><UserRound size={17} />Abrir prévia</button></footer></section></div>}
      {showNewPackage && <NewPackagePanel units={units} saving={packageSaving} onClose={() => setShowNewPackage(false)} onSave={(form) => void addPackage(form)} />}
      {toast && <div className="toast" role="status"><Check size={18} /><span>{toast}</span></div>}
    </>
  );
}
