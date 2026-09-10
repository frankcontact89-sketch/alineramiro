(()=>{
const courseCopy={
 en:{title:'ABBA Academy — Annual Program',desc:'A 48-lesson annual formation program with recorded classes, student progress, and secure access.',lesson:'Lesson',minutes:'minutes',available:'available'},
 pt:{title:'ABBA Academy — Programa Anual',desc:'Um programa anual de formação com 48 aulas gravadas, acompanhamento de progresso e acesso seguro.',lesson:'Aula',minutes:'minutos',available:'disponíveis'},
 es:{title:'ABBA Academy — Programa Anual',desc:'Un programa anual de formación con 48 clases grabadas, seguimiento del progreso y acceso seguro.',lesson:'Clase',minutes:'minutos',available:'disponibles'}
};
function activeLang(){const l=document.documentElement.lang;return ['en','pt','es'].includes(l)?l:'en'}
function polish(){const l=activeLang(),t=courseCopy[l];const title=document.getElementById('courseTitle');const desc=document.getElementById('courseDescription');if(title&&title.closest('#dashboardView'))title.textContent=t.title;if(desc&&desc.closest('#dashboardView'))desc.textContent=t.desc;
 const ln=document.getElementById('lessonNumber');if(ln){const m=ln.textContent.match(/(\d+)/);if(m)ln.textContent=`${t.lesson} ${m[1]}`}
 const ld=document.getElementById('lessonDuration');if(ld){const m=ld.textContent.match(/(\d+)/);if(m)ld.textContent=`${m[1]} ${t.minutes}`}
 const tab=document.getElementById('attachmentsTab'),panel=document.getElementById('attachmentsPanel'),content=document.getElementById('attachmentsContent');if(tab&&content){const hasLinks=content.querySelector('a');const empty=!hasLinks&&(/No attachments|Nenhum material|Sin materiales/i.test(content.textContent)||!content.textContent.trim());tab.classList.toggle('hidden',empty);if(panel&&empty)panel.classList.add('hidden')}
}
new MutationObserver(()=>{clearTimeout(window.__abbaPolish);window.__abbaPolish=setTimeout(polish,60)}).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['lang','class']});
setTimeout(polish,250);
})();