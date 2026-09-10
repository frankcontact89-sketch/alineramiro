(()=>{
const q=id=>document.getElementById(id);
let settingsLessonRows=[];

function forcePortuguese(){
  try{currentLang='pt'}catch{}
  localStorage.setItem('abba_lang','pt');
  localStorage.setItem('abba_caption_lang','pt');
  document.documentElement.lang='pt';
}

function ensureSettingsStyles(){
  if(q('abbaStudentExtrasStyle'))return;
  const style=document.createElement('style');
  style.id='abbaStudentExtrasStyle';
  style.textContent=`
    .settings-section.abba-extra{padding-top:22px}
    .abba-settings-title{font-size:1.08rem;font-weight:800;color:#0f2742;margin:0 0 12px}
    .abba-lesson-grid{display:grid;gap:10px}
    .abba-lesson-card{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid #d7e0e8;border-radius:16px;background:#fff;padding:14px 16px;text-align:left;color:#0f2742}
    .abba-lesson-card.available{cursor:pointer}
    .abba-lesson-card.locked{background:#f7f8fa;color:#7b8794}
    .abba-lesson-left{display:flex;align-items:center;gap:12px;min-width:0}
    .abba-lesson-num{width:34px;height:34px;border-radius:10px;background:#eaf4ff;color:#1677d2;display:grid;place-items:center;font-weight:800;flex:0 0 auto}
    .abba-lesson-card.locked .abba-lesson-num{background:#eceff3;color:#8a94a1}
    .abba-lesson-name{font-weight:800;white-space:nowrap}
    .abba-lesson-status{font-size:.9rem;color:#5e6b78;margin-top:2px}
    .abba-lock{font-size:1.05rem;flex:0 0 auto}
    .abba-notes-list{display:grid;gap:10px}
    .abba-note-card{border:1px solid #d7e0e8;border-radius:16px;background:#fff;padding:14px 16px}
    .abba-note-card strong{display:block;color:#0f2742;margin-bottom:6px}
    .abba-note-card p{margin:0;color:#52606d;white-space:pre-wrap;line-height:1.45}
    .abba-note-empty{color:#7b8794;margin:4px 0 0}
  `;
  document.head.appendChild(style);
}

async function getAllLessonRows(){
  if(!currentCourse?.id)return [];
  const {data,error}=await db.from('abba_lessons')
    .select('id,lesson_number,mux_playback_id,is_published')
    .eq('course_id',currentCourse.id)
    .order('lesson_number');
  if(error){console.error('ABBA lesson settings',error);return []}
  settingsLessonRows=data||[];
  return settingsLessonRows;
}

function openAvailableLesson(row){
  const playable=lessons.find(l=>l.id===row.id)||lessons.find(l=>Number(l.lesson_number)===Number(row.lesson_number));
  if(!playable)return;
  q('settingsPanel')?.classList.add('hidden');
  openLesson(playable,true);
}

async function renderLessonLibrary(){
  const host=q('abbaLessonLibrary');
  if(!host)return;
  host.innerHTML='';
  const rows=await getAllLessonRows();
  const byNumber=new Map(rows.map(r=>[Number(r.lesson_number),r]));
  const total=Math.max(48,Number(currentCourse?.total_lessons)||48);
  const grid=document.createElement('div');
  grid.className='abba-lesson-grid';
  for(let i=1;i<=total;i++){
    const row=byNumber.get(i);
    const available=!!(row?.is_published&&row?.mux_playback_id);
    const card=document.createElement('button');
    card.type='button';
    card.className='abba-lesson-card '+(available?'available':'locked');
    card.disabled=!available;
    card.innerHTML=`<span class="abba-lesson-left"><span class="abba-lesson-num">${i}</span><span><span class="abba-lesson-name">Aula ${i}</span><span class="abba-lesson-status">${available?'Disponível':'Bloqueada'}</span></span></span><span class="abba-lock">${available?'›':'🔒'}</span>`;
    if(available)card.onclick=()=>openAvailableLesson(row);
    grid.appendChild(card);
  }
  host.appendChild(grid);
}

async function renderMyNotes(){
  const host=q('abbaMyNotesList');
  if(!host||!currentUser?.id)return;
  host.innerHTML='';
  if(!settingsLessonRows.length)await getAllLessonRows();
  const numberById=new Map(settingsLessonRows.map(r=>[String(r.id),Number(r.lesson_number)]));
  const {data,error}=await db.from('abba_lesson_notes')
    .select('lesson_id,note_text,updated_at')
    .eq('user_id',currentUser.id);
  if(error){
    console.error('ABBA my notes',error);
    host.innerHTML='<p class="abba-note-empty">Não foi possível carregar suas notas.</p>';
    return;
  }
  const notes=(data||[])
    .filter(n=>String(n.note_text||'').trim())
    .map(n=>({...n,lesson_number:numberById.get(String(n.lesson_id))||999}))
    .sort((a,b)=>a.lesson_number-b.lesson_number);
  if(!notes.length){
    host.innerHTML='<p class="abba-note-empty">Suas notas salvas aparecerão aqui, organizadas por aula.</p>';
    return;
  }
  for(const note of notes){
    const card=document.createElement('div');
    card.className='abba-note-card';
    const lessonLabel=note.lesson_number===999?'Aula':'Aula '+note.lesson_number;
    card.innerHTML=`<strong>Notas da ${lessonLabel}</strong><p></p>`;
    card.querySelector('p').textContent=note.note_text||'';
    host.appendChild(card);
  }
}

function ensureSettingsExtras(){
  const sheet=document.querySelector('#settingsPanel .settings-sheet');
  if(!sheet||q('abbaLessonSection'))return;
  ensureSettingsStyles();
  const signout=q('settingsSignOutBtn');

  const lessonsSection=document.createElement('section');
  lessonsSection.id='abbaLessonSection';
  lessonsSection.className='settings-section abba-extra';
  lessonsSection.innerHTML='<div class="settings-kicker">AULAS</div><h3 class="abba-settings-title">Conteúdo do curso</h3><div id="abbaLessonLibrary"></div>';

  const notesSection=document.createElement('section');
  notesSection.id='abbaNotesSection';
  notesSection.className='settings-section abba-extra';
  notesSection.innerHTML='<div class="settings-kicker">MINHAS NOTAS</div><h3 class="abba-settings-title">Notas por aula</h3><div id="abbaMyNotesList"></div>';

  if(signout){
    sheet.insertBefore(lessonsSection,signout);
    sheet.insertBefore(notesSection,signout);
  }else{
    sheet.append(lessonsSection,notesSection);
  }
}

async function openSettingsEnhanced(){
  forcePortuguese();
  q('settingsPanel')?.classList.remove('hidden');
  if(q('settingsEmail'))q('settingsEmail').textContent=currentUser?.email||'';
  ensureSettingsExtras();
  await renderLessonLibrary();
  await renderMyNotes();
}

function wireSettings(){
  const btn=q('settingsBtn');
  if(btn)btn.onclick=openSettingsEnhanced;
  const close=q('closeSettingsBtn');
  if(close)close.onclick=()=>q('settingsPanel')?.classList.add('hidden');
  const panel=q('settingsPanel');
  if(panel)panel.onclick=e=>{if(e.target===panel)panel.classList.add('hidden')};
  const save=q('saveNoteBtn');
  if(save&&!save.dataset.abbaNotesRefresh){
    save.dataset.abbaNotesRefresh='1';
    save.addEventListener('click',()=>setTimeout(()=>{if(!q('settingsPanel')?.classList.contains('hidden'))renderMyNotes()},700));
  }
}

function forcePortuguesePlayerCaption(){
  const player=q('muxPlayer');
  if(!player)return;
  try{
    player.setAttribute('default-show-captions','');
    const tracks=player.textTracks;
    if(!tracks)return;
    let firstCaption=null;
    for(let i=0;i<tracks.length;i++){
      const tr=tracks[i];
      if(tr.kind==='subtitles'||tr.kind==='captions'){
        if(!firstCaption)firstCaption=tr;
        const code=String(tr.language||tr.srclang||'').toLowerCase();
        tr.mode=(code==='pt'||code.startsWith('pt-'))?'showing':'disabled';
      }
    }
    if(firstCaption&&![...tracks].some?.(t=>(String(t.language||'').toLowerCase().startsWith('pt')&&t.mode==='showing')))firstCaption.mode='showing';
  }catch{}
}

async function recoverPortal(){
  forcePortuguese();
  wireSettings();
  try{
    const {data:{session}}=await db.auth.getSession();
    if(!session?.user)return;
    currentUser=session.user;
    show('authView',false);show('portalView',true);show('signOutBtn',true);show('settingsBtn',true);
    if(q('settingsEmail'))q('settingsEmail').textContent=currentUser.email||'';

    if(!currentCourse){
      const {data:courseData,error:courseErr}=await db.from('abba_courses').select('*').eq('slug','annual-program').maybeSingle();
      if(courseErr||!courseData)throw courseErr||new Error('Course not found');
      currentCourse=courseData;
    }

    const {data:enrollment}=await db.from('abba_enrollments').select('*').eq('course_id',currentCourse.id).eq('user_id',currentUser.id).eq('status','active').maybeSingle();
    currentEnrollment=enrollment||null;
    if(!currentEnrollment){show('noEnrollment',true);show('courseArea',false);show('learningDashboard',false);renderProgress();return;}

    show('noEnrollment',false);
    const {data:lessonData,error:lessonErr}=await db.from('abba_lessons').select('*').eq('course_id',currentCourse.id).eq('is_published',true).not('mux_playback_id','is',null).order('lesson_number');
    if(lessonErr)throw lessonErr;
    lessons=lessonData||[];

    progressRows=[];
    if(lessons.length){
      const ids=lessons.map(x=>x.id);
      const {data:progressData}=await db.from('abba_lesson_progress').select('*').in('lesson_id',ids);
      progressRows=progressData||[];
    }

    show('courseArea',true);
    show('learningDashboard',lessons.length>0);
    renderLessons();renderProgress();renderDashboard();
    wireSettings();
    forcePortuguesePlayerCaption();
  }catch(err){
    console.error('ABBA Academy recovery',err);
  }
}

forcePortuguese();
wireSettings();
setTimeout(recoverPortal,500);
setTimeout(recoverPortal,1600);
setTimeout(()=>{wireSettings();forcePortuguesePlayerCaption()},2600);
})();