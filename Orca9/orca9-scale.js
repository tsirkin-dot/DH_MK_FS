/* Orca9 scale layer: campaign orchestrator, page groups, hotfix lane, kill switch.
   Prototype only: no external systems, no real model calls. Loaded after orca9-page-control.js. */

/* ---------- campaign packet types ---------- */
const CK = {
  landing:  { label: 'Лендінг (нова сторінка)', who: 'Content Copywriter + Content Optimizer', review: ['SEO', 'PPC', 'AI Visibility'], approver: 'Editor', ch: 'Кампанія', risk: 'R2', human: true,
              launch: 'м’який запуск: noindex і 10% рекламного трафіку → моніторинг 7 днів → індексація', gate: 'Нова сторінка не має контролю для A/B: замість тесту — м’який запуск і моніторинг' },
  articles: { label: 'Статті (нові сторінки)', who: 'Content Copywriter', review: ['SEO', 'AI Visibility', 'Бренд'], approver: 'Editor', ch: 'Контент', risk: 'R2', human: true,
              launch: 'публікація 3 сторінок і внутрішні посилання на лендинг', gate: 'Факти через O2 і реєстр фактів; Editor затверджує' },
  ads:      { label: 'Реклама', who: 'PPC Strategist + Creative Strategist', review: ['SEO', 'Аналітика'], approver: 'Marketing lead (R3)', ch: 'PPC', risk: 'R3', human: true,
              launch: 'кампанію запущено, бюджет зарезервовано в ліміті ролі', gate: 'R3: ліміт ролі сукупно на тиждень, O3 перевіряє тижневий бюджет' },
  emails:   { label: 'Листи', who: 'Email Copywriter + Email Lifecycle Architect', review: ['Бренд', 'AI Visibility'], approver: 'Editor', ch: 'Email', risk: 'R2', human: true,
              launch: 'тестова розсилка → відписки й suppression ✓ → відправка 3 400 клієнтам', gate: 'Незворотна дія: завжди людина, тестова розсилка перед відправкою' },
  posts:    { label: 'Пости', who: 'LinkedIn Organic Strategist + Twitter/X Strategist', review: ['Бренд', 'AI Visibility'], approver: 'Editor', ch: 'SMM', risk: 'R2', human: true,
              launch: 'прев’ю → публікація за розкладом', gate: 'Прев’ю і дозволені акаунти; Editor затверджує' },
  update:   { label: 'Зміна наявної сторінки', who: 'Content Optimizer', review: ['SEO', 'PPC', 'AI Visibility'], approver: 'за тріажем Координатора', ch: 'SEO', risk: 'R2', human: false,
              launch: 'через Координатора сторінки: пакет → тест-гейт → gateway', gate: 'Наявна сторінка: повний контур Координатора і тест-гейт' }
};
const CK_ST = { plan: ['план', ''], wait: ['чекає залежність', ''], queued: ['у черзі ресурсу', 'warn'], work: ['агенти працюють', 'act'], review: ['погодження', 'act'], verify: ['O2 і O3', 'act'], return: ['повернуто O2', 'warn'], human: ['чекає людину', 'warn'], launch: ['запуск через gateway', 'act'], delegated: ['у Координатора сторінки', 'act'], blocked: ['записи вимкнено', 'bad'], done: ['готово', 'ok'], rejected: ['відхилено', 'bad'], failed: ['не пройшло', 'bad'] };
const GP_ST = { new: ['нова', ''], queued: ['у черзі групи', 'warn'], review: ['погодження правила', 'act'], human: ['чекає людину', 'warn'], auto: ['авто-дозвіл', 'ok'], test: ['тест половина/половина', 'act'], won: ['тест виграв', 'ok'], rollout: ['розгортання хвилями', 'act'], deployed: ['розгорнуто', 'ok'], rolledback: ['відкочено', 'bad'], inconclusive: ['висновок не визначено', 'warn'], rejected: ['відхилено', 'bad'], expired: ['прострочено', 'warn'] };
const WAVES = [10, 50, 100];

function scaleInit() {
  const mk = (prefix, names) => names.map(n => prefix + n);
  const G = [
    { id: 'G-FEATURES', name: 'Продуктові лендинги', pattern: '/features/*', template: 'feature-landing', share: '22% органіки', members: mk('/features/', ['forecasting', 'cohorts', 'billing', 'churn', 'mrr', 'ltv', 'benchmarks', 'alerts', 'exports', 'roles', 'api', 'sso']) },
    { id: 'G-BLOG', name: 'How-to статті блогу', pattern: '/blog/how-to-*', template: 'blog-how-to', share: '31% органіки', members: ['/blog/finance-close', '/blog/cfo-dashboard', ...Array.from({ length: 44 }, (_, i) => '/blog/how-to-' + (i + 1))] },
    { id: 'G-INTEG', name: 'Сторінки інтеграцій', pattern: '/integrations/*', template: 'integration', share: '6% органіки', members: mk('/integrations/', ['quickbooks', 'xero', 'netsuite', 'stripe', 'chargebee', 'recurly', 'hubspot', 'salesforce', 'slack', 'gsheets', 'snowflake', 'bigquery', 'sage', 'freshbooks', 'zoho', 'paddle', 'braintree', 'pipedrive']) },
    { id: 'G-PRICE', name: 'Сторінки з блоком ціни', pattern: 'будь-який шаблон із price-block', template: 'price-block', share: '—', members: ['/pricing', '/smart-reports', '/pricing-analytics', '/features/billing', '/compare/baremetrics', '/compare/profitwell', '/blog/saas-pricing-guide', '/partners', '/enterprise'] }
  ];
  G.forEach(g => GROUPS[g.id] = g);
  Object.assign(S, {
    clockH: 0, writesOff: false, killQueue: [], r3Used: {},
    groups: G,
    gps: [
      { id: 'GP-1', group: 'G-FEATURES', pod: 'PPC', agent: 'PPC Strategist', imp: 'high', conf: 76, field: 'cta',
        title: 'Єдиний CTA «Переглянути демо» на 12 продуктових лендингах',
        rule: 'cta = «Переглянути демо» для шаблону feature-landing',
        why: 'Рекламні кампанії ведуть на /features/*, а CTA різні: «Learn more», «Start», «Дізнатися більше». Message match з оголошеннями «Book a demo» втрачається.',
        sample: [['/features/forecasting', 'Learn more', 'Переглянути демо'], ['/features/cohorts', 'Start', 'Переглянути демо'], ['/features/billing', 'Дізнатися більше', 'Переглянути демо']],
        exceptions: [['/features/api', 'сторінка для розробників: CTA «Документація API» лишається']],
        rv: { SEO: ['ok', 'CTA не впливає на H1 і ключі'], PPC: ['ok', 'message match з оголошеннями «Book a demo»'], 'AI Visibility': ['ok', 'визначення і факти не зачеплено'] },
        tests: [['A/B тест', 3.1, 'конверсія в демо'], ['SEO-тест', 0.2, 'кліки до контролю'], ['AI Visibility тест', 0, 'згадки на промптах про функції']], canary: [1.4, 1.2, 1.1], status: 'new' },
      { id: 'GP-2', group: 'G-BLOG', pod: 'AI Visibility', agent: 'AI Search Optimizer', imp: 'low', conf: 82, field: 'definition',
        title: 'Блок-визначення на початку 46 how-to статей',
        rule: 'definition = визначення терміну з H1, ≤ 40 слів, джерело з реєстру фактів',
        why: 'AI Overviews і Perplexity цитують конкурентів, у яких перший абзац — коротке визначення. У нас вступ без визначення в 44 з 46 статей.',
        sample: [['/blog/finance-close', 'Вступ на 3 абзаци', 'Закриття місяця — підготовка й перевірка фінансових даних за завершений місяць.'], ['/blog/cfo-dashboard', 'Вступ з історією', 'CFO-дашборд — один екран з ключовими фінансовими показниками компанії.'], ['/blog/how-to-7', 'Без визначення', 'Revenue recognition — визнання доходу в періоді, коли послугу надано.']],
        exceptions: [['/blog/how-to-12', 'визначення вже є — без змін'], ['/blog/how-to-31', 'термін без перевіреного джерела — у ручну чергу']],
        rv: { SEO: ['ok', 'обсяг тексту і ключі збережено'], PPC: ['ok', 'статті не в рекламі'], 'AI Visibility': ['ok', 'структура для цитування'] },
        tests: [['A/B тест', 0.3, 'клік на CTA статті'], ['SEO-тест', 3, 'кліки до контролю'], ['AI Visibility тест', 9, 'цитування на промптах']], canary: [0.6, 0.4, 0.5], status: 'new' },
      { id: 'GP-3', group: 'G-INTEG', pod: 'AI Visibility', agent: 'Citation Analyst', imp: 'low', conf: 88, field: 'details',
        title: 'Рядок «доступно з» і changelog на 18 сторінках інтеграцій',
        rule: 'details += «Доступно з {дата з реєстру}. Що нового: {посилання на changelog}»',
        why: 'ChatGPT і Gemini кажуть, що інтеграцій немає або вони «у бета». На сторінках немає дат і посилань на changelog.',
        sample: [['/integrations/quickbooks', 'Опис без дати', 'Доступно з березня 2026. Що нового: changelog #412'], ['/integrations/xero', 'Опис без дати', 'Доступно з січня 2025. Що нового: changelog #298'], ['/integrations/netsuite', 'Опис без дати', 'Доступно з червня 2025. Що нового: changelog #341']],
        exceptions: [['/integrations/paddle', 'дата запуску відсутня в реєстрі — без змін']],
        rv: { SEO: ['ok', 'нова секція індексується'], PPC: ['ok', 'посадкові сторінки кампаній не змінено'], 'AI Visibility': ['ok', 'факт з датою для цитування'] },
        tests: [['A/B тест', 0.4, 'клік «Підключити»'], ['SEO-тест', 2.5, 'кліки до контролю'], ['AI Visibility тест', 11, 'коректність факту на промптах']], canary: [0.4, -2.8, 0.2], status: 'new' }
    ],
    cmps: [{ id: 'CMP-482', title: 'Запуск Smart Reports', epic: 'EP-12', budget: 3000, brief: 'Лендінг, 3 статті, 2 оголошення, 4 листи, 6 постів, банер на наявній /pricing', status: 'new', packets: [], updatePage: '/pricing' }],
    facts: [
      ['price.smart_reports', 'Smart Reports: від $79/міс', 'billing-system, 01.10.2026', 'Finance'],
      ['integration.quickbooks', 'Інтеграція QuickBooks доступна з березня 2026', 'changelog #412', 'Product'],
      ['customers.count', '1 200+ компаній', 'CRM, 30.09.2026', 'RevOps'],
      ['trial.days', 'Пробний період 14 днів', 'billing-system', 'Finance']
    ],
    hotfixes: [{ id: 'HF-1', title: 'Помилкова ціна: $49 замість $79', fact: 'price.smart_reports', group: 'G-PRICE', field: 'price', value: 'від $79/міс',
      found: 'Citation Analyst: Perplexity цитує «$49». Сканер сторінок знайшов стару ціну в 3 з 9 сторінок групи «Сторінки з блоком ціни».',
      pages: HF_WRONG.map(p => [p, 'від $49/міс']), status: 'new', log: [] }]
  });
  Object.assign(VIEWS, { cmps: cmpView, groups: gpView, hotfix: hfView });
}

