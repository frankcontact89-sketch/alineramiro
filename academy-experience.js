(()=>{
const q=id=>document.getElementById(id);
const fmtTime=seconds=>{const s=Math.max(0,Math.floor(Number(seconds)||0));const h=Math.floor(s/3600),m=Math.floor((s%3600)/60);return h?`${h}h ${m}min`:`${m} min`};
let allCourseLessons=[];

function ensureDashboardExperience(){
  const dashboard=q('learningDashboard');
  if(!dashboard||q('studyOverview'))return;
  const overview=document.createElement('section');
  overview.id='studyOverview';
  overview.className='study-overview';
  overview.innerHTML=`<div class="section-head premium-head"><div><div class="eyebrow">Sua jornada</div><h2>Visão geral</h2></div></div><div class="study-stats"><article><strong id="statProgress">0%</strong><span>Progresso</span></article><article><strong id="statCompleted">0</strong><span>Aulas concluídas</span></article><article><strong id="statTime">0 min</strong><span>Tempo assistido</span></article></div>`;
  dashboard.insertBefore(overview,dashboard.firstChild);
}

function updateDashboardExperience(){
  ensureDashboardExperience();
  const completed=Array.isArray(progressRows)?progressRows.filter(r=>r.completed).length:0;
  const total=allCourseLessons.length||48;
  const percent=total?Math.round(completed/total*100):0;
  const watched=Array.isArray(progressRows)?progressRows.reduce((sum,r)=>sum+Math.max(0,Number(r.watched_seconds)||0),0):0;
  if(q('statProgress'))q('statProgress').textContent=`${percent}%`;
  if(q('statCompleted'))q('statCompleted').textContent=`${completed}/${total}`;
  if(q('statTime'))q('statTime').textContent=fmtTime(watched);
}

function ensureSettingsSections(){
  const sheet=document.querySelector('.settings-sheet');
  if(!sheet)return;
  const signout=q('settingsSignOutBtn');
  if(!q('settingsProgress')){
    const progress=document.createElement('section');
    progress.id='settingsProgress';progress.className='settings-section';
    progress.innerHTML=`<div class="settings-kicker">MINHA JORNADA</div><div class="journey-card"><div><strong id="journeyPercent">0%</strong><small>do curso concluído</small></div><div class="journey-bar"><i id="journeyBar"></i></div><div class="journey-meta"><span id="journeyDone">0 de 48 aulas</span><span id="journeyTime">0 min</span></div></div>`;
    sheet.insertBefore(progress,signout);
  }
  if(!q('settingsLessons')){
    const sec=document.createElement('section');sec.id='settingsLessons';sec.className='settings-section';
    sec.innerHTML=`<div class="settings-kicker">AULAS</div><p class="settings-help section-copy">Acesse as aulas disponíveis. As demais permanecem bloqueadas até serem publicadas.</p><div id="settingsLessonList" class="settings-lesson-list" aria-live="polite"></div>`;
    sheet.insertBefore(sec,signout);
  }
  if(!q('settingsNotes')){
    const sec=document.createElement('section');sec.id='settingsNotes';sec.className='settings-section';
    sec.innerHTML=`<div class="settings-kicker">MINHAS NOTAS</div><p class="settings-help section-copy">Suas anotações ficam organizadas pela aula em que foram escritas.</p><div id="settingsNotesList" class="settings-notes-list" aria-live="polite"></div>`;
    sheet.insertBefore(sec,signout);
  }
}

function updateJourneyCard(){
  ensureSettingsSections();
  const completed=Array.isArray(progressRows)?progressRows.filter(r=>r.completed).length:0;
  const total=allCourseLessons.length||48;
  const percent=total?Math.round(completed/total*100):0;
  const watched=Array.isArray(progressRows)?progressRows.reduce((sum,r)=>sum+Math.max(0,Number(r.watched_seconds)||0),0):0;
  if(q('journeyPercent'))q('journeyPercent').textContent=`${percent}%`;
  if(q('journeyBar'))q('journeyBar').style.width=`${percent}%`;
  if(q('journeyDone'))q('journeyDone').textContent=`${completed} de ${total} aulas`;
  if(q('journeyTime'))q('journeyTime').textContent=fmtTime(watched);
}

async function loadAllLessons(){
  try{
    const {data:{session}}=await db.auth.getSession();if(!session)return;
    let courseId=currentCourse?.id;
    if(!courseId){const {data}=await db.from('abba_courses').select('id').eq('slug','annual-program').maybeSingle();courseId=data?.id;}
    if(!courseId)return;
    const {data,error}=await db.from('abba_lessons').select('id,lesson_number,is_published,mux_playback_id').eq('course_id',courseId).order('lesson_number');
    if(error)throw error;
    allCourseLessons=Array.isArray(data)?data:[];
    renderSettingsLessons();updateDashboardExperience();updateJourneyCard();
  }catch(err){console.error('ABBA lesson library',err)}
}

function renderSettingsLessons(){
  ensureSettingsSections();const host=q('settingsLessonList');if(!host)return;
  host.innerHTML='';
  const items=allCourseLessons.length?allCourseLessons:Array.from({length:48},(_,i)=>({lesson_number:i+1,is_published:false,mux_playback_id:null,id:null}));
  items.forEach(item=>{
    const available=!!(item.is_published&&item.mux_playback_id);
    const row=document.createElement(available?'button':'div');
    row.className='settings-lesson-row'+(available?' available':' locked');
    if(available)row.type='button';
    row.innerHTML=`<span class="lesson-index">${String(item.lesson_number).padStart(2,'0')}</span><span class="lesson-simple"><strong>Aula ${item.lesson_number}</strong><small>${available?'Disponível':'Bloqueada'}</small></span><span class="lesson-state" aria-hidden="true">${available?'›':'🔒'}</span>`;
    if(available)row.onclick=()=>{q('settingsPanel')?.classList.add('hidden');if(typeof openLessonById==='function')openLessonById(item.id,true)};
    host.appendChild(row);
  });
}

async function loadNotes(){
  ensureSettingsSections();const host=q('settingsNotesList');if(!host)return;
  host.innerHTML='<div class="notes-loading">Carregando notas…</div>';
  try{
    const {data:{session}}=await db.auth.getSession();if(!session){host.innerHTML='';return;}
    const {data,error}=await db.from('abba_lesson_notes').select('lesson_id,note_text,updated_at').eq('user_id',session.user.id).order('updated_at',{ascending:false});
    if(error)throw error;
    const noteRows=(data||[]).filter(n=>String(n.note_text||'').trim());
    if(!noteRows.length){host.innerHTML='<div class="empty-notes">Você ainda não salvou notas.</div>';return;}
    const numbers=new Map(allCourseLessons.map(l=>[l.id,l.lesson_number]));
    noteRows.sort((a,b)=>(numbers.get(a.lesson_id)||999)-(numbers.get(b.lesson_id)||999));
    host.innerHTML='';
    noteRows.forEach(note=>{
      const num=numbers.get(note.lesson_id);
      if(!num)return;
      const card=document.createElement('article');card.className='saved-note-card';
      const text=String(note.note_text||'').trim();
      card.innerHTML=`<div class="saved-note-head"><strong>Notas da Aula ${num}</strong><span>Aula ${num}</span></div><p></p>`;
      card.querySelector('p').textContent=text;
      card.onclick=()=>{const available=allCourseLessons.find(l=>l.id===note.lesson_id&&l.is_published&&l.mux_playback_id);if(available){q('settingsPanel')?.classList.add('hidden');if(typeof openLessonById==='function')openLessonById(note.lesson_id,true);setTimeout(()=>{document.querySelector('[data-tab="notes"]')?.click()},500)}};
      host.appendChild(card);
    });
  }catch(err){console.error('ABBA notes library',err);host.innerHTML='<div class="empty-notes">Não foi possível carregar suas notas agora.</div>'}
}

async function refreshExperience(){
  ensureDashboardExperience();ensureSettingsSections();
  await loadAllLessons();
  updateDashboardExperience();updateJourneyCard();
}

document.addEventListener('click',e=>{
  if(e.target?.closest?.('#settingsBtn'))setTimeout(()=>{refreshExperience();loadNotes()},80);
  if(e.target?.closest?.('#saveNoteBtn'))setTimeout(loadNotes,700);
},true);

const observer=new MutationObserver(()=>{if(!q('portalView')?.classList.contains('hidden')){ensureDashboardExperience();updateDashboardExperience();updateJourneyCard()}});
observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
setTimeout(refreshExperience,1200);
setTimeout(()=>{loadNotes()},1800);
})();