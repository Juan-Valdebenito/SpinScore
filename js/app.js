/* SpinScore v1.3 — app.js */

// ── ESTADO ────────────────────────────────
let cfg = { sets: 3, pts: 11 };

let match = {
  p:['J1','J2'], pts:[0,0], sets:[0,0],
  history:[], setHistory:[], setsNeeded:2,
  fromTournament:false, tournamentMatchId:null,
};

let tournament = { name:'', players:[], matches:[], currentTab:'matches' };

let gT = {
  name:'', numGroups:4, players:[], groups:[],
  confirmed:false, phase:'groups', currentGroupTab:0,
  groupMatches:[], elimRounds:[],
};

let currentResultMatch = null;
let resultMatchContext = null;
let setRowCount = 0;

// ── NAVEGACION ────────────────────────────
function goTo(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
  window.scrollTo(0,0);
  if (id === 'screen-home')       updateHomeLabel();
  if (id === 'screen-quicksetup') updateQSLabels();
  if (id === 'screen-tournament-bracket') renderBracket();
  if (id === 'screen-groups-main') renderGroupsMain();
  if (id === 'screen-elimination') renderElimination();
}

// ── HOME ──────────────────────────────────
function updateHomeLabel() {
  const el = document.getElementById('home-cfg-label');
  if (el) el.textContent = `${cfg.sets} sets · ${cfg.pts} puntos`;
}

// ── SETTINGS ──────────────────────────────
function selectCfg(type, val) {
  if (type === 'sets') {
    cfg.sets = val;
    document.querySelectorAll('#chips-sets .chip').forEach(c =>
      c.classList.toggle('selected', +c.dataset.val === val));
    document.getElementById('cfg-display-sets').textContent = val;
  } else {
    cfg.pts = val;
    document.querySelectorAll('#chips-pts .chip').forEach(c =>
      c.classList.toggle('selected', +c.dataset.val === val));
    document.getElementById('cfg-display-pts').textContent = val;
  }
}

// ── PARTIDO RAPIDO ────────────────────────
function updateQSLabels() {
  document.getElementById('qs-sets-label').textContent = cfg.sets;
  document.getElementById('qs-pts-label').textContent  = cfg.pts;
}
function startQuickMatch() {
  const p1 = document.getElementById('qs-p1').value.trim() || 'J1';
  const p2 = document.getElementById('qs-p2').value.trim() || 'J2';
  initMatch(p1, p2, false, null);
}

// ── MOTOR DE PARTIDO ──────────────────────
function initMatch(p1, p2, fromTournament, tMatchId) {
  match = {
    p:[p1,p2], pts:[0,0], sets:[0,0], history:[], setHistory:[],
    setsNeeded: Math.ceil(cfg.sets / 2),
    fromTournament, tournamentMatchId: tMatchId,
  };
  document.getElementById('score-format-label').textContent =
    `Al mejor de ${cfg.sets} set${cfg.sets>1?'s':''} · ${cfg.pts} pts`;
  document.getElementById('score-p1-name').textContent = p1;
  document.getElementById('score-p2-name').textContent = p2;
  renderScoreUI();
  goTo('screen-score');
}

function addPoint(player) {
  match.pts[player]++;
  match.history.push(player);
  const el = document.getElementById(player===0?'score-p1-pts':'score-p2-pts');
  el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse');
  checkSetEnd(); renderScoreUI();
}

function undoPoint() {
  if (!match.history.length) { showToast('Nada que deshacer'); return; }
  const last = match.history.pop();
  match.pts[last]--;
  renderScoreUI();
}

// REGLA ITTF: gana set quien llega primero al mínimo de puntos con 2 de diferencia
function checkSetEnd() {
  const [a,b] = match.pts;
  if ((a >= cfg.pts || b >= cfg.pts) && Math.abs(a-b) >= 2) {
    const winner = a > b ? 0 : 1;
    match.setHistory.push([a,b]);
    match.sets[winner]++;
    match.pts = [0,0]; match.history = [];
    // ITTF: gana partido quien gana setsNeeded sets (ej: 2 de 3, 3 de 5)
    if (match.sets[0] >= match.setsNeeded || match.sets[1] >= match.setsNeeded)
      setTimeout(showWinScreen, 300);
  }
}

function renderScoreUI() {
  const [a,b] = match.pts, [sa,sb] = match.sets;
  document.getElementById('score-p1-pts').textContent = a;
  document.getElementById('score-p2-pts').textContent = b;
  document.getElementById('score-p1-sets').textContent = sa;
  document.getElementById('score-p2-sets').textContent = sb;
  document.getElementById('score-p1-sets').className = 'sets-count'+(sa>=match.setsNeeded?' winning':'');
  document.getElementById('score-p2-sets').className = 'sets-count'+(sb>=match.setsNeeded?' winning':'');
  renderSetDots(sa, sb);
  renderPips('pips-p1', sa, match.setsNeeded, 'filled-blue');
  renderPips('pips-p2', sb, match.setsNeeded, 'filled-red');
  // Indicador saque ITTF: cada 2 puntos, en deuce cada 1
  const total = a+b;
  const inDeuce = a >= cfg.pts-1 && b >= cfg.pts-1;
  const cycle = inDeuce ? 1 : 2;
  const srv = (Math.floor(total/cycle) + (sa+sb)) % 2;
  document.getElementById('score-p1-name').textContent = (srv===0?'> ':'') + match.p[0];
  document.getElementById('score-p2-name').textContent = (srv===1?'> ':'') + match.p[1];
}

