// ═══════════════════════════════════
//  SHARED PERSISTENT STATE
//  (survives login/logout switches)
// ═══════════════════════════════════
const SHARED = {
  msgs:[], actionLog:[], trendHist:[],
  userStats:{},
  burstBuf:[],
  stats:{total:0,hate:0,off:0,normal:0,deleted:0,warned:0,actions:0,escalations:0},
  isFrozen:false,      // ← ADMIN ONLY, persists across session switches
  isShadow:false,
  curAction:null,
  escActive:false,
  escCount:0,
  THRESH:5
};

// ═══════════════════════════════════
//  GLOBAL STATE  (per-session)
// ═══════════════════════════════════
const G = {
  me:null, role:null,
  notifs:[],
  filter:'all',
  simTimer:null,
  // shortcuts to SHARED (read/write through SHARED directly)
  get msgs(){return SHARED.msgs;},
  get actionLog(){return SHARED.actionLog;},
  get trendHist(){return SHARED.trendHist;},
  get userStats(){return SHARED.userStats;},
  get burstBuf(){return SHARED.burstBuf;},
  get stats(){return SHARED.stats;},
  get isFrozen(){return SHARED.isFrozen;},
  set isFrozen(v){SHARED.isFrozen=v;},
  get isShadow(){return SHARED.isShadow;},
  set isShadow(v){SHARED.isShadow=v;},
  get curAction(){return SHARED.curAction;},
  set curAction(v){SHARED.curAction=v;},
  get escActive(){return SHARED.escActive;},
  set escActive(v){SHARED.escActive=v;},
  get THRESH(){return SHARED.THRESH;},
};

const COLORS = {user1:'#5b8df6',user2:'#3ecf8e',user3:'#f5923e',user4:'#9b72f5',admin:'#f04747'};
const H_KW = ['kill','deport','hate','filth','disgust','animal','vermin','foreigner','immigrants','exterminate','lynch','subhuman','genocide','destroy all'];
const O_KW = ['bitch','idiot','stupid','moron','fuck','shit','braindead','loser','jerk','shut up','clown','dumb','asshole','retard'];

// ═══════════════════════════════════
//  CLASSIFIER
// ═══════════════════════════════════
function classify(text){
  const t = text.toLowerCase();
  const h = H_KW.filter(w=>t.includes(w)).length;
  const o = O_KW.filter(w=>t.includes(w)).length;
  if(h>=1){const s=Math.min(.97,.52+h*.15+Math.random()*.07);return{label:'hate',score:s}}
  if(o>=1){const s=Math.min(.97,.47+o*.13+Math.random()*.07);return{label:'offensive',score:s}}
  const s=Math.min(.95,.70+Math.random()*.14);return{label:'normal',score:s}
}

// ═══════════════════════════════════
//  AUTH
// ═══════════════════════════════════
let selRole='user';
function pickRole(r){
  selRole=r;
  ['lr-u','lr-a'].forEach((id,i)=>document.getElementById(id).classList.toggle('sel',(i===0&&r==='user')||(i===1&&r==='admin')));
  document.getElementById('l-name').value=r==='admin'?'admin':'user2';
}
function doLogin(){
  const name=(document.getElementById('l-name').value||'user').trim();
  G.me=name; G.role=selRole;
  const rb=document.getElementById('t-rb');
  rb.textContent=selRole==='admin'?'Admin':'Utilisateur';
  rb.className='tbadge '+(selRole==='admin'?'tbadge-a':'tbadge-u');
  document.getElementById('t-un').textContent=name;
  const av=document.getElementById('t-av');
  av.textContent=name.substring(0,2).toUpperCase();
  av.style.background=(COLORS[name]||'#5b8df6')+'22';
  av.style.color=COLORS[name]||'#5b8df6';
  document.getElementById('t-anav').style.display=selRole==='admin'?'flex':'none';
  document.getElementById('t-bell').style.display=selRole==='admin'?'flex':'none';
  document.getElementById('scr-login').classList.remove('on');
  document.getElementById('shell').classList.add('on');
  if(selRole==='user') initUser();
  else initAdmin();
  scheduleNextSim(); // first message after ~4s, then random 6–11s
}
function doLogout(){
  clearInterval(G.simTimer);
  // Only reset session-specific state; SHARED (msgs, isFrozen, etc.) persists across switches
  G.me=null; G.role=null; G.notifs=[]; G.filter='all'; G.simTimer=null;
  document.getElementById('shell').classList.remove('on');
  document.getElementById('scr-login').classList.add('on');
  document.getElementById('v-user').classList.remove('on');
  document.getElementById('v-admin').classList.remove('on');
}

// ═══════════════════════════════════
//  ADMIN TABS  (no innerHTML rebuild)
// ═══════════════════════════════════
function adminTab(tab, el){
  ['live','historique','analytics'].forEach(t=>{
    const c=document.getElementById('at-'+t+'-c');
    if(c) c.classList.toggle('on',t===tab);
    const a=document.getElementById('at-'+t);
    if(a) a.classList.toggle('on',t===tab);
  });
  document.querySelectorAll('.tnav-item').forEach(t=>t.classList.remove('on'));
  if(el) el.classList.add('on');
  if(tab==='historique') renderHistorique();
  if(tab==='analytics'){setTimeout(()=>{drawCM();drawROC();drawHistChart();},30);}
}

