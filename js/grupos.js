/* SpinScore v1.8.5 — grupos.js */

function nuevoTorneoGrupos() {
  // Reset GT for a fresh tournament
  GT.id = null;
  GT.name = '';
  GT.numGroups = 4;
  GT.players = [];
  GT.groups = [];
  GT.confirmed = false;
  GT.phase = 'groups';
  GT.currentGroupTab = 0;
  GT.groupMatches = [];
  GT.elimRounds = [];
  GT.podio = null;
  // Reset UI
  const nameEl = document.getElementById('gt-name');
  if (nameEl) nameEl.value = 'Torneo';
  const gpList = document.getElementById('gp-list');
  if (gpList) gpList.innerHTML = '';
  document.getElementById('gp-count').textContent = '0';
  document.getElementById('gp-max').textContent = '16';
  document.getElementById('btn-sortear').disabled = true;
  const info = document.getElementById('gp-info');
  if (info) info.classList.add('d-none');
  // Sync chips to default 4
  document.querySelectorAll('#chips-groups .ss-chip').forEach(c =>
    c.classList.toggle('active', +c.dataset.val === 4));
  goTo('screen-groups-setup');
}

/* SpinScore v1.6 — grupos.js */

const GROUP_COLORS = ['#4FC3F7','#F5C518','#E63946','#22C55E','#A78BFA','#FB923C','#F472B6','#34D399'];
const GROUP_NAMES  = ['A','B','C','D','E','F','G','H'];

const GT = {
  name:'', numGroups:4, players:[], groups:[],
  confirmed:false, phase:'groups', currentGroupTab:0,
  groupMatches:[], elimRounds:[],
};

// ── FIX: selectGroups busca .ss-chip (HTML) ──
function selectGroups(n) {
  GT.numGroups = n;
  document.querySelectorAll('#chips-groups .ss-chip').forEach(c =>
    c.classList.toggle('active', +c.dataset.val === n));
  document.getElementById('gp-max').textContent = n * 4;
  _updateGPInfo();
}

function addGPlayer() {
  const input = document.getElementById('gp-input');
  const name  = input.value.trim(); if (!name) return;
  const max = GT.numGroups * 4;
  if (GT.players.length >= max) { showToast(`Maximo ${max} jugadores`); return; }
  if (GT.players.includes(name)) { showToast('Jugador ya existe'); return; }
  GT.players.push(name); input.value = ''; input.focus();
  renderGPList();
}

function removeGPlayer(i) { GT.players.splice(i,1); renderGPList(); }

function renderGPList() {
  document.getElementById('gp-count').textContent = GT.players.length;
  document.getElementById('gp-list').innerHTML = GT.players.map((p,i)=>`
    <div class="player-item">
      <div class="player-badge">${i+1}</div>
      <span style="flex:1;font-size:15px;">${p}</span>
      <button class="btn-remove" onclick="removeGPlayer(${i})">×</button>
    </div>`).join('');
  _updateGPInfo();
  document.getElementById('btn-sortear').disabled = GT.players.length < 2;
}

function _updateGPInfo() {
  const n = GT.players.length, info = document.getElementById('gp-info');
  if (n >= 2) { info.classList.remove('d-none'); info.textContent = `${n} jugadores en ${GT.numGroups} grupos (~${Math.ceil(n/GT.numGroups)} por grupo)`; }
  else info.classList.add('d-none');
}

function sortearGrupos() {
  const players = [...GT.players];
  for (let i=players.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[players[i],players[j]]=[players[j],players[i]];}
  GT.groups = Array.from({length:GT.numGroups},()=>[]);
  players.forEach((p,i)=>GT.groups[i%GT.numGroups].push(GT.players.indexOf(p)));
  _renderGroupsPreview();
  goTo('screen-groups-preview');
}