function renderSetDots(sa, sb) {
  const c = document.getElementById('set-dots'); c.innerHTML = '';
  for(let i=0; i<cfg.sets; i++) {
    const d = document.createElement('div'); d.className='pip';
    if(i<sa) d.classList.add('filled-blue');
    else if(i<sa+sb) d.classList.add('filled-red');
    c.appendChild(d);
  }
}

function renderPips(elId, filled, total, cls) {
  const el = document.getElementById(elId); el.innerHTML = '';
  for(let i=0; i<total; i++) {
    const p = document.createElement('div');
    p.className = 'pip'+(i<filled?' '+cls:'');
    el.appendChild(p);
  }
}

function showWinScreen() {
  const [sa,sb] = match.sets, wi = sa>sb?0:1;
  document.getElementById('win-name').textContent = match.p[wi];
  document.getElementById('win-p1-name').textContent = match.p[0];
  document.getElementById('win-p2-name').textContent = match.p[1];
  document.getElementById('win-p1-sets').textContent = sa;
  document.getElementById('win-p2-sets').textContent = sb;
  document.getElementById('win-set-history').innerHTML =
    match.setHistory.map(([a,b],i)=>`
      <div style="display:flex;justify-content:space-between;gap:24px;font-size:14px;color:var(--muted);padding:3px 0;">
        <span>Set ${i+1}</span>
        <span style="color:${a>b?'var(--win)':'var(--text)'};">${a}</span>
        <span>–</span>
        <span style="color:${b>a?'var(--win)':'var(--text)'};">${b}</span>
      </div>`).join('');
  document.getElementById('win-screen').classList.add('show');
}

function finishMatch() {
  document.getElementById('win-screen').classList.remove('show');
  if (match.fromTournament) {
    const m = tournament.matches.find(x=>x.id===match.tournamentMatchId);
    if(m){m.sets1=match.sets[0];m.sets2=match.sets[1];m.setHistory=[...match.setHistory];m.done=true;}
    renderBracket(); goTo('screen-tournament-bracket');
  } else goTo('screen-home');
}

function confirmBack() {
  const has = match.history.length>0||match.sets[0]>0||match.sets[1]>0;
  if(!has||confirm('¿Salir del partido? Se perdera el progreso.')){
    document.getElementById('win-screen').classList.remove('show');
    goTo(match.fromTournament?'screen-tournament-bracket':'screen-quicksetup');
  }
}