// ═══════════════════════════════════
//  CORE addMsg  (shared state)
// ═══════════════════════════════════
const SEED=[
  {user:'user1',text:'Hey everyone! Good morning 😊'},
  {user:'user3',text:'Great to see you all here!'},
  {user:'user1',text:'Did anyone catch the game last night?'},
];
function addMsg(user,text){
  const cl=classify(text);
  const id='m'+Date.now()+Math.random().toString(36).slice(2,5);
  const ts=nowTs();
  const msg={id,user,text,label:cl.label,score:cl.score,ts,decided:null};
  G.msgs.push(msg);
  G.trendHist.push(cl.label);
  if(G.trendHist.length>20) G.trendHist.shift();
  G.stats.total++;
  if(cl.label==='hate') G.stats.hate++;
  else if(cl.label==='offensive') G.stats.off++;
  else G.stats.normal++;
  if(!G.userStats[user]) G.userStats[user]={total:0,hate:0,off:0,normal:0,warned:0,deleted:0};
  G.userStats[user].total++;
  G.userStats[user][cl.label==='normal'?'normal':cl.label==='offensive'?'off':'hate']++;
  if(cl.label!=='normal'){
    G.burstBuf.push(Date.now());
    G.burstBuf=G.burstBuf.filter(t=>Date.now()-t<60000);
  }
  if(G.role==='user') appendUserMsg(msg);
  if(G.role==='admin'){appendAdminCard(msg);updateKPIs();}
  checkEsc();
  return msg;
}

// ═══════════════════════════════════
//  USER VIEW
// ═══════════════════════════════════
function initUser(){
  document.getElementById('v-user').classList.add('on');
  renderOL();
  // Restore frozen UI if admin had frozen before we switched
  if(SHARED.isFrozen){
    const fw=document.getElementById('freeze-bar');if(fw)fw.style.display='flex';
    const ci=document.getElementById('cinput');if(ci)ci.disabled=true;
    const cs=document.getElementById('csend');if(cs)cs.disabled=true;
    const ch=document.getElementById('chint');if(ch)ch.textContent='Discussion gelée par les modérateurs.';
    setTimeout(()=>showUWarn('❄ La discussion a été gelée par un modérateur. Les nouveaux messages sont temporairement bloqués.'),400);
  }
  // If we already have messages (returning user), render them; otherwise seed
  if(SHARED.msgs.length>0){
    renderUserFeed();
  } else {
    SEED.forEach((m,i)=>setTimeout(()=>addMsg(m.user,m.text),i*280));
  }
}
function renderOL(){
  document.getElementById('ol-list').innerHTML=['user1','user2','user3','user4'].map(u=>
    `<div class="ol-user">
      <div class="av" style="background:${COLORS[u]}22;color:${COLORS[u]}">${u.substring(0,2).toUpperCase()}</div>
      <span>${u}</span><div style="width:7px;height:7px;border-radius:50%;background:var(--grn);margin-left:auto"></div>
    </div>`).join('');
}
function userDeleteOwnMsg(id){
  const m=G.msgs.find(x=>x.id===id);if(!m||m.user!==G.me)return;
  m.decided='deleted';
  G.stats.deleted++;G.stats.actions++;
  if(G.userStats[m.user])G.userStats[m.user].deleted++;
  renderUserFeed();
  updateUserScore();
}
function buildUserMsgHTML(msg){
  const own=msg.user===G.me;
  const modCls=msg.decided==='deleted'?' blocked':msg.decided==='warned'?' flagged':'';
  const chip=msg.label==='hate'?`<span class="mchip ch-h">Haineux</span>`:msg.label==='offensive'?`<span class="mchip ch-w">Offensif</span>`:'';
  const txt=msg.decided==='deleted'?`<i style="color:var(--red);font-size:11px">Message supprimé</i>`:esc(msg.text);
  // For own warned messages: show warn badge + option to delete
  const warnActions=(own && msg.decided==='warned' && msg.label!=='normal')
    ?`<div style="margin-top:5px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <span style="font-size:10px;color:var(--ora);font-weight:600">⚠ Signalé — visible par les modérateurs</span>
        <button onclick="userDeleteOwnMsg('${msg.id}')" style="font-size:10px;padding:2px 7px;border:1px solid var(--red);background:transparent;color:var(--red);border-radius:4px;cursor:pointer">🗑 Supprimer</button>
      </div>`
    :'';
  const div=document.createElement('div');
  div.className=`msg ${own?'own':'other'}${modCls}`;div.id='umsg-'+msg.id;
  div.innerHTML=`<div class="mav" style="background:${COLORS[msg.user]||'#888'}22;color:${COLORS[msg.user]||'#888'}">${msg.user.substring(0,2).toUpperCase()}</div>
    <div class="mbub">${!own?`<div class="mname">${esc(msg.user)}</div>`:''}
      <div class="mtext">${txt}</div>
      <div class="mmeta"><span class="mts">${msg.ts}</span>${own?chip:''}</div>
      ${warnActions}
    </div>`;
  return div;
}
function appendUserMsg(msg){
  const el=document.getElementById('msgs');
  const div=buildUserMsgHTML(msg);
  el.appendChild(div);
  el.scrollTop=el.scrollHeight;
  updateUserScore();
}
function renderUserFeed(){
  // re-render all messages (called after moderation actions)
  const el=document.getElementById('msgs');
  el.innerHTML='';
  const visible=G.isShadow?G.msgs.filter(m=>m.user===G.me||m.label==='normal'):G.msgs;
  visible.forEach(m=>{ el.appendChild(buildUserMsgHTML(m)); });
  el.scrollTop=el.scrollHeight;
  updateUserScore();
}
function updateUserScore(){
  const mine=G.msgs.filter(m=>m.user===G.me),t=mine.length||1;
  const n=mine.filter(m=>m.label==='normal').length;
  const o=mine.filter(m=>m.label==='offensive').length;
  const h=mine.filter(m=>m.label==='hate').length;
  const np=Math.round(n/t*100),op=Math.round(o/t*100),hp=Math.round(h/t*100);
  const tox=Math.round((o+h)/t*100);
  const color=tox>50?'var(--red)':tox>20?'var(--ora)':'var(--grn)';
  const arc=document.getElementById('sarc');
  if(arc){arc.style.strokeDashoffset=138.2*(1-tox/100);arc.style.stroke=color;}
  setText('spct',tox+'%');
  const sp=document.getElementById('spct');if(sp)sp.style.color=color;
  setText('sn',np+'%');setText('so',op+'%');setText('sh',hp+'%');
  const bn=document.getElementById('sbn'),bo=document.getElementById('sbo'),bh=document.getElementById('sbh');
  if(bn)bn.style.width=np+'%';if(bo)bo.style.width=op+'%';if(bh)bh.style.width=hp+'%';
  const s=G.userStats[G.me]||{};
  setText('ms-s',s.total||0);setText('ms-o',s.normal||0);setText('ms-w',s.warned||0);setText('ms-d',s.deleted||0);
}
function sendMsg(){
  if(G.isFrozen){showUWarn('❄ Discussion gelée. Impossible d\'envoyer des messages.');return;}
  const inp=document.getElementById('cinput');
  const t=inp.value.trim();if(!t)return;
  inp.value='';document.getElementById('csend').disabled=true;
  const msg=addMsg(G.me,t);
  if(msg.label==='hate'){
    setTimeout(()=>showUWarn('⚠ Votre message a été signalé comme haineux par notre système de modération.'),350);
    pushNotif({type:'crit',title:'🚨 Message haineux — '+G.me,body:`"${t.substring(0,60)}"`,freeze:true});
  }else if(msg.label==='offensive'){
    pushNotif({type:'warn',title:'⚠ Contenu offensif — '+G.me,body:`"${t.substring(0,60)}"`,freeze:false});
  }
}
function showUWarn(t){
  const el=document.getElementById('uwarn');
  if(el._cur===t && el.style.display==='block') return;
  el._cur=t;
  el.textContent=t;el.style.display='block';
  clearTimeout(el._t);el._t=setTimeout(()=>{el.style.display='none';el._cur=null;},5000);
}

