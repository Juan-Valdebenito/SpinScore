/* ════════════════════════════════════════════
   SpinScore v2 — app.js
════════════════════════════════════════════ */

// ── ESTADO GLOBAL ─────────────────────────
let cfg = { sets: 3, pts: 11 };

let match = {
  p: ['J1','J2'], pts:[0,0], sets:[0,0],
  history:[], setHistory:[], setsNeeded:2,
  fromTournament:false, tournamentMatchId:null,
};

let tournament = {
  name:'', players:[], matches:[], currentTab:'matches',
};

// ESTADO TORNEO POR GRUPOS
let gTournament = {
  name: '',
  numGroups: 4,
  players: [],
  groups: [],       // [[playerIdx,...], ...]
  confirmed: false,
  phase: 'groups',  // 'groups' | 'elimination'
  currentGroupTab: 0,
  // Partidos de grupos: { groupIdx, p1, p2, sets1, sets2, setScores:[[a,b],...], done }
  groupMatches: [],
  // Eliminacion
  elimRounds: [],   // array of rounds, each round = array of matches
  elimPhase: 0,     // índice de ronda actual
};

let currentResultMatch = null; // {groupIdx, matchIdx} o {elimRound, matchIdx}
let resultMatchContext = null; // 'group' | 'elim'

// ── NAVEGACIÓN ────────────────────────────
function goTo(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(screenId);
  if (el) el.classList.add('active');
  document.getElementById('app').scrollTop = 0;
  if (screenId === 'screen-home')       updateHomeLabel();
  if (screenId === 'screen-quicksetup') updateQSLabels();
  if (screenId === 'screen-tournament-bracket') renderBracket();
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

// ── PARTIDO RÁPIDO ────────────────────────
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
    setsNeeded: Math.ceil(cfg.sets/2), fromTournament, tournamentMatchId:tMatchId,
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

function checkSetEnd() {
  const [a,b] = match.pts;
  if ((a>=cfg.pts||b>=cfg.pts) && Math.abs(a-b)>=2) {
    const winner = a>b?0:1;
    match.setHistory.push([a,b]);
    match.sets[winner]++;
    match.pts=[0,0]; match.history=[];
    if (match.sets[0]>=match.setsNeeded||match.sets[1]>=match.setsNeeded)
      setTimeout(showWinScreen,300);
  }
}

function renderScoreUI() {
  const [a,b]=[...match.pts], [sa,sb]=[...match.sets];
  document.getElementById('score-p1-pts').textContent=a;
  document.getElementById('score-p2-pts').textContent=b;
  document.getElementById('score-p1-sets').textContent=sa;
  document.getElementById('score-p2-sets').textContent=sb;
  document.getElementById('score-p1-sets').className='sets-count'+(sa>=match.setsNeeded?' winning':'');
  document.getElementById('score-p2-sets').className='sets-count'+(sb>=match.setsNeeded?' winning':'');
  renderSetDots(sa,sb);
  renderPips('pips-p1',sa,match.setsNeeded,'filled-blue');
  renderPips('pips-p2',sb,match.setsNeeded,'filled-red');
  const total=a+b, inDeuce=a>=cfg.pts-1&&b>=cfg.pts-1, cycle=inDeuce?1:2;
  const srv=(Math.floor(total/cycle)+(sa+sb))%2;
  document.getElementById('score-p1-name').textContent=(srv===0?'> ':'')+match.p[0];
  document.getElementById('score-p2-name').textContent=(srv===1?'> ':'')+match.p[1];
}

function renderSetDots(sa,sb) {
  const c=document.getElementById('set-dots'); c.innerHTML='';
  for(let i=0;i<cfg.sets;i++){
    const d=document.createElement('div'); d.className='pip';
    if(i<sa) d.classList.add('filled-blue');
    else if(i<sa+sb) d.classList.add('filled-red');
    c.appendChild(d);
  }
}

function renderPips(elId,filled,total,cls) {
  const el=document.getElementById(elId); el.innerHTML='';
  for(let i=0;i<total;i++){
    const p=document.createElement('div');
    p.className='pip'+(i<filled?' '+cls:'');
    el.appendChild(p);
  }
}

function showWinScreen() {
  const [sa,sb]=match.sets, wi=sa>sb?0:1;
  document.getElementById('win-name').textContent=match.p[wi];
  document.getElementById('win-p1-name').textContent=match.p[0];
  document.getElementById('win-p2-name').textContent=match.p[1];
  document.getElementById('win-p1-sets').textContent=sa;
  document.getElementById('win-p2-sets').textContent=sb;
  document.getElementById('win-set-history').innerHTML=
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
    const m=tournament.matches.find(x=>x.id===match.tournamentMatchId);
    if(m){m.sets1=match.sets[0];m.sets2=match.sets[1];m.setHistory=[...match.setHistory];m.done=true;}
    renderBracket(); goTo('screen-tournament-bracket');
  } else goTo('screen-home');
}

