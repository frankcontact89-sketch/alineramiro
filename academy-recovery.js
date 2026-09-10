(()=>{
let captionLang='pt';
let captionBusy=false;
let lastCaptionLesson='';
let lastCaptionLang='';
const captionSupported=['pt','en','es','hi','ne','ja','zh'];
const captionName={pt:'Português',en:'English',es:'Español',hi:'हिन्दी',ne:'नेपाली',ja:'日本語',zh:'中文'};

function captionStatus(message){
  const el=document.getElementById('settingsStatus');
  if(el)el.textContent=message||'';
}

function captionCopy(key){
  const lang=(document.documentElement.lang||'en').toLowerCase();
  const copy={
    en:{saved:'Subtitle language saved ✓',preparing:'Preparing translated subtitles…',ready:'Subtitles ready ✓',failed:'Could not create these subtitles yet.'},
    pt:{saved:'Idioma dos subtítulos salvo ✓',preparing:'Preparando legendas traduzidas…',ready:'Legendas prontas ✓',failed:'Ainda não foi possível criar estas legendas.'},
    es:{saved:'Idioma de subtítulos guardado ✓',preparing:'Preparando subtítulos traducidos…',ready:'Subtítulos listos ✓',failed:'Todavía no se pudieron crear estos subtítulos.'}
  };
  return (copy[lang]||copy.en)[key];
}

async function getSession(){
  try{return (await db.auth.getSession()).data.session||null}catch{return null}
}

function rememberPortugueseSource(lesson){
  if(!lesson||lesson.__ptSourceSaved)return;
  lesson.__ptSourceSaved=true;
  lesson.__ptTranscript=lesson.transcript||'';
  lesson.__ptCues=Array.isArray(lesson.transcript_cues)?lesson.transcript_cues:[];
  lesson.__ptSummary=lesson.summary||'';
  lesson.__ptPoints=Array.isArray(lesson.key_points)?lesson.key_points:[];
}

function showPortugueseSource(){
  if(!currentLesson)return;
  rememberPortugueseSource(currentLesson);
  currentLesson.transcript=currentLesson.__ptTranscript;
  currentLesson.transcript_cues=currentLesson.__ptCues;
  currentLesson.summary=currentLesson.__ptSummary;
  currentLesson.key_points=currentLesson.__ptPoints;
  renderLessonResources(currentLesson);
  captionStatus('');
}

function selectPlayerCaption(language){
  const player=document.getElementById('muxPlayer');
  if(!player)return;
  try{
    player.setAttribute('default-show-captions','');
    const tracks=player.textTracks;
    if(!tracks)return;
    let found=false;
    for(let i=0;i<tracks.length;i++){
      const tr=tracks[i];
      const code=String(tr.language||tr.srclang||'').toLowerCase();
      const match=code===language||code.startsWith(language+'-')||code.startsWith(language);
      tr.mode=match?'showing':'disabled';
      if(match)found=true;
    }
    if(!found&&language==='pt'){
      for(let i=0;i<tracks.length;i++){
        if(tracks[i].kind==='subtitles'||tracks[i].kind==='captions'){tracks[i].mode='showing';break}
      }
    }
  }catch(e){console.warn('Caption track selection',e)}
}

async function requestCaptionTranslation(force=false){
  if(!currentLesson||!currentLesson.id)return;
  if(!captionSupported.includes(captionLang))captionLang='pt';
  if(captionLang==='pt'){
    showPortugueseSource();
    selectPlayerCaption('pt');
    return;
  }
  const key=currentLesson.id+':'+captionLang;
  if(captionBusy&&!force)return;
  if(!force&&lastCaptionLesson===currentLesson.id&&lastCaptionLang===captionLang)return;
  lastCaptionLesson=currentLesson.id;
  lastCaptionLang=captionLang;
  captionBusy=true;
  rememberPortugueseSource(currentLesson);
  captionStatus(captionCopy('preparing'));
  try{
    const session=await getSession();
    if(!session)throw new Error('No session');
    for(let attempt=0;attempt<45;attempt++){
      const response=await fetch(`${SUPABASE_URL}/functions/v1/abba-caption-translations`,{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`,'apikey':SUPABASE_KEY},
        body:JSON.stringify({lesson_id:currentLesson.id,language:captionLang})
      });
      let data={};
      try{data=await response.json()}catch{}
      if(!response.ok)throw new Error(data.error||`Translation error ${response.status}`);
      if(data.status==='ready'){
        currentLesson.transcript=data.transcript||'';
        currentLesson.transcript_cues=Array.isArray(data.transcript_cues)?data.transcript_cues:[];
        currentLesson.summary=data.summary||'';
        currentLesson.key_points=Array.isArray(data.key_points)?data.key_points:[];
        renderLessonResources(currentLesson);
        captionStatus(captionCopy('ready'));
        const player=document.getElementById('muxPlayer');
        if(player){
          let position=0;
          try{position=player.currentTime||0}catch{}
          const playback=currentLesson.mux_playback_id;
          if(playback){player.setAttribute('playback-id',playback)}
          setTimeout(()=>{try{player.currentTime=position;selectPlayerCaption(captionLang)}catch{}},900);
          setTimeout(()=>selectPlayerCaption(captionLang),1800);
        }
        return;
      }
      if(data.status==='source'){
        showPortugueseSource();
        return;
      }
      await new Promise(resolve=>setTimeout(resolve,4000));
    }
    captionStatus(captionCopy('preparing'));
  }catch(err){
    console.error('ABBA Academy captions',err);
    captionStatus(captionCopy('failed'));
  }finally{
    captionBusy=false;
  }
}

async function loadCaptionPreference(){
  const select=document.getElementById('captionLanguageSelect');
  if(!select)return;
  const session=await getSession();
  if(!session)return;
  try{
    const {data}=await db.from('abba_student_settings').select('preferred_caption_language,preferred_language').eq('user_id',session.user.id).maybeSingle();
    const preferred=data?.preferred_caption_language;
    captionLang=captionSupported.includes(preferred)?preferred:(captionSupported.includes(data?.preferred_language)?data.preferred_language:'pt');
    select.value=captionLang;
  }catch{captionLang=select.value||'pt'}
}

async function saveCaptionPreference(){
  const select=document.getElementById('captionLanguageSelect');
  if(!select)return;
  const value=select.value;
  if(!captionSupported.includes(value))return;
  captionLang=value;
  const session=await getSession();
  if(session){
    const {error}=await db.from('abba_student_settings').upsert({user_id:session.user.id,preferred_caption_language:value,updated_at:new Date().toISOString()},{onConflict:'user_id'});
    if(error){console.error(error);captionStatus(captionCopy('failed'));return}
  }
  captionStatus(captionCopy('saved'));
  lastCaptionLesson='';
  lastCaptionLang='';
  await requestCaptionTranslation(true);
}

async function wireCaptions(){
  const select=document.getElementById('captionLanguageSelect');
  if(!select)return;
  if(!select.dataset.wired){
    select.dataset.wired='1';
    select.addEventListener('change',saveCaptionPreference);
  }
  await loadCaptionPreference();
}

async function recoverPortal(){
  try{
    const {data:{session}}=await db.auth.getSession();
    if(!session?.user)return;
    const learning=document.getElementById('learningDashboard');
    const courseArea=document.getElementById('courseArea');
    const alreadyVisible=(learning&&!learning.classList.contains('hidden'))||(courseArea&&!courseArea.classList.contains('hidden'));
    if(alreadyVisible){await wireCaptions();return;}

    currentUser=session.user;
    show('authView',false);show('portalView',true);show('signOutBtn',true);show('settingsBtn',true);
    if($('settingsEmail'))$('settingsEmail').textContent=currentUser.email||'';

    const {data:courseData,error:courseErr}=await db.from('abba_courses').select('*').eq('slug','annual-program').maybeSingle();
    if(courseErr||!courseData)throw courseErr||new Error('Course not found');
    currentCourse=courseData;

    const {data:enrollment}=await db.from('abba_enrollments').select('*').eq('course_id',currentCourse.id).eq('user_id',currentUser.id).eq('status','active').maybeSingle();
    currentEnrollment=enrollment||null;
    if(!currentEnrollment){show('noEnrollment',true);show('courseArea',false);show('learningDashboard',false);renderProgress();await wireCaptions();return;}

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
    renderLessons();renderProgress();renderDashboard();applyLanguage(currentLang);
    await wireCaptions();
  }catch(err){
    console.error('ABBA Academy recovery',err);
    const hero=document.getElementById('courseDescription');
    if(hero&&!hero.textContent)hero.textContent='Please refresh the page to continue.';
  }
}

setTimeout(recoverPortal,900);
setTimeout(recoverPortal,2500);
setTimeout(wireCaptions,1200);

setInterval(()=>{
  if(currentLesson&&!document.getElementById('lessonView')?.classList.contains('hidden')){
    requestCaptionTranslation(false);
  }
},1800);
})();