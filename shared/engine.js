/* ============================================================
   MOTEUR PARTAGE POUR TOUS LES MODULES DE GEOGRAPHIE 5e-6e
   ============================================================
   Chaque page module-N.html appelle GeoEngine.initModule(config)
   avec son propre contenu (theorie, flashcards, jeu, quiz, examen).
   Ce fichier gere : etat/progression, navigation, rendu des cartes
   reelles, moteur generique de questions, registre global des
   modules (pour la page d'accueil / le deblocage sequentiel).
*/
(function(){

const REGISTRY_KEY = 'geo_5e6e_registry';

function loadRegistry(){
  try{ const raw = localStorage.getItem(REGISTRY_KEY); if(raw) return JSON.parse(raw); }catch(e){}
  return {};
}
function saveRegistry(reg){ try{ localStorage.setItem(REGISTRY_KEY, JSON.stringify(reg)); }catch(e){} }
function getModuleStatus(moduleId){
  const reg = loadRegistry();
  return reg[moduleId] || { passed:false, bestPct:0 };
}
function setModulePassed(moduleId, pct){
  const reg = loadRegistry();
  const cur = reg[moduleId] || { passed:false, bestPct:0 };
  reg[moduleId] = { passed: cur.passed || pct >= 60, bestPct: Math.max(cur.bestPct||0, pct) };
  saveRegistry(reg);
}

/* ============================================================
   OUTILS DE COMPARAISON DE TEXTE
   ============================================================ */
function normalize(str){
  return (str||'').toString().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/[^a-z0-9 ]/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}
function textMatches(input, accepted){
  const n = normalize(input);
  return accepted.some(a => n === normalize(a) || (n.length>2 && n.includes(normalize(a))));
}

/* ============================================================
   CARTES REELLES (equirectangulaire) + reperes
   ============================================================ */
const WORLD_VB = { w: 2752.766, h: 1537.631 };
function geoXY(lon, lat){
  return { x: (lon + 180) / 360 * WORLD_VB.w, y: (90 - lat) / 180 * WORLD_VB.h };
}
function mapAssetPath(name){
  return (window.GEO_ASSET_BASE || '') + name;
}
function renderWorldMap(container, opts){
  opts = opts || {};
  const markers = opts.markers || [];
  const crop = opts.crop; // {lonMin,lonMax,latMin,latMax} optionnel : zoom sur une region
  let vb = WORLD_VB, vbX = 0, vbY = 0;
  if(crop){
    const p1 = geoXY(crop.lonMin, crop.latMax);
    const p2 = geoXY(crop.lonMax, crop.latMin);
    vbX = p1.x; vbY = p1.y;
    vb = { w: p2.x - p1.x, h: p2.y - p1.y };
  }
  container.innerHTML = `
    <div class="world-map-wrap">
      <img src="${mapAssetPath('world.svg')}" class="world-map-base" alt="Carte du monde (fond de carte reel, projection equirectangulaire)" style="${crop ? `clip-path:inset(0); transform:scale(${WORLD_VB.w/vb.w}); transform-origin:${(vbX/WORLD_VB.w*100)}% ${(vbY/WORLD_VB.h*100)}%;` : ''}">
      <svg class="world-map-overlay" viewBox="${vbX} ${vbY} ${vb.w} ${vb.h}" preserveAspectRatio="xMidYMid slice"></svg>
    </div>
  `;
  if(crop){
    // recalcule un cadrage propre par recadrage CSS (object-position) plutot que le scale approximatif ci-dessus
    const wrap = container.querySelector('.world-map-wrap');
    const img = container.querySelector('.world-map-base');
    const scaleX = WORLD_VB.w / vb.w, scaleY = WORLD_VB.h / vb.h;
    wrap.style.aspectRatio = (vb.w/vb.h).toFixed(4);
    img.style.width = (scaleX*100)+'%';
    img.style.maxWidth = 'none';
    img.style.position = 'absolute';
    img.style.left = (-(vbX*scaleX/WORLD_VB.w*100)) + '%';
    img.style.top = (-(vbY*scaleY/WORLD_VB.h*100)) + '%';
    img.style.transform = 'none';
  }
  const svg = container.querySelector('.world-map-overlay');
  /* Les valeurs r/fontSize/dx/dy/stroke sont exprimees "comme sur la carte du monde entiere" ;
     sur un recadrage (crop), le meme nombre d'unites de viewBox occupe plus de pixels a l'ecran,
     donc on les reduit proportionnellement pour garder une taille visuelle coherente. */
  const scale = vb.w / WORLD_VB.w;
  markers.forEach(m=>{
    const p = geoXY(m.lon, m.lat);
    const c = document.createElementNS('http://www.w3.org/2000/svg','circle');
    c.setAttribute('cx', p.x); c.setAttribute('cy', p.y); c.setAttribute('r', (m.r || 22) * scale);
    c.setAttribute('fill', m.color || '#1f6f5c');
    c.setAttribute('stroke', '#fff'); c.setAttribute('stroke-width', 5 * scale);
    svg.appendChild(c);
    if(m.label){
      const t = document.createElementNS('http://www.w3.org/2000/svg','text');
      t.setAttribute('x', p.x + (m.dx!==undefined ? m.dx : 28) * scale);
      t.setAttribute('y', p.y + (m.dy!==undefined ? m.dy : 8) * scale);
      t.setAttribute('font-size', (m.fontSize || 38) * scale);
      t.setAttribute('font-family', 'Helvetica Neue, Arial, sans-serif');
      t.setAttribute('font-weight', 700);
      t.setAttribute('fill', m.color || '#1f6f5c');
      t.setAttribute('stroke', '#fff');
      t.setAttribute('stroke-width', 6 * scale);
      t.setAttribute('paint-order', 'stroke');
      t.textContent = m.label;
      svg.appendChild(t);
    }
  });
  if(opts.onClick){
    svg.style.cursor = 'crosshair';
    svg.addEventListener('click', function(evt){
      const pt = svg.createSVGPoint();
      pt.x = evt.clientX; pt.y = evt.clientY;
      const loc = pt.matrixTransform(svg.getScreenCTM().inverse());
      opts.onClick(loc, svg);
    });
  }
  return svg;
}

let _belgiumSvgCache = null;
async function loadBelgiumSvgMarkup(){
  if(_belgiumSvgCache) return _belgiumSvgCache;
  const res = await fetch(mapAssetPath('belgium-regions.svg'));
  const txt = await res.text();
  _belgiumSvgCache = txt.replace(/^[\s\S]*?<svg/,'<svg');
  return _belgiumSvgCache;
}
function tagBelgiumRegions(container){
  const colorToRegion = { 'f2536b':'Wallonie', 'fab274':'Flandre', '2385d2':'Bruxelles' };
  container.querySelectorAll('path').forEach(p=>{
    const style = p.getAttribute('style') || '';
    const m = style.match(/fill:\s*#([0-9a-fA-F]{6})/);
    if(m && colorToRegion[m[1].toLowerCase()]){
      p.dataset.region = colorToRegion[m[1].toLowerCase()];
      p.style.cursor = 'pointer';
    }
  });
}

/* ============================================================
   MOTEUR GENERIQUE DE QUESTIONS (quiz + examen)
   ============================================================ */
function renderMcq(q, idx, prefix){
  const name = prefix+'-'+idx;
  return `<div class="options">${q.options.map((o,i)=>`<label><input type="radio" name="${name}" value="${i}"> ${o}</label>`).join('')}</div>`;
}
function renderTf(q, idx, prefix){
  const name = prefix+'-'+idx;
  return `<div class="options">
    <label><input type="radio" name="${name}" value="true"> Vrai</label>
    <label><input type="radio" name="${name}" value="false"> Faux</label>
  </div>`;
}
function renderMatch(q, idx, prefix){
  return q.items.map((item, j)=>{
    const optsHtml = item.options.map(o=>`<option value="${o}">${o}</option>`).join('');
    return `<div class="match-row"><span class="left">${item.left}</span>
      <select class="match-select" id="${prefix}-${idx}-${j}">
        <option value="">-- choisir --</option>${optsHtml}
      </select></div>`;
  }).join('');
}
function renderClassify(q, idx, prefix){
  const opts = q.classifyOptions || ['Atout','Contrainte'];
  return q.items.map((item,j)=>{
    return `<div class="match-row"><span class="left">${item.text}</span>
      <select class="match-select" id="${prefix}-${idx}-${j}">
        <option value="">-- choisir --</option>
        ${opts.map(o=>`<option value="${o}">${o}</option>`).join('')}
      </select></div>`;
  }).join('');
}
function renderData(q, idx, prefix){
  let sub = q.subquestions.map((sq,j)=>`
    <p style="margin-bottom:4px;"><strong>${j+1}.</strong> ${sq.prompt}</p>
    <input class="text-answer" id="${prefix}-${idx}-${j}" type="text" placeholder="Ta reponse">
  `).join('');
  return `${q.tableHtml}<div style="margin-top:10px;">${sub}</div>`;
}
function renderOpen(q, idx, prefix){
  return `<textarea class="open-answer" id="${prefix}-${idx}"></textarea>`;
}
function renderQuestionBody(q, idx, prefix){
  switch(q.type){
    case 'mcq': return renderMcq(q, idx, prefix);
    case 'tf': return renderTf(q, idx, prefix);
    case 'match': return renderMatch(q, idx, prefix);
    case 'classify': return renderClassify(q, idx, prefix);
    case 'data': return renderData(q, idx, prefix);
    case 'open': return renderOpen(q, idx, prefix);
  }
  return '';
}
function gradeQuestion(q, idx, prefix){
  let earned = 0, detail = '';
  switch(q.type){
    case 'mcq': {
      const sel = document.querySelector(`input[name="${prefix}-${idx}"]:checked`);
      const ok = sel && parseInt(sel.value,10) === q.correct;
      earned = ok ? q.points : 0;
      detail = ok ? 'Exact.' : `Reponse attendue : ${q.options[q.correct]}.`;
      break;
    }
    case 'tf': {
      const sel = document.querySelector(`input[name="${prefix}-${idx}"]:checked`);
      const ok = sel && (sel.value === String(q.correct));
      earned = ok ? q.points : 0;
      detail = ok ? 'Exact.' : `Reponse attendue : ${q.correct ? 'Vrai' : 'Faux'}.`;
      break;
    }
    case 'match': {
      const per = q.points / q.items.length;
      let good = 0;
      q.items.forEach((item,j)=>{
        const el = document.getElementById(`${prefix}-${idx}-${j}`);
        if(el && el.value === item.correct) good++;
      });
      earned = +(good*per).toFixed(2);
      detail = `${good} / ${q.items.length} associations correctes.`;
      break;
    }
    case 'classify': {
      const per = q.points / q.items.length;
      let good = 0;
      q.items.forEach((item,j)=>{
        const el = document.getElementById(`${prefix}-${idx}-${j}`);
        if(el && el.value === item.correct) good++;
      });
      earned = +(good*per).toFixed(2);
      detail = `${good} / ${q.items.length} classements corrects.`;
      break;
    }
    case 'data': {
      const per = q.points / q.subquestions.length;
      let good = 0;
      q.subquestions.forEach((sq,j)=>{
        const el = document.getElementById(`${prefix}-${idx}-${j}`);
        if(el && textMatches(el.value, sq.accepted)) good++;
      });
      earned = +(good*per).toFixed(2);
      detail = `${good} / ${q.subquestions.length} reponses correctes.`;
      break;
    }
    case 'open': {
      const el = document.getElementById(`${prefix}-${idx}`);
      const val = normalize(el ? el.value : '');
      let hits = 0;
      q.keywordGroups.forEach(group=>{ if(group.some(k=>val.includes(normalize(k)))) hits++; });
      const ratio = hits / q.keywordGroups.length;
      earned = +(ratio * q.points).toFixed(2);
      detail = `Correction automatique approximative, basee sur des mots-cles (${hits}/${q.keywordGroups.length} idees attendues detectees). Compare surtout ta reponse au corrige-modele.`;
      break;
    }
  }
  return { earned, detail };
}

/* ============================================================
   INITIALISATION D'UN MODULE
   ============================================================ */
function initModule(cfg){
  const STORAGE_KEY = 'geo_5e6e_' + cfg.id;
  let state = loadState();
  function loadState(){
    try{ const raw = localStorage.getItem(STORAGE_KEY); if(raw) return JSON.parse(raw); }catch(e){}
    return { theoryDone:false, exerciseDone:false, theoryStepSeen:0, attempts:[] };
  }
  function saveState(){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(e){} }
  function bestScorePct(){ if(!state.attempts.length) return 0; return Math.max(...state.attempts.map(a=>a.pct)); }
  function hasPassed(){ return bestScorePct() >= (cfg.passThreshold||60); }

  const root = document.getElementById('app-root');
  root.innerHTML = `
  <div class="app">
    <a class="hub-link" href="${cfg.hubHref || 'index.html'}">&larr; Tous les modules</a>
    <header class="top">
      <div class="eyebrow">${cfg.eyebrow}</div>
      <h1>${cfg.title}</h1>
      <p class="subtitle">${cfg.subtitle}</p>
    </header>
    <nav class="stepper">
      <button class="step-btn" data-view="accueil">Accueil</button>
      <button class="step-btn" data-view="theorie">1. Theorie</button>
      <button class="step-btn" data-view="exercices">2. Entrainement</button>
      <button class="step-btn" data-view="examen">3. Examen</button>
    </nav>

    <section id="view-accueil" class="view">
      <div class="panel">
        <span class="badge">A propos de ce module</span>
        <h2>Comment fonctionne ce parcours ?</h2>
        ${cfg.introHtml}
        <h3>Les trois etapes</h3>
        <ol class="clean">
          <li><strong>Theorie</strong> : sections courtes a lire dans l'ordre, avec de vraies cartes. Rien n'est chronometre.</li>
          <li><strong>Entrainement</strong> : flashcards, jeu de reperage sur carte et quiz, sans note qui compte. Autant d'essais que tu veux.</li>
          <li><strong>Examen</strong> : questions notees. Il faut ${cfg.passThreshold||60}% pour reussir et debloquer le module suivant. Essais illimites.</li>
        </ol>
        <div class="callout">Ta progression est enregistree automatiquement dans ton navigateur, tant que tu reviens sur ce meme lien.</div>
        <div class="btn-row"><button class="btn" data-go="theorie">Commencer la theorie</button></div>
      </div>
      <div id="progress-summary" class="panel"></div>
      <div style="text-align:center; margin-top: 10px;"><button class="reset-link" id="reset-btn">Reinitialiser ma progression sur ce module</button></div>
    </section>

    <section id="view-theorie" class="view">
      <div class="panel">
        <span class="badge">Theorie</span>
        <div id="theory-slides"></div>
        <div class="theory-nav">
          <button class="btn secondary" id="theory-prev">Precedent</button>
          <span class="theory-progress" id="theory-progress-label"></span>
          <button class="btn" id="theory-next">Suivant</button>
        </div>
      </div>
    </section>

    <section id="view-exercices" class="view">
      <div class="panel">
        <span class="badge">Entrainement</span>
        <h2>Entraine-toi sans pression</h2>
        <p>Rien ici ne compte pour une note. Choisis un format, autant de fois que tu veux.</p>
        <div class="subnav">
          <button class="subnav-btn active" id="subnav-flashcards">Flashcards</button>
          <button class="subnav-btn" id="subnav-jeu">Jeu de la carte</button>
          <button class="subnav-btn" id="subnav-quiz">Quiz</button>
        </div>
        <div id="ex-tab-flashcards" class="ex-tab active">
          <p style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:0.88rem; color:var(--ink-soft);">Retourne la carte, puis dis honnetement si tu savais la reponse.</p>
          <div id="flashcards-area"></div>
        </div>
        <div id="ex-tab-jeu" class="ex-tab">
          <p style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:0.88rem; color:var(--ink-soft);">Clique directement sur la carte pour situer l'element demande.</p>
          <div id="game-area"></div>
        </div>
        <div id="ex-tab-quiz" class="ex-tab">
          <p style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:0.88rem; color:var(--ink-soft);">Reponds, clique sur « Verifier », lis l'explication, puis passe a la suite.</p>
          <div id="exercices-list"></div>
        </div>
        <div class="btn-row"><button class="btn" id="ex-done-btn">J'ai fini de m'entrainer, aller a l'examen</button></div>
      </div>
    </section>

    <section id="view-examen" class="view">
      <div class="panel" id="exam-panel">
        <span class="badge warn">Examen &middot; valeur certificative</span>
        <h2>Examen : ${cfg.examTitle||cfg.title}</h2>
        <p>${cfg.examBank.length} questions, ${cfg.examBank.reduce((s,q)=>s+q.points,0)} points au total. Seuil de reussite : ${cfg.passThreshold||60}%. Essais illimites.</p>
        <div id="exam-questions"></div>
        <div class="btn-row"><button class="btn" id="exam-submit-btn">Corriger mon examen</button></div>
        <div id="exam-result"></div>
        <div id="attempts-history" class="attempts-history"></div>
      </div>
      <div id="next-module-card"></div>
    </section>

    <footer class="foot">${cfg.footerHtml||''}</footer>
  </div>
  `;

  /* ---- navigation ---- */
  function goTo(view){
    root.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    root.querySelector('#view-'+view).classList.add('active');
    root.querySelectorAll('.step-btn').forEach(b=>b.classList.remove('active'));
    const btn = root.querySelector('.step-btn[data-view="'+view+'"]');
    if(btn) btn.classList.add('active');
    window.scrollTo({top:0, behavior:'smooth'});
    if(view === 'exercices' && !exTabInit.flashcards){ switchExTab('flashcards'); }
    refreshUI();
  }
  root.querySelectorAll('.step-btn').forEach(b=>b.addEventListener('click', ()=>goTo(b.dataset.view)));
  root.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click', ()=>goTo(b.dataset.go)));
  root.querySelector('#reset-btn').addEventListener('click', resetProgress);

  function refreshUI(){
    root.querySelector('.step-btn[data-view="theorie"]').classList.toggle('done', state.theoryDone);
    root.querySelector('.step-btn[data-view="exercices"]').classList.toggle('done', state.exerciseDone);
    root.querySelector('.step-btn[data-view="examen"]').classList.toggle('done', hasPassed());
    renderProgressSummary();
    renderAttemptsHistory();
    renderNextModuleCard();
  }
  function renderProgressSummary(){
    const el = root.querySelector('#progress-summary');
    const pct = bestScorePct();
    el.innerHTML = `
      <span class="badge">Ma progression</span>
      <h3 style="margin-top:6px;">Etat actuel</h3>
      <ul class="clean" style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:0.93rem;">
        <li>Theorie lue en entier : ${state.theoryDone ? '<strong>oui</strong>' : 'pas encore'}</li>
        <li>Entrainement aborde : ${state.exerciseDone ? '<strong>oui</strong>' : 'pas encore'}</li>
        <li>Meilleur score a l'examen : <strong>${state.attempts.length ? pct.toFixed(0)+'%' : 'aucun essai pour le moment'}</strong> ${hasPassed() ? '(module reussi)' : ''}</li>
      </ul>`;
  }
  function renderAttemptsHistory(){
    const el = root.querySelector('#attempts-history');
    if(!state.attempts.length){ el.innerHTML=''; return; }
    let rows = state.attempts.map((a,i)=>`<tr><td>Essai ${i+1}</td><td>${a.date}</td><td>${a.pct.toFixed(0)}%</td><td>${a.pct>=(cfg.passThreshold||60)?'Reussi':'A retenter'}</td></tr>`).join('');
    el.innerHTML = `<h3>Historique de tes essais a l'examen</h3><table><tr><th></th><th>Date</th><th>Score</th><th>Resultat</th></tr>${rows}</table>`;
  }
  function renderNextModuleCard(){
    const el = root.querySelector('#next-module-card');
    if(!cfg.nextHref){ el.innerHTML=''; return; }
    if(hasPassed()){
      setModulePassed(cfg.id, bestScorePct());
      el.innerHTML = `<div class="unlock-card">
        <h3 style="margin-top:0;">Module suivant debloque : ${cfg.nextTitle}</h3>
        <p>Bravo, tu peux continuer.</p>
        <div class="btn-row" style="justify-content:center;"><a class="btn" href="${cfg.nextHref}" style="text-decoration:none;">Aller au module suivant</a></div>
      </div>`;
    } else {
      el.innerHTML = `<div class="lock-card">Module suivant verrouille. Il se debloquera des que tu auras obtenu au moins ${cfg.passThreshold||60}% a cet examen.</div>`;
    }
  }
  function resetProgress(){
    if(!confirm("Effacer toute ta progression sur ce module (theorie, entrainement, essais d'examen) ? Cette action est irreversible.")) return;
    state = { theoryDone:false, exerciseDone:false, theoryStepSeen:0, attempts:[] };
    saveState();
    buildExercises(); buildExam();
    theoryIndex = 0; renderTheorySlide();
    refreshUI();
    goTo('accueil');
  }
  function markExerciseDone(){ state.exerciseDone = true; saveState(); }

  /* ---- theorie ---- */
  let theoryIndex = 0;
  function renderTheorySlide(){
    const s = cfg.theorySlides[theoryIndex];
    root.querySelector('#theory-slides').innerHTML = `<h2>${s.title}</h2>${s.html}`;
    root.querySelector('#theory-progress-label').textContent = `Section ${theoryIndex+1} / ${cfg.theorySlides.length}`;
    root.querySelector('#theory-prev').disabled = theoryIndex === 0;
    root.querySelector('#theory-next').textContent = (theoryIndex === cfg.theorySlides.length - 1) ? 'Terminer la theorie' : 'Suivant';
    if(s.postRender) s.postRender({renderWorldMap, loadBelgiumSvgMarkup, tagBelgiumRegions, geoXY});
  }
  function theoryStep(delta){
    if(delta > 0 && theoryIndex === cfg.theorySlides.length - 1){
      state.theoryDone = true; saveState(); refreshUI(); goTo('exercices'); return;
    }
    theoryIndex = Math.max(0, Math.min(cfg.theorySlides.length - 1, theoryIndex + delta));
    if(theoryIndex+1 > (state.theoryStepSeen||0)){ state.theoryStepSeen = theoryIndex+1; saveState(); }
    renderTheorySlide();
    window.scrollTo({top:0, behavior:'smooth'});
  }
  root.querySelector('#theory-prev').addEventListener('click', ()=>theoryStep(-1));
  root.querySelector('#theory-next').addEventListener('click', ()=>theoryStep(1));

  /* ---- sous-nav entrainement ---- */
  let exTabInit = { flashcards:false, jeu:false, quiz:false };
  function switchExTab(tab){
    ['flashcards','jeu','quiz'].forEach(t=>{
      root.querySelector('#subnav-'+t).classList.toggle('active', t===tab);
      root.querySelector('#ex-tab-'+t).classList.toggle('active', t===tab);
    });
    if(tab==='flashcards' && !exTabInit.flashcards){ startFlashcards(); exTabInit.flashcards = true; }
    if(tab==='jeu' && !exTabInit.jeu){ startGame(); exTabInit.jeu = true; }
    if(tab==='quiz' && !exTabInit.quiz){ buildExercises(); exTabInit.quiz = true; }
  }
  root.querySelector('#subnav-flashcards').addEventListener('click', ()=>switchExTab('flashcards'));
  root.querySelector('#subnav-jeu').addEventListener('click', ()=>switchExTab('jeu'));
  root.querySelector('#subnav-quiz').addEventListener('click', ()=>switchExTab('quiz'));
  root.querySelector('#ex-done-btn').addEventListener('click', ()=>{ markExerciseDone(); goTo('examen'); });

  /* ---- flashcards ---- */
  let fcDeck = [], fcFlipped = false;
  function startFlashcards(){
    fcDeck = cfg.flashcardBank.map((c,i)=>({...c, id:i}));
    fcFlipped = false;
    renderFlashcard();
  }
  function renderFlashcard(){
    const el = root.querySelector('#flashcards-area');
    if(!fcDeck.length){
      el.innerHTML = `<div class="unlock-card"><strong>Toutes les cartes sont maitrisees pour ce tour.</strong><div class="btn-row" style="justify-content:center;"><button class="btn" id="fc-restart">Recommencer le paquet</button></div></div>`;
      el.querySelector('#fc-restart').addEventListener('click', startFlashcards);
      return;
    }
    const card = fcDeck[0];
    el.innerHTML = `
      <div class="flashcard-progress">Cartes restantes a maitriser : ${fcDeck.length} / ${cfg.flashcardBank.length}</div>
      <div class="flashcard ${fcFlipped?'flipped':''}" id="fc-card">
        <div class="flashcard-inner">
          <div class="flashcard-face front">${card.front}</div>
          <div class="flashcard-face back">${card.back}</div>
        </div>
      </div>
      <div class="fc-controls"><button class="btn secondary" id="fc-flip">Retourner la carte</button></div>
      <div class="fc-controls">
        <button class="btn know" id="fc-know">Je savais</button>
        <button class="btn review" id="fc-review">A revoir</button>
      </div>`;
    el.querySelector('#fc-card').addEventListener('click', flipCard);
    el.querySelector('#fc-flip').addEventListener('click', flipCard);
    el.querySelector('#fc-know').addEventListener('click', ()=>fcRate(true));
    el.querySelector('#fc-review').addEventListener('click', ()=>fcRate(false));
  }
  function flipCard(){ fcFlipped = !fcFlipped; renderFlashcard(); }
  function fcRate(knew){
    const card = fcDeck.shift();
    if(!knew) fcDeck.push(card);
    fcFlipped = false;
    markExerciseDone();
    renderFlashcard();
  }

  /* ---- jeu de la carte ---- */
  let gameRounds = [], gameIndex = 0, gameScore = 0, gameAnswered = false;
  function startGame(){
    gameRounds = cfg.gameRounds;
    gameIndex = 0; gameScore = 0;
    renderGameRound();
  }
  function renderGameRound(){
    const el = root.querySelector('#game-area');
    if(gameIndex >= gameRounds.length){
      el.innerHTML = `<div class="score-box"><div>Score au jeu</div><div class="score-number pass">${gameScore} / ${gameRounds.length}</div>
        <div class="btn-row" style="justify-content:center;"><button class="btn" id="game-restart">Rejouer</button></div></div>`;
      el.querySelector('#game-restart').addEventListener('click', startGame);
      markExerciseDone();
      return;
    }
    const r = gameRounds[gameIndex];
    gameAnswered = false;
    el.innerHTML = `
      <div class="game-score">Manche ${gameIndex+1} / ${gameRounds.length} &middot; score : ${gameScore}</div>
      <div class="q-prompt">${r.prompt}</div>
      <div id="game-map-holder"></div>
      <div id="game-feedback" class="feedback"></div>`;
    const holder = root.querySelector('#game-map-holder');
    if(r.kind === 'world'){
      renderWorldMap(holder, { markers: r.markers||[], crop: r.crop, onClick: (loc)=>handleWorldClick(loc, r) });
    } else {
      holder.innerHTML = '<div class="belgium-map-wrap" id="game-belgium-map"></div>';
      loadBelgiumSvgMarkup().then(markup=>{
        const wrap = root.querySelector('#game-belgium-map');
        wrap.innerHTML = markup;
        tagBelgiumRegions(wrap);
        wrap.querySelector('svg').addEventListener('click', (evt)=>handleBelgiumClick(evt, r));
      });
    }
  }
  function nextGameRound(){ gameIndex++; renderGameRound(); }
  function handleWorldClick(loc, round){
    if(gameAnswered) return;
    gameAnswered = true;
    const target = geoXY(round.lon, round.lat);
    const dist = Math.hypot(loc.x - target.x, loc.y - target.y);
    const ok = dist <= round.tol;
    if(ok) gameScore++;
    const svg = root.querySelector('#game-map-holder .world-map-overlay');
    const scale = svg.viewBox.baseVal.width / WORLD_VB.w;
    const r = (round.markerR || 18) * scale;
    const guess = document.createElementNS('http://www.w3.org/2000/svg','circle');
    guess.setAttribute('cx', loc.x); guess.setAttribute('cy', loc.y); guess.setAttribute('r', r);
    guess.setAttribute('fill', ok ? '#1f6f5c' : '#a3283f');
    guess.setAttribute('stroke', '#fff'); guess.setAttribute('stroke-width', 5 * scale);
    svg.appendChild(guess);
    if(!ok){
      const correct = document.createElementNS('http://www.w3.org/2000/svg','circle');
      correct.setAttribute('cx', target.x); correct.setAttribute('cy', target.y); correct.setAttribute('r', r);
      correct.setAttribute('fill', 'none'); correct.setAttribute('stroke', '#1f6f5c'); correct.setAttribute('stroke-width', 8 * scale);
      correct.setAttribute('stroke-dasharray', (10*scale)+','+(8*scale));
      svg.appendChild(correct);
    }
    const fb = root.querySelector('#game-feedback');
    fb.className = 'feedback show ' + (ok?'correct':'incorrect');
    fb.innerHTML = (ok ? 'Bien vu !' : "Pas tout a fait : le cercle en pointille montre l'endroit exact.") +
      ' <div class="btn-row"><button class="btn" id="game-next">Manche suivante</button></div>';
    fb.querySelector('#game-next').addEventListener('click', nextGameRound);
  }
  function handleBelgiumClick(evt, round){
    if(gameAnswered) return;
    const region = evt.target.dataset ? evt.target.dataset.region : null;
    if(!region) return;
    gameAnswered = true;
    const ok = region === round.region;
    if(ok) gameScore++;
    evt.target.style.stroke = ok ? '#1f6f5c' : '#a3283f';
    evt.target.style.strokeWidth = '4';
    if(!ok){
      const wrap = root.querySelector('#game-belgium-map');
      const correctPath = Array.from(wrap.querySelectorAll('path')).find(p=>p.dataset.region===round.region);
      if(correctPath){ correctPath.style.stroke = '#1f6f5c'; correctPath.style.strokeWidth = '5'; correctPath.style.strokeDasharray = '6,4'; }
    }
    const fb = root.querySelector('#game-feedback');
    fb.className = 'feedback show ' + (ok?'correct':'incorrect');
    fb.innerHTML = (ok ? 'Exact !' : `Ce n'etait pas la bonne region (contour en pointille = ${round.region}).`) +
      ' <div class="btn-row"><button class="btn" id="game-next">Manche suivante</button></div>';
    fb.querySelector('#game-next').addEventListener('click', nextGameRound);
  }

  /* ---- quiz ---- */
  function buildExercises(){
    const container = root.querySelector('#exercices-list');
    container.innerHTML = cfg.exerciseBank.map((q, idx)=>`
      <div class="question">
        <div class="q-number">Exercice ${idx+1} <span class="q-points">(${q.points} pt${q.points>1?'s':''})</span></div>
        <div class="q-prompt">${q.prompt}</div>
        ${renderQuestionBody(q, idx, 'ex')}
        <button class="check-btn" data-idx="${idx}">Verifier ma reponse</button>
        <div class="feedback" id="ex-feedback-${idx}"></div>
      </div>`).join('');
    container.querySelectorAll('.check-btn').forEach(b=>b.addEventListener('click', ()=>checkExercise(parseInt(b.dataset.idx,10))));
  }
  function checkExercise(idx){
    const q = cfg.exerciseBank[idx];
    const {earned, detail} = gradeQuestion(q, idx, 'ex');
    const pct = earned / q.points;
    const el = root.querySelector(`#ex-feedback-${idx}`);
    el.className = 'feedback show ' + (pct>=0.99 ? 'correct' : (pct>0 ? 'partial' : 'incorrect'));
    let html = `<strong>${earned} / ${q.points} pt(s).</strong> ${q.explain}`;
    if(q.type==='data' || q.type==='match' || q.type==='classify') html += ` ${detail}`;
    if(q.modelAnswer) html += `<div class="model">Corrige-modele : "${q.modelAnswer}"</div>`;
    el.innerHTML = html;
    markExerciseDone();
  }

  /* ---- examen ---- */
  function buildExam(){
    const container = root.querySelector('#exam-questions');
    container.innerHTML = cfg.examBank.map((q, idx)=>`
      <div class="question">
        <div class="q-number">Question ${idx+1} <span class="q-points">(${q.points} pt${q.points>1?'s':''})</span></div>
        <div class="q-prompt">${q.prompt}</div>
        ${renderQuestionBody(q, idx, 'exam')}
      </div>`).join('');
    root.querySelector('#exam-result').innerHTML = '';
  }
  function submitExam(){
    let total = 0, earnedTotal = 0, breakdown = [];
    cfg.examBank.forEach((q, idx)=>{
      total += q.points;
      const {earned, detail} = gradeQuestion(q, idx, 'exam');
      earnedTotal += earned;
      breakdown.push({idx, q, earned, detail});
    });
    const pct = (earnedTotal/total)*100;
    const passed = pct >= (cfg.passThreshold||60);
    state.attempts.push({ date: new Date().toLocaleDateString('fr-BE'), pct: pct });
    saveState();
    if(passed) setModulePassed(cfg.id, pct);

    let html = `<div class="score-box"><div>Ton score</div><div class="score-number ${passed?'pass':'fail'}">${pct.toFixed(0)}%</div>
      <div>${earnedTotal.toFixed(1)} / ${total} points</div>
      <div class="badge ${passed?'':'warn'}" style="margin-top:10px;">${passed ? 'Module reussi (seuil de '+(cfg.passThreshold||60)+'% atteint)' : 'Pas encore '+(cfg.passThreshold||60)+'%, tu peux retenter'}</div></div>`;
    html += breakdown.map(b=>`
      <div class="question">
        <div class="q-number">Question ${b.idx+1}</div>
        <div class="q-prompt">${b.q.prompt}</div>
        <div class="feedback show ${b.earned>=b.q.points-0.01?'correct':(b.earned>0?'partial':'incorrect')}">
          <strong>${b.earned.toFixed(1)} / ${b.q.points} pt(s).</strong>
          ${b.q.type==='mcq' ? 'Reponse attendue : '+b.q.options[b.q.correct]+'.' : ''}
          ${b.q.type==='tf' ? 'Reponse attendue : '+(b.q.correct?'Vrai':'Faux')+'.' : ''}
          ${(b.q.type==='match'||b.q.type==='classify'||b.q.type==='data'||b.q.type==='open') ? b.detail : ''}
          ${b.q.modelAnswer ? '<div class="model">Corrige-modele : "'+b.q.modelAnswer+'"</div>' : ''}
        </div>
      </div>`).join('');
    root.querySelector('#exam-result').innerHTML = html;
    refreshUI();
    root.querySelector('#exam-result').scrollIntoView({behavior:'smooth'});
  }
  root.querySelector('#exam-submit-btn').addEventListener('click', submitExam);

  /* ---- init ---- */
  theoryIndex = 0;
  renderTheorySlide();
  buildExam();
  refreshUI();
  goTo('accueil');
}

window.GeoEngine = { initModule, getModuleStatus, geoXY, renderWorldMap, loadBelgiumSvgMarkup, tagBelgiumRegions };
})();