// ── LIGA ──────────────────────────────────
function addTPlayer() {
  const input=document.getElementById('t-player-input'), name=input.value.trim();
  if(!name)return;
  if(tournament.players.includes(name)){showToast('Jugador ya existe');return;}
  tournament.players.push(name); input.value=''; input.focus();
  renderTPlayerList();
}
function removeTPlayer(i) { tournament.players.splice(i,1); renderTPlayerList(); }
function renderTPlayerList() {
  const n=tournament.players.length;
  document.getElementById('player-count').textContent=n;
  document.getElementById('player-list').innerHTML=
    tournament.players.map((p,i)=>`
      <div class="player-item">
        <div class="player-badge">${i+1}</div>
        <span style="flex:1;font-size:15px;">${p}</span>
        <button class="btn-remove" onclick="removeTPlayer(${i})">×</button>
      </div>`).join('');
  const mc=(n*(n-1))/2, info=document.getElementById('t-match-count');
  if(n>=2){info.style.display='block';info.innerHTML=`${n} jugadores · <b style="color:var(--text);">${mc}</b> partidos`;}
  else info.style.display='none';
  document.getElementById('btn-start-tournament').disabled=n<2;
}
function startTournament() {
  tournament.name=document.getElementById('t-name').value.trim()||'Liga';
  tournament.matches=createRoundRobin(tournament.players);
  tournament.currentTab='matches';
  document.getElementById('t-header-name').textContent=tournament.name;
  renderBracket(); goTo('screen-tournament-bracket');
}
function createRoundRobin(players) {
  const m=[];
  for(let i=0;i<players.length;i++)
    for(let j=i+1;j<players.length;j++)
      m.push({id:`${i}-${j}`,p1:i,p2:j,sets1:0,sets2:0,setHistory:[],done:false});
  return m;
}
function switchTab(tab) {
  tournament.currentTab=tab;
  document.getElementById('tab-matches').classList.toggle('active',tab==='matches');
  document.getElementById('tab-standings').classList.toggle('active',tab==='standings');
  renderBracket();
}
function renderBracket() {
  const done=tournament.matches.filter(m=>m.done).length, total=tournament.matches.length;
  document.getElementById('t-header-progress').textContent=`${done}/${total} partidos`;
  if(tournament.currentTab==='matches') renderMatchesTab();
  else renderStandingsTab();
}
function renderMatchesTab() {
  const pending=tournament.matches.filter(m=>!m.done);
  const done=tournament.matches.filter(m=>m.done);
  const allDone=tournament.matches.length>0&&pending.length===0;
  let html='';
  if(allDone){
    const st=calcStandings(),champ=tournament.players[st[0].idx];
    html+=`<div style="background:rgba(245,197,24,.12);border:1px solid var(--accent);border-radius:14px;padding:16px;margin-bottom:16px;text-align:center;">
      <div style="font-weight:800;color:var(--accent);font-size:20px;">Torneo finalizado</div>
      <div style="color:var(--muted);font-size:14px;margin-top:4px;">Campeon: <b style="color:var(--text);">${champ}</b></div>
    </div>`;
  }
  if(pending.length>0){
    html+=`<div class="section-label">Pendientes</div>`;
    pending.forEach(m=>{
      html+=`<div class="match-row" onclick="playTournamentMatch('${m.id}')">
        <div style="flex:1;text-align:left;color:var(--blue);font-weight:700;font-size:15px;">${tournament.players[m.p1]}</div>
        <div class="match-vs">VS</div>
        <div style="flex:1;text-align:right;color:var(--red);font-weight:700;font-size:15px;">${tournament.players[m.p2]}</div>
        <div style="margin-left:10px;color:var(--accent);">▶</div>
      </div>`;
    });
  }
  if(done.length>0){
    html+=`<div class="section-label" style="color:var(--muted);margin-top:${pending.length>0?'16px':'0'};">Jugados</div>`;
    done.forEach(m=>{
      const w=m.sets1>m.sets2?m.p1:m.p2;
      html+=`<div class="match-row done">
        <div style="flex:1;text-align:left;color:${w===m.p1?'var(--win)':'var(--muted)'};font-weight:${w===m.p1?700:400};font-size:14px;">${tournament.players[m.p1]}</div>
        <div style="display:flex;gap:8px;align-items:center;flex-shrink:0;">
          <span class="orb" style="color:var(--blue);font-size:18px;">${m.sets1}</span>
          <span style="color:var(--muted);">–</span>
          <span class="orb" style="color:var(--red);font-size:18px;">${m.sets2}</span>
        </div>
        <div style="flex:1;text-align:right;color:${w===m.p2?'var(--win)':'var(--muted)'};font-weight:${w===m.p2?700:400};font-size:14px;">${tournament.players[m.p2]}</div>
      </div>`;
    });
  }
  document.getElementById('bracket-content').innerHTML=html;
}
function renderStandingsTab() {
  const st=calcStandings(), allDone=tournament.matches.every(m=>m.done)&&tournament.matches.length>0;
  const medals=['1°','2°','3°'];
  let html=`<div class="standings-head">
    <div style="width:28px;">#</div><div style="flex:1;">JUGADOR</div>
    <div style="width:34px;text-align:center;">PTS</div><div style="width:30px;text-align:center;">PJ</div>
    <div style="width:28px;text-align:center;">G</div><div style="width:28px;text-align:center;">P</div>
    <div style="width:42px;text-align:center;">SETS</div></div>`;
  st.forEach((s,rank)=>{
    html+=`<div class="standing-row${rank===0&&allDone?' champion':''}">
      <div style="width:28px;font-weight:800;font-size:13px;color:${rank===0?'var(--accent)':'var(--muted)'};">${rank<3?medals[rank]:rank+1}</div>
      <div style="flex:1;font-weight:${rank===0?700:500};font-size:14px;">${tournament.players[s.idx]}</div>
      <div style="width:34px;text-align:center;color:var(--accent);font-weight:800;">${s.pts}</div>
      <div style="width:30px;text-align:center;color:var(--muted);font-size:13px;">${s.won+s.lost}</div>
      <div style="width:28px;text-align:center;color:var(--win);font-size:13px;">${s.won}</div>
      <div style="width:28px;text-align:center;color:var(--red);font-size:13px;">${s.lost}</div>
      <div style="width:42px;text-align:center;color:var(--muted);font-size:12px;">${s.setW}-${s.setL}</div>
    </div>`;
  });
  html+=`<div class="standings-footer">2 pts por victoria · Desempate por diferencia de sets</div>`;
  document.getElementById('bracket-content').innerHTML=html;
}
function calcStandings() {
  const st=tournament.players.map((_,i)=>({idx:i,pts:0,won:0,lost:0,setW:0,setL:0,ptW:0,ptL:0}));
  tournament.matches.filter(m=>m.done).forEach(m=>{
    st[m.p1].setW+=m.sets1;st[m.p1].setL+=m.sets2;
    st[m.p2].setW+=m.sets2;st[m.p2].setL+=m.sets1;
    (m.setHistory||[]).forEach(([a,b])=>{st[m.p1].ptW+=a;st[m.p1].ptL+=b;st[m.p2].ptW+=b;st[m.p2].ptL+=a;});
    const w=m.sets1>m.sets2?m.p1:m.p2,l=w===m.p1?m.p2:m.p1;
    st[w].pts+=2;st[w].won++;st[l].lost++;
  });
  return st.sort((a,b)=>b.pts-a.pts||(b.setW-b.setL)-(a.setW-a.setL)||(b.ptW-b.ptL)-(a.ptW-a.ptL));
}
function playTournamentMatch(matchId) {
  const m=tournament.matches.find(x=>x.id===matchId); if(!m)return;
  initMatch(tournament.players[m.p1],tournament.players[m.p2],true,matchId);
}

