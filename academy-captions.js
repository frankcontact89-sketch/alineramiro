(()=>{
const q=id=>document.getElementById(id);
let appliedLessonId=null;

function selectPortugueseTrack(){
 const p=q('muxPlayer');
 if(!p)return false;
 try{
   const tracks=p.textTracks;
   if(!tracks)return false;
   let found=false;
   for(let i=0;i<tracks.length;i++){
     const tr=tracks[i];
     const code=(tr.language||'').toLowerCase();
     const label=(tr.label||'').toLowerCase();
     const match=code==='pt'||code.startsWith('pt-')||label.includes('portugu');
     if(tr.kind==='subtitles'||tr.kind==='captions')tr.mode=match?'showing':'disabled';
     if(match)found=true;
   }
   return found;
 }catch{return false}
}

async function persistPortuguese(){
 localStorage.setItem('abba_lang','pt');
 localStorage.setItem('abba_caption_lang','pt');
 document.documentElement.lang='pt';
 const {data:{session}}=await db.auth.getSession();
 if(session){
   await db.from('abba_student_settings').upsert({
     user_id:session.user.id,
     preferred_language:'pt',
     preferred_caption_language:'pt',
     updated_at:new Date().toISOString()
   },{onConflict:'user_id'});
 }
 const s=q('captionStatus');if(s)s.textContent='Português ativo ✓';
}

function ensurePortugueseForCurrentLesson(){
 if(!currentLesson||!currentLesson.mux_playback_id)return;
 if(appliedLessonId===currentLesson.id&&selectPortugueseTrack())return;
 appliedLessonId=currentLesson.id;
 let tries=0;
 const timer=setInterval(()=>{
   tries++;
   if(selectPortugueseTrack()||tries>=20)clearInterval(timer);
 },300);
}

window.abbaSetCaptionLanguage=async()=>{await persistPortuguese();ensurePortugueseForCurrentLesson();};

setInterval(()=>{
 if(currentLesson&&!q('lessonView')?.classList.contains('hidden'))ensurePortugueseForCurrentLesson();
},1200);

persistPortuguese();
})();