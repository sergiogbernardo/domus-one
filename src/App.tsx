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
  LoaderCircle,
  LogOut,
  Menu,
  PackageCheck,
  PackagePlus,
  Search,
  Settings,
  ShieldCheck,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import { initialPackages } from './data';
import { isSupabaseConfigured, supabase } from './lib/supabase';
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

function AuthScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;

    setBusy(true);
    setMessage(null);

    const result = mode === 'signin'
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: fullName.trim() },
            emailRedirectTo: new URL(import.meta.env.BASE_URL, window.location.origin).toString(),
          },
        });

    setBusy(false);
    if (result.error) {
      setMessage({ tone: 'error', text: result.error.message });
      return;
    }

    if (mode === 'signup' && !result.data.session) {
      setMessage({ tone: 'success', text: 'Conta criada. Confirme o e-mail para entrar no Domus One.' });
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-story">
        <Brand />
        <div>
          <span className="eyebrow">GESTÃO DE ENCOMENDAS</span>
          <h1>Portaria organizada.<br />Moradores informados.</h1>
          <p>Uma operação segura para registrar chegadas, acompanhar retiradas e manter o histórico de cada condomínio.</p>
        </div>
        <small>DOMUS ONE · ACESSO SEGURO</small>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <Brand />
          <span className="eyebrow">{mode === 'signin' ? 'BEM-VINDO DE VOLTA' : 'PRIMEIRO ACESSO'}</span>
          <h2>{mode === 'signin' ? 'Entrar no Domus One' : 'Criar sua conta'}</h2>
          <p>{mode === 'signin' ? 'Use seu e-mail de acesso à portaria ou área do morador.' : 'Depois do cadastro, seu acesso será vinculado ao condomínio.'}</p>
          <form onSubmit={submit}>
            {mode === 'signup' && (
              <label>Nome completo<input autoComplete="name" required value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Seu nome" /></label>
            )}
            <label>E-mail<input autoComplete="email" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@exemplo.com" /></label>
            <label>Senha<input autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo de 8 caracteres" /></label>
            {message && <div className={`auth-message auth-message--${message.tone}`} role="status">{message.text}</div>}
            <button className="button button--primary button--full" disabled={busy} type="submit">
              {busy ? <LoaderCircle className="spin" size={18} /> : <ShieldCheck size={18} />}
              {busy ? 'Aguarde…' : mode === 'signin' ? 'Entrar com segurança' : 'Criar conta'}
            </button>
          </form>
          <button className="auth-switch" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage(null); }} type="button">
            {mode === 'signin' ? 'Ainda não tem acesso? Criar conta' : 'Já possui conta? Entrar'}
          </button>
        </div>
      </section>
    </main>
  );
}

function Sidebar({ onResidentView, displayName, email, onSignOut }: { onResidentView: () => void; displayName: string; email: string; onSignOut: () => void }) {
  return (
    <aside className="sidebar">
      <Brand />
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
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'waiting' | 'all'>('waiting');
  const visiblePackages = useMemo(() => packages.filter((item) => {
    const matchesFilter = filter === 'all' || item.status === 'waiting';
    const normalized = query.trim().toLocaleLowerCase('pt-BR');
    return matchesFilter && (!normalized || [item.apartment, item.resident, item.carrier, item.id].some((value) => value.toLocaleLowerCase('pt-BR').includes(normalized)));
  }), [filter, packages, query]);

  return (
    <div className="app-shell">
      <Sidebar onResidentView={onResidentView} displayName={displayName} email={email} onSignOut={onSignOut} />
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

  if (authLoading) {
    return <main className="system-state"><Brand /><LoaderCircle className="spin" size={30} /><p>Validando sua sessão…</p></main>;
  }

  if (!session) return <AuthScreen />;

  const displayName = String(session.user.user_metadata.full_name || session.user.email?.split('@')[0] || 'Usuário');
  const email = session.user.email || '';

  return (
    <>
      {view === 'doorman' ? (
        <DoormanDashboard packages={packages} onNewPackage={() => setShowNewPackage(true)} onResidentView={() => setView('resident')} displayName={displayName} email={email} onSignOut={() => supabase?.auth.signOut()} />
      ) : (
        <ResidentApp packages={packages} onBack={() => setView('doorman')} onCollect={collectPackage} />
      )}
      {showNewPackage && <NewPackagePanel onClose={() => setShowNewPackage(false)} onSave={addPackage} />}
      {toast && <div className="toast" role="status"><Check size={18} /><span>{toast}</span></div>}
    </>
  );
}
