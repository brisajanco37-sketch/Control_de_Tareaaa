import {getData,saveData,createTask,getTask,updateTask,deleteTask,createDelivery,gradeDelivery,registerAccount,loginAccount,logoutAccount,restoreSession,isSupabaseMode,saveAttendance,getFileUrl} from "./api.js";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const FILE_ACCEPT=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.webp,.zip";
let data, role, userName, dni, currentView="dashboard", authMode="login";
const roleNames={student:"Alumno",teacher:"Profesor"};
const isTeacher=()=>role==="teacher";
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=s=>s?new Date(s).toLocaleString("es-AR",{dateStyle:"short",timeStyle:"short"}):"Sin fecha";
const expired=t=>t.due&&new Date(t.due)<new Date();
function toast(m){const el=$("#toast");if(!el)return;el.textContent=m;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2600);}
async function downloadAttachment(path,name){
  try{
    const url=await getFileUrl(path);
    const link=document.createElement("a");
    link.href=url;
    link.download=name||"archivo";
    if(!url.startsWith("data:")){link.target="_blank";link.rel="noopener noreferrer";}
    document.body.appendChild(link);link.click();link.remove();
  }catch(error){console.error(error);toast(error.message||"No se pudo abrir el archivo.");}
}
function chooseDeliveryFile(task){
  const picker=document.createElement("input");
  picker.type="file";
  picker.accept=FILE_ACCEPT;
  picker.addEventListener("change",async()=>{
    const file=picker.files?.[0];
    if(!file)return;
    try{
      await createDelivery({taskId:task.id,student:userName,studentDni:dni,attachment:file});
      data=await getData();render();toast("¡Archivo enviado y tarea entregada!");
    }catch(error){console.error(error);toast(error.message||"No se pudo enviar el archivo.");}
  });
  picker.click();
}
async function currentAccount(){return await restoreSession()}
function setAccount(account){
  role=account?.role;userName=account?.name||"Usuario";dni=account?.dni||"";
  if(!$("#user-name"))return;
  $("#user-name").textContent=userName;$("#user-role").textContent=roleNames[role]||"Invitado";
  $("#welcome-name").textContent=userName.split(" ")[0];$("#avatar").textContent=userName.split(" ").map(x=>x[0]).slice(0,2).join("").toUpperCase();
  $$(".teacher-only").forEach(el=>el.classList.toggle("hidden",!isTeacher()));
  $$(".student-only").forEach(el=>el.classList.toggle("hidden",role!=="student"));
  $(".online-label").textContent=isSupabaseMode()?"Conectado a Supabase":"Modo de demostración";
  $("#welcome-copy").textContent=isTeacher()?"Administrá actividades, revisá entregas y calificá los trabajos de tus alumnos.":"Consultá tus actividades, entregá tus trabajos y revisá tus calificaciones.";
}
function updateAuthFields(){
  const registering=authMode==="register";
  const selectedRole=$("#auth-role").value;
  const show=(id,visible)=>{const el=$(id);if(el)el.classList.toggle("hidden",!visible);};
  show("#name-field",registering);show("#dni-field",registering&&selectedRole==="student");show("#year-field",registering);show("#division-field",registering);show("#code-field",registering&&selectedRole==="teacher");show("#role-field",true);
  $("#auth-name").required=registering;$("#auth-dni").required=registering&&selectedRole==="student";$("#auth-year").required=registering;$("#auth-division").required=registering;$("#auth-code").required=registering&&selectedRole==="teacher";
  $("#auth-email").autocomplete=registering?"email":"username";$("#auth-password").autocomplete=registering?"new-password":"current-password";
}
function switchAuth(mode){
  authMode=mode;$$(".auth-tab").forEach(b=>b.classList.toggle("active",b.dataset.authMode===mode));
  $("#auth-title").textContent=mode==="login"?"Ingresar a Control de Tarea":"Crear una cuenta";
  $("#auth-description").textContent=mode==="login"?"Ingresá con tu correo electrónico y contraseña.":"Completá tus datos para crear una cuenta de alumno o profesor.";
  $("#auth-submit").textContent=mode==="login"?"Ingresar al sistema →":"Crear cuenta →";updateAuthFields();
}
async function authSubmit(e){
  e.preventDefault();
  const email=$("#auth-email").value.trim().toLowerCase(),password=$("#auth-password").value,selectedRole=$("#auth-role").value;
  if(!email){toast("Ingresá tu correo electrónico.");return;}if(password.length<6){toast("La contraseña debe tener al menos 6 caracteres.");return;}
  try{
    let account;
    if(authMode==="register"){
      const name=$("#auth-name").value.trim(),id=$("#auth-dni").value.replace(/\D/g,""),year=$("#auth-year").value,division=$("#auth-division").value,code=$("#auth-code").value;
      if(!name){toast("Ingresá tu nombre y apellido.");return;}if(selectedRole==="student"&&!/^\d{7,8}$/.test(id)){toast("El DNI debe tener 7 u 8 números.");return;}if(!year||!division){toast("Seleccioná el año y la división.");return;}if(selectedRole==="teacher"&&!code.trim()){toast("Ingresá el código de autorización docente.");return;}
      account=await registerAccount({email,dni:id,name,password,role:selectedRole,year,division,code});
      toast(selectedRole==="teacher"?"Cuenta de profesor creada correctamente.":"Cuenta de alumno creada correctamente.");
    }else{
      account=await loginAccount({email,password});
      if(account.role!==selectedRole){await logoutAccount();throw new Error(selectedRole==="teacher"?"Esta cuenta no está registrada como profesor. Elegí Alumno o verificá tu cuenta.":"Esta cuenta no está registrada como alumno. Elegí Profesor o verificá tu cuenta.");}
    }
    setAccount(account);$("#auth-modal").classList.add("hidden");data=await getData();render();
  }catch(error){console.error(error);toast(error.message||"No se pudo completar la autenticación.");}
}
function applyTheme(theme){document.documentElement.dataset.theme=theme;localStorage.setItem("ct_theme",theme);const b=$("#theme-toggle");if(b)b.innerHTML=theme==="dark"?'☀ <span>Modo claro</span>':'☾ <span>Modo oscuro</span>';}
function navigate(view){
  if((view==="students"||view==="subjects"||view==="attendance")&&!isTeacher()){toast("Esta sección es exclusiva del profesor.");return;}
  currentView=view;$$('.view').forEach(v=>v.classList.add("hidden"));$("#view-"+view)?.classList.remove("hidden");
  $$(".nav-link[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
  const titles={dashboard:"Panel principal",tasks:"Tareas y exámenes",deliveries:"Entregas",students:"Alumnos",subjects:"Materias y cursos",attendance:"Asistencia",calendar:"Calendario",grades:"Calificaciones",notifications:"Notificaciones"};
  if($("#page-title"))$("#page-title").textContent=titles[view]||"Control de Tarea";renderView(view);
}
function taskStatus(t){const mine=data.deliveries.find(d=>String(d.taskId)===String(t.id)&&d.studentDni===dni);return mine?"Entregada":expired(t)?"Vencida":"Pendiente";}
function taskCard(t){
  const status=taskStatus(t);
  const actions=isTeacher()?`<a class="small-action" href="editar.html?id=${encodeURIComponent(t.id)}">Editar</a><button class="small-action danger" data-delete="${esc(t.id)}">Eliminar</button>`:(status==="Pendiente"?`<button class="small-action gold-action" data-deliver="${esc(t.id)}">Entregar tarea</button>`:"");
  const attachment=t.filePath?`<button class="small-action" type="button" data-task-file="${esc(t.id)}">📎 Descargar ${esc(t.fileName||"material adjunto")}</button>`:"";
  return `<article class="task-card"><div class="task-card-top"><span class="type-pill">${esc(t.type)}</span><span class="status-pill ${status.toLowerCase()}">${status}</span></div><h3>${esc(t.title)}</h3><p>${esc(t.description)}</p><div class="task-meta"><span>▦ ${esc(t.subject)}</span><span>◷ ${fmt(t.due)}</span></div><div class="task-meta"><span>${esc(t.year)} · ${esc(t.division)}</span></div><div class="task-actions">${attachment}${actions}</div></article>`;
}
function renderDashboard(){
  const tasks=data.tasks||[],mine=data.deliveries.filter(d=>d.studentDni===dni);
  $("#stat-total").textContent=tasks.length;$("#stat-pending").textContent=isTeacher()?tasks.filter(t=>!expired(t)).length:tasks.filter(t=>!mine.some(d=>String(d.taskId)===String(t.id))&&!expired(t)).length;
  $("#stat-done").textContent=isTeacher()?data.deliveries.length:mine.length;$("#stat-subjects").textContent=new Set(tasks.map(t=>t.subject)).size;
  $("#stat-label-one").textContent=isTeacher()?"Actividades publicadas":"Actividades disponibles";$("#stat-label-two").textContent=isTeacher()?"Dentro del plazo":"Pendientes";$("#stat-label-three").textContent=isTeacher()?"Entregas recibidas":"Mis entregas";$("#side-count").textContent=tasks.length;
  $("#recent-list").innerHTML=tasks.slice(0,4).map(t=>`<div class="activity-item"><div class="activity-symbol">▤</div><div class="activity-info"><strong>${esc(t.title)}</strong><small>${esc(t.subject)} · ${esc(t.year)} · Límite: ${fmt(t.due)}</small></div><span class="status-pill ${taskStatus(t).toLowerCase()}">${taskStatus(t)}</span></div>`).join("")||'<div class="empty-state">Todavía no hay actividades publicadas.</div>';
}
function renderTasks(){
  const q=$("#search-task")?.value||"",subject=$("#filter-subject")?.value||"",status=$("#filter-status")?.value||"",subjects=[...new Set(data.tasks.map(t=>t.subject))];
  if($("#filter-subject"))$("#filter-subject").innerHTML='<option value="">Todas las materias</option>'+subjects.map(s=>`<option ${s===subject?"selected":""}>${esc(s)}</option>`).join("");
  const list=data.tasks.filter(t=>(!q||(t.title+" "+t.subject).toLowerCase().includes(q.toLowerCase()))&&(!subject||t.subject===subject)&&(!status||(status==="done"?taskStatus(t)==="Entregada":status==="late"?taskStatus(t)==="Vencida":taskStatus(t)==="Pendiente")));
  $("#task-list").innerHTML=list.map(taskCard).join("")||'<div class="empty-state">No hay actividades que coincidan con la búsqueda.</div>';
}
function renderDeliveries(){
  const items=isTeacher()?data.deliveries:data.deliveries.filter(d=>d.studentDni===dni);
  $("#delivery-heading").textContent=isTeacher()?"Entregas recibidas":"Mis entregas";
  $("#delivery-list").innerHTML=items.length?`<table><thead><tr><th>Alumno</th><th>Actividad</th><th>Fecha</th><th>Archivo</th><th>Nota</th><th>Estado</th>${isTeacher()?"<th>Acción</th>":""}</tr></thead><tbody>${items.map(d=>`<tr><td>${esc(d.student)}</td><td>${esc(data.tasks.find(t=>String(t.id)===String(d.taskId))?.title||"Actividad")}</td><td>${fmt(d.sentAt)}</td><td>${d.filePath?`<button class="small-action" type="button" data-delivery-file="${esc(d.id)}">📎 Descargar</button>`:"Sin archivo"}</td><td>${d.grade==null?"Sin calificar":`<b class="grade">${esc(d.grade)}/10</b>`}${d.feedback?`<small class="feedback">${esc(d.feedback)}</small>`:""}</td><td><span class="status-pill entregada">${d.grade==null?"Entregada":"Calificada"}</span></td>${isTeacher()?`<td><button class="small-action gold-action" data-grade="${esc(d.id)}">Poner nota</button></td>`:""}</tr>`).join("")}</tbody></table>`:'<div class="empty-state">Todavía no hay entregas registradas.</div>';
}
function renderStudents(){$("#student-list").innerHTML=`<table><thead><tr><th>Alumno</th><th>DNI</th><th>Cuenta</th></tr></thead><tbody>${(data.students||[]).map(a=>`<tr><td>${esc(a.name)}</td><td>${esc(a.dni)}</td><td>Alumno</td></tr>`).join("")||'<tr><td colspan="3">Todavía no hay alumnos registrados.</td></tr>'}</tbody></table>`;}
function renderSubjects(){const subjects=[...new Set(data.tasks.map(t=>t.subject))];$("#subject-list").innerHTML=subjects.map(s=>`<article class="subject-card"><span>▦</span><h3>${esc(s)}</h3><p>${data.tasks.filter(t=>t.subject===s).length} actividades publicadas</p></article>`).join("")||'<div class="empty-state">Todavía no hay materias.</div>';}
function renderAttendance(){$("#attendance-list").innerHTML=`<table><thead><tr><th>Alumno</th><th>Asistencia</th></tr></thead><tbody>${(data.students||[]).map(a=>`<tr><td>${esc(a.name)}</td><td><select data-attendance="${esc(a.dni)}"><option>Presente</option><option>Ausente</option><option>Tarde</option></select></td></tr>`).join("")}</tbody></table>`;}
function renderCalendar(){$("#calendar-list").innerHTML=[...data.tasks].sort((a,b)=>new Date(a.due)-new Date(b.due)).map(t=>`<div class="activity-item"><div class="date-tile">${new Date(t.due).getDate()}<small>${new Date(t.due).toLocaleDateString("es-AR",{month:"short"})}</small></div><div class="activity-info"><strong>${esc(t.title)}</strong><small>${esc(t.subject)} · ${fmt(t.due)}</small></div><span class="status-pill ${taskStatus(t).toLowerCase()}">${taskStatus(t)}</span></div>`).join("")||'<div class="empty-state">No hay fechas cargadas.</div>';}
function renderGrades(){const rows=isTeacher()?data.deliveries:data.deliveries.filter(d=>d.studentDni===dni);$("#grades-list").innerHTML=rows.length?`<table><thead><tr><th>Actividad</th><th>${isTeacher()?"Alumno":"Materia"}</th><th>Nota</th><th>Devolución</th></tr></thead><tbody>${rows.map(d=>`<tr><td>${esc(data.tasks.find(t=>String(t.id)===String(d.taskId))?.title||"Actividad")}</td><td>${isTeacher()?esc(d.student):esc(data.tasks.find(t=>String(t.id)===String(d.taskId))?.subject||"")}</td><td>${d.grade==null?"Pendiente":`<b class="grade">${esc(d.grade)}/10</b>`}</td><td>${esc(d.feedback||"Sin devolución")}</td></tr>`).join("")}</tbody></table>`:'<div class="empty-state">Todavía no hay calificaciones.</div>';}
function renderNotifications(){$("#notifications-list").innerHTML=data.notifications.map(n=>`<div class="activity-item"><div class="activity-symbol">♢</div><div class="activity-info"><strong>${esc(n.title)}</strong><small>${esc(n.detail)} · ${fmt(n.date)}</small></div></div>`).join("")||'<div class="empty-state">No tenés notificaciones.</div>';$("#notification-count").textContent=data.notifications.length;}
function renderView(v){({dashboard:renderDashboard,tasks:renderTasks,deliveries:renderDeliveries,students:renderStudents,subjects:renderSubjects,attendance:renderAttendance,calendar:renderCalendar,grades:renderGrades,notifications:renderNotifications}[v]||(()=>{}))();}
function render(){renderDashboard();renderTasks();renderDeliveries();renderStudents();renderSubjects();renderGrades();renderNotifications();}

async function init(){
  applyTheme(localStorage.getItem("ct_theme")||"light");
  $("#theme-toggle")?.addEventListener("click",()=>applyTheme(document.documentElement.dataset.theme==="dark"?"light":"dark"));
  $$(".auth-tab").forEach(b=>b.addEventListener("click",()=>switchAuth(b.dataset.authMode)));
  $("#auth-form")?.addEventListener("submit",authSubmit);
  $("#auth-role")?.addEventListener("change",updateAuthFields);
  $("#profile-switch")?.addEventListener("click",async()=>{try{await logoutAccount();location.reload();}catch(e){toast(e.message);}});
  const session=await currentAccount();switchAuth("login");
  if(!session){data={tasks:[],deliveries:[],students:[],notifications:[],grades:[],attendance:[]};$("#auth-modal")?.classList.remove("hidden");}
  else{setAccount(session);$("#auth-modal")?.classList.add("hidden");data=await getData();}
  $$(".nav-link[data-view]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.view)));
  $$("[data-go]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.go)));
  $("#search-task")?.addEventListener("input",renderTasks);$("#filter-subject")?.addEventListener("change",renderTasks);$("#filter-status")?.addEventListener("change",renderTasks);

  $("#task-list")?.addEventListener("click",async e=>{
    const del=e.target.closest("[data-delete]"),deliver=e.target.closest("[data-deliver]"),file=e.target.closest("[data-task-file]");
    if(file){const task=data.tasks.find(t=>String(t.id)===String(file.dataset.taskFile));if(task)await downloadAttachment(task.filePath,task.fileName);return;}
    if(del){if(!isTeacher()){toast("Solo el profesor puede eliminar tareas.");return;}if(confirm("¿Eliminar esta tarea?")){try{await deleteTask(del.dataset.delete);data=await getData();render();toast("Tarea eliminada.");}catch(err){console.error(err);toast(err.message||"No se pudo eliminar la tarea.");}}return;}
    if(deliver){if(role!=="student"){toast("Solo el alumno puede entregar tareas.");return;}const task=data.tasks.find(t=>String(t.id)===String(deliver.dataset.deliver));if(!task||expired(task)){toast("El plazo terminó o la tarea no existe.");return;}if(data.deliveries.some(d=>String(d.taskId)===String(task.id)&&d.studentDni===dni)){toast("Ya entregaste esta tarea.");return;}chooseDeliveryFile(task);}
  });

  $("#delivery-list")?.addEventListener("click",async e=>{
    const file=e.target.closest("[data-delivery-file]");
    if(file){const delivery=data.deliveries.find(d=>String(d.id)===String(file.dataset.deliveryFile));if(delivery)await downloadAttachment(delivery.filePath,delivery.fileName);return;}
    const btn=e.target.closest("[data-grade]");if(!btn||!isTeacher())return;
    const delivery=data.deliveries.find(d=>String(d.id)===String(btn.dataset.grade));if(!delivery)return;
    const grade=prompt("Ingresá una nota de 1 a 10:");if(grade===null)return;const n=Number(grade);if(!Number.isFinite(n)||n<1||n>10){toast("La nota debe estar entre 1 y 10.");return;}
    const feedback=prompt("Devolución para el alumno (opcional):")||"";
    try{await gradeDelivery(delivery.id,n,feedback);data=await getData();render();toast("Calificación guardada.");}catch(err){console.error(err);toast(err.message||"No se pudo guardar la nota.");}
  });
  $("#attendance-list")?.addEventListener("change",async e=>{if(e.target.matches("[data-attendance]")){try{await saveAttendance(e.target.dataset.attendance,e.target.value);data=await getData();toast("Asistencia actualizada.");}catch(err){console.error(err);toast(err.message||"No se pudo guardar la asistencia.");}}});

  $("#create-form")?.addEventListener("submit",async e=>{
    e.preventDefault();if(!isTeacher()){toast("Solo el profesor puede crear tareas.");return;}
    const f=new FormData(e.currentTarget),values=Object.fromEntries(f.entries());
    try{await createTask(values);location.href="index.html";}catch(err){console.error(err);toast(err.message||"No se pudo publicar la tarea.");}
  });
  const createForm=$("#create-form");if(createForm&&!isTeacher()){toast("Ingresá con una cuenta de profesor para crear actividades.");setTimeout(()=>location.href="index.html",900);return;}
  const editForm=$("#edit-form");
  if(editForm){
    if(!isTeacher()){toast("Solo el profesor puede editar tareas.");setTimeout(()=>location.href="index.html",700);return;}
    const id=new URLSearchParams(location.search).get("id"),task=await getTask(id);if(!task){toast("No se encontró la tarea.");return;}
    for(const [key,value] of Object.entries(task)){const field=editForm.elements.namedItem(key);if(field&&typeof value==="string")field.value=value;}
    editForm.addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(editForm);try{await updateTask(id,Object.fromEntries(f.entries()));location.href="index.html";}catch(err){console.error(err);toast(err.message||"No se pudieron guardar los cambios.");}});
  }
  if($("#stat-total"))render();
}
init().catch(e=>{console.error(e);toast("No se pudo iniciar la aplicación.");});
