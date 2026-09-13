import fs from 'node:fs';
const p0 = 0.25;
const post = (h,n) => (1+h)/(4+n);
const ci = (h,n) => { const m=post(h,n); const s=Math.sqrt(m*(1-m)/(n+5)); return [Math.max(0,m-1.645*s), Math.min(1,m+1.645*s)]; };
const pct = x => Math.round(x*100)+'%';
const ramp = ['#cde2fb','#b7d3f6','#9ec5f4','#86b6ef','#6da7ec','#5598e7','#3987e5','#2a78d6','#256abf','#1c5cab','#184f95','#104281','#0d366b'];
const rampAt = m => ramp[Math.min(ramp.length-1, Math.max(0, Math.round((m-0.05)/0.6*(ramp.length-1))))];
const MIN=5;

const hooks = [['negative_warning',9,22],['contrarian',5,14],['bold_claim',9,27],['question',8,30],['curiosity_gap',4,18],['story_open',1,7],['list_promise',1,8],['direct_address',1,3],['demonstration',0,2]];
const beats = ['context','problem','counter_positioning','proof','steps','example','payoff','cta','aside'];

// ---- dimension explorer bars ----
const sorted = [...hooks].sort((a,b)=>post(b[1],b[2])-post(a[1],a[2]));
const W=560; // px for 100%
const bars = sorted.map(([k,h,n])=>{
  const m=post(h,n); const [lo,hi]=ci(h,n); const dim=n<MIN;
  return `<div style="display:flex;align-items:center;gap:12px;height:28px;opacity:${dim?0.4:1}">
    <div class="mono" style="width:150px;font-size:12px;text-align:right;color:#0a0a0a">${k}</div>
    <div style="position:relative;flex-grow:1;height:28px">
      <div style="position:absolute;left:0;top:0;bottom:0;width:1px;background:#c3c2b7"></div>
      <div style="position:absolute;left:${Math.round(p0*W)}px;top:0;bottom:0;width:1px;border-left:1px dashed #c3c2b7"></div>
      <div style="position:absolute;left:0;top:6px;height:16px;width:${Math.round(m*W)}px;background:#2a78d6;border-radius:0 4px 4px 0"></div>
      <div style="position:absolute;left:${Math.round(lo*W)}px;top:13px;height:2px;width:${Math.round((hi-lo)*W)}px;background:#525252"></div>
      <div style="position:absolute;left:${Math.round(Math.max(m,hi)*W)+10}px;top:5px;font-size:12px;white-space:nowrap" class="tnum"><b style="font-weight:600">${pct(m)}</b> <span class="muted">${h}/${n}${dim?' · low sample':''}</span></div>
    </div>
  </div>`;
}).join('\n');

// ---- heatmap ----
// deterministic fake counts
let seed=7; const rnd=()=>{seed=(seed*9301+49297)%233280;return seed/233280;};
const cells={};
for (const [hk,,hn] of hooks) for (const b of beats) {
  let n=Math.round(rnd()*Math.min(hn,14)); if(rnd()<0.18) n=0;
  let h=Math.round(n*(0.12+rnd()*0.4));
  cells[hk+'|'+b]=[h,n];
}
cells['negative_warning|counter_positioning']=[0,0];
cells['question|steps']=[3,4];
cells['bold_claim|proof']=[11,24];
cells['negative_warning|proof']=[7,15];
cells['contrarian|counter_positioning']=[5,9];
cells['story_open|payoff']=[1,6];
const cellW=64, cellH=40;
let heat=`<div style="display:grid;grid-template-columns:150px repeat(${beats.length}, ${cellW}px);gap:2px;align-items:center">`;
heat+=`<div></div>`+beats.map(b=>`<div class="mono" style="font-size:10px;color:#737373;text-align:center;line-height:1.2;height:28px;display:flex;align-items:flex-end;justify-content:center">${b.replace('_','_<br>')}</div>`).join('');
for (const [hk] of hooks) {
  heat+=`<div class="mono" style="font-size:12px;text-align:right;padding-right:8px">${hk}</div>`;
  for (const b of beats) {
    const [h,n]=cells[hk+'|'+b]; const m=post(h,n); const op=Math.min(1,n/(2*MIN));
    const bg = n===0?'#fafafa':rampAt(m);
    const ink = n>0 && op>0.6 && m>0.35 ? '#fff' : '#0a0a0a';
    const inner = n===0?`<span style="color:#c3c2b7;font-size:10px">—</span>`:`<div style="font-weight:600;font-size:12px" class="tnum">${pct(m)}</div><div class="tnum" style="font-size:10px;opacity:.8">${h}/${n}</div>`;
    const ring = (hk==='bold_claim'&&b==='proof')?'outline:2px solid #0a0a0a;outline-offset:-2px;':'';
    heat+=`<div style="width:${cellW}px;height:${cellH}px;border-radius:4px;background:${bg};position:relative;${ring}"><div style="position:absolute;inset:0;background:${bg};opacity:${n===0?1:op};border-radius:4px"></div><div style="position:absolute;inset:0;background:#fff;opacity:${n===0?0:(1-op)*0.85};border-radius:4px"></div><div style="position:relative;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:${ink};line-height:1.1">${inner}</div></div>`;
  }
}
heat+='</div>';

