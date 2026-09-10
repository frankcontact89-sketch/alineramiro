(()=>{
async function recoverPortal(){
  try{
    const {data:{session}}=await db.auth.getSession();
    if(!session?.user)return;
    const learning=document.getElementById('learningDashboard');
    const courseArea=document.getElementById('courseArea');
    const alreadyVisible=(learning&&!learning.classList.contains('hidden'))||(courseArea&&!courseArea.classList.contains('hidden'));
    if(alreadyVisible)return;

    currentUser=session.user;
    show('authView',false);show('portalView',true);show('signOutBtn',true);show('settingsBtn',true);
    if($('settingsEmail'))$('settingsEmail').textContent=currentUser.email||'';

    const {data:courseData,error:courseErr}=await db.from('abba_courses').select('*').eq('slug','annual-program').maybeSingle();
    if(courseErr||!courseData)throw courseErr||new Error('Course not found');
    currentCourse=courseData;

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
    renderLessons();renderProgress();renderDashboard();applyLanguage(currentLang);
  }catch(err){
    console.error('ABBA Academy recovery',err);
    const hero=document.getElementById('courseDescription');
    if(hero&&!hero.textContent)hero.textContent='Please refresh the page to continue.';
  }
}
setTimeout(recoverPortal,1200);
setTimeout(recoverPortal,3500);
})();