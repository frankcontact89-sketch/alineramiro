(()=>{
const supported=[['pt','Português'],['en','English'],['es','Español'],['hi','हिन्दी'],['ne','नेपाली'],['ja','日本語'],['zh','中文']];
let captionLang='pt',running=false,bound=false;
const q=id=>document.getElementById(id);
function uiLang(){const l=document.documentElement.lang;return ['en','pt','es'].includes(l)?l:'en'}
function copy(){const l=uiLang();return l==='pt'?{title:'IDIOMA DOS SUBTÍTULOS',label:'Idioma dos subtítulos',help:'Escolha o idioma da transcrição e dos subtítulos da aula.',saved:'Idioma dos subtítulos salvo ✓',preparing:'Preparando tradução...',ready:'Tradução pronta ✓',failed:'Não foi possível preparar esta tradução agora.'}:l==='es'?{title:'IDIOMA DE SUBTÍTULOS',label:'Idioma de subtítulos',help:'Elige el idioma de la transcripción y los subtítulos de la clase.',saved:'Idioma de subtítulos guardado ✓',preparing:'Preparando traducción...',ready:'Traducción lista ✓',failed:'No se pudo preparar esta traducción ahora.'}:{title:'SUBTITLE LANGUAGE',label:'Subtitle language',help:'Choose the language used for the lesson transcript and subtitles.',saved:'Subtitle language saved ✓',preparing:'Preparing translation...',ready:'Translation ready ✓',failed:'Could not prepare this translation right now.'}}
function ensureUI(){
 let sel=q('captionLanguageSelect');
 if(!sel){
  const langSection=q('languageLabel')?.closest('.settings-section');if(!langSection)return null;
  const s=document.createElement('section');s.className='settings-section';s.id='captionSettingsSection';
  s.innerHTML='<div class="settings-kicker" id="captionTitle"></div><label class="settings-select-row"><span id="captionLabel"></span><select id="captionLanguageSelect"></select></label><p class="settings-help" id="captionHelp"></p><p class="settings-help" id="captionStatus"></p>';
  langSection.insertAdjacentElement('afterend',s);sel=q('captionLanguageSelect');
 }
 if(sel && !sel.options.length){supported.forEach(([v,n])=>{const o=document.createElement('option');o.value=v;o.textContent=n;sel.appendChild(o)})}
 if(sel && !bound){sel.addEventListener('change',saveCaptionPref);bound=true}
 if(!q('captionStatus') && sel){const p=document.createElement('p');p.className='settings-help';p.id='captionStatus';sel.closest('.settings-section')?.appendChild(p)}
 translateLabels();
 return sel;
}
function translateLabels(){const t=copy();if(q('captionTitle'))q('captionTitle').textContent=t.title;const section=q('captionLanguageSelect')?.closest('.settings-section');if(section){const kicker=section.querySelector('.settings-kicker');const label=section.querySelector('.settings-select-row span');const help=section.querySelector('.settings-help:not(#captionStatus)');if(kicker)kicker.textContent=t.title;if(label)label.textContent=t.label;if(help)help.textContent=t.help}}
async function loadPref(){const sel=ensureUI();const {data:{session}}=await db.auth.getSession();if(!session||!sel)return;const {data}=await db.from('abba_student_settings').select('preferred_caption_language,preferred_language').eq('user_id',session.user.id).maybeSingle();captionLang=supported.some(x=>x[0]===data?.preferred_caption_language)?data.preferred_caption_language:(['pt','en','es'].includes(data?.preferred_language)?data.preferred_language:'pt');sel.value=captionLang;requestTranslation()}
async function saveCaptionPref(e){const v=e.target.value;if(!supported.some(x=>x[0]===v))return;captionLang=v;const {data:{session}}=await db.auth.getSession();if(session){await db.from('abba_student_settings').upsert({user_id:session.user.id,preferred_caption_language:v,updated_at:new Date().toISOString()},{onConflict:'user_id'})}if(q('captionStatus'))q('captionStatus').textContent=copy().saved;requestTranslation(true)}
function saveSource(l){if(!l||l.__sourceSaved)return;l.__sourceSaved=true;l.__sourceTranscript=l.transcript;l.__sourceCues=Array.isArray(l.transcript_cues)?l.transcript_cues:[];l.__sourceSummary=l.summary;l.__sourcePoints=Array.isArray(l.key_points)?l.key_points:[]}
function restoreSource(){if(!currentLesson)return;saveSource(currentLesson);currentLesson.transcript=currentLesson.__sourceTranscript;currentLesson.transcript_cues=currentLesson.__sourceCues;currentLesson.summary=currentLesson.__sourceSummary;currentLesson.key_points=currentLesson.__sourcePoints;renderLessonResources(currentLesson);if(q('captionStatus'))q('captionStatus').textContent='';applyPlayerCaption('pt')}
async function callTranslation(){const {data:{session}}=await db.auth.getSession();if(!session||!currentLesson)return null;const r=await fetch(`${SUPABASE_URL}/functions/v1/abba-caption-translations`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`,'apikey':SUPABASE_KEY},body:JSON.stringify({lesson_id:currentLesson.id,language:captionLang})});let j={};try{j=await r.json()}catch{}if(!r.ok)throw new Error(j.error||'Translation failed');return j}
function applyPlayerCaption(lang){const p=q('muxPlayer');if(!p||!currentLesson?.mux_playback_id)return;let pos=0,paused=true;try{pos=p.currentTime||0;paused=p.paused}catch{}
 const base=currentLesson.mux_playback_id;const next=lang&&lang!=='pt'?`${base}?default_subtitles_lang=${encodeURIComponent(lang)}`:`${base}?default_subtitles_lang=pt`;
 p.setAttribute('playback-id',next);
 setTimeout(()=>{try{p.currentTime=pos;if(!paused)p.play()}catch{}},700);
}
async function requestTranslation(force=false){if(!currentLesson)return;if(captionLang==='pt'){restoreSource();return}if(running&&!force)return;running=true;saveSource(currentLesson);if(q('captionStatus'))q('captionStatus').textContent=copy().preparing;try{for(let i=0;i<45;i++){const j=await callTranslation();if(!j)break;if(j.status==='ready'){currentLesson.transcript=j.transcript||'';currentLesson.transcript_cues=Array.isArray(j.transcript_cues)?j.transcript_cues:[];currentLesson.summary=j.summary||'';currentLesson.key_points=Array.isArray(j.key_points)?j.key_points:[];renderLessonResources(currentLesson);applyPlayerCaption(captionLang);if(q('captionStatus'))q('captionStatus').textContent=copy().ready;return}if(j.status==='source'){restoreSource();return}await new Promise(r=>setTimeout(r,4000))}if(q('captionStatus'))q('captionStatus').textContent=copy().preparing}catch(e){console.warn(e);if(q('captionStatus'))q('captionStatus').textContent=copy().failed}finally{running=false}}
if(typeof openLesson==='function'){const base=openLesson;window.openLesson=async function(...args){const out=await base(...args);setTimeout(()=>requestTranslation(),300);return out}}
new MutationObserver(()=>{ensureUI();if(currentLesson&&!q('lessonView')?.classList.contains('hidden'))requestTranslation()}).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['lang','class']});
setTimeout(loadPref,500);
})();