/* ---------- campaign orchestrator ---------- */
function cmpPackets(c, chs) {
  const P = (key, kind, title, res, deps, extra = {}) => ({ id: `${c.id}/${key}`, key, kind, title, res, deps: deps.map(d => `${c.id}/${d}`), status: 'plan', ...extra });
  const all = [
    P('L', 'landing', 'Лендінг запуску', `${c.slug}/launch`, [], { before: 'Сторінки ще немає', after: 'Лендінг: H1, визначення, CTA «Переглянути демо», FAQ' }),
    P('A', 'articles', '3 статті в блог', `/blog/${c.slugShort}-*`, ['L'], { o2Return: true, before: 'Статей немає', after: '3 статті: гайд, кейс, порівняння' }),
    P('AD', 'ads', '2 оголошення і бюджет', `ppc:${c.title}`, ['L'], { amount: c.budget, before: 'Кампанії немає', after: `Google Ads, $${c.budget.toLocaleString('uk')} на 4 тижні` }),
    P('U', 'update', 'Банер кампанії на наявній сторінці', c.updatePage, ['L'], { before: 'Наявна сторінка без банера', after: 'Банер «Новинка» з посиланням на лендинг' }),
    P('E', 'emails', '4 листи клієнтам', 'email:segment-finance', ['L', 'A'], { before: 'Розсилки немає', after: '4 листи сегменту «фінанси»' }),
    P('P', 'posts', '6 постів LinkedIn і X', 'social:linkedin+x', ['A'], { before: 'Постів немає', after: '6 постів за розкладом' })
  ];
  if (!chs) return all;
  const want = new Set(['L']);
  if (chs.includes('Контент')) want.add('A');
  if (chs.includes('PPC')) want.add('AD');
  if (chs.includes('SEO')) want.add('U');
  if (chs.includes('Email')) want.add('E');
  if (chs.includes('SMM')) { want.add('P'); want.add('A'); }
  if (want.has('E')) want.add('A');
  return all.filter(p => want.has(p.key));
}
function cmpDecompose(c) {
  if (!c || c.packets.length) return;
  c.slug = c.slug || '/smart-reports'; c.slugShort = c.slugShort || 'smart-reports'; c.updatePage = c.updatePage || '/smart-reports';
  c.packets = cmpPackets(c, c.chs);
  c.status = 'decomposed';
  ev('o', 'Оркестратор кампаній', `${c.id}: бриф розкладено на ${c.packets.length} пакетів за типом ресурсу; залежності побудовано`);
  c.packets.forEach(k => ev('', 'Оркестратор кампаній', `${k.id}: ${CK[k.kind].label} → ${k.res}${k.deps.length ? '; чекає ' + k.deps.join(', ') : ''}`));
  slack(`<b>${esc(c.id)} ${esc(c.title)}</b>: розкладено на ${c.packets.length} пакетів. Кожен іде своїм контуром: сторінки — через Координатора, листи — з тестовою розсилкою, реклама — R3.`, [{ label: 'Відкрити кампанію', action: 'nav-to', screen: 'cmps', primary: true }]);
  render();
}
function cmpLp(c, k) {
  const url = k ? k.res : (c.slug || (c.id === 'CMP-482' ? '/smart-reports' : '/lp/' + c.id.slice(4))) + '/launch';
  return { key: 'cmp:' + c.id, url, before: [], after: lpLaunch(c), isNew: 1, label: 'нова сторінка · ' + (k ? CK_ST[k.status]?.[0] || k.status : 'ще не розкладено'),
    note: 'Сторінки ще немає, усі блоки нові. Нова адреса не має контролю для A/B, тому запуск м’який: noindex 7 днів і моніторинг. Лист, реклама і пости чекають, поки Editor затвердить лендинг.' };
}
function cmpLpHTML(c, i) {
  const k = c.packets.find(x => x.kind === 'landing');
  return `<details class="lp-dt"${i === 0 ? ' open data-tour="cmp-lp"' : ''}><summary>Прев’ю лендингу ${esc(k ? k.res : '')}</summary>${lpView(cmpLp(c, k))}</details>`;
}
function cmpLpFor(a) {
  const [c, k] = cmpFind(a.ck);
  return c && k && k.kind === 'landing' ? lpView({ ...cmpLp(c, k), key: 'ap:' + a.id, label: 'нова сторінка · на затвердженні' }) : '';
}
function cmpFind(pid) { for (const c of S.cmps) { const k = c.packets.find(x => x.id === pid); if (k) return [c, k]; } return [null, null]; }
function cmpRun(c) {
  if (!c) return;
  if (!c.packets.length) cmpDecompose(c);
  if (c.status === 'running' || c.status === 'done') return;
  c.status = 'running';
  ev('o', 'Оркестратор кампаній', `${c.id}: запуск хвилями за залежностями`);
  cmpTick(c);
}
function cmpTick(c) {
  if (c.status !== 'running') return;
  for (const k of c.packets) {
    if (!['plan', 'wait'].includes(k.status)) continue;
    const ready = k.deps.every(d => c.packets.find(x => x.id === d)?.status === 'done');
    if (ready) cmpPacket(c, k); else k.status = 'wait';
  }
  if (c.packets.every(k => k.status === 'done')) {
    c.status = 'done';
    ev('ok', 'Оркестратор кампаній', `${c.id}: усі пакети виконано`);
    slack(`<b>${esc(c.id)}</b> завершено: ${c.packets.length} пакетів пройшли свої ворота.`);
  }
  render();
}
async function cmpPacket(c, k) {
  const K = CK[k.kind];
  if (k.kind === 'update') return cmpDelegate(c, k);
  if (!takePage(k.res, { id: k.id }, 'cmp')) { k.status = 'queued'; k.note = `ресурс утримує ${holderOf(k.res)?.id}`; ev('warn', 'Оркестратор кампаній', `${k.id}: ${k.res} зайнятий, у черзі`); render(); return; }
  k.status = 'work'; render();
  ev('', K.who, `${k.id}: ${k.title} — чернетка готова`); await wait(700);
  k.status = 'review'; render();
  for (const r of K.review) { await wait(280); ev('ok', (typeof XRC !== 'undefined' && XRC[r]?.[0]) || r, `${k.id}: погоджено (${r})`); }
  k.status = 'verify'; render(); await wait(450);
  if (k.o2Return && !k.o2Fixed) {
    k.o2Fixed = true; k.status = 'return'; k.note = 'O2: немає джерела для «−30% часу закриття місяця»';
    ev('warn', 'O2 Verifier', `${k.id}: ${k.note}; повернуто автору`); render(); await wait(900);
    ev('', K.who, `${k.id}: додано джерело — опитування 120 клієнтів, Q3`); k.note = ''; k.status = 'verify'; render(); await wait(450);
  }
  ev('o', 'O2 Verifier', `${k.id}: факти й посилання перевірено`);
  ev('o', 'O3 Auditor', `${k.id}: бренд і політики${k.kind === 'ads' ? ', тижневий бюджет' : ''} — ок`);
  if (K.human) {
    k.status = 'human';
    const a = { id: 'AP-' + (++S.seq), cmp: c.id, ck: k.id, risk: K.risk, amount: k.amount || 0, ch: K.ch, title: `${c.id}: ${k.title}`, before: k.before, after: k.after, xr: K.review, o2: 'Факти й посилання перевірено', o3: K.risk === 'R3' ? 'Ліміт і тижневий бюджет перевірено' : 'Бренд і політики — ок', status: 'pending', age: 0,
      onApprove: () => cmpAfterHuman(k.id), onReject: st => cmpRejected(k.id, st) };
    S.approvals.push(a); k.ap = a.id;
    slack(`Потрібен апрув (${K.risk}): <b>${esc(a.title)}</b>. Затверджує: ${K.approver}.`, [{ label: 'Затвердити', action: 'approve-slack', id: a.id, primary: true }], K.ch === 'PPC' ? 'ppc' : 'mkt-orchestra');
    render(); return;
  }
  await cmpLaunch(k.id);
}
function cmpAfterHuman(pid) { const [c, k] = cmpFind(pid); if (k && k.status === 'human') { k.status = 'launch'; cmpLaunch(pid); } }
function cmpRejected(pid, st) {
  const [c, k] = cmpFind(pid); if (!k) return;
  releasePage(k.res, k.id, st);
  if (st === 'returned') { k.status = 'plan'; k.note = 'повернуто людиною'; cmpTick(c); }
  else { k.status = 'rejected'; k.note = 'відхилено людиною; залежні пакети зупинено'; render(); }
}
async function cmpLaunch(pid) {
  const [c, k] = cmpFind(pid); if (!k) return;
  if (!gwAllowed(k.id, () => cmpLaunch(pid))) { k.status = 'blocked'; render(); return; }
  k.status = 'launch'; render(); await wait(600);
  ev('ok', 'Gateway', `${k.id}: ${CK[k.kind].launch}; read-back ✓`);
  k.status = 'done'; releasePage(k.res, k.id, 'done');
  cmpTick(c);
}
function cmpDelegate(c, k) {
  const id = 'REC-' + k.id.replace('/', '-');
  let r = S.recs.find(x => x.id === id);
  if (!r) {
    r = { id, page: k.res, pod: 'SEO', agent: 'Content Optimizer', cmp: k.id, imp: 'low', impWhy: 'банер без зміни H1, визначення і CTA', conf: 86,
      title: `${c.id}: банер кампанії на ${k.res}`, why: 'Пакет кампанії змінює наявну сторінку, тому йде через Координатора сторінки і тест-гейт.',
      before: k.before, after: k.after, patch: { details: 'Новинка: ' + c.title + ' — дивіться лендинг запуску.' },
      rv: { SEO: ['ok', 'H1 і ключі не змінено'], PPC: ['ok', 'CTA сторінки збережено'], 'AI Visibility': ['ok', 'визначення збережено'] },
      tests: [['A/B тест', 2.1, 'клік на банер і демо'], ['SEO-тест', 0.4, 'кліки до контролю'], ['AI Visibility тест', 0, 'цитування, п.']], status: 'new' };
    S.recs.push(r);
  }
  k.status = 'delegated'; k.rec = id;
  ev('o', 'Оркестратор кампаній', `${k.id}: наявна сторінка — передано Координатору сторінки як ${id}`);
  render(); reviewRec(r);
}
/* Runs on every render: delegated packets follow their recommendation. */
function cmpSync() {
  for (const c of S.cmps || []) for (const k of c.packets) {
    if (k.status !== 'delegated' && k.status !== 'queued') continue;
    if (!k.rec) continue;
    const r = S.recs.find(x => x.id === k.rec); if (!r) continue;
    if (r.status === 'deployed') { k.status = 'done'; setTimeout(() => cmpTick(c), 0); }
    else if (['rolledback', 'rejected', 'expired'].includes(r.status)) { k.status = 'failed'; k.note = `${r.id}: ${REC_ST[r.status][0]}`; }
    else if (r.status === 'queued') k.status = 'queued';
    else if (k.status === 'queued') k.status = 'delegated';
  }
}
function cmpResume(pid) { const [c, k] = cmpFind(pid); if (k && k.status === 'queued') { k.status = 'plan'; cmpTick(c); } }
function cmpFromBrief(d) {
  const c = { id: 'CMP-' + (++S.seq), title: d.title, epic: '—', budget: d.budget || 0, brief: `${d.chs.join(', ')}; ICP: ${d.icp}`, chs: d.chs, status: 'new', packets: [],
    slug: '/lp/' + S.seq, slugShort: 'lp-' + S.seq, updatePage: '/integrations' };
  S.cmps.unshift(c);
  ev('h', ROLES[S.role].name, `створив бриф «${d.title}»`);
  cmpDecompose(c);
  return c;
}
function cmpDepth(c) {
  const memo = {};
  const d = k => memo[k.id] ?? (memo[k.id] = k.deps.length ? 1 + Math.max(...k.deps.map(x => d(c.packets.find(p => p.id === x)))) : 0);
  c.packets.forEach(d); return memo;
}
function cmpDag(c) {
  if (!c.packets.length) return '';
  const depth = cmpDepth(c), cols = {};
  c.packets.forEach(k => (cols[depth[k.id]] = cols[depth[k.id]] || []).push(k));
  const W = 210, H = 66, GX = 270, GY = 84, pos = {};
  Object.entries(cols).forEach(([d, list]) => list.forEach((k, i) => pos[k.id] = { x: 16 + d * GX, y: 16 + i * GY }));
  const w = 16 + (Object.keys(cols).length - 1) * GX + W + 16, h = 16 + Math.max(...Object.values(cols).map(l => l.length)) * GY;
  const fill = { done: ['#DDF1EA', '#1E8A6E'], human: ['#F4EAD1', '#B8891A'], return: ['#FBEBD2', '#B86E00'], queued: ['#FBEBD2', '#B86E00'], rejected: ['#F8DEDA', '#B9382A'], failed: ['#F8DEDA', '#B9382A'], blocked: ['#F8DEDA', '#B9382A'] };
  const act = ['work', 'review', 'verify', 'launch', 'delegated'];
  let edges = '', nodes = '';
  c.packets.forEach(k => k.deps.forEach(dp => {
    const a = pos[dp], b = pos[k.id]; const x1 = a.x + W, y1 = a.y + H / 2, x2 = b.x, y2 = b.y + H / 2, mx = (x1 + x2) / 2;
    edges += `<path d="M${x1} ${y1} L${mx} ${y1} L${mx} ${y2} L${x2 - 2} ${y2}" fill="none" stroke="#8A93A8" stroke-width="1.5" marker-end="url(#cmp-a)"/>`;
  }));
  c.packets.forEach(k => {
    const p = pos[k.id], st = CK_ST[k.status] || ['', ''];
    const [f, s] = fill[k.status] || (act.includes(k.status) ? ['#E2E5F7', '#3442A8'] : ['#FFFFFF', '#C3CAD8']);
    nodes += `<g><rect x="${p.x}" y="${p.y}" width="${W}" height="${H}" rx="9" fill="${f}" stroke="${s}" stroke-width="1.6" ${k.status === 'queued' || k.status === 'delegated' ? 'stroke-dasharray="5 4"' : ''}/>
      <text x="${p.x + 12}" y="${p.y + 20}" font-size="12.5" font-weight="600" fill="#182033">${esc(k.key)} · ${esc(CK[k.kind].label)}</text>
      <text x="${p.x + 12}" y="${p.y + 38}" font-size="11.5" fill="#55607A">${esc(k.res.length > 30 ? k.res.slice(0, 29) + '…' : k.res)}</text>
      <text x="${p.x + 12}" y="${p.y + 56}" font-size="11.5" font-weight="600" fill="${s}">${esc(st[0])}</text></g>`;
  });
  return `<div class="dag"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Граф пакетів кампанії"><defs><marker id="cmp-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#8A93A8"/></marker></defs>${edges}${nodes}</svg></div>`;
}
function cmpView() {
  const can = ROLES[S.role].r2 || S.role === 'pm';
  return `${intro(`<b>Оркестратор кампаній.</b> Кампанія — це не один пакет. Оркестратор кампаній розкладає бриф на окремі пакети за типом ресурсу: нова сторінка, статті, реклама, листи, пости, зміна наявної сторінки. Кожен пакет блокує лише свій ресурс і йде своїм контуром перевірок. Залежності задають порядок: листи й реклама не вийдуть, поки не готовий лендинг.`)}
    ${flow('Як кампанія стає роботою', '', [
      ['Бриф', 'Мета, ICP, канали, бюджет, дедлайн'],
      ['Декомпозиція', 'Оркестратор кампаній: пакети за типом ресурсу'],
      ['Граф залежностей', 'Що чекає на що: лендинг → статті, реклама, листи'],
      ['Свій контур на пакет', 'Сторінка — Координатор; лист — тестова розсилка; реклама — R3'],
      ['Хвилі запуску', 'Пакет стартує, щойно готові його залежності'],
      ['Звіт кампанії', 'Статус кожного пакета і хто його затвердив']
    ])}
    ${S.cmps.map((c, i) => `<div class="panel sec-gap"${i === 0 ? ' data-tour="cmp-dag"' : ''}><h2>${esc(c.id)} · ${esc(c.title)} <span class="chip">${esc(c.epic)}</span><span class="chip ${c.status === 'done' ? 'ok' : c.status === 'running' ? 'act' : ''}">${{ new: 'бриф', decomposed: 'розкладено', running: 'в роботі', done: 'завершено' }[c.status]}</span>
      <span class="sp">${!c.packets.length ? `<button class="btn small" data-action="cmp-decompose" data-id="${c.id}">Розкласти на пакети</button>` : ''}${c.status !== 'running' && c.status !== 'done' ? `<button class="btn small primary" data-action="cmp-run" data-id="${c.id}" ${can ? '' : 'disabled'}>Запустити кампанію</button>` : ''}</span></h2>
      <p class="small muted" style="margin:-4px 0 8px">${esc(c.brief)}${c.budget ? ` · бюджет $${c.budget.toLocaleString('uk')}` : ''}</p>
      ${c.packets.length ? cmpDag(c) + `<div class="tbl-wrap"><table><thead><tr><th>Пакет</th><th>Ресурс</th><th>Робить</th><th>Погоджують</th><th>Затверджує</th><th>Як виходить у світ</th><th>Статус</th></tr></thead><tbody>
        ${c.packets.map(k => { const K = CK[k.kind], st = CK_ST[k.status]; return `<tr><td><b>${esc(k.key)} · ${esc(k.title)}</b><br><span class="small muted">${k.deps.length ? 'після ' + esc(k.deps.map(d => d.split('/')[1]).join(', ')) : 'старт'}</span></td><td class="small">${esc(k.res)}</td><td class="small">${esc(K.who)}</td><td class="small">${esc(K.review.join(', '))} → O2, O3</td><td class="small">${esc(K.approver)}</td><td class="small">${esc(K.gate)}</td><td><span class="chip ${st[1]}">${st[0]}</span>${k.note ? `<br><span class="small muted">${esc(k.note)}</span>` : ''}${k.rec ? `<br><button class="btn small" data-action="open-rec" data-id="${k.rec}">${k.rec}</button>` : ''}</td></tr>`; }).join('')}
      </tbody></table></div>` : '<p class="empty">Натисніть «Розкласти на пакети», щоб побачити граф.</p>'}${cmpLpHTML(c, i)}</div>`).join('')}
    <div class="grid g2 sec-gap">
      ${rights('Чому пакети йдуть різними контурами', [
        ['R2', 'Наявна сторінка', 'Координатор сторінки → тест-гейт (A/B, SEO, AI Visibility)'],
        ['R2', 'Нова сторінка', 'контролю для A/B немає: м’який запуск, моніторинг, потім індексація'],
        ['R2', 'Група сторінок', 'одне правило → тест половина/половина → хвилі 10/50/100%'],
        ['R2', 'Лист', 'незворотно: тестова розсилка, відписки, завжди людина'],
        ['R2', 'Пост', 'прев’ю, дозволені акаунти, Editor'],
        ['R3', 'Реклама і бюджет', 'ліміт ролі сукупно за тиждень, O3 — тижневий бюджет']
      ], 'Тип ресурсу визначає ворота. Оркестратор кампаній не затверджує нічого сам: лише розкладає і стежить за порядком.')}
      ${rights('Хто за що відповідає в кампанії', [
        ['O1', 'Розуміє мету і бриф', 'Planner'],
        ['Кампанія', 'Розкладає на пакети, будує залежності, стежить за хвилями', 'Оркестратор кампаній'],
        ['Сторінка', 'Цілісність наявної сторінки, черга, компроміс', 'Координатор сторінки'],
        ['Канали', 'Вимоги SEO, PPC, AI Visibility', 'канальні оркестратори'],
        ['Докази', 'Факти, джерела, розрахунки', 'O2'],
        ['Політики', 'Бренд, бюджет, вето', 'O3'],
        ['Рішення', 'Публікація, гроші, незворотні дії', 'люди за роллю']
      ])}
    </div>`;
}