// ═══════════════════════════════════
//  ADMIN VIEW
// ═══════════════════════════════════
function initAdmin(){
  document.getElementById('v-admin').classList.add('on');
  // If messages already exist (coming back from user view), rebuild feed; otherwise seed
  if(SHARED.msgs.length>0){
    rebuildFeed(); updateKPIs();
    // Restore freeze banner if still frozen
    if(SHARED.isFrozen){
      const af=document.getElementById('admin-freeze-banner');
      if(af){
        af.style.display='flex';
        af.innerHTML=`<span style="font-size:22px">❄️</span>
          <div>
            <div style="font-size:13px;font-weight:700;color:var(--blu)">Discussion gelée — simulateur stoppé</div>
            <div style="font-size:11px;color:var(--t2);margin-top:3px">Le simulateur est arrêté. Aucun message ne peut être posté.</div>
          </div>
          <button onclick="doAction('clear-freeze')" style="margin-left:auto;border:1px solid var(--b2);background:var(--s3);color:var(--t1);border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer">Reprendre</button>`;
      }
      updateCtrlStatus('frozen');
    }
  } else {
    SEED.forEach((m,i)=>setTimeout(()=>addMsg(m.user,m.text),i*200));
  }
}
// append single card (fast path)
function appendAdminCard(msg){
  const el=document.getElementById('feed-cards');if(!el)return;
  const visible=G.filter==='all'||G.filter===msg.label;
  if(!visible)return;
  const color=msg.label==='hate'?'var(--red)':msg.label==='offensive'?'var(--ora)':'var(--grn)';
  const lblc=msg.label==='hate'?'lbl-hate':msg.label==='offensive'?'lbl-off':'lbl-norm';
  const pct=Math.round(msg.score*100);
  const div=document.createElement('div');
  div.className='afc '+msg.label;div.id='afc-'+msg.id;
  div.innerHTML=`<div class="afc-top">
    <div class="av" style="background:${COLORS[msg.user]||'#888'}22;color:${COLORS[msg.user]||'#888'}">${msg.user.substring(0,2).toUpperCase()}</div>
    <span class="afc-user">${esc(msg.user)}</span>
    <span class="afc-ts">${msg.ts}</span>
  </div>
  <div class="afc-text">${esc(msg.text.substring(0,130))}</div>
  <div class="afc-bot">
    <span class="lbl ${lblc}">${msg.label}</span>
    ${msg.label!=='normal'?`<button class="ab awrn" onclick="aWarn('${msg.id}','${msg.user}')">⚠ Warn</button>`:''}
    ${msg.label==='hate'?`<button class="ab adel" onclick="aDel('${msg.id}','${msg.user}')">🗑 Suppr</button>`:''}
    <button class="ab aok" onclick="aOk('${msg.id}')">✔ OK</button>
    <div class="cbar"><div class="cfill" style="width:${pct}%;background:${color}"></div></div>
    <span style="font-size:10px;color:var(--t2)">${pct}%</span>
  </div>`;
  // prepend (newest on top)
  el.insertBefore(div,el.firstChild);
  // keep max 50
  while(el.children.length>50) el.removeChild(el.lastChild);
  const tc=document.getElementById('atcnt');if(tc)tc.textContent=G.msgs.length;
}
// full rebuild for filter change
function rebuildFeed(){
  const el=document.getElementById('feed-cards');if(!el)return;
  el.innerHTML='';
  const src=G.filter==='all'?G.msgs:G.msgs.filter(m=>m.label===G.filter);
  src.slice().reverse().slice(0,50).forEach(msg=>{
    const color=msg.label==='hate'?'var(--red)':msg.label==='offensive'?'var(--ora)':'var(--grn)';
    const lblc=msg.label==='hate'?'lbl-hate':msg.label==='offensive'?'lbl-off':'lbl-norm';
    const pct=Math.round(msg.score*100);
    const div=document.createElement('div');
    div.className='afc '+msg.label;div.id='afc-'+msg.id;
    div.innerHTML=`<div class="afc-top">
      <div class="av" style="background:${COLORS[msg.user]||'#888'}22;color:${COLORS[msg.user]||'#888'}">${msg.user.substring(0,2).toUpperCase()}</div>
      <span class="afc-user">${esc(msg.user)}</span>
      <span class="afc-ts">${msg.ts}</span>
    </div>
    <div class="afc-text">${esc(msg.text.substring(0,130))}</div>
    <div class="afc-bot">
      <span class="lbl ${lblc}">${msg.label}</span>
      ${msg.label!=='normal'?`<button class="ab awrn" onclick="aWarn('${msg.id}','${msg.user}')">⚠ Warn</button>`:''}
      ${msg.label==='hate'?`<button class="ab adel" onclick="aDel('${msg.id}','${msg.user}')">🗑 Suppr</button>`:''}
      <button class="ab aok" onclick="aOk('${msg.id}')">✔ OK</button>
      <div class="cbar"><div class="cfill" style="width:${pct}%;background:${color}"></div></div>
      <span style="font-size:10px;color:var(--t2)">${pct}%</span>
    </div>`;
    el.appendChild(div);
  });
}
function filt(f,btn){
  G.filter=f;
  document.querySelectorAll('.fb').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');rebuildFeed();
}