// ══════════════════════════════════════════
// TORNEO POR GRUPOS
// ══════════════════════════════════════════
const GROUP_COLORS=['#4FC3F7','#F5C518','#E63946','#22C55E','#A78BFA','#FB923C','#F472B6','#34D399'];
const GROUP_NAMES=['A','B','C','D','E','F','G','H'];

function selectGroups(n) {
  gT.numGroups=n;
  document.querySelectorAll('#chips-groups .chip').forEach(c=>
    c.classList.toggle('selected',+c.dataset.val===n));
  document.getElementById('gp-max').textContent=n*4;
  updateGPInfo();
}
function addGPlayer() {
  const input=document.getElementById('gp-input'), name=input.value.trim();
  if(!name)return;
  const max=gT.numGroups*4;
  if(gT.players.length>=max){showToast(`Maximo ${max} jugadores`);return;}
  if(gT.players.includes(name)){showToast('Jugador ya existe');return;}
  gT.players.push(name); input.value=''; input.focus();
  renderGPList();
}
function removeGPlayer(i) { gT.players.splice(i,1); renderGPList(); }
function renderGPList() {
  const n=gT.players.length;
  document.getElementById('gp-count').textContent=n;
  document.getElementById('gp-list').innerHTML=
    gT.players.map((p,i)=>`
      <div class="player-item">
        <div class="player-badge">${i+1}</div>
        <span style="flex:1;font-size:15px;">${p}</span>
        <button class="btn-remove" onclick="removeGPlayer(${i})">×</button>
      </div>`).join('');
  updateGPInfo();
  document.getElementById('btn-sortear').disabled=n<2;
}
function updateGPInfo() {
  const n=gT.players.length, info=document.getElementById('gp-info');
  if(n>=2){
    info.style.display='block';
    info.textContent=`${n} jugadores en ${gT.numGroups} grupos (~${Math.ceil(n/gT.numGroups)} por grupo)`;
  } else info.style.display='none';
}

function sortearGrupos() {
  const players=[...gT.players];
  for(let i=players.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [players[i],players[j]]=[players[j],players[i]];
  }
  gT.groups=Array.from({length:gT.numGroups},()=>[]);
  players.forEach((p,i)=>gT.groups[i%gT.numGroups].push(gT.players.indexOf(p)));
  renderGroupsPreview();
  goTo('screen-groups-preview');
}

function renderGroupsPreview() {
  let html='';
  gT.groups.forEach((group,gi)=>{
    const color=GROUP_COLORS[gi];
    html+=`<div class="group-card">
      <div class="group-header">
        <div class="group-badge" style="background:${color};">G${GROUP_NAMES[gi]}</div>
        <span>Grupo ${GROUP_NAMES[gi]}</span>
      </div>`;
    group.forEach((pi,pos)=>{
      html+=`<div class="group-player">
        <div class="group-player-num">${pos+1}</div>
        <div class="group-player-name">${gT.players[pi]}</div>
      </div>`;
    });
    html+=`</div>`;
  });
  document.getElementById('groups-preview-content').innerHTML=html;
}

function confirmarGrupos() {
  gT.name=document.getElementById('gt-name').value.trim()||'Torneo';
  gT.confirmed=true; gT.phase='groups'; gT.currentGroupTab=0;
  gT.groupMatches=[];
  gT.groups.forEach((group,gi)=>{
    for(let i=0;i<group.length;i++)
      for(let j=i+1;j<group.length;j++)
        gT.groupMatches.push({groupIdx:gi,p1:group[i],p2:group[j],sets1:0,sets2:0,setScores:[],done:false});
  });
  renderGroupsMain();
  goTo('screen-groups-main');
}

// ── RENDER GRUPOS MAIN ────────────────────
function renderGroupsMain() {
  document.getElementById('gt-header-name').textContent=gT.name;
  document.getElementById('gt-phase-label').textContent='Fase de Grupos';
  const tabsEl=document.getElementById('groups-tabs');
  let tabsHtml='';
  gT.groups.forEach((_,gi)=>{
    tabsHtml+=`<button class="tab${gi===gT.currentGroupTab?' active':''}"
      onclick="switchGroupTab(${gi})">Grupo ${GROUP_NAMES[gi]}</button>`;
  });
  tabsHtml+=`<button class="tab${gT.currentGroupTab===gT.groups.length?' active':''}"
    onclick="switchGroupTab(${gT.groups.length})">General</button>`;
  tabsEl.innerHTML=tabsHtml;
  renderGroupTabContent();
}

function switchGroupTab(idx) {
  gT.currentGroupTab=idx;
  document.querySelectorAll('#groups-tabs .tab').forEach((t,i)=>
    t.classList.toggle('active',i===idx));
  renderGroupTabContent();
}

function renderGroupTabContent() {
  const content=document.getElementById('groups-main-content');
  const idx=gT.currentGroupTab;
  if(idx===gT.groups.length){renderGeneralTab(content);return;}
  renderSingleGroupTab(content, idx);
}

