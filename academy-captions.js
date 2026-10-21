(()=>{
const el=id=>document.getElementById(id);
const languages=['pt','en'];
let selected=languages.includes(localStorage.getItem('abba_caption_lang'))?localStorage.getItem('abba_caption_lang'):'pt';
let lessonId=null;
const css=document.createElement('style');
css.textContent='.caption-language-bar{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin:16px 0 12px;padding:12px 14px;border:1px solid #d9e1eb;border-radius:12px;background:#f8fbff}.caption-language-bar label{font-weight:700;color:#24334d;font-size:14px}.caption-language-bar select{margin-left:auto;max-width:100%;border:1px solid #b9cce4;border-radius:9px;background:white;padding:9px 12px;font:inherit;color:#203650}.caption-language-bar #captionStatus{width:100%;font-size:13px;color:#52617a}@media(max-width:440px){.caption-language-bar select{margin-left:0;width:100%}}';
document.head.appendChild(css);
function matching(track,lang){
 const code=String(track.language||'').toLowerCase(),label=String(track.label||'').toLowerCase();
 return lang==='pt'?(code==='pt'||code.startsWith('pt-')||label.includes('portugu')):(code==='en'||code.startsWith('en-')||label.includes('english')||label.includes('inglês'));
}
function setStatus(message){const node=el('captionStatus');if(node)node.textContent=message}
function applyTracks(){
 const player=el('muxPlayer');
 if(!player||!window.currentLesson&&!currentLesson)return;
 let found=false;
 try{
  const tracks=player.textTracks;if(!tracks)return;
  for(let i=0;i<tracks.length;i++){
   const tr=tracks[i];if(!['subtitles','captions'].includes(tr.kind))continue;
   const isMatch=matching(tr,selected);
   tr.mode=isMatch?'showing':'disabled';
   if(isMatch)found=true;
  }
  if(found)setStatus(selected==='pt'?'Legendas em português ativadas ✓':'English subtitles enabled ✓');
  else setStatus(selected==='pt'?'Legendas em português ainda não disponíveis nesta aula.':'English subtitles are not yet available for this lesson.');
 }catch(e){console.warn('ABBA captions',e)}
}
function translatedCues(lesson){
 if(selected!=='en')return null;
 for(const key of ['transcript_cues_en','english_transcript_cues','transcript_en_cues']){
  if(Array.isArray(lesson[key])&&lesson[key].length)return lesson[key];
 }
 return null;
}
function updateTranscript(){
 const lesson=typeof currentLesson!=='undefined'?currentLesson:null;
 const host=el('transcriptContent');if(!lesson||!host)return;
 if(selected!=='en')return;
 const cues=translatedCues(lesson);
 const prose=lesson.transcript_en||lesson.english_transcript;
 if(cues){
  host.replaceChildren();
  const wrapper=document.createElement('div');wrapper.className='transcript-list';
  cues.forEach(c=>{
   const row=document.createElement('button');row.type='button';row.className='transcript-row';
   const stamp=document.createElement('span');stamp.className='transcript-time';
   const sec=Math.max(0,Math.floor(Number(c.start)||0));stamp.textContent=Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0');
   const text=document.createElement('span');text.className='transcript-text';text.textContent=c.text||'';
   row.append(stamp,text);row.onclick=()=>{const player=el('muxPlayer');if(player){player.currentTime=sec;player.play().catch(()=>{});window.scrollTo({top:0,behavior:'smooth'})}};wrapper.appendChild(row);
  });host.appendChild(wrapper);
 }else if(typeof prose==='string'&&prose.trim()){host.textContent=prose.trim();}
 else host.textContent='English transcript is not yet available for this lesson.';
}
function refresh(){if(!el('lessonView')?.classList.contains('hidden')&&typeof currentLesson!=='undefined'&&currentLesson){applyTracks();updateTranscript()}}
async function persist(){
 localStorage.setItem('abba_caption_lang',selected);
 try{const {data:{session}}=await db.auth.getSession();if(session)await db.from('abba_student_settings').upsert({user_id:session.user.id,preferred_caption_language:selected,updated_at:new Date().toISOString()},{onConflict:'user_id'});}catch(e){console.warn('ABBA caption preference',e)}
}
function select(lang){selected=languages.includes(lang)?lang:'pt';const selector=el('captionLanguageSelect');if(selector)selector.value=selected;persist();if(typeof currentLesson!=='undefined'&&currentLesson&&typeof renderLessonResources==='function'){renderLessonResources(currentLesson)}refresh()}
const selector=el('captionLanguageSelect');
if(selector){selector.value=selected;selector.addEventListener('change',event=>select(event.target.value))}
window.abbaSetCaptionLanguage=select;
const player=el('muxPlayer');
if(player){['loadedmetadata','canplay','emptied'].forEach(evt=>player.addEventListener(evt,()=>setTimeout(applyTracks,50)));try{player.textTracks?.addEventListener('addtrack',()=>setTimeout(applyTracks,100))}catch{}}
if(typeof renderLessonResources==='function'){
 const original=renderLessonResources;
 renderLessonResources=function(lesson){original(lesson);if(lesson&&selected==='en')updateTranscript()};
}
setInterval(()=>{const lesson=typeof currentLesson!=='undefined'?currentLesson:null;if(!lesson||el('lessonView')?.classList.contains('hidden'))return;if(lesson.id!==lessonId){lessonId=lesson.id;setStatus('');setTimeout(refresh,250)}applyTracks()},1400);
try{db.auth.getSession().then(async({data:{session}})=>{if(!session)return;const {data}=await db.from('abba_student_settings').select('preferred_caption_language').eq('user_id',session.user.id).maybeSingle();if(data&&languages.includes(data.preferred_caption_language)){selected=data.preferred_caption_language;localStorage.setItem('abba_caption_lang',selected);if(selector)selector.value=selected;refresh()}}).catch(()=>{})}catch{}
})();