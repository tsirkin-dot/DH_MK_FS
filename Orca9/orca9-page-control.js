/* Prototype coordination only: no external systems or real model calls. */
const PAGE_CONTROL = new Map();
const CHANNEL_ALL = ['SEO', 'PPC', 'AI Visibility'];
/* Активні канальні оркестратори. Масив «живий»: у фазі 1 тут лише SEO, у повному плані — усі три.
   Уся логіка погоджень (пакети, групи, конвеєри, швидка смуга) ітерує саме його, тому не потребує окремих гілок. */
const CHANNEL_OWNERS = [...CHANNEL_ALL];
/* Реєстр напрямів. Новий напрям підключається одним записом: фаза, под агентів, канал погодження, тест у тест-гейті, екрани. */
const DIRS = {
  'SEO':             { phase: 1, pods: ['SEO'], channel: 'SEO', test: 'SEO-тест', screens: ['seo'], what: 'позиції, технічний стан, оптимізація сторінок' },
  'Контент':         { phase: 1, pods: ['Контент'], screens: [], what: 'статті, тексти лендингів, кейси' },
  'Координація':     { phase: 1, pods: ['Координація'], screens: [], what: 'Координатор сторінки, SEO-оркестратор, черга і блокування' },
  'PPC':             { phase: 2, pods: ['PPC'], channel: 'PPC', screens: ['ppc'], what: 'реклама, бюджети R3, message match' },
  'AI Visibility':   { phase: 2, pods: ['AI Visibility'], channel: 'AI Visibility', test: 'AI Visibility тест', screens: ['aiv'], what: 'цитування в AI-системах, наратив' },
  'Аналітика':       { phase: 2, pods: ['Аналітика'], screens: [], what: 'агенти аналітики; дашборди доступні з фази 1' },
  'Контроль якості': { phase: 2, pods: ['Контроль якості'], screens: ['agentqa'], what: 'еталонні кейси, дрейф, релізи агентів' },
  'Групи сторінок':  { phase: 2, pods: [], screens: ['groups'], what: 'одне правило на шаблон, хвилі 10/50/100%' },
  'Кампанії':        { phase: 3, pods: [], screens: ['cmps'], what: 'декомпозиція брифу на пакети' },
  'SMM':             { phase: 3, pods: ['SMM'], screens: [], what: 'органічні пости, спільнота' },
  'Email':           { phase: 3, pods: ['Email'], screens: [], what: 'розсилки, ланцюжки, доставлюваність' }
};
const PHASE = { mode: 'full', extra: [] };   // mode: 'p1' | 'full'; extra — напрями, підключені достроково
function dirOn(k) { const d = DIRS[k]; return !d || PHASE.mode === 'full' || d.phase === 1 || PHASE.extra.includes(k); }
const dirOfPod = pod => Object.keys(DIRS).find(k => DIRS[k].pods.includes(pod));
const dirOfScreen = sc => Object.keys(DIRS).find(k => DIRS[k].screens.includes(sc));
const dirOfCh = ch => ({ 'SEO': 'SEO', 'Контент': 'Контент', 'PPC': 'PPC', 'AI Visibility': 'AI Visibility', 'SMM': 'SMM', 'Email': 'Email', 'Аналітика': 'Аналітика', 'Кампанія': 'Кампанії' }[ch]);
function podOn(pod) { const k = dirOfPod(pod); return !k || dirOn(k); }
function screenOn(sc) { const k = dirOfScreen(sc); return !k || dirOn(k); }
function chOn(ch) { const k = dirOfCh(ch); return !k || dirOn(k); }
function testOn(name) { const k = Object.keys(DIRS).find(x => DIRS[x].test && String(name).startsWith(DIRS[x].test)); return !k || dirOn(k); }
function syncChannels() { CHANNEL_OWNERS.length = 0; CHANNEL_ALL.filter(c => dirOn(c)).forEach(c => CHANNEL_OWNERS.push(c)); }
const chAgreed = () => CHANNEL_OWNERS.length === 1 ? `${CHANNEL_OWNERS[0]}-оркестратор погодив` : `Канали ${CHANNEL_OWNERS.join(', ')} погодили`;
const chList = () => CHANNEL_OWNERS.length === 3 ? 'Три канали' : CHANNEL_OWNERS.length === 1 ? `${CHANNEL_OWNERS[0]}-оркестратор` : `Канали ${CHANNEL_OWNERS.join(' і ')}`;
/* Groups of pages (filled by orca9-scale.js), the single test evaluator, locks with TTL and the write kill switch. */
const GROUPS = {};
const HF_WRONG = ['/smart-reports', '/compare/baremetrics', '/blog/saas-pricing-guide'];
const GATE = { harm: -2, win: 2, overrideHarm: -1, lockTtlH: 48 };
function unitOf(name) { return /AI Visibility/i.test(name) ? ' п.' : '%'; }
function fmtGate(name, v) { return Number.isFinite(v) ? (v >= 0 ? '+' : '') + String(v).replace('.', ',') + unitOf(name) : 'немає даних'; }
/* Тести вимкнених напрямів (у фазі 1 — AI Visibility тест) не входять в оцінку. */
const asGate = arr => (arr || []).filter(t => testOn(t[0])).map(t => ({ name: t[0], value: typeof t[1] === 'number' ? t[1] : t[2] }));
/* One evaluator for pages, groups and pipelines: harm → rollback, no clear win or bad data → inconclusive, otherwise pass. */
function gateEvaluate(results, opts = {}) {
  const harmAt = opts.strict ? GATE.overrideHarm : GATE.harm;
  if (!Array.isArray(results) || !results.length || results.some(r => !r || !Number.isFinite(r.value))) return { verdict: 'inconclusive', why: 'неповні або нечислові результати' };
  const harm = results.filter(r => r.value < harmAt);
  if (harm.length) return { verdict: 'harm', why: harm.map(r => `${r.name} ${fmtGate(r.name, r.value)}`).join(', ') };
  if (!results.some(r => r.value >= GATE.win)) return { verdict: 'inconclusive', why: 'немає достатнього покращення' };
  return { verdict: 'pass', why: results.map(r => `${r.name} ${fmtGate(r.name, r.value)}`).join(' · ') };
}
function resKeys(path) { return String(path).startsWith('group:') ? [path, ...(GROUPS[path.slice(6)]?.members || [])] : [path]; }
function holderOf(path) { return pageState(path).active; }
function gwAllowed(label, resume) {
  if (!S.writesOff) return true;
  ev('bad', 'Gateway', `аварійний вимикач: заблоковано ${label}`);
  if (resume) S.killQueue.push(resume);
  toast('Записи вимкнено аварійним вимикачем. Дію виконаємо після увімкнення.');
  return false;
}
function pageState(path) {
  if (!PAGE_CONTROL.has(path)) PAGE_CONTROL.set(path, {
    path, version: 1, active: null, queue: [], history: [],
    content: {
      title: 'Acme · ' + path,
      h1: path === '/smart-reports' ? 'Financial reporting automation' : path === '/pricing-analytics' ? 'Pricing analytics | Acme' : path === '/integrations' ? 'Інтеграції Acme' : 'Закриття місяця',
      definition: path === '/smart-reports' ? 'Smart Reports допомагає готувати фінансові звіти.' : '',
      cta: 'Дізнатися більше', details: path === '/integrations' ? 'QuickBooks' : 'Поточний матеріал сторінки.',
      price: (GROUPS['G-PRICE']?.members || []).includes(path) ? (HF_WRONG.includes(path) ? 'від $49/міс' : 'від $79/міс') : ''
    }
  });
  return PAGE_CONTROL.get(path);
}
function packetPatch(r, variant) {
  if (r.st) return r.patch || (r.title.includes('title') ? { title: r.after || 'Pricing analytics для SaaS | Acme' } : { details: r.after || r.title });
  if (r.patchC) return variant === 'comp' ? r.patchC : r.patch;
  if (r.id === 'REC-3' || r.compromise) return variant !== 'comp'
    ? { h1: 'Звіти для CFO зі Smart Reports', definition: '', cta: 'Переглянути демо' }
    : { h1: 'Financial reporting automation зі Smart Reports', definition: 'Smart Reports допомагає готувати фінансові звіти. Перегляньте демо продукту.', cta: 'Переглянути демо' };
  if (r.patch) return r.patch;
  if (r.pod === 'SEO' && r.page === '/smart-reports') return { details: 'FAQ: що таке financial reporting automation; які звіти готує Smart Reports; як переглянути демо.' };
  if (r.page === '/pricing-analytics') return { definition: 'Pricing analytics: аналіз даних про тарифи SaaS.', details: 'Порівняльна таблиця та FAQ. Цифри клієнтів допускаються лише з перевіреним джерелом.' };
  if (r.page === '/integrations') return { details: 'QuickBooks: опис інтеграції та посилання на changelog. Дату запуску перевіряємо перед публікацією.' };
  return { definition: 'Закриття місяця — підготовка й перевірка фінансових даних за завершений місяць.', details: 'Таблиця кроків і FAQ зі збереженням наявного тексту.' };
}
function packetFingerprint(r) {
  return JSON.stringify([r.page, r.packet.version, r.packet.baseVersion, r.packet.patch, r.packet.after]);
}
function newPacket(r, variant = 'base') {
  const page = pageState(r.page);
  const previous = r.packet;
  r.variant = variant;
  r.packet = {
    version: (previous?.version || 0) + 1, baseVersion: page.version,
    before: { ...page.content }, patch: packetPatch(r, variant), approvals: {},
    evidence: false, policy: false, coordinated: false, humanApproved: false,
    signedFingerprint: null
  };
  r.packet.after = { ...r.packet.before, ...r.packet.patch };
  if (r.st) { r.testsPassed = false; r.rolloutApproved = false; }
  r.rvState = {};
  return r.packet;
}
/* Atomic lock: a group takes its key and every member page; a page packet waits if its page or group is held. */
function takePage(path, owner, kind) {
  const keys = resKeys(path);
  const busy = keys.map(pageState).find(p => p.active && p.active.id !== owner.id);
  if (busy) {
    if (!busy.queue.some(x => x.id === owner.id)) busy.queue.push({ id: owner.id, kind, path });
    return false;
  }
  keys.forEach(k => { const p = pageState(k); if (p.active?.id !== owner.id) p.active = { id: owner.id, kind, since: S.clockH || 0 }; p.queue = p.queue.filter(x => x.id !== owner.id); });
  return true;
}
function releasePage(path, id, result) {
  const nexts = []; let released = false;
  for (const k of resKeys(path)) {
    const page = pageState(k);
    if (page.active?.id !== id) continue;
    released = true;
    page.history.unshift({ id, result, version: page.version });
    page.active = null;
    while (page.queue.length) { const n = page.queue.shift(); if (!nexts.some(x => x.id === n.id)) { nexts.push(n); break; } }
  }
  if (!released) return;
  nexts.forEach(next => setTimeout(() => resumeQueued(next), 0));
}
function resumeQueued(next) {
  if (next.kind === 'recommendation') {
    const r = S.recs.find(x => x.id === next.id);
    if (r?.status === 'queued') {
      r.status = 'new';
      ev('o', 'Координатор сторінки', `${r.id}: черга звільнилася; перебудовую пакет від актуальної v${pageState(r.page).version}`);
      reviewRec(r);
    }
  } else if (next.kind === 'group') {
    if (typeof gpResume === 'function') gpResume(next.id);
  } else if (next.kind === 'cmp') {
    if (typeof cmpResume === 'function') cmpResume(next.id);
  } else {
    const p = S.pipelines.find(x => x.id === next.id);
    if (p?.pageQueued) { p.pageQueued = false; runPipeline(p, 0, false); }
  }
}
function lockAge(path) { const a = pageState(path).active; return a ? (S.clockH || 0) - (a.since || 0) : 0; }
/* TTL: a packet that waits for a human longer than 48 h loses its lock; the test group is restored and the queue moves on. */
function expireStale() {
  let n = 0;
  for (const r of S.recs) {
    if (!['human', 'won', 'inconclusive'].includes(r.status) || pageState(r.page).active?.id !== r.id || lockAge(r.page) < GATE.lockTtlH) continue;
    delete pageState(r.page).testContent;
    r.status = 'expired';
    r.reason = `Рішення не прийнято за ${GATE.lockTtlH} год. Дозвіл прострочено, тестову групу відновлено, сторінку звільнено. Подайте пакет знову — він перебудується від актуальної версії.`;
    ev('warn', 'Координатор сторінки', `${r.id}: дозвіл прострочено, ${r.page} звільнено для черги`);
    releasePage(r.page, r.id, 'expired'); n++;
  }
  for (const p of S.pipelines) {
    if (!p.land || !p.page || pageState(p.page).active?.id !== p.id || lockAge(p.page) < GATE.lockTtlH) continue;
    if (!(p.st[5] === 'active' || p.st[7] === 'active')) continue;
    S.approvals.filter(a => a.pl === p.id && a.status === 'pending').forEach(a => a.status = 'expired');
    delete pageState(p.page).testContent;
    p.st[p.st[7] === 'active' ? 7 : 5] = 'veto';
    p.note = `Дозвіл прострочено (${GATE.lockTtlH} год). Пакет знято, ресурс звільнено; задачу можна подати знову.`;
    ev('warn', 'Координатор сторінки', `${p.id}: дозвіл прострочено, ${p.page} звільнено`);
    releasePage(p.page, p.id, 'expired'); n++;
  }
  if (typeof gpExpire === 'function') n += gpExpire();
  return n;
}
function advanceClock(h) {
  S.clockH = (S.clockH || 0) + h;
  S.approvals.filter(a => a.status === 'pending').forEach(a => a.age = (a.age || 0) + h);
  const n = expireStale();
  ev('', 'Демо', `минуло ${h} год; прострочених блокувань: ${n}`);
  if (n) slack(`<b>Прострочено ${n} рішень.</b> Ресурси звільнено, черга рушила. Пакети можна подати знову.`, [], 'pm-standup');
  toast(n ? `Минуло ${h} год: ${n} блокувань знято, черга рушила.` : `Минуло ${h} год: прострочених блокувань немає.`);
  render();
}
function channelDecision(r, channel, variant) {
  const original = r.rv[channel];
  if (variant === 'comp' && r.compromise) return ['ok', channel === 'SEO' ? 'Ключ і тема H1 збережені.' : channel === 'PPC' ? 'CTA і рекламний наратив збережені без непідтвердженої обіцянки.' : 'Визначення залишилося; факти не замінені слоганом.'];
  return original || ['ok', `Оркестратор ${channel} перевірив пропозицію свого каналу; права на запис це не дає.`];
}
function packetReady(r) {
  const p = r.packet;
  return !!p && p.evidence && p.policy && p.coordinated
    && CHANNEL_OWNERS.every(c => p.approvals[c]?.version === p.version && (p.approvals[c].verdict === 'ok' || (p.override?.version === p.version && p.override.channels.includes(c))))
    && p.signedFingerprint === packetFingerprint(r)
    && pageState(r.page).version === p.baseVersion
    && pageState(r.page).active?.id === r.id;
}
function pagePreview(content, label) {
  return `<article class="page-preview"><div class="preview-label">${esc(label)} · умовний макет, не live-сайт</div><div class="preview-label">Заголовок вкладки: ${esc(content.title)}</div><h3>${esc(content.h1)}</h3>${content.price ? `<div class="preview-label">Блок ціни: ${esc(content.price)}</div>` : ''}${content.definition ? `<p>${esc(content.definition)}</p>` : '<p class="muted small">Визначення відсутнє</p>'}<span class="preview-cta">${esc(content.cta)}</span><p class="small muted">${esc(content.details)}</p></article>`;
}
/* ---------- Прев’ю лендингу: сторінка з блоків, режими «До / Після / Зміни», десктоп і мобільний ---------- */
const LP_MODE = {};
const LP_NAME = { hero: 'Hero і CTA', def: 'Визначення', how: 'Як працює', cmp: 'Порівняння', faq: 'FAQ + schema', rev: 'Відгуки', case: 'Кейс з цифрами', price: 'Ціна', int: 'Інтеграції', table: 'Таблиця даних', video: 'Відео + транскрипт', trust: 'Довіра і безпека', body: 'Основний текст', form: 'Форма запису' };
const LP_DEF = {
  hero: { h1: 'Smart Reports', sub: 'Acme', cta: 'Переглянути демо', lead: 'Фінансові звіти для SaaS без ручних таблиць.' },
  def: { text: 'Smart Reports — інструмент, що автоматично збирає фінансові звіти на закриття місяця.' },
  how: { items: ['Підключіть облікову систему', 'Оберіть шаблон звіту', 'Отримайте звіт на закриття місяця'] },
  cmp: { cols: ['Acme', 'Fathom', 'Baremetrics'], rows: [['Звіти на закриття місяця', 1, 1, 0], ['Прогноз cash flow', 1, 0, 1], ['Інтеграція з QuickBooks', 1, 1, 1]] },
  faq: { items: ['Що таке financial reporting automation?', 'Які звіти готує Smart Reports?', 'Як переглянути демо?'] },
  rev: { items: [['«Звіт для борду тепер готовий за день»', 'CFO, Northwind'], ['«Менше ручних таблиць наприкінці місяця»', 'Finance lead, Lumen']] },
  case: { num: '−38%', text: 'часу на закриття місяця · Northwind, звіт клієнта' },
  price: { text: 'від $79/міс' },
  int: { items: ['QuickBooks', 'Xero', 'Stripe', 'HubSpot', 'NetSuite'] },
  table: { rows: [['Крок', 'Хто', 'Час'], ['Звірка рахунків', 'Smart Reports', '2 год'], ['Перевірка', 'Finance', '1 день']] },
  video: { text: 'Демо за 3 хвилини · транскрипт під відео' },
  trust: { items: ['SOC 2 Type II', 'GDPR', 'SSO'] },
  body: { text: 'Поточний матеріал сторінки.' },
  form: { cta: 'Записатися на демо', items: ['Робоча пошта', 'Компанія'] }
};
const lpB = (id, d) => ({ id, ...LP_DEF[id], ...(d || {}) });
function lpBlocks(c) {
  const b = [lpB('hero', { h1: c.h1, sub: c.title, cta: c.cta })];
  if (c.definition) b.push(lpB('def', { text: c.definition }));
  if (c.price) b.push(lpB('price', { text: c.price }));
  b.push(lpB('how'));
  const d = c.details || '', faq = /FAQ/.test(d);
  if (/^FAQ:/.test(d)) b.push(lpB('faq', { items: d.replace(/^FAQ:\s*/, '').replace(/\.$/, '').split(/;\s*/).map(s => s.charAt(0).toUpperCase() + s.slice(1) + '?') }));
  else {
    if (/Порівняльна таблиця/.test(d)) b.push(lpB('cmp'));
    else if (/Таблиця кроків/.test(d)) b.push(lpB('table'));
    if (faq) b.push(lpB('faq'));
    if (!faq && !/таблиц/i.test(d)) b.push(lpB('body', { text: d }));
    else b.push(lpB('body', { text: d.replace(/^[^.]*\.\s*/, '') || 'Поточний матеріал сторінки.' }));
  }
  b.push(lpB('trust'));
  return b;
}
function lpDiff(before, after) {
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const res = after.map(a => { const o = before.find(x => x.id === a.id); return { ...a, st: !o ? 'added' : same(o, a) ? 'same' : 'changed', old: o }; });
  before.forEach((b, i) => { if (!after.some(a => a.id === b.id)) res.splice(Math.min(i, res.length), 0, { ...b, st: 'removed' }); });
  return res;
}
function lpBlockHTML(b) {
  const e = esc, it = b.items || [];
  const body = {
    hero: () => `<div class="lp-hero"><div><div class="lp-eye">${e(b.sub)}</div><div class="lp-h1">${e(b.h1)}</div><p>${e(b.lead || LP_DEF.hero.lead)}</p><span class="lp-btn">${e(b.cta)}</span></div><div class="lp-art" aria-hidden="true"><i></i><i></i><i></i></div></div>`,
    def: () => `<div class="lp-def"><b>Що це</b><p>${e(b.text)}</p></div>`,
    how: () => `<div class="lp-h2">Як це працює</div><div class="lp-steps">${it.map((s, i) => `<div><b>${i + 1}</b>${e(s)}</div>`).join('')}</div>`,
    cmp: () => `<div class="lp-h2">Порівняння</div><table class="lp-tbl"><tr><th></th>${b.cols.map(c => `<th>${e(c)}</th>`).join('')}</tr>${b.rows.map(r => `<tr><td>${e(r[0])}</td>${r.slice(1).map(v => `<td>${v ? '✓' : '—'}</td>`).join('')}</tr>`).join('')}</table>`,
    faq: () => `<div class="lp-h2">Питання і відповіді</div><div class="lp-faq">${it.map(q => `<div>${e(q)}<span>+</span></div>`).join('')}</div>`,
    rev: () => `<div class="lp-rev">${it.map(r => `<div><p>${e(r[0])}</p><span>${e(r[1])}</span></div>`).join('')}</div>`,
    case: () => `<div class="lp-case"><b>${e(b.num)}</b><span>${e(b.text)}</span></div>`,
    price: () => `<div class="lp-price"><span>Тариф Smart Reports</span><b>${e(b.text)}</b><span class="lp-btn ghost">Обрати тариф</span></div>`,
    int: () => `<div class="lp-h2">Інтеграції</div><div class="lp-pills">${it.map(x => `<span>${e(x)}</span>`).join('')}</div>`,
    table: () => `<table class="lp-tbl">${b.rows.map((r, i) => `<tr>${r.map(c => i ? `<td>${e(c)}</td>` : `<th>${e(c)}</th>`).join('')}</tr>`).join('')}</table>`,
    video: () => `<div class="lp-video"><span>▶</span>${e(b.text)}</div>`,
    trust: () => `<div class="lp-pills trust">${it.map(x => `<span>${e(x)}</span>`).join('')}</div>`,
    body: () => `<p class="lp-body">${e(b.text)}</p>`,
    form: () => `<div class="lp-form">${it.map(x => `<span>${e(x)}</span>`).join('')}<span class="lp-btn">${e(b.cta)}</span></div>`
  }[b.id];
  const was = b.st === 'changed' && b.old ? Object.keys(b).filter(k => !['st', 'old', 'id'].includes(k) && JSON.stringify(b[k]) !== JSON.stringify(b.old[k])).map(k => ({ h1: 'H1', cta: 'CTA', sub: 'заголовок вкладки', text: 'текст', items: 'пункти', lead: 'підзаголовок', rows: 'рядки', cols: 'колонки', num: 'цифра' }[k] || k)) : [];
  const tag = { added: 'новий блок', changed: 'змінено' + (was.length ? ': ' + was.join(', ') : ''), removed: 'прибрано' }[b.st];
  const old = b.st === 'changed' && b.old && b.old.h1 !== b.h1 && b.id === 'hero' ? `<div class="lp-was">було: «${e(b.old.h1)}»${b.old.cta !== b.cta ? ` · CTA «${e(b.old.cta)}»` : ''}</div>` : '';
  return `<section class="lpb ${b.st || ''}" data-blk="${b.id}"><span class="lp-k">${e(LP_NAME[b.id] || b.id)}${tag ? ` · <em>${e(tag)}</em>` : ''}</span>${body ? body() : ''}${old}</section>`;
}
function lpView(o) {
  const key = o.key, mode = LP_MODE[key] || (o.isNew ? 'after' : 'diff'), dev = LP_MODE[key + ':dev'] || 'desk';
  const list = lpDiff(o.before || [], o.after || []);
  const n = s => list.filter(b => b.st === s).length, add = n('added'), chg = n('changed'), del = n('removed');
  const pane = (m, blocks) => `<div class="lp-pane" data-pane="${m}">${blocks.length ? blocks.map(lpBlockHTML).join('') : `<div class="lp-empty">${o.isNew ? 'Сторінки ще немає: адреса нова.' : 'Порожньо'}</div>`}</div>`;
  const btn = (m, t) => `<button type="button" data-lpm="${m}">${t}</button>`;
  return `<div class="lp" data-lpk="${esc(key)}" data-mode="${mode}" data-dev="${dev}"${o.tour ? ` data-tour="${o.tour}"` : ''}>
    <div class="lp-bar"><div class="lp-seg">${btn('before', 'До')}${btn('after', 'Після')}${btn('diff', 'Зміни')}</div>
      <div class="lp-sum">${add ? `<span class="chip ok">+${add} ${o.isNew ? 'блоків' : 'нових'}</span>` : ''}${chg ? `<span class="chip warn">${chg} змінено</span>` : ''}${del ? `<span class="chip bad">${del} прибрано</span>` : ''}${!add && !chg && !del ? '<span class="chip">без змін</span>' : ''}</div>
      <div class="lp-seg">${`<button type="button" data-lpd="desk">Десктоп</button><button type="button" data-lpd="mob">Мобільний</button>`}</div></div>
    <div class="lp-frame"><div class="lp-chrome"><i></i><i></i><i></i><span class="lp-url">acme.com${esc(o.url || '')}</span><span class="lp-lab">${esc(o.label || 'умовний макет, не live-сайт')}</span></div>
      ${pane('before', (o.before || []).map(b => ({ ...b, st: '' })))}${pane('after', (o.after || []).map(b => ({ ...b, st: '' })))}${pane('diff', list)}</div>
    ${o.note ? `<p class="lp-note">${esc(o.note)}</p>` : ''}</div>`;
}
if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('click', e => {
  const b = e.target && e.target.closest && e.target.closest('[data-lpm],[data-lpd]'); if (!b) return;
  const w = b.closest('.lp'); if (!w) return;
  if (b.dataset.lpm) { w.dataset.mode = b.dataset.lpm; LP_MODE[w.dataset.lpk] = b.dataset.lpm; }
  else { w.dataset.dev = b.dataset.lpd; LP_MODE[w.dataset.lpk + ':dev'] = b.dataset.lpd; }
});
/* Новий лендинг кампанії і сторінки з брифу */
function lpLaunch(c) {
  return [lpB('hero', { h1: c.title + ': звіти на закриття місяця за години', sub: 'Новинка · ' + c.title, cta: 'Переглянути демо' }), lpB('def'), lpB('how'), lpB('int'), lpB('faq'), lpB('form')];
}
function lpBriefBlock(a) {
  const page = a.page || '/pricing-analytics', base = lpBlocks(pageState(page).content), id = a.blk || 'cmp', act = a.act || 'add';
  const has = base.some(b => b.id === id), at = Math.min(base.length - 1, 2);
  const before = act !== 'add' && !has ? [...base.slice(0, at), lpB(id), ...base.slice(at)] : base;
  let after;
  if (act === 'del') after = before.filter(b => b.id !== id);
  else if (act === 'edit' || has) after = before.map(b => b.id !== id ? b : id === 'hero' ? { ...b, h1: b.h1 + ' для SaaS', cta: 'Переглянути демо' } : { ...b, ...(b.text ? { text: b.text + ' Оновлено за даними з джерелом.' } : { items: [...(b.items || []), ...(b.rows ? [] : ['Новий пункт із джерелом'])], ...(b.rows ? { rows: [...b.rows, ['Новий рядок з джерелом', 1, 0, 1].slice(0, b.rows[0].length)] } : {}) }) });
  else after = [...before.slice(0, at), lpB(id), ...before.slice(at)];
  return { key: 'bf:' + page + ':' + act + ':' + id, url: page, before, after, tour: 'bf-lp', label: 'умовний макет · v' + pageState(page).version + ' → пакет',
    note: act === 'del' ? 'Прибраний блок теж перевіряють канали: він міг тримати ключ або цитування.' : 'Зміна піде пакетом через канали, Координатора і тест-гейт. Основна сторінка не зміниться до розгортання.' };
}
function lpBriefNew(t, a) {
  const ids = a.blocks && a.blocks.length ? a.blocks : t.id === 'vs' ? ['hero', 'cmp', 'faq', 'form'] : ['hero', 'def', 'how', 'faq', 'int'];
  const url = (t.page || '').replace(/^нов[аі]:\s*/, '').split(' ')[0] || '/new-page';
  const h1 = t.id === 'vs' ? 'Acme vs Baremetrics: чесне порівняння' : 'Smart Forecast: прогноз cash flow для SaaS';
  return { key: 'bf:new:' + t.id + ':' + ids.join(','), url, before: [], isNew: 1, tour: 'bf-lp', label: 'нова сторінка · шаблон feature-landing',
    after: ids.filter(id => LP_DEF[id]).map(id => id === 'hero' ? lpB('hero', { h1, sub: 'Acme', cta: 'Спробувати безкоштовно' }) : lpB(id)),
    note: 'Нова адреса: контролю для A/B немає, тому запуск м’який — noindex 7 днів і моніторинг. Блоки з цифрами чи відгуками проходять O2 і згоду клієнта.' };
}
function packetHTML(r) {
  const page = pageState(r.page), p = r.packet;
  if (!p) return `<p class="small muted">До узгодження це лише пропозиція. Сторінка v${page.version} не змінена; жодних погоджень ще немає.</p>${lpView({ key: r.id + ':draft', url: r.page, before: lpBlocks(page.content), after: lpBlocks({ ...page.content, ...packetPatch(r, 'base') }), label: 'поточна v' + page.version + ' → чернетка автора · умовний макет', tour: 'lp-preview' })}`;
  return `<div class="packet" data-tour="page-packet"><div class="packet-head"><b>Єдиний пакет ${esc(r.id)} · v${p.version}</b><span class="chip">база сторінки v${p.baseVersion}</span></div>
    <div class="channel-approvals">${CHANNEL_ALL.map(c => { if (!CHANNEL_OWNERS.includes(c)) return `<div class="ph-ghost-row"><b>${esc(c)}-оркестратор</b><span class="chip ph">не підключено · фаза ${DIRS[c].phase}</span><span class="small muted">канал з’явиться разом із напрямом; нові пакети тоді проходитимуть і його погодження</span></div>`; const a = p.approvals[c]; return `<div><b>${esc(c)}-оркестратор</b><span class="chip ${a?.verdict === 'ok' ? 'ok' : a?.verdict === 'no' ? 'bad' : ''}">${a ? (a.verdict === 'ok' ? 'погодив' : 'заперечив') + ' · v' + a.version : 'очікує'}</span><p>${esc(a?.reason || 'Оцінює вплив на свій канал.')}</p></div>`; }).join('')}</div>
    <div class="reason ${p.coordinated ? 'ok' : ''}"><b>Координатор сторінки:</b> ${esc(p.coordinated ? chAgreed() + ' одну версію. Далі — правила ризику та дозвіл на обмежений тест.' : 'Збирає спільне рішення; канальні погодження не дозволяють окремі правки.')}</div>
    ${lpView({ key: r.id + ':v' + p.version, url: r.page, before: lpBlocks(p.before), after: lpBlocks(p.after), label: 'пакет v' + p.version + ' · ' + (r.variant === 'comp' ? 'узгоджений компроміс' : 'пропозиція для тесту') + ' · умовний макет', tour: 'lp-preview' })}
    <div class="small muted">Поля пакета: ${Object.keys(p.patch).map(esc).join(', ')}. Зміна варіанта створює нову версію й скидає всі погодження. Тест не є публікацією на весь сайт.</div></div>`;
}
function pageControlHTML() {
  const all = [...new Set([...S.recs.map(r => r.page), ...PAGE_CONTROL.keys()])];
  const isMember = k => Object.values(GROUPS).some(g => g.members.includes(k));
  const groupHeld = k => !!pageState(k).active && Object.values(GROUPS).some(g => g.members.includes(k) && pageState('group:' + g.id).active?.id === pageState(k).active.id);
  const idleMember = k => isMember(k) && !pageState(k).active && !pageState(k).queue.length && !S.recs.some(r => r.page === k);
  const groupKeys = Object.keys(GROUPS).map(id => 'group:' + id);
  const singles = all.filter(k => !k.startsWith('group:') && !groupHeld(k) && !idleMember(k));
  const kind = k => k.startsWith('group:') ? `група · ${GROUPS[k.slice(6)]?.members.length || 0} стор.` : k.startsWith('ppc:') ? 'рекламна кампанія' : k.startsWith('email:') ? 'сегмент розсилки' : k.startsWith('social:') ? 'соцмережі' : 'сторінка';
  const row = k => { const p = pageState(k); const age = lockAge(k); return `<tr><td>${esc(k.startsWith('group:') ? GROUPS[k.slice(6)]?.name + ' (' + GROUPS[k.slice(6)]?.pattern + ')' : k)}</td><td class="small muted">${kind(k)}</td><td>v${p.version}</td><td>${p.active ? `${esc(p.active.id)} <span class="small ${age >= GATE.lockTtlH - 12 ? 'down' : 'muted'}">· ${age} год з ${GATE.lockTtlH}</span>` : 'вільна'}</td><td>${p.queue.map(x => esc(x.id)).join(', ') || '—'}</td></tr>`; };
  return `<div class="panel sec-gap" data-tour="page-control"><h2>Ресурси, блокування і черга ${hint('Один активний пакет на ресурс. Група блокує всі свої сторінки атомарно. Блокування без рішення людини живе 48 годин, потім знімається, а пакет можна подати знову.')}<span class="sp"><button class="btn small" data-action="clock-48">Перемотати 48 год</button></span></h2><p class="small muted">SEO, PPC і AI Visibility погоджують свої вимоги. Координатор відповідає за цілу сторінку чи групу. Один активний пакет на ресурс; решта — у черзі. Новий пакет завжди спирається на останню опубліковану версію.</p><div class="tbl-wrap"><table><thead><tr><th>Ресурс</th><th>Тип</th><th>Версія</th><th>Активний пакет · вік блокування</th><th>Черга</th></tr></thead><tbody>${[...groupKeys, ...singles].map(row).join('')}</tbody></table></div></div>`;
}
function pcOverride(r) {
  if (!r || r.status !== 'human' || !r.packet) return;
  if (S.role !== 'owner') { toast('Прийняти ризик всупереч каналу може лише Owner.'); return; }
  const p = r.packet, objs = CHANNEL_OWNERS.filter(c => p.approvals[c]?.verdict !== 'ok');
  if (!objs.length) return;
  p.override = { by: 'Owner', version: p.version, channels: objs };
  p.coordinated = true; p.signedFingerprint = packetFingerprint(r); r.requiresHuman = true;
  r.reason = `Owner прийняв ризик всупереч запереченню ${objs.join(', ')}. Рішення записано в аудит. Тест-гейт суворіший: шкода понад −1 у будь-якому каналі — відкат; розгортання лише з окремим дозволом.`;
  ev('h', 'Owner', `прийняв ризик для ${r.id} v${p.version} всупереч ${objs.join(', ')}; суворий тест-гейт`);
  slack(`<b>${esc(r.id)}</b>: Owner прийняв ризик всупереч ${objs.join(', ')}. Тест суворіший, розгортання — окремим рішенням.`, [], 'pm-standup');
  render();
}
function pcResubmit(r) {
  if (!r || r.status !== 'expired') return;
  r.status = 'new'; r.reason = 'Подано знову після прострочення. Пакет буде перебудовано від актуальної версії.'; delete r.packet;
  ev('h', ROLES[S.role].name, `подав ${r.id} знову`); reviewRec(r);
}
function changePacketVariant(r, variant) {
  if (!r || !['human', 'ready'].includes(r.status)) return;
  ev('warn', 'Координатор сторінки', `${r.id}: варіант змінено; попередні погодження скинуто`);
  reviewRec(r, variant, true);
}
function rejectPacket(r) {
  if (!r || !ROLES[S.role].r2 || !['human', 'ready'].includes(r.status)) return;
  r.status = 'rejected'; r.reason = 'Людина відхилила пакет. Сторінка не змінена.';
  ev('h', ROLES[S.role].name, `відхилив ${r.id}`);
  releasePage(r.page, r.id, 'rejected'); render();
}
function demoPageQueue() {
  if (S.recs.some(r => r.id === 'REC-5')) { toast('REC-5 уже є в рекомендаціях.'); return; }
  const r = { id: 'REC-5', page: '/smart-reports', pod: 'SEO', agent: 'Content Optimizer', imp: 'low', impWhy: 'FAQ без зміни H1, визначення та CTA', conf: 88, title: 'SEO додає FAQ на ту саму сторінку', why: 'Друга пропозиція має зберегти результат узгодженого PPC-пакета.', before: 'Поточний блок деталей.', after: 'FAQ про Smart Reports зі збереженням погодженого H1 та CTA.', rv: { SEO: ['ok', 'FAQ доповнює тему без заміни H1.'], PPC: ['ok', 'CTA та рекламний наратив не змінюються.'], 'AI Visibility': ['ok', 'Визначення збережене.'] }, tests: [['A/B тест', 0.5, 'конверсія'], ['SEO-тест', 3, 'кліки'], ['AI Visibility тест', 2, 'цитування']], status: 'new' };
  S.recs.push(r); reviewRec(r); go('recs');
}