function renderSingleGroupTab(content, idx) {
  const group=gT.groups[idx];
  const color=GROUP_COLORS[idx];
  const matches=gT.groupMatches.filter(m=>m.groupIdx===idx);
  const stats=calcGroupStats(idx);
  const allDone=matches.every(m=>m.done);
  const isDesktop=window.innerWidth>=768;

  // Tabla de posiciones
  let html=`<div class="group-card">
    <div class="group-header">
      <div class="group-badge" style="background:${color};">G${GROUP_NAMES[idx]}</div>
      <span>Grupo ${GROUP_NAMES[idx]}</span>
      ${allDone?`<span style="margin-left:auto;font-size:11px;color:var(--win);font-weight:600;">Completo</span>`:''}
    </div>
    <div style="display:flex;font-size:10px;color:var(--muted);font-weight:700;
      padding:6px 16px;letter-spacing:.5px;border-bottom:1px solid var(--border);">
      <div style="width:24px;">#</div>
      <div style="flex:1;">JUGADOR</div>
      <div style="width:32px;text-align:center;">PTS</div>
      <div style="width:26px;text-align:center;">G</div>
      <div style="width:26px;text-align:center;">P</div>
      <div style="width:40px;text-align:center;">SETS</div>
    </div>`;
  stats.forEach((s,rank)=>{
    const passing=rank<2&&allDone;
    html+=`<div class="group-player" style="${passing?'background:rgba(34,197,94,.07);':''}">
      <div class="group-player-num" style="color:${passing?'var(--win)':'var(--muted)'};">
        ${rank+1}${passing?'*':''}
      </div>
      <div class="group-player-name" style="font-weight:${rank<2?600:400};">${gT.players[s.idx]}</div>
      <div class="group-player-stats">
        <span><span class="stat-val">${s.pts}</span></span>
        <span><span class="stat-val g">${s.won}</span></span>
        <span><span class="stat-val p">${s.lost}</span></span>
        <span><span class="stat-val">${s.setW}-${s.setL}</span></span>
      </div>
    </div>`;
  });
  html+=`</div>`;

  // Partidos del grupo
  html+=`<div class="section-label" style="margin-top:4px;">Partidos del Grupo ${GROUP_NAMES[idx]}</div>`;

  // Desktop: grid de partidos
  if(isDesktop) html+=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">`;

  matches.forEach((m)=>{
    const realIdx=gT.groupMatches.indexOf(m);
    const p1name=gT.players[m.p1], p2name=gT.players[m.p2];
    if(m.done){
      const w=m.sets1>m.sets2?'p1':'p2';
      const detail=m.setScores.map(([a,b])=>`${a}-${b}`).join(' | ');
      html+=`<div class="match-row done" style="flex-direction:column;align-items:stretch;gap:4px;">
        <div style="display:flex;align-items:center;">
          <div style="flex:1;color:${w==='p1'?'var(--win)':'var(--muted)'};font-weight:${w==='p1'?700:400};font-size:14px;">${p1name}</div>
          <div style="display:flex;gap:8px;align-items:center;">
            <span class="orb" style="color:var(--blue);font-size:16px;">${m.sets1}</span>
            <span style="color:var(--muted);">–</span>
            <span class="orb" style="color:var(--red);font-size:16px;">${m.sets2}</span>
          </div>
          <div style="flex:1;text-align:right;color:${w==='p2'?'var(--win)':'var(--muted)'};font-weight:${w==='p2'?700:400};font-size:14px;">${p2name}</div>
        </div>
        ${detail?`<div style="font-size:11px;color:var(--border);text-align:center;">${detail}</div>`:''}
      </div>`;
    } else {
      html+=`<div class="match-row" onclick="abrirResultado(${realIdx},'group')">
        <div style="flex:1;text-align:left;color:var(--blue);font-weight:700;font-size:14px;">${p1name}</div>
        <div class="match-vs">VS</div>
        <div style="flex:1;text-align:right;color:var(--red);font-weight:700;font-size:14px;">${p2name}</div>
        <div style="margin-left:10px;color:var(--accent);font-size:18px;">+</div>
      </div>`;
    }
  });

  if(isDesktop) html+=`</div>`;

  if(allDone){
    const top2=stats.slice(0,2).map(s=>gT.players[s.idx]);
    html+=`<div class="advance-banner" style="margin-top:8px;">
      Clasifican al cuadro eliminatorio: <b>${top2.join(' y ')}</b>
    </div>`;
  }
  content.innerHTML=html;
}

function renderGeneralTab(content) {
  const allGroupsDone=gT.groups.every((_,gi)=>{
    return gT.groupMatches.filter(x=>x.groupIdx===gi).every(x=>x.done);
  });
  const isDesktop=window.innerWidth>=768;
  let html='';

  // Desktop: grid de grupos
  if(isDesktop) html+=`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;">`;

  gT.groups.forEach((_,gi)=>{
    const color=GROUP_COLORS[gi];
    const stats=calcGroupStats(gi);
    const done=gT.groupMatches.filter(m=>m.groupIdx===gi).every(m=>m.done);
    html+=`<div class="group-card">
      <div class="group-header">
        <div class="group-badge" style="background:${color};">G${GROUP_NAMES[gi]}</div>
        <span>Grupo ${GROUP_NAMES[gi]}</span>
        ${done?`<span style="margin-left:auto;font-size:11px;color:var(--win);font-weight:600;">Listo</span>`:''}
      </div>`;
    stats.forEach((s,rank)=>{
      html+=`<div class="group-player" style="${rank<2&&done?'background:rgba(34,197,94,.07);':''}">
        <div class="group-player-num" style="color:${rank<2&&done?'var(--win)':'var(--muted)'};">${rank+1}${rank<2&&done?'*':''}</div>
        <div class="group-player-name" style="font-weight:${rank<2?600:400};font-size:13px;">${gT.players[s.idx]}</div>
        <div class="group-player-stats">
          <span><span class="stat-val g">${s.won}</span>G</span>
          <span><span class="stat-val p">${s.lost}</span>P</span>
          <span><span class="stat-val">${s.pts}</span>pts</span>
        </div>
      </div>`;
    });
    html+=`</div>`;
  });

  if(isDesktop) html+=`</div>`;

  if(allGroupsDone && gT.phase==='groups'){
    html+=`<div style="margin-top:16px;">
      <button class="btn-primary" onclick="iniciarEliminacion()">Iniciar Fase Eliminatoria</button>
    </div>`;
  } else if(gT.phase==='elimination'){
    html+=`<div style="margin-top:16px;">
      <button class="btn-primary" onclick="goTo('screen-elimination')">Ver Cuadro Eliminatorio</button>
    </div>`;
  }
  content.innerHTML=html;
}