function _renderGroupsPreview() {
  document.getElementById('groups-preview-content').innerHTML = GT.groups.map((group,gi)=>`
    <div class="group-card">
      <div class="group-header">
        <div class="group-badge" style="background:${GROUP_COLORS[gi]};">G${GROUP_NAMES[gi]}</div>
        <span>Grupo ${GROUP_NAMES[gi]}</span>
      </div>
      ${group.map((pi,pos)=>`
        <div class="group-player">
          <div class="group-player-num">${pos+1}</div>
          <div class="group-player-name">${GT.players[pi]}</div>
        </div>`).join('')}
    </div>`).join('');
}

function confirmarGrupos() {
  // Assign a new unique ID to this tournament
  const GT = getGT ? getGT() : window.GT;
  if (!GT.id) {
    GT.id        = storageNewId();
    GT.createdAt = Date.now();
  }
  GT.name = document.getElementById('gt-name').value.trim()||'Torneo';
  GT.confirmed=true; GT.phase='groups'; GT.currentGroupTab=0;
  GT.groupMatches=[];
  GT.groups.forEach((group,gi)=>{
    for(let i=0;i<group.length;i++)
      for(let j=i+1;j<group.length;j++)
        GT.groupMatches.push({groupIdx:gi,p1:group[i],p2:group[j],sets1:0,sets2:0,setScores:[],done:false});
  });
  renderGroupsMain(); goTo('screen-groups-main');
}

function renderGroupsMain() {
  document.getElementById('gt-header-name').textContent = GT.name;
  document.getElementById('gt-phase-label').textContent = 'Fase de Grupos';
  const tabsEl = document.getElementById('groups-tabs');
  tabsEl.innerHTML = GT.groups.map((_,gi)=>
    `<button class="tab${gi===GT.currentGroupTab?' active':''}" onclick="switchGroupTab(${gi})">Grupo ${GROUP_NAMES[gi]}</button>`
  ).join('') + `<button class="tab${GT.currentGroupTab===GT.groups.length?' active':''}" onclick="switchGroupTab(${GT.groups.length})">General</button>`;
  renderGroupTabContent();
}

function switchGroupTab(idx) {
  GT.currentGroupTab=idx;
  document.querySelectorAll('#groups-tabs .tab').forEach((t,i)=>t.classList.toggle('active',i===idx));
  renderGroupTabContent();
}

function renderGroupTabContent() {
  const content = document.getElementById('groups-main-content');
  GT.currentGroupTab===GT.groups.length ? _renderGeneralTab(content) : _renderSingleGroupTab(content,GT.currentGroupTab);
}