async function pcReview(r, variant = 'base', revised = false) {
  if (!r || (revised ? !['human', 'ready'].includes(r.status) : !['new', 'queued'].includes(r.status))) return;
  if (!takePage(r.page, r, 'recommendation')) {
    r.status = 'queued'; r.reason = `Сторінку утримує ${pageState(r.page).active.id}. Після завершення пакет буде перебудовано від актуальної версії; запис зараз заборонений.`;
    ev('warn', 'Координатор сторінки', `${r.id}: у черзі для ${r.page}`); render(); return;
  }
  const p = newPacket(r, variant);
  r.status = 'review'; r.reason = 'Канальні оркестратори оцінюють одну версію пакета.'; render();
  ev('o', 'Координатор сторінки', `${r.id} v${p.version}: зафіксовано базу сторінки v${p.baseVersion}; інші правки чекають`);
  for (const channel of CHANNEL_OWNERS) {
    await wait(450);
    const [verdict, reason] = channelDecision(r, channel, variant);
    p.approvals[channel] = { verdict, reason, version: p.version };
    r.rvState[channel] = verdict;
    ev(verdict === 'ok' ? 'ok' : 'warn', `${channel}-оркестратор`, `${r.id} v${p.version}: ${reason}`);
    render();
  }
  await wait(350);
  p.evidence = true; p.policy = true;
  ev('o', 'O2 Verifier', `${r.id}: демонстраційні джерела й поля перевірено; це не реальна верифікація фактів`);
  ev('o', 'O3 Auditor', `${r.id}: дозволені поля; зміна політик або довільний код не входять у пакет`);
  const objections = CHANNEL_OWNERS.filter(c => p.approvals[c].verdict !== 'ok');
  p.coordinated = objections.length === 0;
  p.signedFingerprint = packetFingerprint(r);
  if (objections.length) {
    r.requiresHuman = true; r.status = 'human';
    r.reason = `Конфлікт: ${objections.join(', ')} заперечують. Координатор пропонує компроміс. Оберіть варіант: він створить нову версію й повторне погодження. Непогоджений пакет не можна відправити навіть у тест.`;
    slack(`<b>${esc(r.id)}</b>: конфлікт каналів. Потрібне рішення по єдиному пакету.`, [{ label: 'Переглянути пакет', action: 'open-rec', id: r.id }], recCh(r));
  } else if (r.requiresHuman || r.imp === 'high' || r.conf < 70) {
    r.status = 'human';
    r.reason = `${r.requiresHuman ? 'Компроміс повторно погоджений усіма каналами.' : 'Канали погодили пакет.'} ${r.conf < 70 ? 'Недостатньо впевненості.' : r.imp === 'high' ? 'Високий вплив.' : 'Після конфлікту потрібне рішення людини.'} Людина дозволяє обмежений тест саме цієї версії.`;
  } else {
    r.status = 'auto'; r.reason = 'Координатор узгодив єдиний пакет. Низький вплив: O3 фіксує дозвіл на обмежений тест, а не на весь сайт.';
    ev('ok', 'Координатор сторінки', `${r.id}: ${chAgreed()} v${p.version}; авто-дозвіл на тест`);
  }
  render();
  if (r.status === 'auto') { await wait(300); pcStartTest(r); }
}
function pcStartTest(r) {
  if (!r || !['human', 'auto', 'ready'].includes(r.status)) return;
  if (!packetReady(r)) { toast('Потрібні актуальні погодження всіх каналів на незмінний пакет.'); return; }
  if ((r.requiresHuman || r.imp === 'high' || r.conf < 70) && !r.packet.humanApproved) { toast('Потрібен дозвіл людини на цю версію.'); return; }
  if (!gwAllowed(`тест ${r.id}`, () => pcStartTest(r))) { r.reason = 'Дозвіл є, але записи вимкнено аварійним вимикачем. Тест стартує після увімкнення.'; render(); return; }
  r.status = 'test'; r.week = 0;
  if (r.anomalyId) S.anomalies.find(a => a.id === r.anomalyId).status = 'test';
  r.packet.testFingerprint = packetFingerprint(r);
  pageState(r.page).testContent = { ...r.packet.after };
  ev('o', 'Gateway (симуляція)', `${r.id} v${r.packet.version}: застосовано лише до тестової групи; основна сторінка v${r.packet.baseVersion} незмінна`);
  render();
}
function pcApprove(r) {
  if (!r || r.status !== 'human') return;
  if (!ROLES[S.role].r2) { toast('Ваша роль не дозволяє тест публічної зміни.'); return; }
  if (!packetReady(r)) { toast('Спершу узгодьте варіант з усіма активними каналами: ' + CHANNEL_OWNERS.join(', ') + '.'); return; }
  r.packet.humanApproved = true;
  ev('h', ROLES[S.role].name, `дозволив обмежений тест ${r.id} v${r.packet.version}`);
  pcStartTest(r);
}
function pcTestValid(r) {
  return packetReady(r) && r.packet.testFingerprint === packetFingerprint(r);
}
function pcRecWeek(r) {
  if (!r || r.status !== 'test') return;
  if (r.hotfixHold) { toast(`Тест ${r.id} на паузі: триває швидке виправлення.`); return; }
  if (!pcTestValid(r)) { r.status = 'inconclusive'; r.reason = 'Пакет або база змінилися. Розгортання заблоковане; завершіть тест і погодьте нову версію.'; render(); return; }
  const T = recTests(r);
  r.week = Math.min(3, r.week + 1);
  ev('', 'Моніторинг пакета', `${r.id}: тиждень ${r.week}; оцінюємо активні тести разом`);
  const pre = gateEvaluate(asGate(T));
  if (pre.verdict === 'inconclusive' && pre.why.startsWith('неповні')) { r.status = 'inconclusive'; r.reason = 'Неповні або нечислові результати. Висновок не визначено; публікація заборонена.'; render(); return; }
  if (r.week === 3) {
    const g = gateEvaluate(asGate(T), { strict: !!r.packet?.override });
    if (g.verdict === 'harm') {
      r.status = 'rolledback'; r.reason = `Шкода каналу понад поріг${r.packet?.override ? ' суворого режиму' : ''}: ${g.why}. Тестову групу відновлено; основна сторінка не змінювалася.`;
      delete pageState(r.page).testContent;
      ev('bad', 'Координатор сторінки', `${r.id}: шкода іншому каналу — відкат тестового пакета`);
      releasePage(r.page, r.id, 'rolledback');
    } else if (g.verdict === 'inconclusive') {
      r.status = 'inconclusive'; r.reason = 'Немає достатнього покращення за умовними порогами демо. Не оголошуємо перемогу; завершіть тест без розгортання.';
    } else if (r.imp === 'low' && !r.requiresHuman) pcCommit(r, false);
    else { r.status = 'won'; r.reason = 'Тест пакета пройшов умовні пороги демо. Основна сторінка незмінна; потрібен окремий дозвіл людини на розгортання.'; }
  }
  render();
}
function pcCommit(r, human) {
  if (!r || (human ? r.status !== 'won' : r.status !== 'test') || !pcTestValid(r)) return;
  if (human && !ROLES[S.role].r2) { toast('Ваша роль не дозволяє розгортання.'); return; }
  if (!gwAllowed(`розгортання ${r.id}`, () => pcCommit(r, human))) return;
  const page = pageState(r.page);
  page.content = { ...r.packet.after }; page.version++; delete page.testContent;
  r.status = 'deployed'; r.reason = `Gateway застосував погоджений пакет; сторінка тепер v${page.version}. Черга продовжиться від цієї версії зі збереженням попередніх змін.`;
  if (r.anomalyId) S.anomalies.find(a => a.id === r.anomalyId).status = 'deployed';
  ev(human ? 'h' : 'ok', human ? ROLES[S.role].name : 'Координатор сторінки', `${r.id}: розгорнуто єдину версію; ${r.page} v${page.version}`);
  releasePage(r.page, r.id, 'deployed'); render();
}
function pcEndTest(r) {
  if (!r || !['inconclusive', 'won'].includes(r.status) || !ROLES[S.role].r2) return;
  const won = r.status === 'won';
  delete pageState(r.page).testContent; r.status = 'rolledback';
  r.reason = won ? 'Людина вирішила не розгортати переможний варіант. Тестову групу відновлено, сторінку звільнено.' : 'Тест завершено без розгортання. Основна сторінка збережена.';
  ev('h', ROLES[S.role].name, `завершив ${r.id} без розгортання`);
  releasePage(r.page, r.id, won ? 'declined' : 'inconclusive'); render();
}
function pcCard(r) {
  const st = REC_ST[r.status], T = recTests(r), p = r.packet;
  const can = ROLES[S.role].r2;
  return `<div class="ap rec ${S.recHi === r.id ? 'hi' : ''}" id="rec-${r.id}">
    <div class="t">${esc(r.id)} · ${esc(r.title)} <span class="chip ${r.imp === 'high' ? 'warn' : ''}">${r.imp === 'high' ? 'високий вплив' : 'низький вплив'}</span><span class="chip ${st[1]}">${st[0]}</span></div>
    <div class="small muted">${esc(r.page)} · пропонує ${esc(r.agent)} (${esc(r.pod)}); власник цілісності — Координатор сторінки</div>
    <p class="small">${esc(r.why)}</p>
    <div class="diff"><div><b>Передумова автора</b>${esc(r.before)}</div><div class="after"><b>Пропозиція, ще не дозвіл</b>${esc(r.after)}</div></div>
    ${packetHTML(r)}
    ${r.reason ? `<div class="reason ${r.status === 'deployed' ? 'ok' : ''}">${esc(r.reason)}</div>` : ''}
    ${r.status === 'new' ? `<button class="btn small primary" data-action="rec-review" data-id="${r.id}">Узгодити єдиний пакет</button>` : ''}
    ${r.status === 'human' ? `${r.compromise ? `<div class="acts sec-gap"><button class="btn small ${r.variant === 'comp' ? 'primary' : ''}" data-action="packet-comp" data-id="${r.id}">Компроміс · повторно погодити</button><button class="btn small" data-action="packet-orig" data-id="${r.id}">Оригінал · перевірити наслідки</button></div>` : ''}<div class="acts sec-gap"><button class="btn small primary" data-action="rec-approve" data-id="${r.id}" ${!can || !packetReady(r) ? 'disabled' : ''}>Дозволити тест v${p.version}</button><button class="btn small danger" data-action="rec-reject" data-id="${r.id}" ${!can ? 'disabled' : ''}>Відхилити пакет</button>${p && !p.coordinated ? (S.role === 'owner' ? `<button class="btn small" data-action="packet-override" data-id="${r.id}">Прийняти ризик (Owner)</button>` : '<span class="small muted">Конфлікт знімає компроміс або Owner, свідомо прийнявши ризик.</span>') : ''}</div>` : ''}
    ${r.status === 'expired' ? `<div class="acts sec-gap"><button class="btn small primary" data-action="packet-resubmit" data-id="${r.id}">Подати знову</button></div>` : ''}
    ${['test', 'won', 'deployed', 'rolledback', 'inconclusive'].includes(r.status) ? `<div class="tbl-wrap sec-gap"><table><thead><tr><th>Спільний тест · ${r.week || 0}/3 тижні</th><th>Метрика</th><th>Ефект у демо</th></tr></thead><tbody>${T.map(t => testOn(t[0]) ? `<tr><td>${esc(t[0])}</td><td>${esc(t[2])}</td><td>${fmtGate(t[0], recVal(t, r.week || 0))}</td></tr>` : `<tr class="ph-ghost-row"><td>${esc(t[0])}</td><td>${esc(t[2])}</td><td><span class="chip ph">вимкнено до фази 2</span></td></tr>`).join('')}</tbody></table></div><p class="small muted">Результати змодельовані. Пороги −2%/+2% і три тижні ілюструють маршрут; реальний evaluator потребує вибірки, довірчих інтервалів та окремих одиниць метрик.</p><div class="acts">${r.status === 'test' ? `<button class="btn small" data-action="rec-week" data-id="${r.id}">Наступний тиждень</button>` : ''}${r.status === 'won' ? `<button class="btn small primary" data-action="rec-deploy" data-id="${r.id}" ${!can ? 'disabled' : ''}>Дозволити розгортання пакета</button><button class="btn small" data-action="packet-end" data-id="${r.id}" ${!can ? 'disabled' : ''}>Не розгортати</button>` : ''}${r.status === 'inconclusive' ? `<button class="btn small" data-action="packet-end" data-id="${r.id}" ${!can ? 'disabled' : ''}>Завершити без розгортання</button>` : ''}</div>` : ''}
  </div>`;
}
function pipelinePage(p) { return p.page || null; }
function pipelinePacket(p) {
  p.page = pipelinePage(p);
  if (!p.page) return null;
  if (!takePage(p.page, p, 'pipeline')) return false;
  if (!p.packet) newPacket(p);
  return true;
}
function approvePipelineChannels(p) {
  const q = p.packet, objections = [];
  for (const channel of CHANNEL_OWNERS) {
    const v = p.rv?.[channel] || ['ok', `${channel}: перевірено спільний пакет, без окремого запису.`];
    q.approvals[channel] = { verdict: v[0], reason: v[1], version: q.version };
    if (v[0] !== 'ok') objections.push(channel);
  }
  q.evidence = true; q.policy = true; q.coordinated = objections.length === 0; q.signedFingerprint = packetFingerprint(p);
  return objections;
}
function seedPipelinePackets() {
  for (const p of S.pipelines.filter(x => x.land && x.st[5] === 'active')) {
    const a = S.approvals.find(x => x.pl === p.id);
    if (a) { p.after = a.after; p.before = a.before; }
    if (pipelinePacket(p)) {
      approvePipelineChannels(p);
      if (a) { a.packetVersion = p.packet.version; a.packetFingerprint = packetFingerprint(p); }
    }
  }
}