const legend = `<div class="row" style="gap:16px;font-size:11px;color:#737373">
  <div class="row" style="gap:4px"><span>hit rate</span>${['#cde2fb','#86b6ef','#3987e5','#1c5cab','#0d366b'].map(c=>`<span style="width:14px;height:10px;background:${c};border-radius:2px;display:inline-block"></span>`).join('')}<span>5% → 65%</span></div>
  <div class="row" style="gap:4px"><span>opacity = sample size, full at n ≥ 10</span></div>
  <div class="row" style="gap:4px"><span style="width:14px;height:10px;background:#fafafa;border:1px solid #e5e5e5;border-radius:2px;display:inline-block"></span><span>never combined</span></div>
</div>`;

// ---- suggestion cards ----
const cards = [
 {kind:'Untested synergy', a:'hook: negative_warning', b:'beat: counter_positioning', body:'Negative-warning hooks hit <b>38%</b> (9/22) and counter-positioning beats hit <b>35%</b> (6/16), but you have never combined them. If the effects are independent the pair should land near <b>50%</b>.', foot:'Make 6 reels to find out.', n:'0 videos'},
 {kind:'High uncertainty', a:'hook: question', b:'beat: steps', body:'Question hooks followed by a steps beat hit <b>3 of 4</b>. Raw that is 75%, but after shrinkage it is <b>50%</b> with a 90% interval of <b>23%–77%</b>. Four more videos would narrow it enough to act on.', foot:'Make 4 more reels to narrow it.', n:'4 videos'},
 {kind:'Confirmation', a:'hook: bold_claim', b:'beat: proof', body:'Bold claims backed by a proof beat hit <b>43%</b> over 24 videos (interval <b>28%–58%</b>). That is retrospective. A prospective run is the only way it counts.', foot:'Make 6 reels, tagged, to confirm.', n:'24 videos'},
];
const cardsHtml = cards.map(c=>`<div class="card" style="display:flex;flex-direction:column;flex:1 1 0;min-width:0">
  <div class="card-h"><div class="row" style="justify-content:space-between"><span class="badge sec">${c.kind}</span><span class="sub tnum">${c.n}</span></div>
  <div class="row" style="gap:6px;margin-top:8px;flex-wrap:wrap"><span class="chip">${c.a}</span><span class="muted">×</span><span class="chip">${c.b}</span></div></div>
  <div class="card-c" style="display:flex;flex-direction:column;gap:12px;flex-grow:1">
    <p style="margin:0;font-size:12px;line-height:1.55">${c.body}</p>
    <p style="margin:0;font-size:12px;color:#737373;flex-grow:1">${c.foot}</p>
    <div class="row"><a class="btn" href="#">Accept as hypothesis</a><a class="btn ghost" href="#">Dismiss</a></div>
  </div></div>`).join('\n');

// ---- stat row ----
const stats = [['Reels analysed','131','12 excluded, under 7 days'],['Baseline (median of last 20)','18.4K views','saves 412 · shares 96'],['Hit threshold','≥ 1.9× baseline','top quartile of log ratio'],['Base hit rate','25%','by construction'],['Combinations screened','216','~11 will look good by chance']];
const statsHtml = stats.map(([l,v,s])=>`<div class="card" style="flex:1 1 0;padding:14px 16px;display:flex;flex-direction:column;gap:2px"><div class="sub">${l}</div><div style="font-size:20px;font-weight:600;line-height:1.2">${v}</div><div class="sub">${s}</div></div>`).join('');