// ── STATS DE GRUPO ────────────────────────
function calcGroupStats(gi) {
  const group=gT.groups[gi];
  const st=group.map(pi=>({idx:pi,pts:0,won:0,lost:0,setW:0,setL:0,ptW:0,ptL:0}));
  gT.groupMatches.filter(m=>m.groupIdx===gi&&m.done).forEach(m=>{
    const s1=st.find(x=>x.idx===m.p1), s2=st.find(x=>x.idx===m.p2);
    if(!s1||!s2)return;
    s1.setW+=m.sets1;s1.setL+=m.sets2;
    s2.setW+=m.sets2;s2.setL+=m.sets1;
    m.setScores.forEach(([a,b])=>{s1.ptW+=a;s1.ptL+=b;s2.ptW+=b;s2.ptL+=a;});
    const w=m.sets1>m.sets2?s1:s2, l=w===s1?s2:s1;
    w.pts+=2;w.won++;l.lost++;
  });
  return st.sort((a,b)=>b.pts-a.pts||(b.setW-b.setL)-(a.setW-a.setL)||(b.ptW-b.ptL)-(a.ptW-a.ptL));
}

// ── INGRESO RESULTADO ─────────────────────
function abrirResultado(matchIdx, context) {
  currentResultMatch=matchIdx; resultMatchContext=context;
  let p1name, p2name, existing=[];
  if(context==='group'){
    const m=gT.groupMatches[matchIdx];
    p1name=gT.players[m.p1]; p2name=gT.players[m.p2];
    existing=m.setScores||[];
  } else {
    const {ri,mi}=matchIdx;
    const m=gT.elimRounds[ri][mi];
    p1name=m.p1name; p2name=m.p2name;
    existing=m.setScores||[];
  }
  document.getElementById('result-match-info').innerHTML=`
    <div class="result-player-name left">${p1name}</div>
    <div style="color:var(--muted);font-size:18px;flex-shrink:0;">VS</div>
    <div class="result-player-name right">${p2name}</div>`;
  document.getElementById('result-sets-container').innerHTML='';
  setRowCount=0;
  // ITTF: al mejor de 3 sets = 3 filas base; al mejor de 5 = 5 filas base
  const baseSets = existing.length>0 ? existing.length : cfg.sets;
  for(let i=0;i<baseSets;i++){
    const vals=existing[i]||[null,null];
    addSetRow(vals[0],vals[1]);
  }

  // Botón back según contexto
  const backBtn=document.getElementById('result-back-btn');
  if(backBtn) backBtn.onclick=()=>goTo(context==='elim'?'screen-elimination':'screen-groups-main');

  goTo('screen-result-entry');
}

function addSetRow(valA=null, valB=null) {
  setRowCount++;
  const id=setRowCount;
  const container=document.getElementById('result-sets-container');
  const num=container.children.length+1;
  const row=document.createElement('div');
  row.className='set-row'; row.id=`set-row-${id}`;
  row.innerHTML=`
    <div class="set-row-label">Set ${num}</div>
    <input type="number" class="set-input" id="set-a-${id}" min="0" max="99"
      value="${valA!==null?valA:''}" placeholder="0">
    <div class="set-dash">–</div>
    <input type="number" class="set-input" id="set-b-${id}" min="0" max="99"
      value="${valB!==null?valB:''}" placeholder="0">
    <button class="btn-remove-set" onclick="removeSetRow('set-row-${id}')">×</button>`;
  container.appendChild(row);
  renumberSets();
}

function removeSetRow(id) {
  const el=document.getElementById(id); if(el)el.remove(); renumberSets();
}
function renumberSets() {
  document.querySelectorAll('#result-sets-container .set-row').forEach((row,i)=>{
    const l=row.querySelector('.set-row-label'); if(l)l.textContent=`Set ${i+1}`;
  });
}

