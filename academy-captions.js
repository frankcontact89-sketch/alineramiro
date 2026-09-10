(()=>{
const supported=['pt','en'];
const q=id=>document.getElementById(id);
let captionLang='pt';
let activeJob=false;
let lastLessonKey='';
let lastAppliedTrackKey='';
let generatedTrack=null;

function uiCopy(){
 const l=document.documentElement.lang;
 return l==='pt'
   ?{saved:'Idioma salvo ✓',preparing:'Preparando tradução...',ready:'Tradução pronta ✓',failed:'Falha ao preparar tradução.'}
   :{saved:'Language saved ✓',preparing:'Preparing translation...',ready:'Translation ready ✓',failed:'Could not prepare translation.'};
}
function normalize(lang){return supported.includes(lang)?lang:'pt'}
function n(v){const x=Number(v);return Number.isFinite(x)?x:0}

async function saveUnifiedPreference(lang){
 captionLang=normalize(lang);
 localStorage.setItem('abba_caption_lang',captionLang);
 localStorage.setItem('abba_lang',captionLang);
 const {data:{session}}=await db.auth.getSession();
 if(session){
   const {error}=await db.from('abba_student_settings').upsert({user_id:session.user.id,preferred_language:captionLang,preferred_caption_language:captionLang,updated_at:new Date().toISOString()},{onConflict:'user_id'});
   if(error)console.error('ABBA language preference save failed',error);
 }
 const s=q('captionStatus');if(s)s.textContent=uiCopy().saved;
 await translateCurrent(true);
}
window.abbaSetCaptionLanguage=saveUnifiedPreference;

async function loadPreference(){
 const {data:{session}}=await db.auth.getSession();
 let saved=normalize(localStorage.getItem('abba_lang')||localStorage.getItem('abba_caption_lang')||'pt');
 if(session){
   const {data}=await db.from('abba_student_settings').select('preferred_language,preferred_caption_language').eq('user_id',session.user.id).maybeSingle();
   saved=normalize(data?.preferred_language||data?.preferred_caption_language||saved);
 }
 captionLang=saved;
 localStorage.setItem('abba_lang',saved);
 localStorage.setItem('abba_caption_lang',saved);
 setTimeout(()=>translateCurrent(true),400);
}

function stashSource(){
 if(!currentLesson||currentLesson.__abbaSourceSaved)return;
 currentLesson.__abbaSourceSaved=true;
 currentLesson.__abbaSourceTranscript=currentLesson.transcript;
 currentLesson.__abbaSourceCues=Array.isArray(currentLesson.transcript_cues)?currentLesson.transcript_cues:[];
 currentLesson.__abbaSourceSummary=currentLesson.summary;
 currentLesson.__abbaSourcePoints=Array.isArray(currentLesson.key_points)?currentLesson.key_points:[];
}

function clearGeneratedTrack(){
 try{
   if(generatedTrack){generatedTrack.mode='disabled';while(generatedTrack.cues?.length)generatedTrack.removeCue(generatedTrack.cues[0]);}
 }catch{}
 generatedTrack=null;
}

function restorePortuguese(){
 if(!currentLesson)return;
 clearGeneratedTrack();
 stashSource();
 currentLesson.transcript=currentLesson.__abbaSourceTranscript;
 currentLesson.transcript_cues=currentLesson.__abbaSourceCues;
 currentLesson.summary=currentLesson.__abbaSourceSummary;
 currentLesson.key_points=currentLesson.__abbaSourcePoints;
 if(typeof renderLessonResources==='function')renderLessonResources(currentLesson);
 selectPlayerCaption('pt');
}

async function callTranslation(){
 const {data:{session}}=await db.auth.getSession();
 if(!session||!currentLesson)return null;
 const r=await fetch(`${SUPABASE_URL}/functions/v1/abba-caption-translations`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`,'apikey':SUPABASE_KEY},body:JSON.stringify({lesson_id:currentLesson.id,language:captionLang})});
 let body={};try{body=await r.json()}catch{}
 if(!r.ok)throw new Error(body.error||`HTTP ${r.status}`);
 return body;
}

function chooseExistingTrack(lang){
 const p=q('muxPlayer');if(!p)return false;
 try{
   const tracks=p.textTracks;if(!tracks)return false;let found=false;
   for(let i=0;i<tracks.length;i++){
     const tr=tracks[i],code=(tr.language||'').toLowerCase(),label=(tr.label||'').toLowerCase();
     const match=code===lang||code.startsWith(lang+'-')||label===lang||label.includes(lang==='pt'?'portugu':'english');
     if(tr.kind==='subtitles'||tr.kind==='captions')tr.mode=match?'showing':'disabled';
     if(match)found=true;
   }
   return found;
 }catch{return false}
}

function installGeneratedEnglishTrack(cues){
 const p=q('muxPlayer');
 if(!p||!Array.isArray(cues)||!cues.length)return false;
 try{
   clearGeneratedTrack();
   const media=p.media||p;
   if(typeof media.addTextTrack!=='function')return false;
   const tr=media.addTextTrack('subtitles','English','en');
   for(let i=0;i<cues.length;i++){
     const c=cues[i]||{};
     const start=n(c.start??c.start_time??c.start_seconds??c.from);
     let end=n(c.end??c.end_time??c.end_seconds??c.to);
     const text=String(c.text??c.caption??c.transcript??'').trim();
     if(!text)continue;
     if(end<=start)end=start+Math.max(1.5,Math.min(6,text.length/12));
     try{tr.addCue(new VTTCue(start,end,text))}catch{}
   }
   generatedTrack=tr;
   try{
     const tracks=media.textTracks;
     for(let i=0;i<tracks.length;i++)if(tracks[i]!==tr&&(tracks[i].kind==='subtitles'||tracks[i].kind==='captions'))tracks[i].mode='disabled';
   }catch{}
   tr.mode='showing';
   return true;
 }catch(err){console.error('ABBA generated English captions',err);return false}
}

function selectPlayerCaption(lang){
 const p=q('muxPlayer');if(!p||!currentLesson?.mux_playback_id)return;
 if(lang==='en'&&generatedTrack){try{generatedTrack.mode='showing';return}catch{}}
 const key=`${currentLesson.id}:${lang}`;
 if(chooseExistingTrack(lang)){lastAppliedTrackKey=key;return;}
 if(lastAppliedTrackKey===key)return;
 lastAppliedTrackKey=key;
 let tries=0;const timer=setInterval(()=>{tries++;if(chooseExistingTrack(lang)||tries>=20)clearInterval(timer)},300);
}

async function translateCurrent(force=false){
 if(!currentLesson)return;
 const key=`${currentLesson.id}:${captionLang}`;
 if(!force&&lastLessonKey===key)return;
 lastLessonKey=key;
 if(captionLang==='pt'){restorePortuguese();return;}
 if(activeJob)return;
 activeJob=true;stashSource();
 const status=q('captionStatus');if(status)status.textContent=uiCopy().preparing;
 try{
   for(let i=0;i<40;i++){
     const j=await callTranslation();if(!j)break;
     if(j.status==='ready'){
       currentLesson.transcript=j.transcript||'';
       currentLesson.transcript_cues=Array.isArray(j.transcript_cues)?j.transcript_cues:[];
       currentLesson.summary=j.summary||'';
       currentLesson.key_points=Array.isArray(j.key_points)?j.key_points:[];
       if(typeof renderLessonResources==='function')renderLessonResources(currentLesson);
       const installed=installGeneratedEnglishTrack(currentLesson.transcript_cues);
       if(!installed)selectPlayerCaption('en');
       if(status)status.textContent=uiCopy().ready;
       return;
     }
     if(j.status==='source'){restorePortuguese();return;}
     await new Promise(r=>setTimeout(r,3000));
   }
 }catch(err){console.error('ABBA caption translation',err);if(status)status.textContent=uiCopy().failed;}
 finally{activeJob=false;}
}

setInterval(()=>{
 if(!currentLesson||q('lessonView')?.classList.contains('hidden'))return;
 const unified=normalize(document.documentElement.lang);
 if(unified!==captionLang)captionLang=unified;
 translateCurrent(false);
},800);
setTimeout(loadPreference,300);
})();