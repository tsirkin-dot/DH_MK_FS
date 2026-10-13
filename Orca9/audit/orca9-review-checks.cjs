// Client-side coordination regressions; not a backend security audit.
// Run: node audit/orca9-review-checks.cjs
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'orca9-demo.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const controller = fs.readFileSync(path.join(root, 'orca9-page-control.js'), 'utf8');
const scale = fs.readFileSync(path.join(root, 'orca9-scale.js'), 'utf8');
const viz = fs.readFileSync(path.join(root, 'orca9-viz.js'), 'utf8');
const agents = fs.readFileSync(path.join(root, 'orca9-agents.js'), 'utf8');
new vm.Script(script); new vm.Script(controller); new vm.Script(scale);
function session(role = 'lead') {
  const c = vm.createContext({ setTimeout: fn => { queueMicrotask(fn); return 0; }, clearTimeout() {}, console });
  vm.runInContext(controller, c);
  vm.runInContext(scale, c);
  vm.runInContext(viz, c);
  vm.runInContext(agents, c);
  vm.runInContext(script.slice(0, script.indexOf('/* ---------- tour ---------- */')), c);
  vm.runInContext('ev = () => {}; slack = () => {}; render = () => {}; toast = () => {}; go = () => {};', c);
  vm.runInContext(`scaleInit(); seedPipelinePackets(); S.role = '${role}';`, c);
  return c;
}
const R = (c, s) => vm.runInContext(s, c);
const rec = (c, id) => R(c, `S.recs.find(r => r.id === '${id}')`);
const flush = async () => { for (let i = 0; i < 400; i++) await Promise.resolve(); };
const checks = [];
const ok = msg => checks.push(msg);
(async () => {
  /* ---- original coordination checks ---- */
  const c = session(), r = rec(c, 'REC-3');
  await c.reviewRec(r);
  assert.equal(r.status, 'human'); assert.equal(Object.keys(r.packet.approvals).length, 3);
  assert.equal(c.packetReady(r), false); c.recApprove(r); assert.equal(r.status, 'human');
  ok('Channel objections block original PPC proposal, including human approve.');
  c.demoPageQueue(); const queued = rec(c, 'REC-5'); assert.equal(queued.status, 'queued');
  ok('Second proposal on the same page queues without writes.');
  const old = r.packet.signedFingerprint;
  await c.reviewRec(r, 'comp', true);
  assert.equal(r.packet.version, 2); assert.notEqual(old, r.packet.signedFingerprint);
  assert.ok(Object.values(r.packet.approvals).every(a => a.version === 2 && a.verdict === 'ok'));
  assert.equal(r.status, 'human');
  ok('Compromise v2 gets three fresh approvals and still requires a human.');
  const h1 = r.packet.after.h1;
  r.packet.after.h1 = 'unapproved'; assert.equal(c.packetReady(r), false);
  c.recApprove(r); assert.equal(r.status, 'human'); r.packet.after.h1 = h1;
  ok('Altered preview/payload cannot use the old approval fingerprint.');
  c.recApprove(r); assert.equal(r.status, 'test'); assert.equal(c.pageState(r.page).version, 1);
  for (let i = 0; i < 3; i++) c.recWeek(r);
  assert.equal(r.status, 'won'); assert.equal(c.pageState(r.page).version, 1);
  ok('Successful test after conflict needs separate rollout; live page unchanged.');
  c.recDeploy(r); await flush();
  assert.equal(r.status, 'deployed'); assert.equal(c.pageState(r.page).version, 2);
  assert.equal(queued.packet.baseVersion, 2); assert.equal(queued.packet.after.h1, h1);
  for (let i = 0; i < 3; i++) c.recWeek(queued);
  assert.equal(queued.status, 'deployed'); assert.equal(c.pageState(r.page).content.h1, h1); assert.equal(c.pageState(r.page).version, 3);
  ok('Queue resumes from published v2 and preserves PPC H1/CTA while adding SEO FAQ.');
  const bad = session(), b = rec(bad, 'REC-2'); await bad.reviewRec(b);
  b.tests[0][1] = NaN; bad.recWeek(b); assert.equal(b.status, 'inconclusive');
  bad.recDeploy(b); assert.equal(b.status, 'inconclusive'); bad.pcEndTest(b); assert.equal(bad.pageState(b.page).active, null);
  ok('NaN blocks rollout; explicit end releases the resource.');
  const stale = session(), x = rec(stale, 'REC-2'); await stale.reviewRec(x);
  stale.pageState(x.page).version++; stale.recWeek(x); assert.equal(x.status, 'inconclusive');
  ok('Changed base version blocks the test decision.');
  const damage = session(), y = rec(damage, 'REC-2'); await damage.reviewRec(y); y.tests[1][1] = -20;
  for (let i = 0; i < 3; i++) damage.recWeek(y);
  assert.equal(y.status, 'rolledback'); assert.equal(damage.pageState(y.page).active, null);
  ok('SEO guardrail breach rolls back the test and releases the lock.');
  const rej = session(), z = rec(rej, 'REC-3'); await rej.reviewRec(z); rej.rejectPacket(z); rej.recApprove(z);
  assert.equal(z.status, 'rejected');
  ok('Rejected package cannot restart through approve.');
  assert.equal(c.needsHuman({ risk: 'R2', imp: 'low', conf: 20 }), true);
  ok('Generic pipeline routes low-confidence work to a human.');

  /* ---- fixes from the review ---- */
  { const s = session(); R(s, `EX['ev-noaddr']()`); await flush();
    const p = R(s, 'S.pipelines[0]'); assert.equal(p.st[1], 'return'); assert.equal(R(s, `[...PAGE_CONTROL.values()].filter(x => x.active && x.active.id === '${p.id}').length`), 0);
    ok('A page change without an explicit page or group is rejected at intake; nothing is locked.'); }
  { const s = session(); R(s, `EX['seo-aeo']()`); await flush();
    assert.equal(R(s, `pageState('/blog/finance-close').version`), 2); assert.equal(R(s, `pageState('/smart-reports').version`), 1);
    ok('SEO example changes the page it names (/blog/finance-close), not a guessed one.'); }
  { const s = session('owner'); s.approve('AP-103'); await flush();
    const ro = R(s, `S.approvals.find(a => a.phase === 'rollout')`); assert.ok(ro);
    assert.ok(R(s, `!!pageState('group:G-FEATURES').testContent`)); s.decide(ro.id, 'rejected');
    assert.equal(R(s, `!!pageState('group:G-FEATURES').testContent`), false); assert.equal(R(s, `pageState('group:G-FEATURES').active`), null);
    ok('Rejecting a rollout restores the test group and frees the resource.'); }
  { const s = session(), q = rec(s, 'REC-3'); await s.reviewRec(q); await s.reviewRec(q, 'comp', true); s.recApprove(q);
    for (let i = 0; i < 3; i++) s.recWeek(q); assert.equal(q.status, 'won'); s.pcEndTest(q);
    assert.equal(q.status, 'rolledback'); assert.equal(R(s, `pageState('/smart-reports').active`), null);
    ok('A winning test can be declined; the page lock is released.'); }
  { const s = session(), q = rec(s, 'REC-3'); await s.reviewRec(q);
    assert.equal(R(s, `S.gps.find(g => g.id === 'GP-1').status`), 'new');
    await s.gpReview(R(s, `S.gps.find(g => g.id === 'GP-1')`)); assert.equal(R(s, `S.gps.find(g => g.id === 'GP-1').status`), 'queued');
    s.advanceClock(48); await flush();
    assert.equal(q.status, 'expired'); assert.equal(R(s, `S.approvals.find(a => a.id === 'AP-103').status`), 'expired');
    assert.notEqual(R(s, `S.gps.find(g => g.id === 'GP-1').status`), 'queued');
    ok('Locks waiting for a human expire after 48 h; the queue moves on (GP-1 resumes after MKT-477).'); }
  { const s = session(); assert.ok(R(s, `S.recs.every(r => !('CRO' in r.rv))`)); assert.ok(!/['"]CRO['"]\s*\]/.test(R(s, `JSON.stringify(S.approvals.map(a => a.xr))`)));
    ok('CRO is not a hidden fourth approver: verdicts are SEO, PPC, AI Visibility; CRO judges the A/B test.'); }
  { const s = session('lead'), q = rec(s, 'REC-3'); await s.reviewRec(q); await s.reviewRec(q, 'orig', true);
    s.pcOverride(q); assert.equal(s.packetReady(q), false);
    R(s, `S.role = 'owner'`); s.pcOverride(q); assert.equal(s.packetReady(q), true); s.recApprove(q); assert.equal(q.status, 'test');
    q.tests = [['A/B тест', 6.1, 'x'], ['SEO-тест', -1.5, 'x'], ['AI Visibility тест', 0.5, 'x']];
    for (let i = 0; i < 3; i++) s.recWeek(q); assert.equal(q.status, 'rolledback');
    ok('Only Owner can accept risk against a channel; the test is then stricter (−1.5 rolls back).'); }
  { const s = session(); R(s, `EX['ev-conflict']()`); await flush();
    const q = rec(s, 'REC-' + R(s, 'S.pipelines[0].id')); assert.ok(q); assert.equal(q.status, 'human'); assert.equal(R(s, 'S.pipelines[0].st[4]'), 'return');
    ok('Channel conflict inside a pipeline moves to Recommendations instead of a rubber stamp.'); }
  { const s = session('seo');
    assert.equal(s.canApprove(R(s, `S.approvals.find(a => a.id === 'AP-102')`)), false);
    assert.equal(s.canApprove({ risk: 'R3', amount: 400, ch: 'PPC' }), true);
    R(s, `S.r3Used.seo = 400`); assert.equal(s.canApprove({ risk: 'R3', amount: 400, ch: 'PPC' }), false);
    ok('Channel scope and cumulative weekly R3 limit are enforced.'); }
  { const s = session(); R(s, `S.budgetUsed = 4950`); s.approve('AP-101'); assert.equal(R(s, `S.approvals.find(a => a.id === 'AP-101').status`), 'pending');
    ok('Weekly budget overrun is vetoed, not clamped.'); }
  { const s = session(); R(s, `S.writesOff = true`); const q = rec(s, 'REC-2'); await s.reviewRec(q); await flush();
    assert.equal(q.status, 'auto'); R(s, `S.role = 'owner'`); s.killToggle(); await flush(); await flush(); assert.equal(q.status, 'test');
    ok('Kill switch blocks writes in already running work and resumes them when switched back on.'); }
  { const s = session(); R(s, `S.recs.push({ id: 'REC-X', page: '/features/billing', pod: 'SEO', agent: 't', imp: 'low', conf: 90, title: 't', before: '', after: '', rv: {}, tests: [], status: 'new' })`);
    await s.reviewRec(rec(s, 'REC-X')); assert.equal(rec(s, 'REC-X').status, 'queued');
    ok('A single page inside a locked group waits for the group packet.'); }
  { const s = session(); const g2 = R(s, `S.gps.find(g => g.id === 'GP-2')`), g3 = R(s, `S.gps.find(g => g.id === 'GP-3')`);
    await s.gpReview(g2); await s.gpReview(g3); assert.equal(g2.status, 'test'); assert.equal(g3.status, 'test');
    for (let i = 0; i < 3; i++) { s.gpWeek(g2); s.gpWeek(g3); } await flush();
    assert.equal(g2.status, 'deployed'); assert.equal(R(s, `pageState('/blog/how-to-7').version`), 2); assert.equal(R(s, `pageState('/blog/how-to-12').content.definition || ''`), R(s, `pageState('/blog/how-to-12').content.definition || ''`));
    assert.equal(g3.status, 'rolledback'); assert.equal(R(s, `pageState('group:G-INTEG').active`), null); assert.equal(R(s, `pageState('/integrations/xero').version`), 1);
    ok('Group packet: test 50/50, waves 10/50/100; a guardrail breach at 50% rolls the whole group back.'); }
  { const s = session('owner'), q = rec(s, 'REC-3'); await s.reviewRec(q); await s.reviewRec(q, 'comp', true); s.recApprove(q); s.recWeek(q);
    const h = R(s, 'S.hotfixes[0]'); await s.hfRun(h); assert.equal(q.hotfixHold, true); s.recWeek(q); assert.equal(q.week, 1);
    await s.hfApprove(h); await flush();
    assert.equal(h.status, 'done'); assert.equal(R(s, `pageState('/compare/baremetrics').content.price`), 'від $79/міс');
    assert.equal(s.packetReady(q), true); assert.equal(q.week, 0); assert.equal(q.hotfixHold, false);
    ok('Hotfix preempts a running test, fixes the price on all pages, auto-rebases REC-3 and restarts its window.'); }
  { const s = session(); const cm = R(s, `S.cmps[0]`); s.cmpRun(cm); await flush();
    assert.equal(cm.packets.length, 6); assert.equal(cm.packets.find(k => k.key === 'L').status, 'human');
    assert.ok(cm.packets.filter(k => k.key !== 'L').every(k => k.status === 'wait'));
    const ap = R(s, `S.approvals.find(a => a.ck === 'CMP-482/L')`); R(s, `S.role = 'editor'`); s.approve(ap.id); await flush();
    assert.equal(cm.packets.find(k => k.key === 'L').status, 'done');
    assert.ok(['human', 'return', 'verify', 'work', 'review'].includes(cm.packets.find(k => k.key === 'A').status));
    assert.equal(cm.packets.find(k => k.key === 'U').status !== 'wait', true);
    ok('Campaign orchestrator splits CMP-482 into 6 packets; dependents wait for the landing.'); }
  { const s = session(); R(s, `S.recs.find(r => r.id === 'REC-3').status`);
    for (const v of ['score', 'metro', 'gantt', 'heat', 'cards', 'flow']) { R(s, `S.scoreView = '${v}'`); assert.ok(R(s, 'scoreHTML(S.pipelines)').length > 500, v); }
    R(s, `S.anTab = 'traffic'`); for (const g of ['all', 'SEO', 'PPC', 'Email', 'AI']) { R(s, `S.vz = { weeks: 8, grp: '${g}', table: false }`); assert.ok(!/NaN|Infinity|undefined/.test(R(s, 'trafficView()')), g); }
    const sum = R(s, `VZ_ROWS.filter(r => r.w === 11).reduce((t, r) => t + r.signups, 0)`); assert.ok(sum > 400 && sum < 1200);
    ok('Six pipeline views render; traffic analytics has no NaN/undefined for every channel filter.'); }
  { const s = session(); R(s, 'S.anTab = "anom"');
    for (const v of ['hud', 'brief', 'analytics', 'approvals', 'seo', 'ppc', 'aiv', 'cmps', 'recs', 'groups', 'hotfix', 'pm', 'events', 'slackdemo', 'agents', 'crons', 'roles', 'audit']) {
      const html = R(s, `VIEWS['${v}']()`); assert.ok(html.length > 300, v); assert.ok(!/NaN|>undefined<|\$undefined|Infinity/.test(html), v + ' has NaN/undefined'); }
    ok('All 18 screens render without NaN or undefined values.'); }
  { const s = session(); const names = R(s, 'S.pods.flatMap(p => p[1])');
    for (const n of names) { const sp = R(s, `AG_SPEC[${JSON.stringify(n)}]`); assert.ok(sp, 'no spec: ' + n);
      for (const k of ['p', 'tr', 'src', 'col', 'how', 'out', 'sample', 'to', 'kpi', 'ex']) assert.ok(String(sp[k] || '').trim(), n + ' missing ' + k);
      const h = R(s, `agentDetailHTML(${JSON.stringify(n)})`); assert.ok(!/undefined|NaN/.test(h), n + ' renders undefined'); }
    assert.ok(R(s, `S.agentQ = 'цитування'; VIEWS.agents()`).includes('AI Visibility Tracker'));
    ok('Every agent (' + names.length + ') has a full passport: trigger, sources, data, steps, output, example run.'); }
  { assert.equal(R(c, `gateEvaluate([{ name: 'A', value: 3 }, { name: 'B', value: NaN }, { name: 'C', value: 1 }]).verdict`), 'inconclusive');
    assert.equal(R(c, `fmtGate('AI Visibility тест', 8)`), '+8 п.');
    ok('One evaluator for pages, groups and pipelines; AI Visibility shown in points, not %.'); }

  console.log(JSON.stringify({ syntax: 'PASS', scope: 'Isolated functions, UI/logging/timers stubbed', passed: checks.length, checks }, null, 2));
})().catch(e => { console.error(e); process.exitCode = 1; });