function guardarResultado() {
  const rows=document.querySelectorAll('#result-sets-container .set-row');
  const setScores=[]; let sets1=0, sets2=0, valid=true;
  const setsNeeded=Math.ceil(cfg.sets/2);

  rows.forEach(row=>{
    const inputs=row.querySelectorAll('.set-input');
    const a=parseInt(inputs[0].value), b=parseInt(inputs[1].value);
    if(isNaN(a)||isNaN(b)){valid=false;return;}
    setScores.push([a,b]);
    if(a>b)sets1++; else sets2++;
  });

  if(!valid||setScores.length===0){showToast('Completa todos los sets');return;}

  // Validar que alguien ganó suficientes sets (ITTF: sets necesarios)
  if(sets1<setsNeeded&&sets2<setsNeeded){
    showToast(`Debe haber ${setsNeeded} sets ganados`);return;
  }
  if(sets1===sets2){showToast('Debe haber un ganador');return;}

  if(resultMatchContext==='group'){
    const m=gT.groupMatches[currentResultMatch];
    m.sets1=sets1;m.sets2=sets2;m.setScores=setScores;m.done=true;
    renderGroupsMain(); goTo('screen-groups-main');
  } else {
    const {ri,mi}=currentResultMatch;
    const m=gT.elimRounds[ri][mi];
    m.sets1=sets1;m.sets2=sets2;m.setScores=setScores;m.done=true;
    m.winner=sets1>sets2?m.p1:m.p2;
    m.winnername=sets1>sets2?m.p1name:m.p2name;
    propagateElimWinner(ri,mi);
    renderElimination(); goTo('screen-elimination');
  }
}

// ── ELIMINACION ───────────────────────────
const ROUND_NAMES=['Dieciseisavos','Octavos de Final','Cuartos de Final','Semifinal','Final'];

function iniciarEliminacion() {
  const classified=[];
  gT.groups.forEach((_,gi)=>{
    const top=calcGroupStats(gi).slice(0,2);
    top.forEach((s,pos)=>classified.push({playerIdx:s.idx,group:gi,pos}));
  });
  gT.elimRounds=[];
  gT.phase='elimination';
  const seeds=buildSeeding(classified);
  const firstRound=[];
  for(let i=0;i<seeds.length;i+=2){
    const home=seeds[i], away=seeds[i+1]||null;
    firstRound.push({
      p1:home?home.playerIdx:null, p1name:home?gT.players[home.playerIdx]:'TBD',
      p2:away?away.playerIdx:null, p2name:away?gT.players[away.playerIdx]:'TBD',
      sets1:0,sets2:0,setScores:[],done:false,winner:null,winnername:null,
    });
  }
  gT.elimRounds.push(firstRound);
  let current=firstRound.length;
  while(current>1){
    current=Math.ceil(current/2);
    gT.elimRounds.push(Array.from({length:current},()=>({
      p1:null,p1name:'TBD',p2:null,p2name:'TBD',
      sets1:0,sets2:0,setScores:[],done:false,winner:null,winnername:null,
    })));
  }
  renderElimination();
  goTo('screen-elimination');
}

function buildSeeding(classified) {
  const first=classified.filter(c=>c.pos===0);
  const second=classified.filter(c=>c.pos===1);
  const seeds=[];
  for(let i=0;i<first.length;i++){
    seeds.push(first[i]);
    const cross=second.find(s=>s.group!==first[i].group&&!seeds.includes(s))||second[i];
    seeds.push(cross);
  }
  return seeds;
}

function propagateElimWinner(ri,mi) {
  const nextRi=ri+1;
  if(nextRi>=gT.elimRounds.length)return;
  const nextMi=Math.floor(mi/2);
  const isFirst=mi%2===0;
  const m=gT.elimRounds[ri][mi];
  const next=gT.elimRounds[nextRi][nextMi];
  if(isFirst){next.p1=m.winner;next.p1name=m.winnername;}
  else{next.p2=m.winner;next.p2name=m.winnername;}
}

function renderElimination() {
  document.getElementById('elim-header-name').textContent=gT.name;
  const totalRounds=gT.elimRounds.length;
  const isDesktop=window.innerWidth>=768;
  const container=document.getElementById('elim-content');

  if(isDesktop){
    renderElimDesktop(container, totalRounds);
  } else {
    renderElimMobile(container, totalRounds);
  }
}

function getRoundName(ri, totalRounds) {
  const fromEnd=totalRounds-1-ri;
  if(fromEnd<ROUND_NAMES.length) return ROUND_NAMES[ROUND_NAMES.length-1-fromEnd];
  return `Ronda ${ri+1}`;
}

function renderElimMobile(container, totalRounds) {
  let html=`<div class="elim-bracket-mobile">`;
  gT.elimRounds.forEach((round,ri)=>{
    html+=`<div class="elim-round-title">${getRoundName(ri,totalRounds)}</div>`;
    round.forEach((m,mi)=>{
      const canPlay=m.p1name!=='TBD'&&m.p2name!=='TBD'&&!m.done;
      const isFinal=ri===totalRounds-1;
      if(m.done){
        const w1=m.sets1>m.sets2;
        const detail=m.setScores.map(([a,b])=>`${a}-${b}`).join(' | ');
        html+=`<div class="elim-match">
          <div class="elim-player">
            <div class="elim-player-name${w1?' winner':''}">${m.p1name}</div>
            <div class="elim-player-sets${w1?' winner':''}">${m.sets1}</div>
          </div>
          <div class="elim-player">
            <div class="elim-player-name${!w1?' winner':''}">${m.p2name}</div>
            <div class="elim-player-sets${!w1?' winner':''}">${m.sets2}</div>
          </div>
          ${detail?`<div class="elim-result-detail">${detail}</div>`:''}
        </div>`;
        if(isFinal&&m.done){
          html+=`<div style="background:rgba(245,197,24,.12);border:1px solid var(--accent);border-radius:14px;padding:16px;text-align:center;margin-top:12px;">
            <div style="font-size:22px;font-weight:800;color:var(--accent);">Campeon</div>
            <div style="font-size:20px;font-weight:700;margin-top:4px;">${m.winnername}</div>
          </div>`;
        }
      } else {
        html+=`<div class="elim-match${canPlay?' clickable':''}" ${canPlay?`onclick="abrirResultadoElim(${ri},${mi})"`:''}>
          <div class="elim-player">
            <div class="elim-player-name${m.p1name==='TBD'?' elim-tbd':''}">${m.p1name}</div>
            <div class="elim-player-sets">–</div>
          </div>
          <div class="elim-player">
            <div class="elim-player-name${m.p2name==='TBD'?' elim-tbd':''}">${m.p2name}</div>
            <div class="elim-player-sets">–</div>
          </div>
          ${canPlay?`<div class="elim-result-detail" style="color:var(--accent);">Toca para ingresar resultado</div>`:''}
        </div>`;
      }
    });
  });
  html+=`</div>`;
  container.innerHTML=html;
}