function confirmBack() {
  const has=match.history.length>0||match.sets[0]>0||match.sets[1]>0;
  if(!has||confirm('¿Salir del partido? Se perderá el progreso.')){
    document.getElementById('win-screen').classList.remove('show');
    goTo(match.fromTournament?'screen-tournament-bracket':'screen-quicksetup');
  }
}

// ── LIGA (todos contra todos) ──────────────
function addTPlayer() {
  const input=document.getElementById('t-player-input');
  const name=input.value.trim();
  if(!name)return;
  if(tournament.players.includes(name)){showToast('Jugador ya existe');return;}
  tournament.players.push(name); input.value=''; input.focus();
  renderTPlayerList();
}

function removeTPlayer(i) {
  tournament.players.splice(i,1); renderTPlayerList();
}

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
    const st=calcStandings(), champ=tournament.players[st[0].idx];
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
    <div style="width:42px;text-align:center;">SETS</div>
  </div>`;
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
    st[m.p1].setW+=m.sets1; st[m.p1].setL+=m.sets2;
    st[m.p2].setW+=m.sets2; st[m.p2].setL+=m.sets1;
    (m.setHistory||[]).forEach(([a,b])=>{st[m.p1].ptW+=a;st[m.p1].ptL+=b;st[m.p2].ptW+=b;st[m.p2].ptL+=a;});
    const w=m.sets1>m.sets2?m.p1:m.p2, l=w===m.p1?m.p2:m.p1;
    st[w].pts+=2; st[w].won++; st[l].lost++;
  });
  return st.sort((a,b)=>b.pts-a.pts||(b.setW-b.setL)-(a.setW-a.setL)||(b.ptW-b.ptL)-(a.ptW-a.ptL));
}

function playTournamentMatch(matchId) {
  const m=tournament.matches.find(x=>x.id===matchId); if(!m)return;
  initMatch(tournament.players[m.p1],tournament.players[m.p2],true,matchId);
}

// ══════════════════════════════════════════════
// TORNEO POR GRUPOS
// ══════════════════════════════════════════════

const GROUP_COLORS=['#4FC3F7','#F5C518','#E63946','#22C55E','#A78BFA','#FB923C','#F472B6','#34D399'];
const GROUP_NAMES=['A','B','C','D','E','F','G','H'];

function selectGroups(n) {
  gTournament.numGroups=n;
  document.querySelectorAll('#chips-groups .chip').forEach(c=>
    c.classList.toggle('selected',+c.dataset.val===n));
  document.getElementById('gp-max').textContent=n*4;
  updateGPInfo();
}

function addGPlayer() {
  const input=document.getElementById('gp-input');
  const name=input.value.trim(); if(!name)return;
  const max=gTournament.numGroups*4;
  if(gTournament.players.length>=max){showToast(`Maximo ${max} jugadores para ${gTournament.numGroups} grupos`);return;}
  if(gTournament.players.includes(name)){showToast('Jugador ya existe');return;}
  gTournament.players.push(name); input.value=''; input.focus();
  renderGPList();
}

function removeGPlayer(i) {
  gTournament.players.splice(i,1); renderGPList();
}

function renderGPList() {
  const n=gTournament.players.length, max=gTournament.numGroups*4;
  document.getElementById('gp-count').textContent=n;
  document.getElementById('gp-list').innerHTML=
    gTournament.players.map((p,i)=>`
      <div class="player-item">
        <div class="player-badge">${i+1}</div>
        <span style="flex:1;font-size:15px;">${p}</span>
        <button class="btn-remove" onclick="removeGPlayer(${i})">×</button>
      </div>`).join('');
  updateGPInfo();
  document.getElementById('btn-sortear').disabled=n<2;
}

function updateGPInfo() {
  const n=gTournament.players.length, max=gTournament.numGroups*4;
  const info=document.getElementById('gp-info');
  if(n>=2){
    info.style.display='block';
    const perGroup=Math.ceil(n/gTournament.numGroups);
    info.textContent=`${n} jugadores en ${gTournament.numGroups} grupos (~${perGroup} por grupo)`;
  } else info.style.display='none';
}

function sortearGrupos() {
  const n=gTournament.numGroups, players=[...gTournament.players];
  // Fisher-Yates shuffle
  for(let i=players.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [players[i],players[j]]=[players[j],players[i]];
  }
  // Distribute round-robin into groups
  gTournament.groups=Array.from({length:n},()=>[]);
  players.forEach((p,i)=>{
    const playerIdx=gTournament.players.indexOf(p);
    gTournament.groups[i%n].push(playerIdx);
  });
  renderGroupsPreview();
  goTo('screen-groups-preview');
}

function renderGroupsPreview() {
  let html='';
  gTournament.groups.forEach((group,gi)=>{
    const color=GROUP_COLORS[gi];
    html+=`<div class="group-card">
      <div class="group-header">
        <div class="group-badge" style="background:${color};">G${GROUP_NAMES[gi]}</div>
        <span>Grupo ${GROUP_NAMES[gi]}</span>
      </div>`;
    group.forEach((pi,pos)=>{
      html+=`<div class="group-player">
        <div class="group-player-num">${pos+1}</div>
        <div class="group-player-name">${gTournament.players[pi]}</div>
      </div>`;
    });
    html+=`</div>`;
  });
  document.getElementById('groups-preview-content').innerHTML=html;
}

function confirmarGrupos() {
  gTournament.name=document.getElementById('gt-name').value.trim()||'Torneo';
  gTournament.confirmed=true;
  gTournament.phase='groups';
  gTournament.currentGroupTab=0;
  // Generar partidos de cada grupo
  gTournament.groupMatches=[];
  gTournament.groups.forEach((group,gi)=>{
    for(let i=0;i<group.length;i++)
      for(let j=i+1;j<group.length;j++)
        gTournament.groupMatches.push({
          groupIdx:gi, p1:group[i], p2:group[j],
          sets1:0, sets2:0, setScores:[], done:false
        });
  });
  renderGroupsMain();
  goTo('screen-groups-main');
}

function volverDeGrupos() {
  if(gTournament.phase==='elimination') goTo('screen-groups-main');
  else goTo('screen-home');
}

// ── RENDER GRUPOS MAIN ────────────────────
function renderGroupsMain() {
  document.getElementById('gt-header-name').textContent=gTournament.name;
  document.getElementById('gt-phase-label').textContent='Fase de Grupos';

  // Tabs: uno por grupo + "Posiciones"
  const tabsEl=document.getElementById('groups-tabs');
  let tabsHtml='';
  gTournament.groups.forEach((_,gi)=>{
    tabsHtml+=`<button class="tab${gi===gTournament.currentGroupTab?' active':''}"
      onclick="switchGroupTab(${gi})">Grupo ${GROUP_NAMES[gi]}</button>`;
  });
  tabsHtml+=`<button class="tab${gTournament.currentGroupTab===gTournament.groups.length?' active':''}"
    onclick="switchGroupTab(${gTournament.groups.length})">General</button>`;
  tabsEl.innerHTML=tabsHtml;

  renderGroupTabContent();
}

function switchGroupTab(idx) {
  gTournament.currentGroupTab=idx;
  document.querySelectorAll('#groups-tabs .tab').forEach((t,i)=>
    t.classList.toggle('active',i===idx));
  renderGroupTabContent();
}

function renderGroupTabContent() {
  const content=document.getElementById('groups-main-content');
  const idx=gTournament.currentGroupTab;

  if(idx===gTournament.groups.length) {
    // Tab general: posiciones de todos los grupos + botón avanzar
    renderGeneralTab(content); return;
  }

  // Tab de grupo específico
  const group=gTournament.groups[idx];
  const color=GROUP_COLORS[idx];
  const matches=gTournament.groupMatches.filter(m=>m.groupIdx===idx);
  const stats=calcGroupStats(idx);
  const allDone=matches.every(m=>m.done);

  let html=`<div class="group-card">
    <div class="group-header">
      <div class="group-badge" style="background:${color};">G${GROUP_NAMES[idx]}</div>
      <span>Posiciones Grupo ${GROUP_NAMES[idx]}</span>
    </div>
    <div style="padding:4px 0;">
      <div style="display:flex;font-size:10px;color:var(--muted);font-weight:700;
        padding:6px 16px;letter-spacing:.5px;border-bottom:1px solid var(--border);">
        <div style="width:20px;">#</div>
        <div style="flex:1;">JUGADOR</div>
        <div style="width:28px;text-align:center;">PTS</div>
        <div style="width:24px;text-align:center;">G</div>
        <div style="width:24px;text-align:center;">P</div>
        <div style="width:36px;text-align:center;">SETS</div>
      </div>`;

  stats.forEach((s,rank)=>{
    const passing=rank<2&&allDone;
    html+=`<div class="group-player" style="${passing?'background:rgba(34,197,94,.07);':''}">
      <div class="group-player-num" style="color:${passing?'var(--win)':'var(--muted)'};">${rank+1}${passing?'*':''}</div>
      <div class="group-player-name" style="font-weight:${rank<2?600:400};">${gTournament.players[s.idx]}</div>
      <div class="group-player-stats">
        <span><span class="stat-val">${s.pts}</span></span>
        <span><span class="stat-val g">${s.won}</span></span>
        <span><span class="stat-val p">${s.lost}</span></span>
        <span><span class="stat-val">${s.setW}-${s.setL}</span></span>
      </div>
    </div>`;
  });
  html+=`</div></div>`;

  // Partidos del grupo
  html+=`<div class="section-label" style="margin-top:4px;">Partidos</div>`;
  matches.forEach((m,mi)=>{
    const realIdx=gTournament.groupMatches.indexOf(m);
    const p1name=gTournament.players[m.p1], p2name=gTournament.players[m.p2];
    if(m.done){
      const w=m.sets1>m.sets2?'p1':'p2';
      const detail=m.setScores.map(([a,b])=>`${a}-${b}`).join(', ');
      html+=`<div class="match-row done">
        <div style="flex:1;text-align:left;color:${w==='p1'?'var(--win)':'var(--muted)'};font-weight:${w==='p1'?700:400};font-size:14px;">${p1name}</div>
        <div style="display:flex;gap:8px;align-items:center;flex-shrink:0;">
          <span class="orb" style="color:var(--blue);font-size:18px;">${m.sets1}</span>
          <span style="color:var(--muted);">–</span>
          <span class="orb" style="color:var(--red);font-size:18px;">${m.sets2}</span>
        </div>
        <div style="flex:1;text-align:right;color:${w==='p2'?'var(--win)':'var(--muted)'};font-weight:${w==='p2'?700:400};font-size:14px;">${p2name}</div>
      </div>
      ${detail?`<div style="font-size:11px;color:var(--border);text-align:center;margin:-6px 0 8px;">${detail}</div>`:''}`;
    } else {
      html+=`<div class="match-row" onclick="abrirResultado(${realIdx},'group')">
        <div style="flex:1;text-align:left;color:var(--blue);font-weight:700;font-size:14px;">${p1name}</div>
        <div class="match-vs">VS</div>
        <div style="flex:1;text-align:right;color:var(--red);font-weight:700;font-size:14px;">${p2name}</div>
        <div style="margin-left:10px;color:var(--accent);">+</div>
      </div>`;
    }
  });

  if(allDone) {
    const top2=stats.slice(0,2).map(s=>gTournament.players[s.idx]);
    html+=`<div class="advance-banner" style="margin-top:8px;">
      Clasifican: <b>${top2.join(' y ')}</b>
    </div>`;
  }

  content.innerHTML=html;
}

function renderGeneralTab(content) {
  const allGroupsDone=gTournament.groups.every((_,gi)=>{
    const m=gTournament.groupMatches.filter(x=>x.groupIdx===gi);
    return m.every(x=>x.done);
  });

  let html='';
  gTournament.groups.forEach((_,gi)=>{
    const color=GROUP_COLORS[gi];
    const stats=calcGroupStats(gi);
    const done=gTournament.groupMatches.filter(m=>m.groupIdx===gi).every(m=>m.done);
    html+=`<div class="group-card" style="margin-bottom:12px;">
      <div class="group-header">
        <div class="group-badge" style="background:${color};">G${GROUP_NAMES[gi]}</div>
        <span>Grupo ${GROUP_NAMES[gi]}</span>
        ${done?`<span style="margin-left:auto;font-size:11px;color:var(--win);font-weight:600;">Completo</span>`:''}
      </div>`;
    stats.forEach((s,rank)=>{
      html+=`<div class="group-player" style="${rank<2&&done?'background:rgba(34,197,94,.07);':''}">
        <div class="group-player-num" style="color:${rank<2&&done?'var(--win)':'var(--muted)'};">${rank+1}${rank<2&&done?'*':''}</div>
        <div class="group-player-name" style="font-weight:${rank<2?600:400};font-size:13px;">${gTournament.players[s.idx]}</div>
        <div class="group-player-stats">
          <span><span class="stat-val g">${s.won}</span>G</span>
          <span><span class="stat-val p">${s.lost}</span>P</span>
        </div>
      </div>`;
    });
    html+=`</div>`;
  });

  if(allGroupsDone && gTournament.phase==='groups') {
    html+=`<button class="btn-primary" onclick="iniciarEliminacion()" style="margin-top:8px;">
      Iniciar Fase Eliminatoria
    </button>`;
  } else if(gTournament.phase==='elimination') {
    html+=`<button class="btn-primary" onclick="goTo('screen-elimination')" style="margin-top:8px;">
      Ver Cuadro Eliminatorio
    </button>`;
  }

  content.innerHTML=html;
}

// ── STATS DE GRUPO ────────────────────────
function calcGroupStats(gi) {
  const group=gTournament.groups[gi];
  const st=group.map(pi=>({idx:pi,pts:0,won:0,lost:0,setW:0,setL:0,ptW:0,ptL:0}));
  gTournament.groupMatches.filter(m=>m.groupIdx===gi&&m.done).forEach(m=>{
    const s1=st.find(x=>x.idx===m.p1), s2=st.find(x=>x.idx===m.p2);
    if(!s1||!s2)return;
    s1.setW+=m.sets1; s1.setL+=m.sets2;
    s2.setW+=m.sets2; s2.setL+=m.sets1;
    m.setScores.forEach(([a,b])=>{s1.ptW+=a;s1.ptL+=b;s2.ptW+=b;s2.ptL+=a;});
    const w=m.sets1>m.sets2?s1:s2, l=w===s1?s2:s1;
    w.pts+=2; w.won++; l.lost++;
  });
  return st.sort((a,b)=>b.pts-a.pts||(b.setW-b.setL)-(a.setW-a.setL)||(b.ptW-b.ptL)-(a.ptW-a.ptL));
}

// ── INGRESO DE RESULTADO ──────────────────
function abrirResultado(matchIdx, context) {
  currentResultMatch=matchIdx;
  resultMatchContext=context;
  let m, p1name, p2name;
  if(context==='group'){
    m=gTournament.groupMatches[matchIdx];
    p1name=gTournament.players[m.p1];
    p2name=gTournament.players[m.p2];
  } else {
    const {ri,mi}=matchIdx;
    m=gTournament.elimRounds[ri][mi];
    p1name=m.p1name; p2name=m.p2name;
  }
  document.getElementById('result-match-info').innerHTML=`
    <div class="result-player-name left">${p1name}</div>
    <div style="color:var(--muted);font-size:18px;flex-shrink:0;">VS</div>
    <div class="result-player-name right">${p2name}</div>`;

  // Sets existentes o 3 vacíos
  const existingSets = context==='group'
    ? (m.setScores||[])
    : (m.setScores||[]);

  document.getElementById('result-sets-container').innerHTML='';
  const setsToShow = existingSets.length > 0 ? existingSets : [[null,null],[null,null],[null,null]];
  setsToShow.forEach(([a,b])=>addSetRow(a,b));

  goTo('screen-result-entry');
}

let setRowCount=0;
function addSetRow(valA=null, valB=null) {
  setRowCount++;
  const id=setRowCount;
  const container=document.getElementById('result-sets-container');
  const row=document.createElement('div');
  row.className='set-row'; row.id=`set-row-${id}`;
  row.innerHTML=`
    <div class="set-row-label">Set ${container.children.length+1}</div>
    <input type="number" class="set-input" id="set-a-${id}" min="0" max="99"
      value="${valA!==null?valA:''}" placeholder="0">
    <div class="set-dash">–</div>
    <input type="number" class="set-input" id="set-b-${id}" min="0" max="99"
      value="${valB!==null?valB:''}" placeholder="0">
    <button class="btn-remove-set" onclick="removeSetRow('set-row-${id}')">×</button>`;
  container.appendChild(row);
  // Renumber
  renumberSets();
}

function removeSetRow(id) {
  const el=document.getElementById(id);
  if(el) el.remove();
  renumberSets();
}

function renumberSets() {
  document.querySelectorAll('#result-sets-container .set-row').forEach((row,i)=>{
    const label=row.querySelector('.set-row-label');
    if(label) label.textContent=`Set ${i+1}`;
  });
}

function guardarResultado() {
  const rows=document.querySelectorAll('#result-sets-container .set-row');
  const setScores=[];
  let sets1=0, sets2=0;
  let valid=true;

  rows.forEach(row=>{
    const inputs=row.querySelectorAll('.set-input');
    const a=parseInt(inputs[0].value), b=parseInt(inputs[1].value);
    if(isNaN(a)||isNaN(b)){valid=false;return;}
    setScores.push([a,b]);
    if(a>b) sets1++; else sets2++;
  });

  if(!valid||setScores.length===0){showToast('Completa todos los sets');return;}
  if(sets1===sets2){showToast('Debe haber un ganador');return;}

  if(resultMatchContext==='group'){
    const m=gTournament.groupMatches[currentResultMatch];
    m.sets1=sets1; m.sets2=sets2; m.setScores=setScores; m.done=true;
    goTo('screen-groups-main');
    renderGroupsMain();
  } else {
    const {ri,mi}=currentResultMatch;
    const m=gTournament.elimRounds[ri][mi];
    m.sets1=sets1; m.sets2=sets2; m.setScores=setScores; m.done=true;
    m.winner=sets1>sets2?m.p1:m.p2;
    m.winnername=sets1>sets2?m.p1name:m.p2name;
    propagateElimWinner(ri,mi);
    goTo('screen-elimination');
    renderElimination();
  }
}

// ── FASE ELIMINATORIA ─────────────────────
function iniciarEliminacion() {
  // Obtener los 2 clasificados de cada grupo
  const classified=[];
  gTournament.groups.forEach((_,gi)=>{
    const top=calcGroupStats(gi).slice(0,2);
    top.forEach((s,pos)=>classified.push({playerIdx:s.idx,group:gi,pos}));
  });

  // Generar rondas eliminatorias
  const n=classified.length; // 2 clasificados x numGroups
  gTournament.elimRounds=[];
  gTournament.phase='elimination';

  // Primera ronda: enfrentar 1° grupo A vs 2° grupo B, etc. (cross)
  const seeds=buildSeeding(classified);
  const firstRound=[];
  for(let i=0;i<seeds.length;i+=2){
    const home=seeds[i], away=seeds[i+1]||null;
    firstRound.push({
      p1:home?home.playerIdx:null, p1name:home?gTournament.players[home.playerIdx]:'TBD',
      p2:away?away.playerIdx:null, p2name:away?gTournament.players[away.playerIdx]:'TBD',
      sets1:0, sets2:0, setScores:[], done:false, winner:null, winnername:null,
    });
  }
  gTournament.elimRounds.push(firstRound);

  // Generar rondas siguientes vacías
  let current=firstRound.length;
  while(current>1){
    current=Math.ceil(current/2);
    const round=Array.from({length:current},()=>({
      p1:null,p1name:'TBD',p2:null,p2name:'TBD',
      sets1:0,sets2:0,setScores:[],done:false,winner:null,winnername:null,
    }));
    gTournament.elimRounds.push(round);
  }

  document.getElementById('elim-header-name').textContent=gTournament.name;
  renderElimination();
  goTo('screen-elimination');
}

function buildSeeding(classified) {
  // 1° de cada grupo alternados con 2° para cruces
  const first=classified.filter(c=>c.pos===0);
  const second=classified.filter(c=>c.pos===1);
  const seeds=[];
  // Emparejar: 1°A vs 2°B, 1°B vs 2°A, etc.
  for(let i=0;i<first.length;i++){
    seeds.push(first[i]);
    const cross=second.find(s=>s.group!==first[i].group&&!seeds.includes(s));
    seeds.push(cross||second[i]);
  }
  return seeds;
}

function propagateElimWinner(ri,mi) {
  const nextRi=ri+1;
  if(nextRi>=gTournament.elimRounds.length)return;
  const nextMi=Math.floor(mi/2);
  const isFirst=mi%2===0;
  const nextMatch=gTournament.elimRounds[nextRi][nextMi];
  const m=gTournament.elimRounds[ri][mi];
  if(isFirst){nextMatch.p1=m.winner;nextMatch.p1name=m.winnername;}
  else{nextMatch.p2=m.winner;nextMatch.p2name=m.winnername;}
}

const ROUND_NAMES=['Octavos de Final','Cuartos de Final','Semifinal','Final'];

function renderElimination() {
  document.getElementById('elim-header-name').textContent=gTournament.name;
  const totalRounds=gTournament.elimRounds.length;
  let html='';

  gTournament.elimRounds.forEach((round,ri)=>{
    const nameIdx=Math.max(0,ROUND_NAMES.length-(totalRounds-ri));
    const roundName=totalRounds-ri<=ROUND_NAMES.length
      ?ROUND_NAMES[ROUND_NAMES.length-(totalRounds-ri)]
      :`Ronda ${ri+1}`;
    html+=`<div class="elim-round-title">${roundName}</div>`;
    round.forEach((m,mi)=>{
      const canPlay=m.p1name!=='TBD'&&m.p2name!=='TBD'&&!m.done;
      const isFinal=ri===totalRounds-1;
      if(m.done){
        const w1=m.sets1>m.sets2, detail=m.setScores.map(([a,b])=>`${a}-${b}`).join(', ');
        html+=`<div class="elim-match">
          <div class="elim-player">
            <div class="elim-seed">${isFinal?'':''}</div>
            <div class="elim-player-name${w1?' winner':''}">${m.p1name}</div>
            <div class="elim-player-sets${w1?' winner':''}">${m.sets1}</div>
          </div>
          <div class="elim-player">
            <div class="elim-seed"></div>
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
        html+=`<div class="elim-match${canPlay?' clickable':''}"
          ${canPlay?`onclick="abrirResultadoElim(${ri},${mi})"`:''}>
          <div class="elim-player">
            <div class="elim-seed"></div>
            <div class="elim-player-name${m.p1name==='TBD'?' elim-tbd':''}">${m.p1name}</div>
            <div class="elim-player-sets">—</div>
          </div>
          <div class="elim-player">
            <div class="elim-seed"></div>
            <div class="elim-player-name${m.p2name==='TBD'?' elim-tbd':''}">${m.p2name}</div>
            <div class="elim-player-sets">—</div>
          </div>
          ${canPlay?`<div class="elim-result-detail" style="color:var(--accent);">Toca para ingresar resultado</div>`:''}
        </div>`;
      }
    });
  });

  document.getElementById('elim-content').innerHTML=html;
}

