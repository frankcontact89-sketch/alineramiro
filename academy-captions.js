(()=>{
const supported=['pt','en','es','hi','ne','ja','zh'];
const q=id=>document.getElementById(id);
let captionLang=localStorage.getItem('abba_caption_lang')||'pt';
let activeJob=false;

function uiCopy(){const l=document.documentElement.lang;return l==='pt'?{saved:'Idioma dos subtítulos salvo ✓',preparing:'Preparando tradução...',ready:'Tradução pronta ✓',failed:'Falha ao preparar tradução.'}:l==='es'?{saved:'Idioma de subtítulos guardado ✓',preparing:'Preparando traducción...',ready:'Traducción lista ✓',failed:'No se pudo preparar la traducción.'}:{saved:'Subtitle language saved ✓',preparing:'Preparing translation...',ready:'Translation ready ✓',failed:'Could not prepare translation.'}}

async function persist(lang){
 captionLang=supported.includes(lang)?lang:'pt';
 localStorage.setItem('abba_caption_lang',captionLang);
 const sel=q('captionLanguageSelect'); if(sel) sel.value=captionLang;
 const {data:{session}}=await db.auth.getSession();
 if(session){
   const {error}=await db.from('abba_student_settings').upsert({user_id:session.user.id,preferred_caption_language:captionLang,updated_at:new Date().toISOString()},{onConflict:'user_id'});
   if(error) console.error('caption pref save failed',error);
 }
 const s=q('captionStatus'); if(s) s.textContent=uiCopy().saved;
 await translateCurrent();
}

window.abbaSetCaptionLanguage=persist;

document.addEventListener('change',e=>{
 const target=e.target;
 if(target && target.id==='captionLanguageSelect') persist(target.value);
},true);

async function loadPreference(){
 const sel=q('captionLanguageSelect');
 const {data:{session}}=await db.auth.getSession();
 if(session){
   const {data}=await db.from('abba_student_settings').select('preferred_caption_language,preferred_language').eq('user_id',session.user.id).maybeSingle();
   if(data?.preferred_caption_language && supported.includes(data.preferred_caption_language)) captionLang=data.preferred_caption_language;
   else if(!localStorage.getItem('abba_caption_lang') && ['en','es','pt'].includes(data?.preferred_language)) captionLang=data.preferred_language;
 }
 localStorage.setItem('abba_caption_lang',captionLang);
 if(sel) sel.value=captionLang;
 setTimeout(()=>translateCurrent(),600);
}

function stashSource(){
 if(!currentLesson || currentLesson.__abbaSourceSaved) return;
 currentLesson.__abbaSourceSaved=true;
 currentLesson.__abbaSourceTranscript=currentLesson.transcript;
 currentLesson.__abbaSourceCues=Array.isArray(currentLesson.transcript_cues)?currentLesson.transcript_cues:[];
 currentLesson.__abbaSourceSummary=currentLesson.summary;
 currentLesson.__abbaSourcePoints=Array.isArray(currentLesson.key_points)?currentLesson.key_points:[];
}

function restorePortuguese(){
 if(!currentLesson)return;
 stashSource();
 currentLesson.transcript=currentLesson.__abbaSourceTranscript;
 currentLesson.transcript_cues=currentLesson.__abbaSourceCues;
 currentLesson.summary=currentLesson.__abbaSourceSummary;
 currentLesson.key_points=currentLesson.__abbaSourcePoints;
 if(typeof renderLessonResources==='function') renderLessonResources(currentLesson);
 selectPlayerCaption('pt');
}

async function callTranslation(){
 const {data:{session}}=await db.auth.getSession();
 if(!session||!currentLesson) return null;
 const r=await fetch(`${SUPABASE_URL}/functions/v1/abba-caption-translations`,{
   method:'POST',
   headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`,'apikey':SUPABASE_KEY},
   body:JSON.stringify({lesson_id:currentLesson.id,language:captionLang})
 });
 let body={}; try{body=await r.json()}catch{}
 if(!r.ok) throw new Error(body.error||`HTTP ${r.status}`);
 return body;
}

function selectPlayerCaption(lang){
 const p=q('muxPlayer');
 if(!p||!currentLesson?.mux_playback_id)return;
 let pos=0,wasPaused=true;
 try{pos=p.currentTime||0;wasPaused=p.paused}catch{}
 p.setAttribute('playback-id',`${currentLesson.mux_playback_id}?default_subtitles_lang=${encodeURIComponent(lang)}`);
 const choose=()=>{try{const tracks=p.textTracks;if(!tracks)return false;let found=false;for(let i=0;i<tracks.length;i++){const tr=tracks[i];const code=(tr.language||'').toLowerCase();const label=(tr.label||'').toLowerCase();const match=code===lang||code.startsWith(lang+'-')||label.includes(lang);if(tr.kind==='subtitles'||tr.kind==='captions')tr.mode=match?'showing':'disabled';if(match)found=true;}return found}catch{return false}};
 let tries=0;const timer=setInterval(()=>{tries++;if(choose()||tries>24)clearInterval(timer)},500);
 setTimeout(()=>{try{p.currentTime=pos;if(!wasPaused)p.play()}catch{}},900);
}

async function translateCurrent(){
 if(!currentLesson)return;
 if(captionLang==='pt'){restorePortuguese();return;}
 if(activeJob)return;
 activeJob=true;stashSource();
 const status=q('captionStatus'); if(status)status.textContent=uiCopy().preparing;
 try{
   for(let i=0;i<50;i++){
     const j=await callTranslation();
     if(!j)break;
     if(j.status==='ready'){
       currentLesson.transcript=j.transcript||'';
       currentLesson.transcript_cues=Array.isArray(j.transcript_cues)?j.transcript_cues:[];
       currentLesson.summary=j.summary||'';
       currentLesson.key_points=Array.isArray(j.key_points)?j.key_points:[];
       if(typeof renderLessonResources==='function')renderLessonResources(currentLesson);
       selectPlayerCaption(captionLang);
       if(status)status.textContent=uiCopy().ready;
       return;
     }
     if(j.status==='source'){restorePortuguese();return;}
     await new Promise(r=>setTimeout(r,4000));
   }
   if(status)status.textContent=uiCopy().preparing;
 }catch(err){console.error('ABBA caption translation',err);if(status)status.textContent=uiCopy().failed;}
 finally{activeJob=false;}
}

setInterval(()=>{
 const sel=q('captionLanguageSelect'); if(sel && sel.value!==captionLang) sel.value=captionLang;
 if(currentLesson && !q('lessonView')?.classList.contains('hidden')) translateCurrent();
},1500);

setTimeout(loadPreference,700);
})();