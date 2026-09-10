(()=>{
'use strict';
const q=id=>document.getElementById(id);
let lessonMap=new Map();
let totalLessons=48;
let loading=false;

async function session(){
  try{return (await db.auth.getSession()).data.session||null}catch{return null}
}

function setText(id,value){const el=q(id);if(el)el.textContent=value}

function formatTime(seconds){
  const s=Math.max(0,Math.floor(Number(seconds)||0));
  const h=Math.floor(s/3600),m=Math.floor((s%3600)/60);
  return h?`${h}h ${m}min`:`${m} min`;
}

function renderLessons(rows){
  const host=q('settingsLessonList');if(!host)return;
  host.innerHTML='';lessonMap=new Map();
  (rows||[]).forEach(l=>lessonMap.set(Number(l.lesson_number),l));
  for(let n=1;n<=totalLessons;n++){
    const lesson=lessonMap.get(n);
    const available=!!(lesson?.is_published&&lesson?.mux_playback_id);
    const row=document.createElement(available?'button':'div');
    row.className='settings-lesson-row '+(available?'available':'locked');
    if(available)row.type='button';
    const num=document.createElement('span');num.className='lesson-index';num.textContent=String(n).padStart(2,'0');
    const info=document.createElement('span');info.className='lesson-simple';
    const strong=document.createElement('strong');strong.textContent=`Aula ${n}`;
    const small=document.createElement('small');small.textContent=available?'Disponível':'Bloqueada';
    info.append(strong,small);
    const state=document.createElement('span');state.className='lesson-state';state.setAttribute('aria-hidden','true');state.textContent=available?'›':'🔒';
    row.append(num,info,state);
    if(available)row.addEventListener('click',()=>{
      q('settingsPanel')?.classList.add('hidden');
      try{if(typeof openLessonById==='function')openLessonById(lesson.id,true)}catch{}
    });
    host.appendChild(row);
  }
}

function renderNotes(notes,lessonRows){
  const host=q('settingsNotesList');if(!host)return;
  host.innerHTML='';
  const byId=new Map((lessonRows||[]).map(l=>[l.id,Number(l.lesson_number)]));
  const clean=(notes||[]).filter(n=>String(n.note_text||'').trim()).map(n=>({...n,lesson_number:byId.get(n.lesson_id)})).filter(n=>Number.isFinite(n.lesson_number));
  clean.sort((a,b)=>a.lesson_number-b.lesson_number);
  setText('settingsNotesCount',`${clean.length} ${clean.length===1?'aula com notas':'aulas com notas'}`);
  if(!clean.length){
    const empty=document.createElement('div');empty.className='empty-notes';empty.textContent='Você ainda não salvou notas.';host.appendChild(empty);return;
  }
  clean.forEach(note=>{
    const card=document.createElement('button');card.type='button';card.className='saved-note-card';
    const head=document.createElement('div');head.className='saved-note-head';
    const title=document.createElement('strong');title.textContent=`Notas da Aula ${note.lesson_number}`;
    const badge=document.createElement('span');badge.textContent=`Aula ${note.lesson_number}`;
    head.append(title,badge);
    const p=document.createElement('p');p.textContent=String(note.note_text||'').trim();
    card.append(head,p);
    const lesson=(lessonRows||[]).find(l=>l.id===note.lesson_id&&l.is_published&&l.mux_playback_id);
    if(lesson)card.addEventListener('click',()=>{
      q('settingsPanel')?.classList.add('hidden');
      try{if(typeof openLessonById==='function')openLessonById(lesson.id,true)}catch{}
      setTimeout(()=>document.querySelector('[data-tab="notes"]')?.click(),400);
    });
    else card.disabled=true;
    host.appendChild(card);
  });
}

function renderProgress(rows){
  const completed=(rows||[]).filter(r=>r.completed).length;
  const watched=(rows||[]).reduce((sum,r)=>sum+Math.max(0,Number(r.watched_seconds)||0),0);
  const pct=totalLessons?Math.round(completed/totalLessons*100):0;
  setText('journeyPercent',`${pct}%`);setText('journeyDone',`${completed} de ${totalLessons} aulas`);setText('journeyTime',formatTime(watched));
  const bar=q('journeyBar');if(bar)bar.style.width=`${pct}%`;
}

async function refresh(){
  if(loading)return;loading=true;
  const s=await session();if(!s){loading=false;return;}
  setText('settingsLessonStatus','Carregando…');
  try{
    const {data:course,error:courseErr}=await db.from('abba_courses').select('id,total_lessons').eq('slug','annual-program').maybeSingle();
    if(courseErr)throw courseErr;
    totalLessons=Math.max(1,Number(course?.total_lessons)||48);
    const courseId=course?.id;
    if(!courseId)throw new Error('Course not found');
    const [lessonRes,progressRes,noteRes]=await Promise.all([
      db.from('abba_lessons').select('id,lesson_number,is_published,mux_playback_id').eq('course_id',courseId).order('lesson_number'),
      db.from('abba_lesson_progress').select('lesson_id,completed,watched_seconds').eq('user_id',s.user.id),
      db.from('abba_lesson_notes').select('lesson_id,note_text,updated_at').eq('user_id',s.user.id)
    ]);
    if(lessonRes.error)throw lessonRes.error;
    const lessonRows=lessonRes.data||[];
    renderLessons(lessonRows);
    renderProgress(progressRes.error?[]:(progressRes.data||[]));
    renderNotes(noteRes.error?[]:(noteRes.data||[]),lessonRows);
    const available=lessonRows.filter(l=>l.is_published&&l.mux_playback_id).length;
    setText('settingsLessonStatus',`${available} ${available===1?'aula disponível':'aulas disponíveis'}`);
  }catch(err){
    console.error('ABBA settings',err);
    setText('settingsLessonStatus','');
    const host=q('settingsLessonList');if(host&&!host.children.length)renderLessons([]);
    const notes=q('settingsNotesList');if(notes&&!notes.children.length){const e=document.createElement('div');e.className='empty-notes';e.textContent='Não foi possível carregar suas notas agora.';notes.appendChild(e);}
  }finally{loading=false;}
}

q('settingsBtn')?.addEventListener('click',()=>setTimeout(refresh,30));
q('saveNoteBtn')?.addEventListener('click',()=>setTimeout(refresh,500));
setTimeout(()=>{if(!q('portalView')?.classList.contains('hidden'))refresh()},1200);
})();