/* ---------- page groups ---------- */
function gpMembers(g) { return GROUPS[g.group].members; }
function gpEligible(g) { const ex = g.exceptions.map(e => e[0]); return gpMembers(g).filter(m => !ex.includes(m)); }
async function gpReview(g) {
  if (!g || !['new', 'queued'].includes(g.status)) return;
  const key = 'group:' + g.group;
  if (!takePage(key, g, 'group')) {
    g.status = 'queued';
    const h = resKeys(key).map(holderOf).find(a => a && a.id !== g.id);
    g.reason = `Групу або її сторінку утримує ${h?.id}. Пакет чекає; після звільнення перебудується від актуальних версій.`;
    ev('warn', 'Координатор групи', `${g.id}: ${GROUPS[g.group].name} зайнята (${h?.id}), у черзі`); render(); return;
  }
  const n = gpMembers(g).length, ex = g.exceptions.length;
  g.status = 'review'; g.rvState = {}; g.version = (g.version || 0) + 1; g.base = pageState(key).version; g.lint = null; g.reason = ''; render();
  ev('o', 'Координатор групи', `${g.id} v${g.version}: правило для ${n} сторінок «${GROUPS[g.group].name}»; група заблокована атомарно`);
  for (const c of CHANNEL_OWNERS) { await wait(380); const v = g.rv[c] || ['ok', 'погоджено']; g.rvState[c] = v[0]; ev(v[0] === 'ok' ? 'ok' : 'warn', `${c}-оркестратор`, `${g.id}: ${v[1]}`); render(); }
  await wait(350);
  g.lint = { total: n, ok: n - ex, ex };
  ev('o', 'O2 Verifier', `${g.id}: відрендерено всі ${n} сторінок; ${n - ex} пройшли перевірки, ${ex} → окрема черга`);
  ev('o', 'O3 Auditor', `${g.id}: змінюється лише поле шаблону «${g.field}»; інші блоки заборонені`);
  const obj = CHANNEL_OWNERS.filter(c => g.rvState[c] !== 'ok');
  if (obj.length) { g.status = 'human'; g.reason = `Конфлікт: ${obj.join(', ')} проти. Потрібен компроміс або рішення людини.`; }
  else if (g.imp === 'high' || g.conf < 70) { g.status = 'human'; g.reason = `Канали погодили правило й вибірку. Високий вплив: ${n} сторінок, ${GROUPS[g.group].share}. Людина дозволяє тест.`; slack(`<b>${g.id}</b>: груповий пакет на ${n} сторінок чекає дозволу на тест.`, [{ label: 'Відкрити', action: 'nav-to', screen: 'groups', primary: true }], g.pod === 'PPC' ? 'ppc' : 'seo'); }
  else { g.status = 'auto'; g.reason = `Низький вплив, ${chAgreed()} правило, O2 перевірив усі ${n} сторінок. Авто-дозвіл на тест.`; render(); await wait(300); gpStartTest(g); }
  render();
}
function gpApprove(g) {
  if (!g || g.status !== 'human') return;
  if (!ROLES[S.role].r2) { toast(`Роль ${ROLES[S.role].name} не дозволяє зміни сторінок.`); return; }
  if (CHANNEL_OWNERS.some(c => g.rvState?.[c] !== 'ok')) { toast('Спершу зніміть конфлікт каналів.'); return; }
  g.humanOk = ROLES[S.role].name;
  ev('h', ROLES[S.role].name, `дозволив тест групового пакета ${g.id}`);
  gpStartTest(g);
}
function gpStartTest(g) {
  if (!gwAllowed(`тест ${g.id}`, () => gpStartTest(g))) { g.reason = 'Дозвіл є, але записи вимкнено аварійним вимикачем.'; render(); return; }
  const el = gpEligible(g);
  g.testSet = el.filter((_, i) => i % 2 === 0); g.ctrlSet = el.filter((_, i) => i % 2 === 1);
  g.status = 'test'; g.week = 0;
  pageState('group:' + g.group).testContent = { [g.field]: g.rule };
  ev('o', 'Gateway (симуляція)', `${g.id}: правило застосовано до ${g.testSet.length} тестових сторінок; ${g.ctrlSet.length} — контроль; ${g.exceptions.length} — винятки без змін`);
  render();
}
function gpWeek(g) {
  if (!g || g.status !== 'test') return;
  g.week = Math.min(3, g.week + 1);
  ev('', 'Моніторинг групи', `${g.id}: тиждень ${g.week}; тест ${g.testSet.length} сторінок проти ${g.ctrlSet.length}`);
  if (g.week === 3) {
    const r = gateEvaluate(asGate(g.tests));
    if (r.verdict === 'harm') { gpRollback(g, `Шкода каналу: ${r.why}. Тестові сторінки відновлено.`); return; }
    if (r.verdict === 'inconclusive') { g.status = 'inconclusive'; g.reason = 'Немає достатнього покращення. Перемогу не оголошуємо; завершіть без розгортання.'; }
    else if (g.imp === 'low') { render(); gpRollout(g, false); return; }
    else { g.status = 'won'; g.reason = `Тест пройдено: ${r.why}. Розгортання хвилями чекає дозволу людини.`; }
  }
  render();
}
function gpRollback(g, why) {
  delete pageState('group:' + g.group).testContent;
  g.status = 'rolledback'; g.reason = why;
  ev('bad', 'Координатор групи', `${g.id}: відкат — ${why}`);
  slack(`<b>Відкат ${g.id}</b>: ${esc(why)}`, [], g.pod === 'PPC' ? 'ppc' : 'seo');
  releasePage('group:' + g.group, g.id, 'rolledback'); render();
}
async function gpRollout(g, human) {
  if (!g || !['won', 'test'].includes(g.status)) return;
  if (human && !ROLES[S.role].r2) { toast(`Роль ${ROLES[S.role].name} не дозволяє розгортання.`); return; }
  if (!gwAllowed(`хвилі ${g.id}`, () => gpRollout(g, human))) return;
  if (human) ev('h', ROLES[S.role].name, `дозволив розгортання ${g.id} хвилями`);
  g.status = 'rollout'; const el = gpEligible(g);
  for (let i = 0; i < 3; i++) {
    g.wave = i; render(); await wait(800);
    const v = g.canary[i], cnt = Math.ceil(el.length * WAVES[i] / 100);
    if (!Number.isFinite(v) || v < GATE.harm) {
      g.waveFail = i;
      gpRollback(g, `Guardrail на хвилі ${WAVES[i]}% (${cnt} сторінок): конверсія ${fmtGate('A/B', v)}. Усі хвилі відкочено, група повернулась до попередньої версії.`);
      return;
    }
    g.waveOk = i;
    ev('ok', 'Координатор групи', `${g.id}: хвиля ${WAVES[i]}% (${cnt} сторінок) — guardrail ок (${fmtGate('A/B', v)})`);
  }
  const key = 'group:' + g.group;
  commitResource(key, { ...pageState(key).content, [g.field]: g.rule }, { [g.field]: g.rule });
  g.status = 'deployed'; g.reason = `Розгорнуто на ${el.length} сторінок трьома хвилями; ${g.exceptions.length} винятки лишились без змін і пішли в окрему чергу.`;
  ev('ok', 'Gateway', `${g.id}: розгорнуто на ${el.length} сторінок; read-back ✓`);
  releasePage(key, g.id, 'deployed'); render();
}
function gpEnd(g) {
  if (!g || !['inconclusive', 'won'].includes(g.status) || !ROLES[S.role].r2) return;
  delete pageState('group:' + g.group).testContent;
  g.status = 'rolledback'; g.reason = 'Завершено без розгортання. Тестові сторінки відновлено.';
  ev('h', ROLES[S.role].name, `завершив ${g.id} без розгортання`);
  releasePage('group:' + g.group, g.id, 'declined'); render();
}
function gpReject(g) {
  if (!g || g.status !== 'human' || !ROLES[S.role].r2) return;
  g.status = 'rejected'; g.reason = 'Людина відхилила груповий пакет. Сторінки не змінені.';
  ev('h', ROLES[S.role].name, `відхилив ${g.id}`);
  releasePage('group:' + g.group, g.id, 'rejected'); render();
}
function gpExpire() {
  let n = 0;
  for (const g of S.gps) {
    const key = 'group:' + g.group;
    if (!['human', 'won', 'inconclusive'].includes(g.status) || pageState(key).active?.id !== g.id || lockAge(key) < GATE.lockTtlH) continue;
    delete pageState(key).testContent; g.status = 'expired';
    g.reason = `Рішення не прийнято за ${GATE.lockTtlH} год. Групу звільнено; пакет можна подати знову.`;
    ev('warn', 'Координатор групи', `${g.id}: прострочено, ${GROUPS[g.group].name} звільнено`);
    releasePage(key, g.id, 'expired'); n++;
  }
  return n;
}
function gpResume(id) { const g = S.gps.find(x => x.id === id); if (g && g.status === 'queued') { g.status = 'new'; ev('o', 'Координатор групи', `${g.id}: групу звільнено, перебудовую від актуальних версій`); gpReview(g); } }
function commitResource(path, after, patch) {
  const page = pageState(path); page.content = { ...after }; page.version++; delete page.testContent;
  if (String(path).startsWith('group:')) GROUPS[path.slice(6)].members.forEach(m => { const mp = pageState(m); mp.content = { ...mp.content, ...patch }; mp.version++; });
  return page.version;
}
function gpGrid(g) {
  const ex = g.exceptions.map(e => e[0]), el = gpEligible(g);
  const rolled = g.status === 'deployed' ? el.length : g.status === 'rollout' ? Math.ceil(el.length * WAVES[g.wave || 0] / 100) : 0;
  return `<div class="mgrid" aria-label="Сторінки групи">${gpMembers(g).map(m => {
    let c = '';
    if (ex.includes(m)) c = 'x';
    else if (g.status === 'rolledback' && (g.testSet || []).includes(m)) c = 'b';
    else if (['rollout', 'deployed'].includes(g.status)) c = el.indexOf(m) < rolled ? 'r' : '';
    else if (['test', 'won', 'inconclusive'].includes(g.status)) c = (g.testSet || []).includes(m) ? 't' : 'c';
    return `<i class="${c}" title="${esc(m)}"></i>`; }).join('')}</div>
    <div class="legend"><span><i class="mg t"></i>тестова група</span><span><i class="mg c"></i>контроль</span><span><i class="mg x"></i>виняток</span><span><i class="mg r"></i>розгорнуто</span><span><i class="mg b"></i>відкочено</span></div>`;
}
function gpCard(g) {
  const st = GP_ST[g.status], can = ROLES[S.role].r2, grp = GROUPS[g.group];
  const showT = ['test', 'won', 'rollout', 'deployed', 'rolledback', 'inconclusive'].includes(g.status) && g.week !== undefined;
  return `<div class="ap rec" id="gp-${g.id}">
    <div class="t">${g.id} · ${esc(g.title)} <span class="chip ${g.imp === 'high' ? 'warn' : ''}">${g.imp === 'high' ? 'високий вплив' : 'низький вплив'}</span><span class="chip ${st[1]}">${st[0]}</span></div>
    <div class="small muted">${esc(grp.name)} · ${grp.pattern} · ${grp.members.length} сторінок · ${grp.share} · пропонує ${esc(g.agent)} (${esc(g.pod)})</div>
    <p class="small">${esc(g.why)}</p>
    <code class="rule-code">${esc(g.rule)}</code>
    <div class="tbl-wrap"><table><thead><tr><th>Вибірка для людини</th><th>Зараз</th><th>Після правила</th></tr></thead><tbody>${g.sample.map(x => `<tr><td class="small">${esc(x[0])}</td><td class="small muted">${esc(x[1])}</td><td class="small">${esc(x[2])}</td></tr>`).join('')}</tbody></table></div>
    <p class="small"><b>Винятки</b> (не змінюються правилом, ідуть в окрему чергу): ${g.exceptions.map(e => `${esc(e[0])} — ${esc(e[1])}`).join('; ')}</p>
    <div class="rv">${CHANNEL_OWNERS.map(c => { const v = g.rvState?.[c]; return `<span class="chip ${v === 'ok' ? 'ok' : v === 'no' ? 'bad' : ''}">${v === 'ok' ? '✓' : v === 'no' ? '✗' : '…'} ${c}</span>`; }).join('')}${g.lint ? `<span class="chip ok">O2: ${g.lint.ok} з ${g.lint.total} сторінок</span><span class="chip warn">${g.lint.ex} винятки</span>` : ''}</div>
    ${gpGrid(g)}
    ${['rollout', 'deployed', 'rolledback'].includes(g.status) && g.wave !== undefined ? `<div class="waves">${WAVES.map((w, i) => `<div class="${g.waveFail === i ? 'bad' : (g.waveOk ?? -1) >= i ? 'ok' : g.status === 'rollout' && g.wave === i ? 'on' : ''}">хвиля ${w}%</div>`).join('')}</div>` : ''}
    ${showT ? `<div class="tbl-wrap"><table><thead><tr><th>Тест групи · ${g.week}/3 тижні</th><th>Метрика</th><th>Тест проти контролю</th></tr></thead><tbody>${g.tests.map(t => `<tr><td>${esc(t[0])}</td><td class="small muted">${esc(t[2])}</td><td>${fmtGate(t[0], recVal(t, g.week || 0))}</td></tr>`).join('')}</tbody></table></div>` : ''}
    ${g.reason ? `<div class="reason ${g.status === 'deployed' ? 'ok' : ''}">${esc(g.reason)}</div>` : ''}
    <div class="acts sec-gap">
      ${g.status === 'new' ? `<button class="btn small primary" data-action="gp-review" data-id="${g.id}">Узгодити правило для групи</button>` : ''}
      ${g.status === 'human' ? `<button class="btn small primary" data-action="gp-approve" data-id="${g.id}" ${can ? '' : 'disabled'}>Дозволити тест половина/половина</button><button class="btn small danger" data-action="gp-reject" data-id="${g.id}" ${can ? '' : 'disabled'}>Відхилити</button>` : ''}
      ${g.status === 'test' ? `<button class="btn small" data-action="gp-week" data-id="${g.id}">Наступний тиждень</button>` : ''}
      ${g.status === 'won' ? `<button class="btn small primary" data-action="gp-rollout" data-id="${g.id}" ${can ? '' : 'disabled'}>Розгорнути хвилями 10/50/100%</button>` : ''}
      ${['won', 'inconclusive'].includes(g.status) ? `<button class="btn small" data-action="gp-end" data-id="${g.id}" ${can ? '' : 'disabled'}>Завершити без розгортання</button>` : ''}
      ${g.status === 'expired' ? `<button class="btn small primary" data-action="gp-resubmit" data-id="${g.id}">Подати знову</button>` : ''}
    </div></div>`;
}
function gpView() {
  const pls = S.pipelines.filter(p => String(p.page || '').startsWith('group:'));
  return `${intro(`<b>Групи сторінок.</b> Якщо одна ідея або одна помилка повторюється на багатьох сторінках одного шаблону, агент не ходить по кожній сторінці окремо. Він пише одне правило для групи. Канали погоджують правило і вибірку, O2 рендерить і перевіряє всі сторінки, тест іде половина на половину, а розгортання — хвилями 10/50/100% із guardrail між хвилями. Сторінки, де правило не підходить, стають винятками й ідуть окремою чергою.`)}
    ${flow('Як працює груповий пакет', '', [
      ['Правило', 'Одна зміна поля шаблону для всієї групи'],
      ['Погодження', 'SEO, PPC, AI Visibility — на правило і 3 сторінки-вибірки'],
      ['O2 на всі сторінки', 'Рендер кожної сторінки: довжина, дублі, ключі, факти'],
      ['Винятки', 'Де правило не підходить — без змін, окрема черга'],
      ['Тест 50/50', 'Половина групи — тест, половина — контроль'],
      ['Хвилі', '10% → 50% → 100%; guardrail зупиняє й відкочує']
    ])}
    <div class="panel sec-gap"><h2>Групи ${hint('Група — сторінки одного шаблону або з однаковим блоком. Одна сторінка може належати кільком групам; блокування перевіряє кожну сторінку.')}</h2>
      <div class="tbl-wrap"><table><thead><tr><th>Група</th><th>Шаблон</th><th>Сторінок</th><th>Частка трафіку</th><th>Утримує</th><th>Черга</th></tr></thead><tbody>
      ${S.groups.map(g => { const p = pageState('group:' + g.id); return `<tr><td><b>${esc(g.name)}</b><br><span class="small muted">${esc(g.pattern)}</span></td><td class="small">${esc(g.template)}</td><td>${g.members.length}</td><td class="small">${esc(g.share)}</td><td class="small">${p.active ? esc(p.active.id) : 'вільна'}</td><td class="small">${p.queue.map(x => esc(x.id)).join(', ') || '—'}</td></tr>`; }).join('')}
      </tbody></table></div>
      ${pls.length ? `<p class="small muted" style="margin-top:10px">Групові пакети з конвеєра: ${pls.map(p => `<b>${p.id}</b> «${esc(p.title)}» — ${esc(p.note)}`).join('; ')}</p>` : ''}</div>
    <div class="grid g2 sec-gap">
      ${rights('Одна сторінка чи група', [
        ['1', 'Унікальна сторінка, своя ідея', 'пакет сторінки через Координатора'],
        ['3+', 'Одна ідея або помилка на сторінках одного шаблону', 'груповий пакет: правило + вибірка'],
        ['Факт', 'Неправильна ціна, дата, назва з реєстру', 'швидка смуга, теж може бути груповою'],
        ['Виняток', 'Правило не підходить сторінці', 'без змін, окремий пакет у черзі']
      ], 'Координатор групи вирішує масштаб: якщо правило підходить трьом і більше сторінкам одного шаблону, окремі пакети об’єднуються в один груповий.')}
      ${examples('gp-ex', [
        ['gp-all', 'R2', 'Узгодити всі групові пакети', 'GP-2 пройде повністю, GP-3 зупиниться на хвилі 50%, GP-1 стане в чергу за MKT-477.'],
        ['gp-fast', 'R2', 'Прогнати тести груп до кінця', 'Перемотує 3 тижні тестів для груп у тесті.']
      ])}
    </div>
    <div class="panel sec-gap" data-tour="gp-list"><h2>Групові пакети</h2>${S.gps.map(gpCard).join('')}</div>`;
}

