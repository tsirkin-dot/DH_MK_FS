/* Prototype coordination only: no external systems or real model calls. */
const PAGE_CONTROL = new Map();
const CHANNEL_OWNERS = ['SEO', 'PPC', 'AI Visibility'];
/* Groups of pages (filled by orca9-scale.js), the single test evaluator, locks with TTL and the write kill switch. */
const GROUPS = {};
const HF_WRONG = ['/smart-reports', '/compare/baremetrics', '/blog/saas-pricing-guide'];
const GATE = { harm: -2, win: 2, overrideHarm: -1, lockTtlH: 48 };
function unitOf(name) { return /AI Visibility/i.test(name) ? ' п.' : '%'; }
function fmtGate(name, v) { return Number.isFinite(v) ? (v >= 0 ? '+' : '') + String(v).replace('.', ',') + unitOf(name) : 'немає даних'; }
const asGate = arr => (arr || []).map(t => ({ name: t[0], value: typeof t[1] === 'number' ? t[1] : t[2] }));
/* One evaluator for pages, groups and pipelines: harm → rollback, no clear win or bad data → inconclusive, otherwise pass. */
function gateEvaluate(results, opts = {}) {
  const harmAt = opts.strict ? GATE.overrideHarm : GATE.harm;
  if (!Array.isArray(results) || results.length !== 3 || results.some(r => !r || !Number.isFinite(r.value))) return { verdict: 'inconclusive', why: 'неповні або нечислові результати' };
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
function packetHTML(r) {
  const page = pageState(r.page), p = r.packet;
  if (!p) return `<p class="small muted">До узгодження це лише пропозиція. Сторінка v${page.version} не змінена; жодних погоджень ще немає.</p><div class="preview-grid">${pagePreview(page.content, 'Поточна сторінка v' + page.version)}${pagePreview({ ...page.content, ...packetPatch(r, 'base') }, 'Чернетка автора')}</div>`;
  return `<div class="packet" data-tour="page-packet"><div class="packet-head"><b>Єдиний пакет ${esc(r.id)} · v${p.version}</b><span class="chip">база сторінки v${p.baseVersion}</span></div>
    <div class="channel-approvals">${CHANNEL_OWNERS.map(c => { const a = p.approvals[c]; return `<div><b>${esc(c)}-оркестратор</b><span class="chip ${a?.verdict === 'ok' ? 'ok' : a?.verdict === 'no' ? 'bad' : ''}">${a ? (a.verdict === 'ok' ? 'погодив' : 'заперечив') + ' · v' + a.version : 'очікує'}</span><p>${esc(a?.reason || 'Оцінює вплив на свій канал.')}</p></div>`; }).join('')}</div>
    <div class="reason ${p.coordinated ? 'ok' : ''}"><b>Координатор сторінки:</b> ${esc(p.coordinated ? 'Три канали погодили одну версію. Далі — правила ризику та дозвіл на обмежений тест.' : 'Збирає спільне рішення; канальні погодження не дозволяють окремі правки.')}</div>
    <div class="preview-grid">${pagePreview(p.before, 'Поточна сторінка')}${pagePreview(p.after, r.variant === 'comp' ? 'Узгоджений компроміс' : 'Пропозиція для тесту')}</div>
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
    ev('ok', 'Координатор сторінки', `${r.id}: три канали погодили v${p.version}; авто-дозвіл на тест`);
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
  if (!packetReady(r)) { toast('Спершу узгодьте варіант з усіма трьома каналами.'); return; }
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
  ev('', 'Моніторинг пакета', `${r.id}: тиждень ${r.week}; оцінюємо три канали разом`);
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
    ${['test', 'won', 'deployed', 'rolledback', 'inconclusive'].includes(r.status) ? `<div class="tbl-wrap sec-gap"><table><thead><tr><th>Спільний тест · ${r.week || 0}/3 тижні</th><th>Метрика</th><th>Ефект у демо</th></tr></thead><tbody>${T.map(t => `<tr><td>${esc(t[0])}</td><td>${esc(t[2])}</td><td>${fmtGate(t[0], recVal(t, r.week || 0))}</td></tr>`).join('')}</tbody></table></div><p class="small muted">Результати змодельовані. Пороги −2%/+2% і три тижні ілюструють маршрут; реальний evaluator потребує вибірки, довірчих інтервалів та окремих одиниць метрик.</p><div class="acts">${r.status === 'test' ? `<button class="btn small" data-action="rec-week" data-id="${r.id}">Наступний тиждень</button>` : ''}${r.status === 'won' ? `<button class="btn small primary" data-action="rec-deploy" data-id="${r.id}" ${!can ? 'disabled' : ''}>Дозволити розгортання пакета</button><button class="btn small" data-action="packet-end" data-id="${r.id}" ${!can ? 'disabled' : ''}>Не розгортати</button>` : ''}${r.status === 'inconclusive' ? `<button class="btn small" data-action="packet-end" data-id="${r.id}" ${!can ? 'disabled' : ''}>Завершити без розгортання</button>` : ''}</div>` : ''}
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