// MODERATION ACTIONS on cards — use event delegation via onclick in HTML
function aWarn(id,user){
  const m=G.msgs.find(x=>x.id===id);if(!m)return;
  m.decided='warned';G.stats.warned++;G.stats.actions++;
  if(G.userStats[user])G.userStats[user].warned++;
  addLog('warn','Avertissement → '+user);
  // update card
  const card=document.getElementById('afc-'+id);
  if(card) card.style.opacity='.6';
  if(G.role==='user') renderUserFeed();
  updateKPIs();
}
function aDel(id,user){
  const m=G.msgs.find(x=>x.id===id);if(!m)return;
  m.decided='deleted';G.stats.deleted++;G.stats.actions++;
  if(G.userStats[user])G.userStats[user].deleted++;
  addLog('delete','Message supprimé ('+user+')');
  const card=document.getElementById('afc-'+id);
  if(card){card.style.opacity='.4';card.style.textDecoration='line-through';}
  if(G.role==='user') renderUserFeed();
  updateKPIs();
}
function aOk(id){
  const m=G.msgs.find(x=>x.id===id);if(!m)return;
  m.decided='approved';G.stats.actions++;
  const card=document.getElementById('afc-'+id);
  if(card){card.style.borderLeftColor='var(--grn)';card.style.opacity='.7';}
  updateKPIs();
}
function updateKPIs(){
  const t=G.stats.total||1,tx=G.stats.hate+G.stats.off;
  setText('k-tot',G.stats.total);setText('k-h',G.stats.hate);setText('k-o',G.stats.off);
  setText('k-a',G.stats.actions);setText('k-hp',Math.round(G.stats.hate/t*100)+'%');
  setText('k-op',Math.round(G.stats.off/t*100)+'%');setText('k-e',G.stats.escalations+' escalades');
  setText('k-tx',Math.round(tx/t*100)+'%');
  // also update hist kpis
  setText('hk-hate',G.stats.hate);setText('hk-off',G.stats.off);
  setText('hk-esc',G.stats.escalations);
  const toxUsers=Object.values(G.userStats).filter(u=>u.hate>0||u.off>1).length;
  setText('hk-users',toxUsers);
}
function updateDist(){
  const el=document.getElementById('dist-bars');if(!el)return;
  const t=G.stats.total||1;
  el.innerHTML=[{l:'Normal',v:G.stats.normal,c:'var(--grn)'},{l:'Offensif',v:G.stats.off,c:'var(--ora)'},{l:'Haineux',v:G.stats.hate,c:'var(--red)'}]
    .map(r=>{const p=Math.round(r.v/t*100);return`<div class="drow"><span class="dlbl">${r.l}</span><div class="dtrack"><div class="dfill" style="width:${p}%;background:${r.c}"></div></div><span class="dpct">${p}%</span></div>`;}).join('');
}