/* ---------- hotfix lane ---------- */
function hfStep(h, label, who, state = 'done') {
  const t0 = 6 * 60 + 12 + h.log.length * 3;
  h.log.push({ t: `${String(Math.floor(t0 / 60)).padStart(2, '0')}:${String(t0 % 60).padStart(2, '0')}`, label, who, state });
}
function hfHolders(h) {
  const out = [];
  h.pages.forEach(([path]) => resKeys(path).forEach(k => { const a = holderOf(k); if (a && !out.some(x => x.id === a.id)) out.push({ ...a, path }); }));
  Object.values(GROUPS).filter(g => g.members.some(m => h.pages.some(p => p[0] === m))).forEach(g => { const a = holderOf('group:' + g.id); if (a && !out.some(x => x.id === a.id)) out.push({ ...a, path: 'group:' + g.id }); });
  return out;
}
async function hfRun(h) {
  if (!h || h.status !== 'new') return;
  h.status = 'running'; h.log = []; render();
  hfStep(h, 'Виявлено', 'Citation Analyst + сканер сторінок'); ev('warn', 'Citation Analyst', `${h.id}: ${h.found}`); render(); await wait(500);
  const f = S.facts.find(x => x[0] === h.fact);
  hfStep(h, `Реєстр фактів: ${f[1]}`, 'O2 Verifier'); ev('o', 'O2 Verifier', `${h.id}: значення збігається з реєстром (${f[2]}, власник ${f[3]})`); render(); await wait(500);
  hfStep(h, `Мінімальний diff: ${h.pages.length} сторінки × поле «${h.field}»`, 'O3 Auditor'); ev('o', 'O3 Auditor', `${h.id}: лише поле з реєстру; інші зміни заборонені`); render(); await wait(500);
  const holders = hfHolders(h); h.holders = holders.map(x => x.id);
  holders.forEach(x => { const r = S.recs.find(y => y.id === x.id); if (r && r.status === 'test') r.hotfixHold = true; });
  hfStep(h, holders.length ? `Пріоритет над чергою: призупинено ${holders.map(x => x.id).join(', ')}` : 'Пріоритет над чергою: активних пакетів немає', 'Координатор сторінки');
  ev('o', 'Координатор сторінки', holders.length ? `${h.id}: має пріоритет; ${holders.map(x => x.id).join(', ')} на паузі, їхні тести не рахуються під час виправлення` : `${h.id}: сторінки вільні, пауза не потрібна`); render(); await wait(500);
  CHANNEL_OWNERS.forEach(c => ev('ok', `${c}-оркестратор`, `${h.id}: швидке погодження — значення з реєстру`));
  hfStep(h, 'Канали погодили за хвилини', 'SEO, PPC, AI Visibility'); render(); await wait(400);
  h.status = 'human'; hfStep(h, 'Чекає Owner або Marketing lead (SLA 1 год)', 'людина', 'on');
  slack(`<b>Швидке виправлення ${h.id}</b>: ${esc(h.title)} на ${h.pages.length} сторінках. Потрібне одне рішення Owner або Marketing lead.`, [{ label: 'Застосувати виправлення', action: 'hf-approve', id: h.id, primary: true }]);
  render();
}
async function hfApprove(h) {
  if (!h || h.status !== 'human') return;
  if (!['owner', 'lead'].includes(S.role)) { toast('Швидке виправлення затверджує Owner або Marketing lead.'); return; }
  if (!gwAllowed(`виправлення ${h.id}`, () => hfApprove(h))) return;
  h.log[h.log.length - 1].state = 'done'; h.log[h.log.length - 1].label = `Затвердив ${ROLES[S.role].name}`;
  ev('h', ROLES[S.role].name, `затвердив швидке виправлення ${h.id}`);
  h.status = 'applying'; render(); await wait(400);
  for (const [path] of h.pages) {
    const page = pageState(path); page.content = { ...page.content, [h.field]: h.value }; page.version++;
    if (page.testContent) page.testContent = { ...page.testContent, [h.field]: h.value };
  }
  hfStep(h, `Gateway: ${h.pages.length} сторінки, основна, тестова і контрольна версії; read-back ✓`, 'Gateway');
  ev('ok', 'Gateway', `${h.id}: ціну виправлено на ${h.pages.length} сторінках; read-back ✓`); render(); await wait(400);
  const rebased = [];
  for (const r of S.recs) {
    if (!r.packet || !h.pages.some(p => p[0] === r.page) || ['deployed', 'rolledback', 'rejected', 'expired'].includes(r.status)) continue;
    const p = r.packet, page = pageState(r.page);
    if (h.field in p.patch) { r.status = 'inconclusive'; r.reason = `${h.id} змінив те саме поле. Пакет потребує нових погоджень.`; continue; }
    p.baseVersion = page.version; p.before = { ...page.content }; p.after = { ...p.before, ...p.patch };
    p.signedFingerprint = packetFingerprint(r); if (p.testFingerprint) p.testFingerprint = packetFingerprint(r);
    if (page.testContent) page.testContent = { ...p.after };
    rebased.push(r.id);
  }
  hfStep(h, rebased.length ? `Авто-rebase ${rebased.join(', ')}: поля не перетинаються` : 'Rebase не потрібен', 'Координатор сторінки');
  if (rebased.length) ev('o', 'Координатор сторінки', `авто-rebase ${rebased.join(', ')} на нову версію: поле «${h.field}» не входить у їхні пакети`);
  h.status = 'monitor'; hfStep(h, 'Моніторинг 24 год: регресій немає', 'Моніторинг', 'on'); render(); await wait(900);
  h.log[h.log.length - 1].state = 'done';
  S.recs.filter(r => r.hotfixHold).forEach(r => { r.hotfixHold = false; if (r.status === 'test') { r.week = 0; r.reason = `Тест відновлено після ${h.id}; вікно даних перезапущено з нуля.`; } });
  hfStep(h, 'Тести відновлено, вікно перезапущено', 'Координатор сторінки');
  h.status = 'done';
  ev('ok', 'Координатор сторінки', `${h.id}: завершено за ${h.log.length * 3} хв; призупинені тести відновлено`);
  slack(`<b>${h.id}</b> завершено: ${esc(h.title)} виправлено за ${h.log.length * 3} хв. Тести відновлено з новим вікном даних.`);
  render();
}
function hfView() {
  const h = S.hotfixes[0];
  return `${intro(`<b>Швидка смуга.</b> Помилкова ціна, неправильна дата, зламане посилання на checkout або noindex на ключовій сторінці не можуть чекати тритижневого тесту в черзі. Швидка смуга бере лише значення з реєстру фактів, змінює мінімальне поле, має пріоритет над чергою і призупиняє тести на цих сторінках. Рішення — одне, за Owner або Marketing lead. Після виправлення тести відновлюються з новим вікном даних.`)}
    <div class="panel sec-gap" data-tour="hf-flow"><h2>${h.id} · ${esc(h.title)} <span class="chip ${h.status === 'done' ? 'ok' : h.status === 'human' ? 'warn' : h.status === 'new' ? '' : 'act'}">${{ new: 'виявлено', running: 'перевірки', human: 'чекає рішення', applying: 'застосування', monitor: 'моніторинг', done: 'завершено' }[h.status]}</span>
      <span class="sp">${h.status === 'new' ? `<button class="btn small primary" data-action="hf-run" data-id="${h.id}">Запустити швидку смугу</button>` : ''}${h.status === 'human' ? `<button class="btn small primary" data-action="hf-approve" data-id="${h.id}" ${['owner', 'lead'].includes(S.role) ? '' : 'disabled'}>Застосувати виправлення</button>` : ''}</span></h2>
      <p class="small muted">${esc(h.found)}</p>
      <ol class="hf-steps">${(h.log.length ? h.log : [{ t: '—', label: 'Виявлення', who: 'Citation Analyst', state: 'wait' }, { t: '—', label: 'Реєстр фактів', who: 'O2', state: 'wait' }, { t: '—', label: 'Мінімальний diff', who: 'O3', state: 'wait' }, { t: '—', label: 'Пріоритет над чергою', who: 'Координатор', state: 'wait' }, { t: '—', label: 'Одне рішення людини', who: 'Owner або Lead', state: 'wait' }, { t: '—', label: 'Gateway + read-back', who: 'Gateway', state: 'wait' }, { t: '—', label: 'Моніторинг і відновлення тестів', who: 'Координатор', state: 'wait' }]).map(s => `<li class="${s.state}"><time>${s.t}</time><b>${esc(s.label)}</b><span class="small muted">${esc(s.who)}</span></li>`).join('')}</ol>
      <div class="tbl-wrap"><table><thead><tr><th>Сторінка</th><th>Було</th><th>Стане</th><th>Хто утримує сторінку</th></tr></thead><tbody>${h.pages.map(([p, was]) => { const a = resKeys(p).map(holderOf).find(Boolean); return `<tr><td>${esc(p)}</td><td class="small down">${esc(was)}</td><td class="small">${esc(h.value)}</td><td class="small">${a ? esc(a.id) + (h.holders?.includes(a.id) ? ' · на паузі' : '') : 'вільна'}</td></tr>`; }).join('')}</tbody></table></div>
      <p class="small muted">Порада для показу: спершу запустіть тест REC-3 на /smart-reports у «Рекомендаціях», потім швидку смугу. Побачите паузу тесту, авто-rebase і перезапуск вікна даних.</p></div>
    <div class="grid g2 sec-gap">
      <div class="panel"><h2>Реєстр фактів ${hint('Єдине джерело для цін, дат, назв і цифр. Агент не може вигадати значення: швидка смуга бере його лише звідси.')}</h2>
        <div class="tbl-wrap"><table><thead><tr><th>Ключ</th><th>Значення</th><th>Джерело</th><th>Власник</th></tr></thead><tbody>${S.facts.map(f => `<tr><td class="small"><code>${esc(f[0])}</code></td><td>${esc(f[1])}</td><td class="small muted">${esc(f[2])}</td><td class="small">${esc(f[3])}</td></tr>`).join('')}</tbody></table></div></div>
      ${rights('Що можна через швидку смугу', [
        ['Так', 'Ціна, дата, назва, цифра з реєстру фактів', 'одне поле, мінімальний diff'],
        ['Так', 'Зламане посилання на checkout або форму', 'технічна перевірка + read-back'],
        ['Так', 'noindex або 5xx на ключовій сторінці', 'технічний сигнал, без статистики'],
        ['Ніколи', 'Нові формулювання, оффер, дизайн, позиціонування', 'звичайний контур і тест-гейт']
      ], 'Швидка смуга виправляє перевірену помилку, а не покращує сторінку. Усе, що не з реєстру, йде звичайним шляхом.')}
    </div>
    <div class="panel sec-gap"><h2>Історія швидких виправлень</h2><div class="tbl-wrap"><table><thead><tr><th>ID</th><th>Що</th><th>Час до виправлення</th><th>Хто затвердив</th></tr></thead><tbody>
      <tr><td>HF-0</td><td>noindex на /pricing після деплою CMS</td><td>22 хв</td><td>Owner</td></tr>
      ${h.status === 'done' ? `<tr><td>${h.id}</td><td>${esc(h.title)}</td><td>${h.log.length * 3} хв</td><td>${esc(h.log.find(x => x.label.startsWith('Затвердив'))?.label.replace('Затвердив ', '') || '—')}</td></tr>` : ''}
    </tbody></table></div></div>`;
}