function _renderSingleGroupTab(content, idx) {
  const color=GROUP_COLORS[idx], matches=GT.groupMatches.filter(m=>m.groupIdx===idx);
  const stats=calcGroupStats(idx), allDone=matches.every(m=>m.done);
  const isDesktop=window.innerWidth>=768;

  let html=`<div class="group-card">
    <div class="group-header">
      <div class="group-badge" style="background:${color};">G${GROUP_NAMES[idx]}</div>
      <span style="color:var(--ss-text);">Grupo ${GROUP_NAMES[idx]}</span>
      ${allDone?`<span style="margin-left:auto;font-size:11px;color:var(--ss-win);font-weight:600;">Completo</span>`:''}
    </div>
    <div style="display:flex;font-size:10px;color:var(--ss-muted);font-weight:700;padding:6px 16px;letter-spacing:.5px;border-bottom:1px solid var(--ss-border);">
      <div style="width:24px;">#</div><div style="flex:1;">JUGADOR</div>
      <div style="width:32px;text-align:center;">PTS</div>
      <div style="width:26px;text-align:center;">G</div>
      <div style="width:26px;text-align:center;">P</div>
      <div style="width:40px;text-align:center;">SETS</div>
    </div>`;

  stats.forEach((s,rank)=>{
    const passing=rank<2&&allDone;
    html+=`<div class="group-player" style="${passing?'background:rgba(34,197,94,.07);':''}">
      <div class="group-player-num" style="color:${passing?'var(--ss-win)':'var(--ss-muted)'};">${rank+1}${passing?'*':''}</div>
      <div class="group-player-name" style="font-weight:${rank<2?600:400};">${GT.players[s.idx]}</div>
      <div class="group-player-stats">
        <span><span class="stat-val">${s.pts}</span></span>
        <span><span class="stat-val g">${s.won}</span></span>
        <span><span class="stat-val p">${s.lost}</span></span>
        <span><span class="stat-val">${s.setW}-${s.setL}</span></span>
      </div>
    </div>`;
  });
  html+=`</div><div class="section-label" style="margin-top:8px;">Partidos</div>`;
  if(isDesktop) html+=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">`;

  matches.forEach(m=>{
    const ri=GT.groupMatches.indexOf(m), p1=GT.players[m.p1], p2=GT.players[m.p2];
    if(m.done){
      const w=m.sets1>m.sets2?'p1':'p2', detail=m.setScores.map(([a,b])=>`${a}-${b}`).join(' | ');
      html+=`<div class="match-row done" style="flex-direction:column;align-items:stretch;gap:4px;">
        <div style="display:flex;align-items:center;">
          <div style="flex:1;color:${w==='p1'?'var(--ss-win)':'var(--ss-muted)'};font-weight:${w==='p1'?700:400};font-size:14px;">${p1}</div>
          <div style="display:flex;gap:8px;align-items:center;">
            <span class="orb" style="color:var(--ss-blue);font-size:16px;">${m.sets1}</span>
            <span style="color:var(--ss-muted);">–</span>
            <span class="orb" style="color:var(--ss-red);font-size:16px;">${m.sets2}</span>
          </div>
          <div style="flex:1;text-align:right;color:${w==='p2'?'var(--ss-win)':'var(--ss-muted)'};font-weight:${w==='p2'?700:400};font-size:14px;">${p2}</div>
        </div>
        ${detail?`<div style="font-size:11px;color:var(--ss-border);text-align:center;">${detail}</div>`:''}
      </div>`;
    } else {
      html+=`<div class="match-row" onclick="abrirResultado(${ri},'group')">
        <div style="flex:1;text-align:left;color:var(--ss-blue);font-weight:700;font-size:14px;">${p1}</div>
        <div class="match-vs">VS</div>
        <div style="flex:1;text-align:right;color:var(--ss-red);font-weight:700;font-size:14px;">${p2}</div>
        <div style="margin-left:10px;color:var(--ss-accent);font-size:18px;">+</div>
      </div>`;
    }
  });
  if(isDesktop) html+=`</div>`;
  if(allDone){
    const top2=stats.slice(0,2).map(s=>GT.players[s.idx]);
    html+=`<div class="advance-banner mt-3">Clasifican: <b>${top2.join(' y ')}</b></div>`;
  }
  content.innerHTML=html;
}