// ═══════════════════════════════════
//  ESCALATION — SEUIL 5 MSGS TOXIQUES
// ═══════════════════════════════════
let lastEscTs=0;
function checkEsc(){
  const toxic=G.msgs.filter(m=>m.label!=='normal').length;
  const t=G.stats.total||1;
  const pct=Math.round(toxic/t*100);
  const burst=G.burstBuf.length;
  const scores=G.msgs.filter(m=>m.label!=='normal').map(m=>m.score);
  const mean=scores.length?+(scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(2):0;
  const repeat=Object.values(G.userStats).filter(u=>u.hate>1||u.off>2).length;
  setText('eg-pct',pct+'%');
  setText('eg-toxic',toxic+'/'+G.THRESH);
  setText('eg-score',mean.toFixed(2));
  setText('eg-users',repeat);
  const bar=document.getElementById('esc-bar');
  const epct=document.getElementById('eg-pct');
  const triggered=toxic>=G.THRESH;
  if(triggered){
    if(bar){bar.className='esc-bar esc-crit';bar.innerHTML=`<div class="esc-icon">🚨</div><div><div class="esc-title">Escalade ! ${toxic} msgs toxiques</div><div class="esc-sub">Seuil de ${G.THRESH} atteint</div></div>`;}
    if(epct)epct.style.color='var(--red)';
    // show banner
    const banner=document.getElementById('esc-banner');
    if(banner){
      banner.style.display='block';
      setText('ebn-title','Escalade de toxicité détectée !');
      setText('ebn-body',`${toxic} messages toxiques (${pct}%) · ${burst} en 1 min · seuil de ${G.THRESH} msgs atteint\nChoisissez une action pour modérer la discussion.`);
    }
    if(!G.escActive||(Date.now()-lastEscTs>30000)){
      G.escActive=true;lastEscTs=Date.now();G.stats.escalations++;
      addLog('esc',`Escalade: ${toxic} msgs toxiques (${pct}%)`);
      pushNotif({type:'crit',title:'🚨 Escalade de toxicité',body:`${toxic} msgs toxiques (${pct}%) · burst: ${burst}/min`,freeze:true});
      updateKPIs();
    }
  }else if(pct>=15){
    if(bar){bar.className='esc-bar esc-warn';bar.innerHTML=`<div class="esc-icon">⚠️</div><div><div class="esc-title">Vigilance élevée</div><div class="esc-sub">${toxic}/${G.THRESH} msgs toxiques</div></div>`;}
    if(epct)epct.style.color='var(--ora)';
  }else{
    if(bar){bar.className='esc-bar esc-ok';bar.innerHTML=`<div class="esc-icon">✅</div><div><div class="esc-title">Thread normal</div><div class="esc-sub">${toxic}/${G.THRESH} msgs toxiques</div></div>`;}
    if(epct)epct.style.color='var(--grn)';
    G.escActive=false;
    const banner=document.getElementById('esc-banner');
    if(banner)banner.style.display='none';
  }
  updateDist();drawTrend();
}
function dismissBanner(){
  const banner=document.getElementById('esc-banner');
  if(banner)banner.style.display='none';
}

// ═══════════════════════════════════
//  ESCALATION ACTIONS — WORKING BUTTONS
// ═══════════════════════════════════
function doAction(type){
  const same=G.curAction===type;
  G.curAction=same?null:type;
  // update sidebar buttons
  const map={freeze:'eab-f',lock:'eab-l',shadow:'eab-s','warn-all':'eab-w'};
  const cls={freeze:'af',lock:'al',shadow:'as','warn-all':'aw'};
  const cbmap={freeze:'cb-freeze',lock:'cb-lock',shadow:'cb-shadow','warn-all':'cb-warn'};
  const cbcls={freeze:'active-freeze',lock:'active-lock',shadow:'active-shadow','warn-all':'active-warn'};
  Object.keys(map).forEach(k=>{
    const b=document.getElementById(map[k]);
    if(b) b.className='eab'+(G.curAction===k?' '+cls[k]:'');
    const cb=document.getElementById(cbmap[k]);
    if(cb) cb.classList.toggle(cbcls[k],G.curAction===k);
  });
  if(!G.curAction) return;
  const labels={freeze:'❄ Discussion gelée',lock:'🔒 Thread verrouillé',shadow:'👁 Shadow mod activée','warn-all':'⚠ Avertissement envoyé à tous'};
  addLog('action',labels[type]);G.stats.actions++;
  // apply effect
  if(type==='freeze'||type==='lock'){
    G.isFrozen=true;
    // Freeze user chat
    const fw=document.getElementById('freeze-bar');
    if(fw){fw.style.display='flex';
      const lbl=document.getElementById('freeze-bar-msg');
      if(lbl)lbl.textContent=type==='lock'?'🔒 Thread verrouillé par l\'administrateur':'❄️ Discussion gelée par l\'administrateur';
    }
    const ci=document.getElementById('cinput');if(ci)ci.disabled=true;
    const cs=document.getElementById('csend');if(cs)cs.disabled=true;
    const ch=document.getElementById('chint');if(ch)ch.textContent='Discussion gelée par les modérateurs.';
    // Show freeze banner in admin feed too
    const af=document.getElementById('admin-freeze-banner');
    if(af){
      af.style.display='flex';
      af.innerHTML=`<span style="font-size:22px">${type==='lock'?'🔒':'❄️'}</span>
        <div>
          <div style="font-size:13px;font-weight:700;color:${type==='lock'?'var(--red)':'var(--blu)'}">${type==='lock'?'Thread verrouillé — plus aucun nouveau message':'Discussion gelée — simulateur stoppé'}</div>
          <div style="font-size:11px;color:var(--t2);margin-top:3px">Le simulateur est arrêté. Aucun message ne peut être posté.</div>
        </div>
        <button onclick="doAction('clear-freeze')" style="margin-left:auto;border:1px solid var(--b2);background:var(--s3);color:var(--t1);border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer">Reprendre</button>`;
    }
    updateCtrlStatus(type==='freeze'?'frozen':'locked');
  }
  if(type==='clear-freeze'){
    G.isFrozen=false;G.curAction=null;
    const fw=document.getElementById('freeze-bar');if(fw)fw.style.display='none';
    const af=document.getElementById('admin-freeze-banner');if(af)af.style.display='none';
    const ci=document.getElementById('cinput');if(ci)ci.disabled=false;
    const cs=document.getElementById('csend');if(cs)cs.disabled=false;
    const ch=document.getElementById('chint');if(ch)ch.textContent='Entrée pour envoyer · Shift+Entrée nouvelle ligne';
    updateCtrlStatus('open');
    Object.keys(map).forEach(k=>{const b=document.getElementById(map[k]);if(b)b.className='eab';const cb=document.getElementById(cbmap[k]);if(cb)cb.className='ctrl-btn';});
    return;
  }
  if(type==='shadow'){
    G.isShadow=true;
    if(G.role==='user') renderUserFeed();
    updateCtrlStatus('shadow');
  }
  if(type==='warn-all'){
    G.msgs.filter(m=>m.label!=='normal'&&!m.decided).forEach(m=>{
      m.decided='warned';
      if(G.userStats[m.user])G.userStats[m.user].warned++;
    });
    G.stats.warned+=G.msgs.filter(m=>m.label!=='normal').length;
    if(G.role==='user') renderUserFeed();
    updateCtrlStatus('warned');
  }
  updateKPIs();
  addCtrlHist(labels[type]);
}
function updateCtrlStatus(state){
  const el=document.getElementById('ctrl-status');
  const ti=document.getElementById('cs-title');
  const su=document.getElementById('cs-sub');
  if(!el)return;
  const map={
    frozen:{cls:'cst-frozen',ic:'❄️',title:'Discussion gelée',sub:'Les nouveaux messages sont bloqués temporairement.'},
    locked:{cls:'cst-locked',ic:'🔒',title:'Thread verrouillé',sub:'Les commentaires sont définitivement fermés.'},
    shadow:{cls:'cst-shadow',ic:'👁',title:'Shadow modération active',sub:'Les msgs toxiques ne sont visibles que pour les admins.'},
    warned:{cls:'cst-open',ic:'⚠️',title:'Avertissement envoyé',sub:'Tous les utilisateurs actifs ont été avertis.'},
    open:{cls:'cst-open',ic:'🟢',title:'Discussion ouverte',sub:'Tous les utilisateurs peuvent poster des messages.'},
  };
  const s=map[state];if(!s)return;
  el.className='ctrl-status '+s.cls;
  el.querySelector('.cst-icon').textContent=s.ic;
  if(ti)ti.textContent=s.title;
  if(su)su.textContent=s.sub;
}
function addCtrlHist(action){
  const el=document.getElementById('ctrl-hist-list');if(!el)return;
  if(el.querySelector('div[style]')) el.innerHTML='';
  const div=document.createElement('div');div.className='chi';
  div.innerHTML=`<div class="chi-dot" style="background:var(--pur)"></div>
    <div class="chi-body"><div class="chi-action">${action}</div><div class="chi-ts">${nowTs()}</div></div>`;
  el.insertBefore(div,el.firstChild);
}

// ═══════════════════════════════════
//  HISTORIQUE TAB
// ═══════════════════════════════════
function renderHistorique(){
  updateKPIs();
  renderHateMsgs();
  renderUserProfiles();
}
function renderHateMsgs(){
  const el=document.getElementById('hate-msgs-list');if(!el)return;
  const hateMsgs=G.msgs.filter(m=>m.label==='hate');
  setText('hate-count-sub',hateMsgs.length+' message(s)');
  if(!hateMsgs.length){el.innerHTML='<div style="padding:16px;font-size:12px;color:var(--t2);text-align:center">Aucun message haineux détecté.</div>';return;}
  el.innerHTML=hateMsgs.slice().reverse().map(m=>`
    <div class="hate-msg-row">
      <div class="hmr-av">
        <div class="av" style="width:32px;height:32px;font-size:11px;background:${COLORS[m.user]||'#888'}22;color:${COLORS[m.user]||'#888'}">${m.user.substring(0,2).toUpperCase()}</div>
      </div>
      <div class="hmr-body">
        <div class="hmr-top">
          <span class="hmr-name">${esc(m.user)}</span>
          <span class="hmr-ts">${m.ts}</span>
          <span class="hmr-score">Score: ${Math.round(m.score*100)}%</span>
          ${m.decided?`<span style="font-size:10px;background:var(--grn2);color:var(--grn);border-radius:4px;padding:1px 6px">${m.decided}</span>`:''}
        </div>
        <div class="hmr-text">${esc(m.text)}</div>
        <div class="hmr-actions">
          <button class="hmr-btn hmr-ban" onclick="banUser('${m.user}')">🚫 Bannir ${esc(m.user)}</button>
          <button class="hmr-btn hmr-del" onclick="aDel('${m.id}','${m.user}');renderHistorique()">🗑 Supprimer</button>
        </div>
      </div>
    </div>`).join('');
}
function renderUserProfiles(){
  const el=document.getElementById('user-profiles');if(!el)return;
  const users=Object.entries(G.userStats);
  setText('user-count-sub',users.length+' utilisateur(s)');
  if(!users.length){el.innerHTML='<div style="padding:16px;font-size:12px;color:var(--t2)">Aucun utilisateur enregistré.</div>';return;}
  el.innerHTML=users.map(([u,s])=>{
    const t=s.total||1;
    const toxPct=Math.round((s.hate+s.off)/t*100);
    const color=toxPct>50?'var(--red)':toxPct>20?'var(--ora)':'var(--grn)';
    const status=toxPct>50?'danger':toxPct>20?'watch':'safe';
    const statusLabel=toxPct>50?'Dangereux':toxPct>20?'Surveillé':'Normal';
    return `<div class="uprof">
      <div class="uprof-top">
        <div class="av" style="width:32px;height:32px;font-size:11px;background:${COLORS[u]||'#888'}22;color:${COLORS[u]||'#888'}">${u.substring(0,2).toUpperCase()}</div>
        <div>
          <div class="uprof-name">${esc(u)}</div>
          <span class="uprof-status stat-${status}">${statusLabel}</span>
        </div>
      </div>
      <div class="uprof-stats">
        <div class="ups"><div class="ups-v">${s.total}</div><div class="ups-l">Total</div></div>
        <div class="ups"><div class="ups-v" style="color:var(--red)">${s.hate}</div><div class="ups-l">Haineux</div></div>
        <div class="ups"><div class="ups-v" style="color:var(--ora)">${s.off}</div><div class="ups-l">Offensifs</div></div>
      </div>
      <div class="tox-bar-wrap"><div class="tox-bar-fill" style="width:${toxPct}%;background:${color}"></div></div>
      <div class="tox-bar-lbl"><span>Score toxicité</span><span style="color:${color};font-weight:700">${toxPct}%</span></div>
      <div class="uprof-actions">
        <button class="uact uact-warn" onclick="warnUser('${u}')">⚠ Avertir</button>
        <button class="uact uact-ban" onclick="banUser('${u}')">🚫 Bannir</button>
      </div>
    </div>`;
  }).join('');
}
function warnUser(user){
  if(G.userStats[user])G.userStats[user].warned++;
  G.stats.warned++;G.stats.actions++;
  addLog('warn','Avertissement → '+user);
  updateKPIs();renderHistorique();
}
function banUser(user){
  G.stats.actions++;
  addLog('ban','Utilisateur banni → '+user);
  updateKPIs();renderHistorique();
  showToast({type:'crit',body:user+' a été banni de la discussion.',freeze:false});
}

// ═══════════════════════════════════
//  NOTIFICATIONS
// ═══════════════════════════════════
const _notifCooldown={};  // key → last timestamp, throttle repeat alerts
function pushNotif(n){
  const now=Date.now();
  const key=(n.type||'')+(n.title||'').slice(0,25);
  if(_notifCooldown[key] && now-_notifCooldown[key]<20000) return;
  _notifCooldown[key]=now;
  G.notifs.unshift({...n,read:false,ts:nowTs()});
  updateBell();renderNotifList();showToast(n);
}
function updateBell(){
  const u=G.notifs.filter(n=>!n.read).length;
  const b=document.getElementById('bell-b');
  if(b){b.textContent=u;b.classList.toggle('on',u>0);}
  setText('ncnt',G.notifs.filter(n=>!n.read).length);
}
function markRead(){G.notifs.forEach(n=>n.read=true);updateBell();renderNotifList();}
function renderNotifList(){
  const el=document.getElementById('nlist');if(!el)return;
  if(!G.notifs.length){el.innerHTML='<div style="padding:10px 12px;font-size:11px;color:var(--t2)">Aucune alerte.</div>';return;}
  el.innerHTML=G.notifs.slice(0,8).map(n=>`
    <div class="ni${n.read?'':' unread'}">
      <div class="ni-dot" style="background:${n.type==='crit'?'var(--red)':'var(--ora)'}"></div>
      <div><div class="ni-title">${esc(n.title)}</div><div class="ni-sub">${esc(n.body)} · ${n.ts}</div></div>
    </div>`).join('');
}
function showToast(n){
  const c=document.getElementById('toast-root');
  const d=document.createElement('div');d.className='toast';
  d.innerHTML=`<div class="toast-badge ${n.type}">${n.type==='crit'?'🚨 Alerte critique':'⚠ Avertissement'}</div>
    <div class="toast-body">${esc(n.body)}</div>
    <div class="toast-acts">
      <button class="tact" onclick="killToast(this.closest('.toast'))">Ignorer</button>
      ${(n.freeze && G.role==='admin')?`<button class="tact prim" onclick="killToast(this.closest('.toast'));doAction('freeze')">❄ Geler</button>`:''}
    </div>`;
  c.appendChild(d);setTimeout(()=>killToast(d),8000);
}
function killToast(el){if(!el)return;el.classList.add('out');setTimeout(()=>el&&el.parentNode&&el.remove(),300);}

// ═══════════════════════════════════
//  ACTION LOG
// ═══════════════════════════════════
function addLog(type,msg){
  G.actionLog.unshift({type,msg,ts:nowTs()});renderLog();
}
function renderLog(){
  const el=document.getElementById('log-list');if(!el)return;
  const cols={warn:'var(--ora)',delete:'var(--red)',action:'var(--blu)',esc:'var(--pur)',approve:'var(--grn)',ban:'var(--red)'};
  el.innerHTML=G.actionLog.slice(0,15).map(l=>`
    <div class="li">
      <div class="li-dot" style="background:${cols[l.type]||'var(--t2)'}"></div>
      <div class="li-msg">${esc(l.msg)}</div>
      <div class="li-ts">${l.ts}</div>
    </div>`).join('');
}

// ═══════════════════════════════════
//  SIMULATION
// ═══════════════════════════════════
const SIM=[
  // Normal (~65%)
  {u:'user1',t:'Has anyone tried the new coffee place downtown?'},
  {u:'user3',t:'Good morning! Hope everyone has a great day'},
  {u:'user4',t:'Just finished a great book, highly recommend it'},
  {u:'user1',t:'Anyone watching the championship tonight?'},
  {u:'user3',t:'The weather has been amazing this week'},
  {u:'user2',t:'I totally agree with what you said earlier'},
  {u:'user4',t:'Thanks for sharing, that was really helpful'},
  {u:'user1',t:'Looking forward to the weekend'},
  {u:'user3',t:'That is a really interesting perspective'},
  {u:'user2',t:'Hope everyone is doing well today'},
  {u:'user4',t:'This community is always so positive'},
  {u:'user1',t:'Anyone have recommendations for good movies?'},
  {u:'user3',t:'Just got back from a walk, feeling refreshed'},
  // Offensive (~20%)
  {u:'user4',t:'shut up you stupid moron'},
  {u:'user1',t:'what an idiot, you know absolutely nothing'},
  {u:'user3',t:'you are such a braindead loser'},
  {u:'user2',t:'dumb asshole stop talking nonsense'},
  // Hate speech (~15%)
  {u:'user4',t:'these immigrants should be deported now'},
  {u:'user1',t:'I hate all these foreigners destroying our country'},
  {u:'user2',t:'kill all the foreigners and animals'},
  {u:'user3',t:'immigrants are subhuman vermin get out'},
];
let simIdx=0;
let _nextSimTimeout=null;
function scheduleNextSim(){
  if(_nextSimTimeout) clearTimeout(_nextSimTimeout);
  // Random interval 6–11 seconds — natural, not spammy
  _nextSimTimeout=setTimeout(()=>{runSim();},6000+Math.random()*5000);
}
function runSim(){
  if(G.isFrozen){scheduleNextSim();return;}
  const s=SIM[simIdx%SIM.length];simIdx++;
  if(s.u!==G.me) addMsg(s.u,s.t);
  scheduleNextSim();
}

// ═══════════════════════════════════
//  CHARTS
// ═══════════════════════════════════
function drawTrend(){
  const c=document.getElementById('trend-cv');if(!c)return;
  const ctx=c.getContext('2d');const W=c.offsetWidth||256,H=60;
  c.width=W;c.height=H;ctx.clearRect(0,0,W,H);
  if(G.trendHist.length<2)return;
  const step=W/(G.trendHist.length-1||1);
  [['normal','#3ecf8e'],['offensive','#f5923e'],['hate','#f04747']].forEach(([lbl,col])=>{
    ctx.beginPath();ctx.strokeStyle=col;ctx.lineWidth=1.5;
    G.trendHist.forEach((t,i)=>{const cum=G.trendHist.slice(0,i+1).filter(x=>x===lbl).length;const y=H-(cum/(i+1))*(H-6)-3,x=i*step;i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});
    ctx.stroke();
  });
}
function drawCM(){
  const c=document.getElementById('cm-cv');if(!c)return;
  const ctx=c.getContext('2d');
  const labs=['hate','off.','neither'],data=[[0.74,0.15,0.11],[0.08,0.87,0.05],[0.04,0.07,0.89]];
  const cell=62,off=50;c.width=240;c.height=240;ctx.clearRect(0,0,240,240);
  ctx.fillStyle='#8898b8';ctx.font='11px system-ui';
  labs.forEach((l,i)=>{ctx.textAlign='center';ctx.fillText(l,off+i*cell+cell/2,17);ctx.textAlign='right';ctx.fillText(l,off-4,off+i*cell+cell/2+4);});
  data.forEach((row,i)=>row.forEach((v,j)=>{
    const a=0.1+v*.8;const clr=i===0?'240,71,71':i===1?'245,146,62':'62,207,142';
    ctx.fillStyle=`rgba(${clr},${a})`;ctx.fillRect(off+j*cell,off+i*cell-cell/2+cell/2,cell-2,cell-2);
    ctx.fillStyle=v>.5?'#edf0f8':'#8898b8';ctx.textAlign='center';ctx.font='bold 13px system-ui';
    ctx.fillText(v.toFixed(2),off+j*cell+cell/2,off+i*cell+cell/4+6);
  }));
}
function drawROC(){
  const c=document.getElementById('roc-cv');if(!c)return;
  const ctx=c.getContext('2d');const W=c.offsetWidth||256,H=120;
  c.width=W;c.height=H;ctx.clearRect(0,0,W,H);
  const pts=[[0,0],[.05,.4],[.1,.6],[.2,.75],[.3,.85],[.5,.92],[.7,.96],[1,1]];
  ctx.strokeStyle='#f04747';ctx.lineWidth=2;ctx.beginPath();
  pts.forEach(([x,y],i)=>{const px=x*W,py=H-y*(H-10)-5;i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);});ctx.stroke();
  ctx.strokeStyle='#2c3a52';ctx.lineWidth=1;ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(0,H);ctx.lineTo(W,5);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle='#8898b8';ctx.font='10px system-ui';ctx.textAlign='left';ctx.fillText('AUC = 0.91',8,16);
}
function drawHistChart(){
  const c=document.getElementById('hist-cv');if(!c)return;
  const ctx=c.getContext('2d');const W=c.offsetWidth||512,H=85;
  c.width=W;c.height=H;ctx.clearRect(0,0,W,H);
  const d=G.trendHist;if(d.length<2)return;
  const step=W/d.length;
  const cols={normal:'#3ecf8e',offensive:'#f5923e',hate:'#f04747'};
  d.forEach((lbl,i)=>{ctx.fillStyle=cols[lbl]||'#888';ctx.globalAlpha=.75;ctx.fillRect(i*step,H*.2,step-1,H*.8);});
  ctx.globalAlpha=1;
}