/* ---------- kill switch ---------- */
function killPanelHTML() {
  const can = ['owner', 'lead'].includes(S.role);
  return `<div class="panel killbar ${S.writesOff ? 'off' : ''}" data-tour="kill" style="margin-bottom:16px"><div style="flex:1;min-width:240px"><b>Аварійний вимикач записів</b> ${hint('Пауза кронів лише не ставить нові задачі. Аварійний вимикач блокує будь-який запис у gateway: тести, розгортання, листи, рекламу, швидкі виправлення. Задачі, що вже йдуть, зупиняються перед записом і продовжуються після увімкнення.')}<div class="small muted">${S.writesOff ? `Записи вимкнено. Відкладено дій: ${S.killQueue.length}.` : 'Записи дозволені. Пауза розкладу нижче не зупиняє задачі, що вже йдуть.'}</div></div>
    <button class="switch" role="switch" aria-checked="${!S.writesOff}" aria-label="Записи дозволені" data-action="kill-toggle" ${can ? '' : 'aria-disabled="true"'}></button></div>`;
}
function killToggle() {
  if (!['owner', 'lead'].includes(S.role)) { toast('Аварійний вимикач — лише Owner або Marketing lead.'); return; }
  S.writesOff = !S.writesOff;
  ev(S.writesOff ? 'bad' : 'ok', ROLES[S.role].name, S.writesOff ? 'вимкнув усі записи (аварійний вимикач)' : 'увімкнув записи');
  slack(S.writesOff ? '<b>Аварійний вимикач:</b> усі записи зупинено. Планування і перевірки тривають.' : `Записи увімкнено. Відновлюю ${S.killQueue.length} відкладених дій.`);
  if (!S.writesOff) S.killQueue.splice(0).forEach(fn => setTimeout(fn, 0));
  render();
}