function _renderGeneralTab(content) {
  const allDone=GT.groups.every((_,gi)=>GT.groupMatches.filter(x=>x.groupIdx===gi).every(x=>x.done));
  const isDesktop=window.innerWidth>=768;
  let html='';
  if(isDesktop) html+=`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;">`;

  GT.groups.forEach((_,gi)=>{
    const color=GROUP_COLORS[gi], stats=calcGroupStats(gi);
    const done=GT.groupMatches.filter(m=>m.groupIdx===gi).every(m=>m.done);
    html+=`<div class="group-card">
      <div class="group-header">
        <div class="group-badge" style="background:${color};">G${GROUP_NAMES[gi]}</div>
        <span style="color:var(--ss-text);">Grupo ${GROUP_NAMES[gi]}</span>
        ${done?`<span style="margin-left:auto;font-size:11px;color:var(--ss-win);font-weight:600;">Listo</span>`:''}
      </div>`;
    stats.forEach((s,rank)=>{
      html+=`<div class="group-player" style="${rank<2&&done?'background:rgba(34,197,94,.07);':''}">
        <div class="group-player-num" style="color:${rank<2&&done?'var(--ss-win)':'var(--ss-muted)'};">${rank+1}${rank<2&&done?'*':''}</div>
        <div class="group-player-name" style="font-weight:${rank<2?600:400};font-size:13px;">${GT.players[s.idx]}</div>
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

  if(allDone&&GT.phase==='groups'){
    html+=`<div style="margin-top:16px;"><button class="btn-primary" onclick="iniciarEliminacion()">Iniciar Fase Eliminatoria</button></div>`;
  } else if(GT.phase==='elimination'){
    html+=`<div style="margin-top:16px;"><button class="btn-primary" onclick="goTo('screen-elimination')">Ver Cuadro Eliminatorio</button></div>`;
  }
  content.innerHTML=html;
}

function calcGroupStats(gi) {
  const group=GT.groups[gi];
  const st=group.map(pi=>({idx:pi,pts:0,won:0,lost:0,setW:0,setL:0,ptW:0,ptL:0}));
  GT.groupMatches.filter(m=>m.groupIdx===gi&&m.done).forEach(m=>{
    const s1=st.find(x=>x.idx===m.p1), s2=st.find(x=>x.idx===m.p2);
    if(!s1||!s2)return;
    s1.setW+=m.sets1;s1.setL+=m.sets2;s2.setW+=m.sets2;s2.setL+=m.sets1;
    m.setScores.forEach(([a,b])=>{s1.ptW+=a;s1.ptL+=b;s2.ptW+=b;s2.ptL+=a;});
    const w=m.sets1>m.sets2?s1:s2,l=w===s1?s2:s1;
    w.pts+=2;w.won++;l.lost++;
  });
  return st.sort((a,b)=>b.pts-a.pts||(b.setW-b.setL)-(a.setW-a.setL)||(b.ptW-b.ptL)-(a.ptW-a.ptL));
}

// ── INGRESO DE RESULTADO ──
let _crm=null, _rmc=null, _src=0;

function abrirResultado(matchIdx, context) {
  _crm=matchIdx; _rmc=context;
  let p1name,p2name,existing=[];
  if(context==='group'){
    const m=GT.groupMatches[matchIdx];
    p1name=GT.players[m.p1]; p2name=GT.players[m.p2]; existing=m.setScores||[];
  } else {
    const {ri,mi}=matchIdx, m=GT.elimRounds[ri][mi];
    p1name=m.p1name; p2name=m.p2name; existing=m.setScores||[];
  }
  document.getElementById('result-match-info').innerHTML=`
    <div class="result-player-name left">${p1name}</div>
    <div style="color:var(--ss-muted);font-size:18px;flex-shrink:0;">VS</div>
    <div class="result-player-name right">${p2name}</div>`;
  document.getElementById('result-sets-container').innerHTML='';
  _src=0;

  // ── FIX: mostrar solo los sets que corresponden ──
  // Si hay resultados existentes, mostrarlos. Si no, empezar con 2 filas vacías.
  if(existing.length>0){
    existing.forEach(([a,b])=>addSetRow(a,b));
  } else {
    // Empezar con 2 sets vacíos (mínimo para ganar al mejor de 3 o más)
    addSetRow(); addSetRow();
  }

  const btn=document.getElementById('result-back-btn');
  if(btn) btn.onclick=()=>goTo(context==='elim'?'screen-elimination':'screen-groups-main');
  goTo('screen-result-entry');
}

function addSetRow(valA=null,valB=null){
  _src++;
  const id=_src, container=document.getElementById('result-sets-container');
  const num=container.children.length+1;
  const row=document.createElement('div');
  row.className='set-row'; row.id=`set-row-${id}`;
  row.innerHTML=`
    <div class="set-row-label">Set ${num}</div>
    <input type="number" class="set-input" id="set-a-${id}" min="0" max="99" value="${valA!==null?valA:''}" placeholder="0">
    <div class="set-dash">–</div>
    <input type="number" class="set-input" id="set-b-${id}" min="0" max="99" value="${valB!==null?valB:''}" placeholder="0">
    <button class="btn-remove-set" onclick="removeSetRow('set-row-${id}')">×</button>`;
  container.appendChild(row);
  _renumberSets();
}

function removeSetRow(id){const el=document.getElementById(id);if(el)el.remove();_renumberSets();}
function _renumberSets(){
  document.querySelectorAll('#result-sets-container .set-row').forEach((r,i)=>{
    const l=r.querySelector('.set-row-label');if(l)l.textContent=`Set ${i+1}`;
  });
}

function guardarResultado() {
  const rows=document.querySelectorAll('#result-sets-container .set-row');
  const setScores=[];let sets1=0,sets2=0,valid=true;
  const setsNeeded=Math.ceil(STATE.cfg.sets/2);

  rows.forEach(row=>{
    const inputs=row.querySelectorAll('.set-input');
    const a=parseInt(inputs[0].value), b=parseInt(inputs[1].value);
    if(isNaN(a)||isNaN(b)){valid=false;return;}
    setScores.push([a,b]);
    if(a>b)sets1++;else sets2++;
  });

  if(!valid||setScores.length===0){showToast('Completa todos los sets');return;}

  // Validar que alguien llegó a setsNeeded
  if(sets1<setsNeeded&&sets2<setsNeeded){showToast(`Faltan sets: necesitas ${setsNeeded} ganados`);return;}
  if(sets1===sets2){showToast('Debe haber un ganador');return;}
  if(setScores.length>STATE.cfg.sets){showToast(`Maximo ${STATE.cfg.sets} sets`);return;}

  if(_rmc==='group'){
    const m=GT.groupMatches[_crm];
    m.sets1=sets1;m.sets2=sets2;m.setScores=setScores;m.done=true;
    storageSnapshot();
    renderGroupsMain();goTo('screen-groups-main');
  } else {
    const {ri,mi}=_crm, m=GT.elimRounds[ri][mi];
    m.sets1=sets1;m.sets2=sets2;m.setScores=setScores;m.done=true;
    m.winner=sets1>sets2?m.p1:m.p2;
    m.winnername=sets1>sets2?m.p1name:m.p2name;
    _propagateElimWinner(ri,mi);
    // Verificar si es la final y mostrar podio
    const isLastRound=ri===GT.elimRounds.length-1;
    if(isLastRound) {
      setTimeout(()=>_mostrarPodioPorGrupos(), 300);
    }
    renderElimination();goTo('screen-elimination');
  }
}

function _propagateElimWinner(ri,mi){
  const nextRi=ri+1;
  if(nextRi>=GT.elimRounds.length)return;
  const nextMi=Math.floor(mi/2),isFirst=mi%2===0;
  const m=GT.elimRounds[ri][mi], next=GT.elimRounds[nextRi][nextMi];
  if(isFirst){next.p1=m.winner;next.p1name=m.winnername;}
  else{next.p2=m.winner;next.p2name=m.winnername;}
}

function _mostrarPodioPorGrupos(){
  const total=GT.elimRounds.length;
  const finalMatch=GT.elimRounds[total-1][0];
  if(!finalMatch||!finalMatch.done)return;

  // 1° campeón, 2° perdedor de la final
  // 3°/4° perdedores de las semifinales
  const champion=finalMatch.winnername;
  const runnerUp=finalMatch.sets1>finalMatch.sets2?finalMatch.p2name:finalMatch.p1name;

  const semis=total>=2?GT.elimRounds[total-2]:[];
  const semifinalists=semis
    .filter(m=>m.done)
    .map(m=>m.sets1>m.sets2?m.p2name:m.p1name)
    .filter(n=>n&&n!=='TBD'&&n!==champion&&n!==runnerUp);

  const entries=[
    {name:champion,  tournament:GT.name},
    {name:runnerUp,  tournament:GT.name},
    ...semifinalists.map(n=>({name:n,tournament:GT.name})),
  ];
  mostrarPodio(entries);
}

function getGT(){return GT;}