// ---- top videos ----
const vids = [
 ['Stop batching your content if you actually want to grow','negative_warning','61.2K','3.3×','2,140','Aug 2'],
 ['Nobody is going to tell you this about AI tools','curiosity_gap','54.8K','3.0×','1,890','Jul 19'],
 ['Your morning routine is why you have no ideas','negative_warning','47.1K','2.6×','1,402','Aug 21'],
 ['I built the same app twice. Here is what changed','story_open','44.9K','2.5×','1,310','Jun 30'],
 ['This is the only prompt structure that works','bold_claim','41.3K','2.3×','1,655','Aug 9'],
 ['Why are your reels dying at 3 seconds?','question','39.7K','2.2×','980','Jul 4'],
 ['Everyone says post daily. That advice is killing you','contrarian','37.2K','2.1×','1,120','Aug 15'],
 ['Three tools I would delete tomorrow','list_promise','35.0K','1.9×','1,044','Jul 27'],
];
const vidsHtml = vids.map((v,i)=>`<tr><td class="num muted">${i+1}</td><td><div class="row" style="gap:10px"><div class="thumb"></div><div style="min-width:0"><div style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:520px">“${v[0]}”</div><div class="sub">${v[5]} · <a href="#" style="color:#737373">open on Instagram</a></div></div></div></td><td><span class="chip">${v[1]}</span></td><td class="num">${v[2]}</td><td class="num" style="font-weight:600">${v[3]}</td><td class="num">${v[4]}</td></tr>`).join('');

const body = `<!--NAV:A-->
<div class="page">
  <div class="row" style="justify-content:space-between;align-items:flex-end">
    <div><h1 class="h1">What to test next</h1><div class="sub">Ranked by Thompson draw × coverage. These are hypotheses, not findings. Accepting one tracks it on the Hypotheses page.</div></div>
    <a class="btn ghost" href="#">Reshuffle</a>
  </div>
  <div style="display:flex;gap:16px">${cardsHtml}</div>

  <div style="display:flex;gap:16px">${statsHtml}</div>

  <div class="card">
    <div class="card-h" style="flex-direction:row;justify-content:space-between;align-items:flex-start">
      <div><div class="card-t">Hit rate by label</div><div class="card-d">Posterior mean with 90% interval. Bars under 5 videos are dimmed. Dashed line is the 25% base rate.</div></div>
      <div class="row"><div class="sel">Hook device <svg class="ico" viewBox="0 0 16 16" fill="none" stroke="#737373" stroke-width="1.5"><path d="M4 6l4 4 4-4"></path></svg></div><div class="sel">Views <svg class="ico" viewBox="0 0 16 16" fill="none" stroke="#737373" stroke-width="1.5"><path d="M4 6l4 4 4-4"></path></svg></div></div>
    </div>
    <div class="card-c" style="display:flex;flex-direction:column;gap:4px;max-width:820px">${bars}</div>
  </div>

  <div class="card">
    <div class="card-h" style="flex-direction:row;justify-content:space-between;align-items:flex-start">
      <div><div class="card-t">Hook device × beat</div><div class="card-d">Colour is the posterior hit rate on views, opacity is how many videos back it. Pale cells are coverage gaps. Click a cell to see its videos.</div></div>
      <div class="row"><div class="sel">Views <svg class="ico" viewBox="0 0 16 16" fill="none" stroke="#737373" stroke-width="1.5"><path d="M4 6l4 4 4-4"></path></svg></div></div>
    </div>
    <div class="card-c" style="display:flex;flex-direction:column;gap:12px">${heat}${legend}</div>
  </div>

  <div class="card">
    <div class="card-h" style="flex-direction:row;justify-content:space-between;align-items:flex-start">
      <div><div class="card-t">Best performing reels</div><div class="card-d">By views relative to the baseline at the time of posting. Read the hooks side by side.</div></div>
      <div class="row"><div class="sel">Views <svg class="ico" viewBox="0 0 16 16" fill="none" stroke="#737373" stroke-width="1.5"><path d="M4 6l4 4 4-4"></path></svg></div><a class="btn outline" href="#">All videos</a></div>
    </div>
    <table><thead><tr><th style="width:32px">#</th><th>Hook</th><th>Device</th><th class="num">Views</th><th class="num">vs baseline</th><th class="num">Saves</th></tr></thead><tbody>${vidsHtml}</tbody></table>
  </div>
</div>`;
fs.writeFileSync('Main.body.html', body);
console.log('main ok');