// ═══════════════════════════════════
//  UTILS
// ═══════════════════════════════════
function nowTs(){const d=new Date();return[d.getHours(),d.getMinutes(),d.getSeconds()].map(x=>String(x).padStart(2,'0')).join(':')}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function setText(id,val){const el=document.getElementById(id);if(el)el.textContent=val;}

// ═══════════════════════════════════
//  BACKGROUND CANVAS
// ═══════════════════════════════════
(function(){
  const c=document.getElementById('bgc'),ctx=c.getContext('2d');
  const ICONS=['𝕏','f','in','▶','📷','🐦','💬','📡','🌐','📱','🔔','💢','⚡','🔁'];
  let pts=[];
  function resize(){c.width=innerWidth;c.height=innerHeight;}
  function init(){pts=[];const n=Math.floor(c.width*c.height/16000);for(let i=0;i<n;i++)pts.push({x:Math.random()*c.width,y:Math.random()*c.height,vx:(Math.random()-.5)*.2,vy:(Math.random()-.5)*.2,icon:ICONS[Math.floor(Math.random()*ICONS.length)],size:9+Math.random()*15,op:.015+Math.random()*.04,col:['rgba(240,71,71,','rgba(91,141,246,','rgba(245,146,62,','rgba(155,114,245,','rgba(255,255,255,'][Math.floor(Math.random()*5)]});}
  function draw(){ctx.clearRect(0,0,c.width,c.height);pts.forEach(p=>{p.x+=p.vx;p.y+=p.vy;if(p.x<-30)p.x=c.width+30;if(p.x>c.width+30)p.x=-30;if(p.y<-30)p.y=c.height+30;if(p.y>c.height+30)p.y=-30;ctx.font=p.size+'px serif';ctx.fillStyle=p.col+p.op+')';ctx.fillText(p.icon,p.x,p.y);});requestAnimationFrame(draw);}
  window.addEventListener('resize',()=>{resize();init();});resize();init();draw();
})();