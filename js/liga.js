/* SpinScore v1.6 — liga.js */

const LIGA = { name:'', players:[], matches:[], currentTab:'matches' };

function addTPlayer() {
  const input=document.getElementById('t-player-input'), name=input.value.trim();
  if(!name)return;
  if(LIGA.players.includes(name)){showToast('Jugador ya existe');return;}
  LIGA.players.push(name); input.value=''; input.focus();
  renderTPlayerList();
}
function removeTPlayer(i){LIGA.players.splice(i,1);renderTPlayerList();}
function renderTPlayerList() {
  const n=LIGA.players.length;
  document.getElementById('player-count').textContent=n;
  document.getElementById('player-list').innerHTML=LIGA.players.map((p,i)=>`
    <div class="player-item">
      <div class="player-badge">${i+1}</div>
      <span style="flex:1;font-size:15px;">${p}</span>
      <button class="btn-remove" onclick="removeTPlayer(${i})">×</button>
    </div>`).join('');
  const mc=(n*(n-1))/2, info=document.getElementById('t-match-count');
  if(n>=2){info.classList.remove('d-none');info.innerHTML=`${n} jugadores · <b style="color:var(--ss-text);">${mc}</b> partidos`;}
  else info.classList.add('d-none');
  document.getElementById('btn-start-tournament').disabled=n<2;
}
function startTournament() {
  LIGA.name=document.getElementById('t-name').value.trim()||'Liga';
  LIGA.matches=_rr(LIGA.players); LIGA.currentTab='matches';
  document.getElementById('t-header-name').textContent=LIGA.name;
  renderBracket(); goTo('screen-tournament-bracket');
}
function _rr(players) {
  const m=[];
  for(let i=0;i<players.length;i++)
    for(let j=i+1;j<players.length;j++)
      m.push({id:`${i}-${j}`,p1:i,p2:j,sets1:0,sets2:0,setHistory:[],done:false});
  return m;
}
function switchTab(tab) {
  LIGA.currentTab=tab;
  document.getElementById('tab-matches').classList.toggle('active',tab==='matches');
  document.getElementById('tab-standings').classList.toggle('active',tab==='standings');
  renderBracket();
}
function renderBracket() {
  const done=LIGA.matches.filter(m=>m.done).length, total=LIGA.matches.length;
  document.getElementById('t-header-progress').textContent=`${done}/${total} partidos`;
  LIGA.currentTab==='matches'?_renderMatchesTab():_renderStandingsTab();
}
function _renderMatchesTab() {
  const pending=LIGA.matches.filter(m=>!m.done), done=LIGA.matches.filter(m=>m.done);
  const allDone=LIGA.matches.length>0&&pending.length===0;
  let html='';
  if(allDone){
    const st=_standings(), champ=LIGA.players[st[0].idx];
    html+=`<div style="background:rgba(245,197,24,.12);border:1px solid var(--ss-accent);border-radius:14px;padding:16px;margin-bottom:16px;text-align:center;">
      <div style="font-weight:800;color:var(--ss-accent);font-size:20px;">Torneo finalizado</div>
      <div style="color:var(--ss-muted);font-size:14px;margin-top:4px;">Campeon: <b style="color:var(--ss-text);">${champ}</b></div>
    </div>`;
    // Podio liga
    const entries=st.slice(0,4).map(s=>({name:LIGA.players[s.idx],tournament:LIGA.name}));
    setTimeout(()=>mostrarPodio(entries),400);
  }
  if(pending.length>0){
    html+=`<div class="section-label">Pendientes</div>`;
    pending.forEach(m=>{
      html+=`<div class="match-row" onclick="playTournamentMatch('${m.id}')">
        <div style="flex:1;text-align:left;color:var(--ss-blue);font-weight:700;font-size:15px;">${LIGA.players[m.p1]}</div>
        <div class="match-vs">VS</div>
        <div style="flex:1;text-align:right;color:var(--ss-red);font-weight:700;font-size:15px;">${LIGA.players[m.p2]}</div>
        <div style="margin-left:10px;color:var(--ss-accent);">▶</div>
      </div>`;
    });
  }
  if(done.length>0){
    html+=`<div class="section-label" style="color:var(--ss-muted);margin-top:${pending.length>0?'16px':'0'};">Jugados</div>`;
    done.forEach(m=>{
      const w=m.sets1>m.sets2?m.p1:m.p2;
      html+=`<div class="match-row done">
        <div style="flex:1;text-align:left;color:${w===m.p1?'var(--ss-win)':'var(--ss-muted)'};font-weight:${w===m.p1?700:400};font-size:14px;">${LIGA.players[m.p1]}</div>
        <div style="display:flex;gap:8px;align-items:center;flex-shrink:0;">
          <span class="orb" style="color:var(--ss-blue);font-size:18px;">${m.sets1}</span>
          <span style="color:var(--ss-muted);">–</span>
          <span class="orb" style="color:var(--ss-red);font-size:18px;">${m.sets2}</span>
        </div>
        <div style="flex:1;text-align:right;color:${w===m.p2?'var(--ss-win)':'var(--ss-muted)'};font-weight:${w===m.p2?700:400};font-size:14px;">${LIGA.players[m.p2]}</div>
      </div>`;
    });
  }
  document.getElementById('bracket-content').innerHTML=html;
}
function _renderStandingsTab() {
  const st=_standings(), allDone=LIGA.matches.every(m=>m.done)&&LIGA.matches.length>0;
  const medals=['1°','2°','3°'];
  let html=`<div class="standings-head">
    <div style="width:28px;">#</div><div style="flex:1;">JUGADOR</div>
    <div style="width:34px;text-align:center;">PTS</div><div style="width:30px;text-align:center;">PJ</div>
    <div style="width:28px;text-align:center;">G</div><div style="width:28px;text-align:center;">P</div>
    <div style="width:42px;text-align:center;">SETS</div></div>`;
  st.forEach((s,rank)=>{
    html+=`<div class="standing-row${rank===0&&allDone?' champion':''}">
      <div style="width:28px;font-weight:800;font-size:13px;color:${rank===0?'var(--ss-accent)':'var(--ss-muted)'};">${rank<3?medals[rank]:rank+1}</div>
      <div style="flex:1;font-weight:${rank===0?700:500};font-size:14px;">${LIGA.players[s.idx]}</div>
      <div style="width:34px;text-align:center;color:var(--ss-accent);font-weight:800;">${s.pts}</div>
      <div style="width:30px;text-align:center;color:var(--ss-muted);font-size:13px;">${s.won+s.lost}</div>
      <div style="width:28px;text-align:center;color:var(--ss-win);font-size:13px;">${s.won}</div>
      <div style="width:28px;text-align:center;color:var(--ss-red);font-size:13px;">${s.lost}</div>
      <div style="width:42px;text-align:center;color:var(--ss-muted);font-size:12px;">${s.setW}-${s.setL}</div>
    </div>`;
  });
  html+=`<div class="standings-footer">2 pts por victoria · Desempate por diferencia de sets</div>`;
  document.getElementById('bracket-content').innerHTML=html;
}
function _standings() {
  const st=LIGA.players.map((_,i)=>({idx:i,pts:0,won:0,lost:0,setW:0,setL:0,ptW:0,ptL:0}));
  LIGA.matches.filter(m=>m.done).forEach(m=>{
    st[m.p1].setW+=m.sets1;st[m.p1].setL+=m.sets2;
    st[m.p2].setW+=m.sets2;st[m.p2].setL+=m.sets1;
    (m.setHistory||[]).forEach(([a,b])=>{st[m.p1].ptW+=a;st[m.p1].ptL+=b;st[m.p2].ptW+=b;st[m.p2].ptL+=a;});
    const w=m.sets1>m.sets2?m.p1:m.p2,l=w===m.p1?m.p2:m.p1;
    st[w].pts+=2;st[w].won++;st[l].lost++;
  });
  return st.sort((a,b)=>b.pts-a.pts||(b.setW-b.setL)-(a.setW-a.setL)||(b.ptW-b.ptL)-(a.ptW-a.ptL));
}
function playTournamentMatch(id) {
  const m=LIGA.matches.find(x=>x.id===id); if(!m)return;
  initMatch(LIGA.players[m.p1],LIGA.players[m.p2],true,id);
}