function renderElimDesktop(container, totalRounds) {
  let html=`<div class="elim-bracket-desktop">`;
  gT.elimRounds.forEach((round,ri)=>{
    html+=`<div class="bracket-round">
      <div class="bracket-round-title">${getRoundName(ri,totalRounds)}</div>`;
    round.forEach((m,mi)=>{
      const canPlay=m.p1name!=='TBD'&&m.p2name!=='TBD'&&!m.done;
      const w1=m.done&&m.sets1>m.sets2, w2=m.done&&m.sets2>m.sets1;
      html+=`<div class="bracket-match${canPlay?' clickable':''}"
        ${canPlay?`onclick="abrirResultadoElim(${ri},${mi})"`:''}>
        <div class="bracket-team${w1?' winner':''}">
          <div class="bracket-team-name${m.p1name==='TBD'?' tbd':''}">${m.p1name}</div>
          <div class="bracket-team-score${w1?' winner':''}">${m.done?m.sets1:'–'}</div>
        </div>
        <div class="bracket-team${w2?' winner':''}">
          <div class="bracket-team-name${m.p2name==='TBD'?' tbd':''}">${m.p2name}</div>
          <div class="bracket-team-score${w2?' winner':''}">${m.done?m.sets2:'–'}</div>
        </div>
      </div>`;
    });
    html+=`</div>`;
    // Conector entre rondas (excepto después de la última)
    if(ri<totalRounds-1){
      html+=`<div class="bracket-connector">`;
      const nextCount=gT.elimRounds[ri+1].length;
      const factor=round.length/nextCount;
      for(let i=0;i<nextCount;i++){
        html+=`<div style="flex:${factor};display:flex;flex-direction:column;justify-content:center;align-items:flex-start;">
          <div style="height:50%;border-top:2px solid var(--border);border-right:2px solid var(--border);width:100%;"></div>
          <div style="height:50%;border-bottom:2px solid var(--border);border-right:2px solid var(--border);width:100%;"></div>
        </div>`;
      }
      html+=`</div>`;
    }
  });

  // Campeón al final
  const lastRound=gT.elimRounds[totalRounds-1];
  const champ=lastRound&&lastRound[0]&&lastRound[0].done?lastRound[0].winnername:null;
  html+=`<div class="champion-cell">
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="${champ?'#F5C518':'#2A5C3A'}" stroke-width="1.5">
      <path d="M6 9H4a2 2 0 0 0-2 2v1a6 6 0 0 0 6 6h8a6 6 0 0 0 6-6v-1a2 2 0 0 0-2-2h-2"/>
      <rect x="6" y="2" width="12" height="10" rx="2"/>
      <line x1="12" y1="18" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/>
    </svg>
    ${champ
      ?`<div class="champion-name">${champ}</div>`
      :`<div style="font-size:12px;color:var(--border);margin-top:6px;">Campeon</div>`}
  </div>`;

  html+=`</div>`;
  container.innerHTML=html;
}

function abrirResultadoElim(ri,mi) {
  abrirResultado({ri,mi},'elim');
}

// ── TOAST ─────────────────────────────────
let toastTimer;
function showToast(msg) {
  const t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>t.classList.remove('show'),2200);
}

// ── PWA ───────────────────────────────────
if('serviceWorker' in navigator){
  const sw=`const C='spinscore-v13';const F=['./','./index.html','./css/style.css','./js/app.js'];
  self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(F)));self.skipWaiting();});
  self.addEventListener('fetch',e=>{e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));});`;
  navigator.serviceWorker.register(URL.createObjectURL(new Blob([sw],{type:'application/javascript'}))).catch(()=>{});
}

window.addEventListener('load',()=>{
  updateHomeLabel();
  const installed=window.matchMedia('(display-mode:standalone)').matches||navigator.standalone;
  if(!installed)setTimeout(()=>document.getElementById('install-banner').classList.add('show'),1500);
});

// Re-render bracket en resize para cambiar mobile/desktop
window.addEventListener('resize',()=>{
  const active=document.querySelector('.screen.active');
  if(!active)return;
  if(active.id==='screen-groups-main') renderGroupTabContent();
  if(active.id==='screen-elimination') renderElimination();
});
