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
  LayoutDashboard,
  Mail,
  LoaderCircle,
  LogOut,
  Menu,
  PackageCheck,
  PackagePlus,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import { initialPackages } from './data';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import PublicSite from './PublicSite';
import type { AppView, PackageRecord } from './types';

type NewPackageForm = {
  apartment: string;
  resident: string;
  carrier: string;
  note: string;
};

const emptyForm: NewPackageForm = {
  apartment: '',
  resident: '',
  carrier: '',
  note: '',
};

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
  status: 'active' | 'suspended' | 'archived';
  staff_limit: number;
  created_at: string;
};

type PlatformAdminView = 'overview' | 'condominiums' | 'administrators';

type CondominiumAdministrator = {
  id: string;
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
};

const emptyCondominiumForm: CondominiumForm = {
  name: '', legalName: '', documentNumber: '', addressLine: '', city: '', state: '',
  postalCode: '', contactName: '', contactEmail: '', adminEmail: '',
};

function slugify(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function PlatformDashboard({ displayName, email, onSignOut }: { displayName: string; email: string; onSignOut: () => void }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [platformView, setPlatformView] = useState<PlatformAdminView>('overview');
  const [condominiums, setCondominiums] = useState<CondominiumSummary[]>([]);
  const [administrators, setAdministrators] = useState<CondominiumAdministrator[]>([]);
  const [loading, setLoading] = useState(true);
  const [administratorsLoading, setAdministratorsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyCondominiumForm);
  const [error, setError] = useState<string | null>(null);

  async function loadCondominiums() {
    if (!supabase) return;
    setLoading(true);
    const { data, error: loadError } = await supabase.from('condominiums')
      .select('id,name,slug,registration_code,city,state,status,staff_limit,created_at')
      .order('created_at', { ascending: false });
    setLoading(false);
    if (loadError) setError(loadError.message);
    else setCondominiums((data || []) as CondominiumSummary[]);
  }

  async function loadAdministrators() {
    if (!supabase) return;
    setAdministratorsLoading(true);
    const { data, error: loadError } = await supabase.from('staff_memberships')
      .select('id,invited_email,user_id,status,is_owner,created_at,activated_at,condominiums(name,registration_code)')
      .eq('role', 'admin')
      .order('created_at', { ascending: false });
    setAdministratorsLoading(false);
    if (loadError) setError(loadError.message);
    else setAdministrators((data || []) as unknown as CondominiumAdministrator[]);
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
    const { error: createError } = await supabase.rpc('create_condominium_with_admin_invite', {
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
    setSaving(false);
    if (createError) {
      setError(createError.message.includes('platform_admin_cannot_join_condominium')
        ? 'Este e-mail pertence à administração da plataforma e não pode ser vinculado a um condomínio.'
        : createError.message);
      return;
    }
    setForm(emptyCondominiumForm);
    setShowForm(false);
    await Promise.all([loadCondominiums(), loadAdministrators()]);
  }

  const viewCopy = {
    overview: { eyebrow: 'DOMUS ONE · CONTROLE CENTRAL', title: 'Administração da plataforma', description: 'Acompanhe a operação geral e mantenha cada condomínio com sua própria equipe.' },
    condominiums: { eyebrow: 'GESTÃO DE OPERAÇÕES', title: 'Condomínios', description: 'Consulte ambientes, códigos de cadastro, limites e situação operacional.' },
    administrators: { eyebrow: 'GESTÃO DE ACESSOS', title: 'Administradores', description: 'Acompanhe quem recebeu ou ativou o acesso principal de cada condomínio.' },
  }[platformView];

  return (
    <div className={`platform-shell ${sidebarCollapsed ? 'platform-shell--collapsed' : ''}`}>
      <aside className="platform-sidebar">
        <div className="sidebar-brand-row"><Brand /><button className="sidebar-toggle" onClick={() => setSidebarCollapsed((current) => !current)} type="button" aria-label={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}><Menu size={18} /></button></div>
        <div className="platform-badge"><ShieldCheck size={15} />Administração da plataforma</div>
        <nav aria-label="Administração da plataforma"><button className={platformView === 'overview' ? 'active' : ''} onClick={() => setPlatformView('overview')} type="button"><LayoutDashboard size={18} />Visão geral</button><button className={platformView === 'condominiums' ? 'active' : ''} onClick={() => setPlatformView('condominiums')} type="button"><Building2 size={18} />Condomínios</button><button className={platformView === 'administrators' ? 'active' : ''} onClick={() => setPlatformView('administrators')} type="button"><UsersRound size={18} />Administradores</button></nav>
        <div className="operator-card"><span className="avatar">{userInitials(displayName)}</span><span><strong>{displayName}</strong><small>{email}</small></span><button className="operator-card__logout" onClick={onSignOut} type="button" aria-label="Sair"><LogOut size={16} /></button></div>
      </aside>
      <main className="platform-main">
        <header><div><span className="eyebrow">{viewCopy.eyebrow}</span><h1>{viewCopy.title}</h1><p>{viewCopy.description}</p></div>{platformView !== 'administrators' && <button className="button button--primary button--large" onClick={() => { setError(null); setShowForm(true); }} type="button"><Plus size={18} />Novo condomínio</button>}</header>
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
              <div className="platform-table__head"><span>CONDOMÍNIO</span><span>LOCALIZAÇÃO</span><span>CÓDIGO</span><span>LIMITE</span><span>STATUS</span></div>
              {condominiums.map((item) => <article key={item.id}><div><span className="condominium-icon"><Building2 size={18} /></span><span><strong>{item.name}</strong><small>{item.slug}</small></span></div><span>{[item.city, item.state].filter(Boolean).join(' · ') || 'Não informado'}</span><code>{item.registration_code}</code><span>{item.staff_limit} usuários</span><em className={`condominium-status condominium-status--${item.status}`}>{item.status === 'active' ? 'Ativo' : item.status === 'suspended' ? 'Suspenso' : 'Arquivado'}</em></article>)}
              {condominiums.length === 0 && <div className="platform-empty"><Building2 size={28} /><strong>Nenhum condomínio cadastrado</strong><span>Crie a primeira operação para começar.</span></div>}
            </div>
          )}
        </section> : <section className="platform-list platform-admin-list">
          <header><div><h2>Administradores de condomínio</h2><p>O administrador da plataforma não aparece nesta lista e não pode ocupar este perfil.</p></div><button className="icon-button" onClick={() => void loadAdministrators()} type="button" aria-label="Atualizar administradores"><RefreshCw size={17} /></button></header>
          {error && <div className="auth-message auth-message--error">{error}</div>}
          {administratorsLoading ? <div className="platform-loading"><LoaderCircle className="spin" size={22} />Carregando administradores…</div> : <div className="platform-admin-table">
            <div className="platform-admin-table__head"><span>ADMINISTRADOR</span><span>CONDOMÍNIO</span><span>PERFIL</span><span>STATUS</span></div>
            {administrators.map((item) => <article key={item.id}><div><span className="administrator-avatar">{userInitials(item.invited_email || 'Administrador')}</span><span><strong>{item.invited_email || 'E-mail não informado'}</strong><small>{item.user_id ? 'Conta vinculada' : 'Aguardando ativação'}</small></span></div><span><strong>{item.condominiums?.name || 'Condomínio indisponível'}</strong><small>{item.condominiums?.registration_code || '—'}</small></span><span>{item.is_owner ? 'Principal' : 'Administrador'}</span><em className={`membership-status membership-status--${item.status}`}>{item.status === 'active' ? 'Ativo' : item.status === 'invited' ? 'Convidado' : 'Inativo'}</em></article>)}
            {administrators.length === 0 && <div className="platform-empty"><UsersRound size={28} /><strong>Nenhum administrador cadastrado</strong><span>Um administrador será criado junto com o próximo condomínio.</span></div>}
          </div>}
        </section>}
      </main>
      {showForm && <div className="panel-layer resident-modal-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setShowForm(false)}><section className="platform-form-modal" role="dialog" aria-modal="true" aria-labelledby="condominium-form-title"><header><div><span className="eyebrow">NOVA OPERAÇÃO</span><h2 id="condominium-form-title">Cadastrar condomínio</h2><p>O administrador receberá um convite vinculado somente a este condomínio.</p></div><button className="icon-button" onClick={() => setShowForm(false)} type="button" aria-label="Fechar"><X size={20} /></button></header><form onSubmit={createCondominium}><div className="platform-form-grid"><label className="field-wide">Nome do condomínio<input required value={form.name} onChange={(event) => updateForm('name', event.target.value)} placeholder="Ex.: I9 Horto" /></label><label>Razão social<input value={form.legalName} onChange={(event) => updateForm('legalName', event.target.value)} /></label><label>CNPJ / documento<input value={form.documentNumber} onChange={(event) => updateForm('documentNumber', event.target.value)} /></label><label className="field-wide">Endereço<input value={form.addressLine} onChange={(event) => updateForm('addressLine', event.target.value)} /></label><label>Cidade<input value={form.city} onChange={(event) => updateForm('city', event.target.value)} /></label><label>Estado<input maxLength={2} value={form.state} onChange={(event) => updateForm('state', event.target.value)} placeholder="SP" /></label><label>CEP<input value={form.postalCode} onChange={(event) => updateForm('postalCode', event.target.value)} /></label><label>Contato no condomínio<input value={form.contactName} onChange={(event) => updateForm('contactName', event.target.value)} /></label><label>E-mail de contato<input type="email" value={form.contactEmail} onChange={(event) => updateForm('contactEmail', event.target.value)} /></label><label className="field-wide invite-field"><Mail size={18} /><span>Administrador do condomínio<small>Este e-mail receberá o perfil de administrador principal.</small></span><input required type="email" value={form.adminEmail} onChange={(event) => updateForm('adminEmail', event.target.value)} placeholder="administrador@condominio.com.br" /></label></div>{error && <div className="auth-message auth-message--error">{error}</div>}<footer><button className="button button--ghost" onClick={() => setShowForm(false)} type="button">Cancelar</button><button className="button button--primary" disabled={saving} type="submit">{saving ? <LoaderCircle className="spin" size={18} /> : <Plus size={18} />}{saving ? 'Criando…' : 'Criar condomínio e convite'}</button></footer></form></section></div>}
    </div>
  );
}

function NoAccess({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  return <main className="system-state"><Brand /><ShieldCheck size={30} /><h1>Acesso aguardando vínculo</h1><p>A conta <strong>{email}</strong> está autenticada, mas ainda não possui permissão em um condomínio. Se recebeu um convite, confirme o e-mail e entre novamente.</p><button className="button button--outline" onClick={onSignOut} type="button"><LogOut size={17} />Sair</button></main>;
}

type AccessContext =
  | { kind: 'platform' }
  | { kind: 'staff'; role: 'admin' | 'doorman'; condominiumId: string }
  | { kind: 'resident'; condominiumId: string; unitId: string }
  | { kind: 'none' };

function Sidebar({ collapsed, onToggle, onResidentView, displayName, email, onSignOut }: { collapsed: boolean; onToggle: () => void; onResidentView: () => void; displayName: string; email: string; onSignOut: () => void }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand-row"><Brand /><button className="sidebar-toggle" onClick={onToggle} type="button" aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}><Menu size={18} /></button></div>
      <div className="building-context">
        <span className="building-context__icon"><Building2 size={18} /></span>
        <span><small>Condomínio</small><strong>Maison Aurora</strong></span>
        <ChevronDown size={16} />
      </div>
      <nav aria-label="Navegação principal">
        <p>OPERAÇÃO</p>
        <a className="nav-link nav-link--active" href="#painel"><LayoutDashboard size={19} />Painel</a>
        <a className="nav-link" href="#encomendas"><Boxes size={19} />Encomendas<span>18</span></a>
        <a className="nav-link" href="#historico"><Archive size={19} />Histórico</a>
        <p>GESTÃO</p>
        <a className="nav-link" href="#unidades"><Building2 size={19} />Unidades</a>
        <a className="nav-link" href="#pessoas"><UsersRound size={19} />Pessoas</a>
        <a className="nav-link" href="#configuracoes"><Settings size={19} />Configurações</a>
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

function NewPackagePanel({ onClose, onSave }: { onClose: () => void; onSave: (form: NewPackageForm) => void }) {
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
            Apartamento
            <div className="field-prefix"><Building2 size={18} /><input autoFocus required inputMode="numeric" placeholder="Ex.: 1204" value={form.apartment} onChange={(e) => update('apartment', e.target.value)} /></div>
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
          <footer><button className="button button--ghost" onClick={onClose} type="button">Cancelar</button><button className="button button--primary" type="submit"><PackagePlus size={18} />Registrar encomenda</button></footer>
        </form>
      </section>
    </div>
  );
}

function DoormanDashboard({ packages, onNewPackage, onResidentView, displayName, email, onSignOut }: { packages: PackageRecord[]; onNewPackage: () => void; onResidentView: () => void; displayName: string; email: string; onSignOut: () => void }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'waiting' | 'all'>('waiting');
  const visiblePackages = useMemo(() => packages.filter((item) => {
    const matchesFilter = filter === 'all' || item.status === 'waiting';
    const normalized = query.trim().toLocaleLowerCase('pt-BR');
    return matchesFilter && (!normalized || [item.apartment, item.resident, item.carrier, item.id].some((value) => value.toLocaleLowerCase('pt-BR').includes(normalized)));
  }), [filter, packages, query]);

  return (
    <div className={`app-shell ${sidebarCollapsed ? 'app-shell--collapsed' : ''}`}>
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((current) => !current)} onResidentView={onResidentView} displayName={displayName} email={email} onSignOut={onSignOut} />
      <main className="dashboard" id="painel">
        <header className="topbar">
          <button className="mobile-menu" type="button" aria-label="Abrir menu"><Menu /></button>
          <Brand compact />
          <span className="topbar__date">Terça-feira, 14 de julho</span>
          <div className="topbar__actions"><button className="icon-button notification" aria-label="Notificações"><Bell size={20} /><i /></button><button className="mobile-avatar" type="button">LA</button></div>
        </header>
        <div className="dashboard__content">
          <section className="page-heading">
            <div><span className="eyebrow">PORTARIA · OPERAÇÃO ATIVA</span><h1>Olá, {displayName.split(' ')[0]}.</h1><p>Acompanhe o que chegou e mantenha a portaria em ordem.</p></div>
            <button className="button button--primary button--large" onClick={onNewPackage} type="button"><PackagePlus size={19} />Nova encomenda</button>
          </section>
          <section className="metrics" aria-label="Resumo da portaria">
            <MetricCard icon={<Boxes size={21} />} label="Aguardando retirada" value={String(packages.filter((item) => item.status === 'waiting').length + 13)} detail="3 desde ontem" tone="amber" />
            <MetricCard icon={<PackageCheck size={21} />} label="Recebidas hoje" value="06" detail="Dentro da média" tone="mineral" />
            <MetricCard icon={<Check size={21} />} label="Retiradas hoje" value="11" detail="+22% que ontem" />
            <MetricCard icon={<Clock3 size={21} />} label="Tempo médio de espera" value="1d 4h" detail="Últimos 30 dias" />
          </section>
          <section className="package-section" id="encomendas">
            <header>
              <div><h2>Encomendas recentes</h2><p>Registros da portaria atualizados agora</p></div>
              <div className="segmented"><button className={filter === 'waiting' ? 'active' : ''} onClick={() => setFilter('waiting')} type="button">Pendentes</button><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')} type="button">Todas</button></div>
            </header>
            <div className="package-toolbar">
              <label className="search-field"><Search size={18} /><span className="sr-only">Buscar encomenda</span><input placeholder="Buscar apartamento, morador ou código" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
              <button className="button button--outline" type="button"><Building2 size={17} />Todos os blocos<ChevronDown size={16} /></button>
            </div>
            <div className="package-table" role="table" aria-label="Encomendas recentes">
              <div className="package-table__head" role="row"><span>UNIDADE</span><span>DESTINATÁRIO</span><span>TRANSPORTADORA</span><span>CHEGADA</span><span>STATUS</span><span /></div>
              {visiblePackages.map((item) => (
                <div className="package-row" role="row" key={item.id}>
                  <div className="unit-cell"><span>{item.apartment}</span><small>Bloco Aurora</small></div>
                  <div><strong>{item.resident}</strong><small>{item.id}</small></div>
                  <div><span>{item.carrier}</span><small>{item.note ?? 'Volume padrão'}</small></div>
                  <div><span>{item.arrivedAt}</span><small>por Lucas Almeida</small></div>
                  <div><Status status={item.status} /></div>
                  <button className="row-action" type="button" aria-label={`Abrir encomenda ${item.id}`}><ChevronDown size={17} /></button>
                </div>
              ))}
              {visiblePackages.length === 0 && <div className="empty-state"><Search size={24} /><strong>Nenhuma encomenda encontrada</strong><span>Tente buscar por outro apartamento ou nome.</span></div>}
            </div>
            <footer className="table-footer"><span>Mostrando {visiblePackages.length} registros</span><button type="button">Ver todas as encomendas <span>→</span></button></footer>
          </section>
        </div>
      </main>
    </div>
  );
}

function ResidentApp({ packages, onBack, onCollect }: { packages: PackageRecord[]; onBack: () => void; onCollect: (id: string) => void }) {
  const [tab, setTab] = useState<'home' | 'history'>('home');
  const residentPackages = packages.filter((item) => item.apartment === '1204');
  const waiting = residentPackages.filter((item) => item.status === 'waiting');
  const [selected, setSelected] = useState<string | null>(null);
  const selectedPackage = residentPackages.find((item) => item.id === selected);

  return (
    <main className="resident-app">
      <div className="resident-desktop-bar"><Brand /><button className="button button--outline" onClick={onBack} type="button"><ArrowLeft size={17} />Voltar à portaria</button></div>
      <div className="phone-surface">
        <header className="resident-header"><Brand /><button className="icon-button notification" aria-label="Notificações"><Bell size={20} /><i /></button></header>
        <section className="resident-content">
          <div className="resident-welcome"><div><span>OLÁ, MARINA</span><h1>Suas encomendas</h1></div><span className="avatar avatar--large">MA</span></div>
          {tab === 'home' && (
            <>
              <div className="arrival-card">
                <span className="arrival-card__icon"><PackageCheck size={25} /></span>
                <div><span>{waiting.length > 0 ? `${waiting.length} encomendas aguardando` : 'Tudo retirado'}</span><strong>{waiting.length > 0 ? 'Tem novidade na portaria.' : 'Nenhuma pendência por aqui.'}</strong><small>Apartamento 1204 · Bloco Aurora</small></div>
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
            <section className="history-list"><div className="section-title"><div><h2>Histórico recente</h2></div></div>{residentPackages.filter((item) => item.status === 'collected').map((item) => <article key={item.id}><span className="carrier-mark">{item.carrier.slice(0, 1)}</span><div><strong>{item.carrier}</strong><small>Retirada em {item.collectedAt}</small></div><Check size={18} /></article>)}</section>
          )}
        </section>
        <nav className="resident-nav" aria-label="Navegação do morador"><button className={tab === 'home' ? 'active' : ''} onClick={() => setTab('home')} type="button"><Boxes size={20} /><span>Encomendas</span></button><button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')} type="button"><Archive size={20} /><span>Histórico</span></button><button type="button"><UserRound size={20} /><span>Perfil</span></button></nav>
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
    </main>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [access, setAccess] = useState<AccessContext | null>(null);
  const [accessLoading, setAccessLoading] = useState(false);
  const [view, setView] = useState<AppView>('doorman');
  const [packages, setPackages] = useState(initialPackages);
  const [showNewPackage, setShowNewPackage] = useState(false);
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
      setAccessLoading(false);
      return;
    }

    let active = true;
    async function resolveAccess() {
      if (!supabase) return;
      setAccessLoading(true);
      await supabase.rpc('claim_staff_invites');

      const [platformResult, staffResult, residentResult] = await Promise.all([
        supabase.from('platform_admins').select('user_id').eq('user_id', session!.user.id).maybeSingle(),
        supabase.from('staff_memberships').select('role,condominium_id').eq('user_id', session!.user.id).eq('status', 'active').limit(1).maybeSingle(),
        supabase.from('unit_memberships').select('condominium_id,unit_id').eq('user_id', session!.user.id).eq('status', 'active').limit(1).maybeSingle(),
      ]);

      if (!active) return;
      if (platformResult.data) setAccess({ kind: 'platform' });
      else if (staffResult.data) setAccess({ kind: 'staff', role: staffResult.data.role as 'admin' | 'doorman', condominiumId: staffResult.data.condominium_id });
      else if (residentResult.data) setAccess({ kind: 'resident', condominiumId: residentResult.data.condominium_id, unitId: residentResult.data.unit_id });
      else setAccess({ kind: 'none' });
      setAccessLoading(false);
    }
    void resolveAccess();
    return () => { active = false; };
  }, [session]);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 3200);
  }

  function addPackage(form: NewPackageForm) {
    const next: PackageRecord = {
      id: `DO-${2841 + packages.length}`,
      apartment: form.apartment.trim(),
      resident: form.resident.trim(),
      carrier: form.carrier,
      note: form.note.trim() || undefined,
      arrivedAt: 'Agora',
      status: 'waiting',
    };
    setPackages((current) => [next, ...current]);
    setShowNewPackage(false);
    notify(`Encomenda registrada para o apartamento ${next.apartment}.`);
  }

  function collectPackage(id: string) {
    setPackages((current) => current.map((item) => item.id === id ? { ...item, status: 'collected', collectedAt: 'Agora' } : item));
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

  if (access?.kind === 'platform') return <PlatformDashboard displayName={displayName} email={email} onSignOut={signOut} />;
  if (access?.kind === 'resident') return <ResidentApp packages={packages} onBack={signOut} onCollect={collectPackage} />;
  if (!access || access.kind === 'none') return <NoAccess email={email} onSignOut={signOut} />;

  return (
    <>
      {view === 'doorman' ? (
        <DoormanDashboard packages={packages} onNewPackage={() => setShowNewPackage(true)} onResidentView={() => setView('resident')} displayName={displayName} email={email} onSignOut={signOut} />
      ) : (
        <ResidentApp packages={packages} onBack={() => setView('doorman')} onCollect={collectPackage} />
      )}
      {showNewPackage && <NewPackagePanel onClose={() => setShowNewPackage(false)} onSave={addPackage} />}
      {toast && <div className="toast" role="status"><Check size={18} /><span>{toast}</span></div>}
    </>
  );
}
