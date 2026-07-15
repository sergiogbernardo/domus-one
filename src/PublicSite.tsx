import { FormEvent, useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Building2,
  Check,
  Clock3,
  Cookie,
  FileCheck2,
  LoaderCircle,
  LockKeyhole,
  Menu,
  PackageCheck,
  PackagePlus,
  ShieldCheck,
  Smartphone,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import { supabase } from './lib/supabase';

type PublicPage = 'landing' | 'staff' | 'resident' | 'privacy' | 'cookies' | 'terms';
type CookieChoice = 'essential' | 'all';

const pageHashes: Record<PublicPage, string> = {
  landing: '',
  staff: 'acesso-portaria',
  resident: 'acesso-morador',
  privacy: 'privacidade',
  cookies: 'cookies',
  terms: 'termos',
};

function pageFromHash(): PublicPage {
  const hash = window.location.hash.replace('#', '');
  return (Object.entries(pageHashes).find(([, value]) => value === hash)?.[0] as PublicPage | undefined) || 'landing';
}

function PublicBrand() {
  return (
    <div className="brand" aria-label="Domus One">
      <span className="brand__mark" aria-hidden="true"><span>D</span><b>1</b></span>
      <span className="brand__name"><strong>DOMUS</strong><small>ONE</small></span>
    </div>
  );
}

function AccessPage({ audience, onBack, onLegal }: { audience: 'staff' | 'resident'; onBack: () => void; onLegal: (page: PublicPage) => void }) {
  const [mode, setMode] = useState<'signin' | 'activate'>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const isStaff = audience === 'staff';

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
    if (mode === 'activate' && !result.data.session) {
      setMessage({ tone: 'success', text: 'Acesso ativado. Confirme o e-mail para concluir.' });
    }
  }

  return (
    <main className={`access-page access-page--${audience}`}>
      <section className="access-context">
        <button className="access-back" onClick={onBack} type="button"><ArrowLeft size={17} />Voltar para o site</button>
        <PublicBrand />
        <div className="access-context__copy">
          <span className="eyebrow">{isStaff ? 'ACESSO OPERACIONAL' : 'ÁREA DO MORADOR'}</span>
          <h1>{isStaff ? 'A portaria no controle de cada entrega.' : 'Suas encomendas, sempre à vista.'}</h1>
          <p>{isStaff ? 'Registre chegadas, localize volumes e mantenha um histórico seguro da operação.' : 'Acompanhe novas encomendas e confirme a retirada diretamente pelo seu acesso.'}</p>
          <ul>
            <li><Check size={15} />Acesso protegido por perfil</li>
            <li><Check size={15} />Dados isolados por condomínio</li>
            <li><Check size={15} />Histórico com rastreabilidade</li>
          </ul>
        </div>
        <small>DOMUS ONE · SEGURANÇA DESDE A PORTARIA</small>
      </section>
      <section className="access-form-panel">
        <div className="access-mobile-brand"><PublicBrand /><button className="access-mobile-back" onClick={onBack} type="button" aria-label="Voltar para o site"><ArrowLeft size={18} /></button></div>
        <div className="access-form-card">
          <span className="access-role-icon">{isStaff ? <Building2 size={22} /> : <UserRound size={22} />}</span>
          <span className="eyebrow">{mode === 'activate' ? 'PRIMEIRO ACESSO' : isStaff ? 'PORTARIA E ADMINISTRAÇÃO' : 'MORADOR'}</span>
          <h2>{mode === 'activate' ? 'Ativar convite' : isStaff ? 'Entrar na portaria' : 'Entrar como morador'}</h2>
          <p>{mode === 'activate' ? 'Use exatamente o e-mail convidado pelo administrador.' : 'Informe seu e-mail e senha para continuar.'}</p>
          <form onSubmit={submit}>
            {mode === 'activate' && <label>Nome completo<input autoComplete="name" required value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Seu nome" /></label>}
            <label>E-mail<input autoComplete="email" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@exemplo.com" /></label>
            <label>Senha<input autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo de 8 caracteres" /></label>
            {message && <div className={`auth-message auth-message--${message.tone}`} role="status">{message.text}</div>}
            <button className="button button--primary button--full" disabled={busy} type="submit">
              {busy ? <LoaderCircle className="spin" size={18} /> : <LockKeyhole size={18} />}
              {busy ? 'Validando…' : mode === 'activate' ? 'Ativar meu convite' : 'Entrar com segurança'}
            </button>
          </form>
          {isStaff && <button className="auth-switch" onClick={() => { setMode(mode === 'signin' ? 'activate' : 'signin'); setMessage(null); }} type="button">{mode === 'signin' ? 'Recebeu um convite? Ativar acesso' : 'Já ativou? Entrar na portaria'}</button>}
          {!isStaff && <div className="resident-login-help"><ShieldCheck size={16} /><span>Seu acesso precisa estar aprovado pela administração do condomínio.</span></div>}
          <div className="access-legal">Ao continuar, você concorda com os <button onClick={() => onLegal('terms')} type="button">Termos de Uso</button> e a <button onClick={() => onLegal('privacy')} type="button">Política de Privacidade</button>.</div>
        </div>
      </section>
    </main>
  );
}

const legalContent = {
  privacy: {
    eyebrow: 'PROTEÇÃO DE DADOS',
    title: 'Política de Privacidade',
    intro: 'Esta política explica como o Domus One trata dados pessoais na gestão de encomendas e acessos condominiais.',
    sections: [
      ['1. Papéis e responsabilidades', 'O condomínio normalmente atua como controlador dos dados de moradores, unidades, funcionários e encomendas. O Domus One atua como operador desses dados conforme as instruções e o contrato firmado com o condomínio, sem prejuízo das situações em que seja controlador de dados próprios da plataforma.'],
      ['2. Dados tratados', 'Podemos tratar nome, e-mail, telefone quando informado, condomínio, bloco, unidade, perfil de acesso, registros de entrada e retirada de encomendas, datas, horários e trilhas de auditoria. Não solicitamos dados sensíveis para o fluxo normal do serviço.'],
      ['3. Finalidades e bases legais', 'Os dados são utilizados para autenticar usuários, entregar notificações, registrar movimentações, prevenir fraudes, prestar suporte e cumprir obrigações contratuais e legais. As bases aplicáveis podem incluir execução de contrato, legítimo interesse, cumprimento de obrigação legal e exercício regular de direitos.'],
      ['4. Compartilhamento e infraestrutura', 'Os dados ficam disponíveis apenas para usuários autorizados do condomínio correspondente. Utilizamos fornecedores de infraestrutura e autenticação, incluindo Supabase e GitHub Pages, limitados ao necessário para operar e proteger o serviço. Não vendemos dados pessoais.'],
      ['5. Retenção e segurança', 'Os registros são mantidos pelo período necessário às finalidades do serviço, às obrigações legais e à defesa de direitos. Aplicamos isolamento por condomínio, controle de acesso por perfil, conexões criptografadas e trilhas de auditoria. Nenhum sistema elimina integralmente todos os riscos.'],
      ['6. Direitos do titular', 'Nos termos da LGPD, o titular pode solicitar confirmação, acesso, correção, anonimização, bloqueio, eliminação, portabilidade e informações sobre compartilhamento, quando aplicável. Solicitações relativas aos dados do condomínio devem ser direcionadas primeiro à sua administração.'],
      ['7. Contato e atualizações', 'Dúvidas sobre privacidade podem ser enviadas para privacidade@sabion.io ou para a administração do condomínio. Esta política poderá ser atualizada para refletir mudanças legais ou funcionais, com indicação da nova data de vigência.'],
    ],
  },
  cookies: {
    eyebrow: 'TRANSPARÊNCIA DIGITAL',
    title: 'Política de Cookies',
    intro: 'O Domus One utiliza apenas tecnologias necessárias para autenticação, segurança e funcionamento da experiência.',
    sections: [
      ['1. O que são cookies', 'Cookies e tecnologias semelhantes armazenam pequenas informações no navegador para manter sessões, preferências e recursos de segurança. O armazenamento local do navegador também pode cumprir funções equivalentes.'],
      ['2. Tecnologias essenciais', 'A autenticação do Supabase mantém a sessão do usuário e protege o acesso. O Domus One também armazena a escolha de cookies e preferências estritamente funcionais. Sem essas tecnologias, partes autenticadas do serviço podem não funcionar corretamente.'],
      ['3. Cookies opcionais', 'Atualmente não utilizamos cookies de publicidade, rastreamento entre sites ou analytics. Caso uma categoria opcional seja adicionada no futuro, ela permanecerá desativada até uma escolha válida do usuário e esta política será atualizada.'],
      ['4. Controle pelo usuário', 'Você pode rever sua escolha pelo link “Preferências de cookies” no rodapé. Também é possível apagar dados do site nas configurações do navegador; isso poderá encerrar sua sessão e exigir novo login.'],
      ['5. Prazo e contato', 'A preferência de cookies fica salva no navegador até ser removida pelo usuário. Para dúvidas, entre em contato pelo e-mail privacidade@sabion.io.'],
    ],
  },
  terms: {
    eyebrow: 'REGRAS DA PLATAFORMA',
    title: 'Termos de Uso',
    intro: 'Estes termos regulam o acesso ao Domus One por administradores, profissionais de portaria e moradores.',
    sections: [
      ['1. Elegibilidade e acesso', 'O uso depende de vínculo válido com um condomínio cadastrado. Administradores e profissionais de portaria entram por convite; moradores precisam de vínculo aprovado com uma unidade. Cada usuário deve fornecer informações corretas e manter sua senha confidencial.'],
      ['2. Uso permitido', 'A plataforma deve ser usada exclusivamente para a gestão legítima de encomendas, usuários e unidades. É proibido tentar acessar outro condomínio, compartilhar credenciais, interferir na segurança ou registrar informações falsas.'],
      ['3. Responsabilidades do condomínio', 'A administração do condomínio define usuários autorizados, mantém os cadastros atualizados e estabelece os procedimentos físicos de recebimento e entrega. O registro digital complementa, mas não substitui, medidas de conferência e segurança da portaria.'],
      ['4. Disponibilidade e evolução', 'Buscamos manter o serviço disponível e seguro, mas manutenções, falhas de internet e eventos fora de controle podem causar interrupções. Funcionalidades podem evoluir desde que preservados os direitos aplicáveis e a finalidade principal do serviço.'],
      ['5. Suspensão e encerramento', 'Acessos podem ser suspensos em caso de desligamento, mudança de morador, solicitação do condomínio, risco de segurança ou violação destes termos. Os registros poderão ser mantidos conforme obrigações legais e políticas de retenção.'],
      ['6. Privacidade e legislação', 'O tratamento de dados segue a Política de Privacidade e a legislação brasileira, incluindo a LGPD. Estes termos são regidos pelas leis da República Federativa do Brasil.'],
      ['7. Contato', 'Dúvidas sobre estes termos podem ser enviadas para contato@sabion.io. A versão vigente estará sempre disponível nesta página.'],
    ],
  },
} as const;

function LegalPage({ page, onBack }: { page: 'privacy' | 'cookies' | 'terms'; onBack: () => void }) {
  const content = legalContent[page];
  return (
    <main className="legal-page">
      <header className="public-nav legal-nav"><button onClick={onBack} type="button" className="public-brand-button"><PublicBrand /></button><button className="button button--outline" onClick={onBack} type="button"><ArrowLeft size={16} />Voltar</button></header>
      <article className="legal-document">
        <span className="eyebrow">{content.eyebrow}</span>
        <h1>{content.title}</h1>
        <p className="legal-intro">{content.intro}</p>
        <div className="legal-meta"><span>Vigência: 15 de julho de 2026</span><span>Versão 1.0</span></div>
        {content.sections.map(([title, text]) => <section key={title}><h2>{title}</h2><p>{text}</p></section>)}
      </article>
      <PublicFooter onNavigate={(next) => window.location.hash = pageHashes[next]} onCookieSettings={() => window.dispatchEvent(new Event('domus-cookie-settings'))} />
    </main>
  );
}

function PublicFooter({ onNavigate, onCookieSettings }: { onNavigate: (page: PublicPage) => void; onCookieSettings: () => void }) {
  return (
    <footer className="public-footer">
      <div><PublicBrand /><p>Gestão segura de encomendas para condomínios.</p></div>
      <nav aria-label="Documentos legais"><button onClick={() => onNavigate('privacy')} type="button">Privacidade</button><button onClick={() => onNavigate('cookies')} type="button">Cookies</button><button onClick={() => onNavigate('terms')} type="button">Termos de Uso</button><button onClick={onCookieSettings} type="button">Preferências de cookies</button></nav>
      <small>© 2026 Domus One. Todos os direitos reservados.</small>
    </footer>
  );
}

function LandingPage({ onNavigate, onCookieSettings }: { onNavigate: (page: PublicPage) => void; onCookieSettings: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <main className="public-site">
      <header className="public-nav">
        <button className="public-brand-button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} type="button"><PublicBrand /></button>
        <nav className={menuOpen ? 'open' : ''}><a href="#solucao" onClick={() => setMenuOpen(false)}>A solução</a><a href="#como-funciona" onClick={() => setMenuOpen(false)}>Como funciona</a><a href="#seguranca" onClick={() => setMenuOpen(false)}>Segurança</a><button className="nav-resident" onClick={() => onNavigate('resident')} type="button"><UserRound size={16} />Área do morador</button><button className="button button--primary" onClick={() => onNavigate('staff')} type="button">Acesso à portaria <ArrowRight size={16} /></button></nav>
        <button className="public-menu" onClick={() => setMenuOpen((current) => !current)} type="button" aria-label="Abrir menu">{menuOpen ? <X /> : <Menu />}</button>
      </header>

      <section className="public-hero">
        <div className="public-hero__copy">
          <span className="hero-pill"><ShieldCheck size={15} />Gestão de encomendas com rastreabilidade</span>
          <h1>A portaria registra.<br />O morador acompanha.<br /><em>O condomínio evolui.</em></h1>
          <p>Uma solução executiva para digitalizar o recebimento e a retirada de encomendas, sem perder a simplicidade da operação diária.</p>
          <div className="hero-actions"><button className="button button--primary button--large" onClick={() => onNavigate('staff')} type="button"><Building2 size={18} />Entrar na portaria</button><button className="button button--outline button--large" onClick={() => onNavigate('resident')} type="button"><Smartphone size={18} />Sou morador</button></div>
          <div className="hero-trust"><span><Check size={14} />Sem papel</span><span><Check size={14} />Acesso por perfil</span><span><Check size={14} />Pronto para qualquer condomínio</span></div>
        </div>
        <div className="hero-product" aria-label="Demonstração do painel Domus One">
          <div className="hero-product__glow" />
          <div className="product-window">
            <header><div><i /><i /><i /></div><span>PORTARIA · OPERAÇÃO ATIVA</span><Bell size={16} /></header>
            <div className="product-body">
              <aside><span className="mini-brand">D¹</span><i className="active" /><i /><i /><i /></aside>
              <div className="product-content">
                <div className="product-heading"><div><small>VISÃO GERAL</small><strong>Bom dia, Lucas.</strong></div><span><PackagePlus size={14} />Nova encomenda</span></div>
                <div className="product-metrics"><article><PackageCheck size={16} /><b>18</b><small>Aguardando</small></article><article><Clock3 size={16} /><b>06</b><small>Recebidas hoje</small></article><article><Check size={16} /><b>11</b><small>Retiradas hoje</small></article></div>
                <div className="product-list"><header><strong>Encomendas recentes</strong><small>Atualizado agora</small></header>{[['1204', 'Mariana Costa', 'Amazon'], ['803', 'Rafael Mendes', 'Mercado Livre'], ['1502', 'Carla Azevedo', 'Correios']].map(([unit, name, carrier]) => <div key={unit}><b>{unit}</b><span><strong>{name}</strong><small>{carrier}</small></span><em>Aguardando</em></div>)}</div>
              </div>
            </div>
          </div>
          <div className="resident-float"><span><PackageCheck size={19} /></span><div><small>NOVA ENCOMENDA</small><strong>Seu pacote chegou</strong><em>Apto 1204 · Agora</em></div></div>
        </div>
      </section>

      <section className="public-proof"><span>UMA OPERAÇÃO MAIS ORGANIZADA PARA</span><div><strong>Administradoras</strong><i />Condomínios residenciais<i />Portarias 24 horas<i />Moradores</div></section>

      <section className="public-solution" id="solucao">
        <div className="section-heading"><span className="eyebrow">UMA EXPERIÊNCIA, TRÊS VISÕES</span><h2>Cada pessoa vê exatamente<br />o que precisa.</h2><p>Do controle central à confirmação do morador, todos os acessos respeitam o papel de cada usuário.</p></div>
        <div className="solution-grid">
          <article><span><UsersRound /></span><small>ADMINISTRAÇÃO</small><h3>Governança sem complicação</h3><p>Cadastre condomínios, designe administradores e acompanhe acessos em ambientes isolados.</p><ul><li><Check />Múltiplos condomínios</li><li><Check />Até 10 operadores por unidade</li><li><Check />Controle de vínculos</li></ul></article>
          <article className="featured"><span><Building2 /></span><small>PORTARIA</small><h3>Agilidade no balcão</h3><p>Registre uma chegada em poucos segundos e encontre qualquer encomenda sem folhear livros.</p><ul><li><Check />Registro rápido</li><li><Check />Busca instantânea</li><li><Check />Histórico auditável</li></ul></article>
          <article><span><Smartphone /></span><small>MORADOR</small><h3>Informação na palma da mão</h3><p>Acompanhe pendências e confirme a retirada com uma experiência pensada para o celular.</p><ul><li><Check />Avisos claros</li><li><Check />Histórico pessoal</li><li><Check />Confirmação digital</li></ul></article>
        </div>
      </section>

      <section className="public-flow" id="como-funciona">
        <div className="section-heading section-heading--light"><span className="eyebrow">DO RECEBIMENTO À RETIRADA</span><h2>Um fluxo simples.<br />Uma operação confiável.</h2></div>
        <div className="flow-steps"><article><b>01</b><span><PackagePlus /></span><h3>A encomenda chega</h3><p>O porteiro informa unidade, destinatário e transportadora.</p></article><i /><article><b>02</b><span><Bell /></span><h3>O morador visualiza</h3><p>A nova encomenda aparece na área pessoal do morador.</p></article><i /><article><b>03</b><span><FileCheck2 /></span><h3>A retirada é confirmada</h3><p>A confirmação registra usuário, data e horário no histórico.</p></article></div>
      </section>

      <section className="public-security" id="seguranca">
        <div className="security-seal"><ShieldCheck size={45} /><span>SEGURANÇA<br />POR PADRÃO</span></div>
        <div><span className="eyebrow">CONFIANÇA EM CADA REGISTRO</span><h2>Os dados de um condomínio<br />nunca se misturam com os de outro.</h2><p>O Domus One foi estruturado com isolamento multi-condomínio, permissões decididas no banco de dados e rastreabilidade de ações críticas.</p><div className="security-items"><span><LockKeyhole /><b>Acesso por perfil</b><small>Administrador, portaria e morador com permissões próprias.</small></span><span><ShieldCheck /><b>Isolamento de dados</b><small>Políticas de segurança aplicadas em cada consulta.</small></span><span><FileCheck2 /><b>Trilha de auditoria</b><small>Eventos importantes associados ao usuário responsável.</small></span></div></div>
      </section>

      <section className="public-cta"><span className="eyebrow">DOMUS ONE</span><h2>O livro da portaria pode<br />ficar no passado.</h2><p>Entre no ambiente certo e experimente uma gestão de encomendas mais simples e segura.</p><div><button className="button button--primary button--large" onClick={() => onNavigate('staff')} type="button">Acessar portaria <ArrowRight size={17} /></button><button className="button button--outline button--large" onClick={() => onNavigate('resident')} type="button">Área do morador</button></div></section>
      <PublicFooter onNavigate={onNavigate} onCookieSettings={onCookieSettings} />
    </main>
  );
}

function CookieBanner({ onChoose, onPolicy }: { onChoose: (choice: CookieChoice) => void; onPolicy: () => void }) {
  return <aside className="cookie-banner" aria-label="Preferências de cookies"><span className="cookie-icon"><Cookie size={21} /></span><div><strong>Sua privacidade importa</strong><p>Usamos tecnologias essenciais para autenticação e segurança. Não utilizamos publicidade ou analytics neste momento. <button onClick={onPolicy} type="button">Saiba mais</button></p></div><div className="cookie-actions"><button className="button button--ghost" onClick={() => onChoose('essential')} type="button">Somente essenciais</button><button className="button button--primary" onClick={() => onChoose('all')} type="button">Aceitar opcionais</button></div></aside>;
}

export default function PublicSite() {
  const [page, setPage] = useState<PublicPage>(pageFromHash);
  const [cookieChoice, setCookieChoice] = useState<CookieChoice | null>(() => localStorage.getItem('domus-one-cookie-choice') as CookieChoice | null);

  useEffect(() => {
    const syncPage = () => setPage(pageFromHash());
    const resetCookies = () => setCookieChoice(null);
    window.addEventListener('hashchange', syncPage);
    window.addEventListener('domus-cookie-settings', resetCookies);
    return () => { window.removeEventListener('hashchange', syncPage); window.removeEventListener('domus-cookie-settings', resetCookies); };
  }, []);

  function navigate(next: PublicPage) {
    setPage(next);
    window.history.pushState(null, '', pageHashes[next] ? `#${pageHashes[next]}` : window.location.pathname);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function chooseCookies(choice: CookieChoice) {
    localStorage.setItem('domus-one-cookie-choice', choice);
    setCookieChoice(choice);
  }

  let content;
  if (page === 'staff' || page === 'resident') content = <AccessPage audience={page} onBack={() => navigate('landing')} onLegal={navigate} />;
  else if (page === 'privacy' || page === 'cookies' || page === 'terms') content = <LegalPage page={page} onBack={() => navigate('landing')} />;
  else content = <LandingPage onNavigate={navigate} onCookieSettings={() => setCookieChoice(null)} />;

  return <>{content}{cookieChoice === null && <CookieBanner onChoose={chooseCookies} onPolicy={() => navigate('cookies')} />}</>;
}
