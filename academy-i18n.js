(()=>{
const q=id=>document.getElementById(id);
const T={back:'← Voltar',signout:'Sair',my:'Meu aprendizado',continue:'Continuar aprendendo',up:'A seguir',path:'Caminho do curso',modules:'Módulos',lessons:'Aulas',enrollTitle:'Inscrição necessária',enrollCopy:'Sua conta está pronta, mas este curso ainda não foi ativado para você.',enrollBtn:'Ver opções de inscrição',backCourse:'← Voltar ao curso',complete:'Marcar como concluída',completed:'Concluída ✓',next:'Próxima aula →',transcript:'Transcrição',notes:'Notas',summary:'Resumo',attachments:'Materiais',portal:'Portal do Aluno',authCopy:'Entre para continuar seu programa anual e manter seu progresso sincronizado.',password:'Senha',show:'Mostrar',signin:'Entrar',create:'Criar conta',forgot:'Esqueceu a senha?',settings:'Configurações',account:'CONTA',studentAccount:'Conta do aluno',changePassword:'Alterar senha',language:'IDIOMA',preferred:'Idioma',langHelp:'ABBA Academy está configurada em Português.',access:'ACESSO AO CURSO',active:'Acesso ativo',saveNote:'Salvar nota',notePh:'Escreva suas notas desta aula...',key:'Pontos principais'};
function txt(id,v){const e=q(id);if(e)e.textContent=v}
function lockPortugueseSelector(){const sel=q('languageSelect');if(!sel)return;[...sel.options].forEach(o=>{if(o.value!=='pt')o.remove()});sel.value='pt';sel.disabled=true;}
function apply(){
 document.documentElement.lang='pt';
 localStorage.setItem('abba_lang','pt');
 localStorage.setItem('abba_caption_lang','pt');
 txt('backHome',T.back);txt('signOutBtn',T.signout);txt('myLearningLabel',T.my);txt('continueLabel',T.continue);txt('upNextLabel',T.up);txt('coursePathLabel',T.path);txt('modulesTitle',T.modules);txt('lessonsTitle',T.lessons);txt('enrollmentTitle',T.enrollTitle);txt('enrollmentCopy',T.enrollCopy);txt('enrollmentBtn',T.enrollBtn);txt('backDashboardBtn',T.backCourse);txt('authTitle',T.portal);txt('authCopy',T.authCopy);txt('passwordLabel',T.password);txt('submitBtn',T.signin);txt('signUpBtn',T.create);txt('forgotBtn',T.forgot);txt('settingsTitle',T.settings);txt('accountLabel',T.account);txt('accountEmailTitle',T.studentAccount);txt('changePasswordLabel',T.changePassword);txt('languageLabel',T.language);txt('preferredLanguageLabel',T.preferred);txt('languageHelp',T.langHelp);txt('accessLabel',T.access);txt('courseAccessStatus',T.active);txt('settingsSignOutBtn',T.signout);txt('saveNoteBtn',T.saveNote);
 lockPortugueseSelector();
 const note=q('lessonNote');if(note)note.placeholder=T.notePh;
 document.querySelectorAll('.tab').forEach(b=>{const n=b.dataset.tab;if(n==='transcript')b.textContent=T.transcript;if(n==='notes')b.textContent=T.notes;if(n==='summary')b.textContent=T.summary;if(n==='attachments')b.textContent=T.attachments});
 document.querySelectorAll('#summaryContent h4').forEach(e=>e.textContent=T.key);
}
async function persist(){
 const {data:{session}}=await db.auth.getSession();
 if(!session)return;
 q('settingsBtn')?.classList.remove('hidden');
 if(q('settingsEmail'))q('settingsEmail').textContent=session.user.email||'';
 await db.from('abba_student_settings').upsert({user_id:session.user.id,preferred_language:'pt',preferred_caption_language:'pt',updated_at:new Date().toISOString()},{onConflict:'user_id'});
}
function openSettings(){q('settingsPanel')?.classList.remove('hidden');apply()}
function closeSettings(){q('settingsPanel')?.classList.add('hidden')}
q('settingsBtn')?.addEventListener('click',openSettings);q('closeSettingsBtn')?.addEventListener('click',closeSettings);q('settingsPanel')?.addEventListener('click',e=>{if(e.target===q('settingsPanel'))closeSettings()});
q('languageSelect')?.addEventListener('change',e=>{e.target.value='pt';apply()});
q('resetPasswordBtn')?.addEventListener('click',async()=>{const {data:{session}}=await db.auth.getSession();if(!session?.user?.email)return;const {error}=await db.auth.resetPasswordForEmail(session.user.email,{redirectTo:'https://alineramiro.com/academy-reset.html'});txt('settingsStatus',error?error.message:'Enviamos um link para alterar sua senha.')});
q('settingsSignOutBtn')?.addEventListener('click',async()=>{await db.auth.signOut();location.reload()});
new MutationObserver(()=>{clearTimeout(window.__abbaPt);window.__abbaPt=setTimeout(apply,40)}).observe(document.body,{subtree:true,childList:true,characterData:true});
apply();persist();
})();