/* ---------- actions ---------- */
const SCALE_ACTIONS = {
  'cmp-decompose': id => cmpDecompose(S.cmps.find(c => c.id === id)),
  'cmp-run': id => { if (!(ROLES[S.role].r2 || S.role === 'pm')) { toast('Запустити кампанію може роль з правом публікацій або PM.'); return; } cmpRun(S.cmps.find(c => c.id === id)); },
  'gp-review': id => gpReview(S.gps.find(g => g.id === id)),
  'gp-approve': id => gpApprove(S.gps.find(g => g.id === id)),
  'gp-reject': id => gpReject(S.gps.find(g => g.id === id)),
  'gp-week': id => gpWeek(S.gps.find(g => g.id === id)),
  'gp-rollout': id => gpRollout(S.gps.find(g => g.id === id), true),
  'gp-end': id => gpEnd(S.gps.find(g => g.id === id)),
  'gp-resubmit': id => { const g = S.gps.find(x => x.id === id); if (g?.status === 'expired') { g.status = 'new'; gpReview(g); } },
  'gp-all': () => { const n = S.gps.filter(g => g.status === 'new'); if (!n.length) { toast('Нових групових пакетів немає.'); return; } n.forEach((g, i) => setTimeout(() => gpReview(g), i * 250)); },
  'gp-fast': () => { const t = S.gps.filter(g => g.status === 'test'); if (!t.length) { toast('Немає груп у тесті.'); return; } t.forEach(g => { while (g.status === 'test') gpWeek(g); }); },
  'hf-run': id => hfRun(S.hotfixes.find(h => h.id === id)),
  'hf-approve': id => hfApprove(S.hotfixes.find(h => h.id === id)),
  'clock-48': () => advanceClock(48),
  'kill-toggle': killToggle,
  'packet-override': id => pcOverride(S.recs.find(r => r.id === id)),
  'packet-resubmit': id => pcResubmit(S.recs.find(r => r.id === id))
};