function abrirResultadoElim(ri,mi) {
  currentResultMatch={ri,mi};
  resultMatchContext='elim';
  const m=gTournament.elimRounds[ri][mi];
  document.getElementById('result-match-info').innerHTML=`
    <div class="result-player-name left">${m.p1name}</div>
    <div style="color:var(--muted);font-size:18px;flex-shrink:0;">VS</div>
    <div class="result-player-name right">${m.p2name}</div>`;
  document.getElementById('result-sets-container').innerHTML='';
  setRowCount=0;
  const setsToShow=m.setScores.length>0?m.setScores:[[null,null],[null,null],[null,null]];
  setsToShow.forEach(([a,b])=>addSetRow(a,b));
  goTo('screen-result-entry');
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
  const sw=`const C='spinscore-v2';const F=['./','./index.html','./css/style.css','./js/app.js'];
  self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(F)));self.skipWaiting();});
  self.addEventListener('fetch',e=>{e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));});`;
  const blob=new Blob([sw],{type:'application/javascript'});
  navigator.serviceWorker.register(URL.createObjectURL(blob)).catch(()=>{});
}

window.addEventListener('load',()=>{
  updateHomeLabel();
  const installed=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone;
  if(!installed) setTimeout(()=>document.getElementById('install-banner').classList.add('show'),1500);
});
