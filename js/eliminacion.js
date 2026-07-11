/* SpinScore v1.6 — eliminacion.js */

const ROUND_NAMES=['Dieciseisavos','Octavos de Final','Cuartos de Final','Semifinal','Final'];

function iniciarEliminacion() {
  const GT=getGT();
  const classified=[];
  GT.groups.forEach((_,gi)=>calcGroupStats(gi).slice(0,2).forEach((s,pos)=>classified.push({playerIdx:s.idx,group:gi,pos})));
  GT.elimRounds=[]; GT.phase='elimination';
  const seeds=_buildSeeding(classified);
  const firstRound=[];
  for(let i=0;i<seeds.length;i+=2){
    const h=seeds[i],a=seeds[i+1]||null;
    firstRound.push(_nm(h?h.playerIdx:null,h?GT.players[h.playerIdx]:'TBD',a?a.playerIdx:null,a?GT.players[a.playerIdx]:'TBD'));
  }
  GT.elimRounds.push(firstRound);
  let size=firstRound.length;
  while(size>1){size=Math.ceil(size/2);GT.elimRounds.push(Array.from({length:size},()=>_nm(null,'TBD',null,'TBD')));}
  renderElimination(); goTo('screen-elimination');
}

function _nm(p1,p1name,p2,p2name){return{p1,p1name,p2,p2name,sets1:0,sets2:0,setScores:[],done:false,winner:null,winnername:null};}

function _buildSeeding(classified) {
  const first=classified.filter(c=>c.pos===0), second=classified.filter(c=>c.pos===1);
  const used=new Set(), seeds=[];
  first.forEach(f=>{
    seeds.push(f);
    const cross=second.find(s=>s.group!==f.group&&!used.has(s.group));
    if(cross){used.add(cross.group);seeds.push(cross);}
    else seeds.push(second.find(s=>!used.has(s.group))||second[0]);
  });
  return seeds;
}

function _rn(ri,total){
  const fe=total-1-ri;
  return fe<ROUND_NAMES.length?ROUND_NAMES[ROUND_NAMES.length-1-fe]:`Ronda ${ri+1}`;
}

function renderElimination() {
  const GT=getGT(), total=GT.elimRounds.length;
  const isDesktop=window.innerWidth>=768;
  const container=document.getElementById('elim-content');
  document.getElementById('elim-header-name').textContent=GT.name;
  isDesktop?_renderDesktop(container,GT,total):_renderMobile(container,GT,total);
}

function _renderMobile(container,GT,total) {
  let html='';
  GT.elimRounds.forEach((round,ri)=>{
    html+=`<div class="elim-round-title">${_rn(ri,total)}</div>`;
    round.forEach((m,mi)=>{
      const can=m.p1name!=='TBD'&&m.p2name!=='TBD'&&!m.done;
      const isFinal=ri===total-1;
      if(m.done){
        const w1=m.sets1>m.sets2, detail=m.setScores.map(([a,b])=>`${a}-${b}`).join(' | ');
        html+=`<div class="elim-match">
          <div class="elim-player"><div class="elim-player-name${w1?' winner':''}">${m.p1name}</div><div class="elim-player-sets${w1?' winner':''}">${m.sets1}</div></div>
          <div class="elim-player"><div class="elim-player-name${!w1?' winner':''}">${m.p2name}</div><div class="elim-player-sets${!w1?' winner':''}">${m.sets2}</div></div>
          ${detail?`<div class="elim-result-detail">${detail}</div>`:''}
        </div>`;
        if(isFinal&&m.done){
          html+=`<div style="background:rgba(245,197,24,.12);border:1px solid var(--ss-accent);border-radius:14px;padding:16px;text-align:center;margin-top:12px;">
            <div style="font-weight:800;color:var(--ss-accent);font-size:22px;">Campeon</div>
            <div style="font-size:20px;font-weight:700;margin-top:4px;">${m.winnername}</div>
          </div>`;
        }
      } else {
        html+=`<div class="elim-match${can?' clickable':''}" ${can?`onclick="abrirResultadoElim(${ri},${mi})"`:''}>
          <div class="elim-player"><div class="elim-player-name${m.p1name==='TBD'?' elim-tbd':''}">${m.p1name}</div><div class="elim-player-sets">–</div></div>
          <div class="elim-player"><div class="elim-player-name${m.p2name==='TBD'?' elim-tbd':''}">${m.p2name}</div><div class="elim-player-sets">–</div></div>
          ${can?`<div class="elim-result-detail" style="color:var(--ss-accent);">Toca para ingresar resultado</div>`:''}
        </div>`;
      }
    });
  });
  container.innerHTML=html;
}

