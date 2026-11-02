(()=>{
'use strict';
const q=id=>document.getElementById(id);
const translations={en:{days:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],weekly:'WEEKLY ACTIVITY',title:'Your study week',streak:n=>n+'-day streak',active:n=>n+' active '+(n===1?'day':'days')+' this week',progress:'Course progress',studied:n=>'You studied '+n+' '+(n===1?'day':'days')+' this week.',empty:'Your study activity will appear here as you use the Academy.',yes:'studied',no:'no activity',today:'today'},pt:{days:['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'],weekly:'ATIVIDADE SEMANAL',title:'Sua semana de estudos',streak:n=>n+' dias seguidos',active:n=>n+' dias ativos esta semana',progress:'Progresso do curso',studied:n=>'Você estudou em '+n+' '+(n===1?'dia':'dias')+' nesta semana.',empty:'Sua atividade de estudo aparecerá aqui conforme você acessar a Academy.',yes:'estudou',no:'sem atividade',today:'hoje'},es:{days:['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'],weekly:'ACTIVIDAD SEMANAL',title:'Tu semana de estudio',streak:n=>n+' días consecutivos',active:n=>n+' días activos esta semana',progress:'Progreso del curso',studied:n=>'Estudiaste '+n+' '+(n===1?'día':'días')+' esta semana.',empty:'Tu actividad de estudio aparecerá aquí cuando utilices la Academia.',yes:'estudió',no:'sin actividad',today:'hoy'}};const tr=()=>translations[document.documentElement.lang]||translations.en;

function localDateString(d=new Date()){
  const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function startOfWeek(d=new Date()){
  const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());
  const js=x.getDay();
  x.setDate(x.getDate()-(js===0?6:js-1));
  return x;
}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}

function ensureCard(){
  if(q('abbaWeeklyActivity'))return q('abbaWeeklyActivity');
  const dashboard=q('learningDashboard');
  if(!dashboard)return null;
  const card=document.createElement('section');
  card.id='abbaWeeklyActivity';
  card.className='card abba-weekly-card';
  card.innerHTML=`
    <div class="abba-weekly-head">
      <div><div class="eyebrow">ATIVIDADE SEMANAL</div><h2>Sua semana de estudos</h2></div>
      <div class="abba-streak" id="abbaStreak">0 dias</div>
    </div>
    <p class="abba-weekly-copy" id="abbaWeeklyCopy">Acompanhe os dias em que você estudou na ABBA Academy.</p>
    <div class="abba-week-days" id="abbaWeekDays" aria-label="Atividade desta semana"></div>
    <div class="abba-weekly-foot"><strong id="abbaActiveCount">0 dias ativos</strong><span id="abbaCourseProgress"></span></div>`;
  dashboard.insertBefore(card,dashboard.firstChild);
  return card;
}

async function getSessionUser(){
  try{return (await db.auth.getSession()).data.session?.user||null}catch{return null}
}

async function recordToday(user){
  const today=localDateString();
  const now=new Date().toISOString();
  const {error}=await db.from('abba_daily_activity').upsert({user_id:user.id,activity_date:today,last_seen_at:now,updated_at:now},{onConflict:'user_id,activity_date'});
  if(error)console.error('ABBA activity record',error);
}

function calculateStreak(rows){
  const dates=new Set((rows||[]).map(r=>String(r.activity_date)));
  let cursor=new Date();
  let streak=0;
  while(dates.has(localDateString(cursor))){streak++;cursor=addDays(cursor,-1)}
  return streak;
}

function render(rows){
  const card=ensureCard();if(!card)return;
  const active=new Set((rows||[]).map(r=>String(r.activity_date)));
  const today=localDateString();
  const L=tr();card.querySelector('.eyebrow').textContent=L.weekly;card.querySelector('h2').textContent=L.title;const monday=startOfWeek();
  const host=q('abbaWeekDays');host.innerHTML='';
  let weekCount=0;
  for(let i=0;i<7;i++){
    const d=addDays(monday,i),key=localDateString(d),didStudy=active.has(key),isToday=key===today;
    if(didStudy)weekCount++;
    const cell=document.createElement('div');
    cell.className='abba-day'+(didStudy?' active':'')+(isToday?' today':'');
    cell.setAttribute('aria-label',`${L.days[i]}: ${didStudy?L.yes:L.no}${isToday?', '+L.today:''}`);
    cell.innerHTML=`<span class="abba-day-mark">${didStudy?'✓':L.days[i].slice(0,2)}</span><small>${L.days[i]}</small>`;
    host.appendChild(cell);
  }
  const streak=calculateStreak(rows);
  q('abbaStreak').textContent=L.streak(streak);
  q('abbaActiveCount').textContent=L.active(weekCount);
  const progress=q('progressLabel')?.textContent?.trim();
  q('abbaCourseProgress').textContent=progress?`${L.progress}: ${progress}`:'';
  q('abbaWeeklyCopy').textContent=weekCount?L.studied(weekCount):L.empty;
}

async function refresh(){
  const user=await getSessionUser();if(!user)return;
  await recordToday(user);
  const since=addDays(new Date(),-60);
  const {data,error}=await db.from('abba_daily_activity').select('activity_date,last_seen_at').eq('user_id',user.id).gte('activity_date',localDateString(since)).order('activity_date',{ascending:false});
  if(error){console.error('ABBA weekly activity',error);return}
  render(data||[]);
}

function wireStudySignals(){
  ['continueBtn','completeBtn','saveNoteBtn','nextBtn'].forEach(id=>q(id)?.addEventListener('click',()=>refresh(),{passive:true}));
  q('muxPlayer')?.addEventListener('play',()=>refresh(),{passive:true});
}

setTimeout(()=>{ensureCard();wireStudySignals();refresh()},900);
setTimeout(refresh,2200);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refresh()});document.getElementById('languageSelect')?.addEventListener('change',()=>setTimeout(refresh,60));
})();

if(!document.querySelector('script[data-abba-resources]')){
  const s=document.createElement('script');
  s.src='academy-resources.js?v=20260910j';
  s.dataset.abbaResources='1';
  document.body.appendChild(s);
}

if(!document.querySelector('script[data-abba-ai-coach]')){
  const s=document.createElement('script');
  s.src='academy-coach.js?v=20260916a';
  s.dataset.abbaAiCoach='1';
  document.body.appendChild(s);
}