function _renderDesktop(container,GT,total) {
  const firstSize=GT.elimRounds[0].length, halfSize=Math.ceil(firstSize/2);
  const leftRounds=_halfRounds(GT,'left',halfSize);
  const rightRounds=_halfRounds(GT,'right',firstSize-halfSize);
  const champion=GT.elimRounds[total-1]?.[0];
  let html=`<div class="bracket-wrapper"><div class="bracket-half bracket-left">`;
  leftRounds.forEach((round,ri)=>{
    html+=`<div class="bracket-col"><div class="bracket-round-label">${_rn(ri,total)}</div><div class="bracket-col-matches">`;
    round.forEach((m,mi)=>{html+=_bcard(m,ri,mi);});
    html+=`</div></div>`;
    if(ri<leftRounds.length-1)html+=_conn(round.length,'left');
  });
  html+=`</div>`;
  const champName=champion?.done?champion.winnername:null;
  html+=`<div class="bracket-center">
    <div class="bracket-final-label">FINAL</div>
    <div class="bracket-champion-box">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="${champName?'#F5C518':'#2A5C3A'}" stroke-width="1.5"><path d="M6 9H4a2 2 0 0 0-2 2v1a6 6 0 0 0 6 6h8a6 6 0 0 0 6-6v-1a2 2 0 0 0-2-2h-2"/><rect x="6" y="2" width="12" height="10" rx="2"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></svg>
      <div class="bracket-champion-name">${champName||'Campeon'}</div>
    </div>
    ${champion&&!champion.done&&champion.p1name!=='TBD'&&champion.p2name!=='TBD'
      ?`<button class="btn-final" onclick="abrirResultadoElim(${total-1},0)">Ingresar resultado</button>`:''
    }
  </div>`;
  html+=`<div class="bracket-half bracket-right">`;
  rightRounds.forEach((round,ri)=>{
    if(ri<rightRounds.length-1)html+=_conn(round.length,'right');
    const origOffset=halfSize;
    html+=`<div class="bracket-col"><div class="bracket-round-label">${_rn(ri,total)}</div><div class="bracket-col-matches">`;
    round.forEach((m,mi)=>{html+=_bcard(m,ri,origOffset+mi);});
    html+=`</div></div>`;
  });
  html+=`</div></div>`;
  container.innerHTML=html;
}

function _halfRounds(GT,side,firstSize) {
  const total=GT.elimRounds.length, half=[];
  GT.elimRounds.forEach((round,ri)=>{
    if(ri===total-1)return;
    const h1=Math.ceil(round.length/2);
    const slice=side==='left'?round.slice(0,h1):round.slice(h1);
    if(slice.length>0)half.push(slice);
  });
  return half;
}

function _bcard(m,ri,mi) {
  const can=m.p1name!=='TBD'&&m.p2name!=='TBD'&&!m.done;
  const w1=m.done&&m.sets1>m.sets2, w2=m.done&&m.sets2>m.sets1;
  const detail=m.done?m.setScores.map(([a,b])=>`${a}-${b}`).join(' | '):'';
  return `<div class="b-match${can?' b-clickable':''}${m.done?' b-done':''}" ${can?`onclick="abrirResultadoElim(${ri},${mi})"`:''}>
    <div class="b-team${w1?' b-winner':''}"><div class="b-name${m.p1name==='TBD'?' b-tbd':''}">${m.p1name}</div><div class="b-score${w1?' b-winner':''}">${m.done?m.sets1:'–'}</div></div>
    <div class="b-team${w2?' b-winner':''}"><div class="b-name${m.p2name==='TBD'?' b-tbd':''}">${m.p2name}</div><div class="b-score${w2?' b-winner':''}">${m.done?m.sets2:'–'}</div></div>
    ${detail?`<div class="b-detail">${detail}</div>`:''}
    ${can?`<div class="b-play-hint">Toca para ingresar</div>`:''}
  </div>`;
}

function _conn(matchCount,side) {
  const lines=Array.from({length:Math.ceil(matchCount/2)},()=>`
    <div class="conn-pair"><div class="conn-top"></div><div class="conn-mid"></div><div class="conn-bot"></div></div>`).join('');
  return `<div class="bracket-connector">${lines}</div>`;
}

function abrirResultadoElim(ri,mi){abrirResultado({ri,mi},'elim');}

function _dispararPodio() {
  const GT = getGT();
  const total = GT.elimRounds.length;
  const finalM = GT.elimRounds[total - 1]?.[0];
  if (!finalM || !finalM.done) return;

  // 1° campeón
  const champ = finalM.winnername;
  // 2° perdedor de la final
  const runner = finalM.p1name === champ ? finalM.p2name : finalM.p1name;
  // 3°/4° perdedores de semis
  const thirds = total >= 2
    ? GT.elimRounds[total - 2]
        .filter(m => m.done)
        .map(m => m.p1name === m.winnername ? m.p2name : m.p1name)
        .filter(n => n && n !== 'TBD' && n !== champ && n !== runner)
    : [];

  mostrarPodio([champ, runner, ...thirds], GT.name);
}
