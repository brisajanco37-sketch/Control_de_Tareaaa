import { SUPABASE_URL, SUPABASE_ANON_KEY, USE_LOCAL_DEMO } from "./config.js";

const STORAGE_KEY = "control_tarea_v2";
const ACCOUNTS_KEY = "ct_accounts";
const SESSION_KEY = "ct_session";
const FILE_BUCKET = "archivos-tareas";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const LOCAL_MAX_FILE_SIZE = 1 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([
  "pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx",
  "txt", "jpg", "jpeg", "png", "webp", "zip"
]);

const initialData = {
  tasks: [
    {id:1,title:"Trabajo práctico: introducción a la programación",type:"Tarea",subject:"Programación",year:"5° año",division:"1° división",due:"2026-11-18T23:59",description:"Resolver las consignas vistas en clase y entregar el archivo con el código fuente.",created:new Date().toISOString()},
    {id:2,title:"Evaluación de funciones y gráficos",type:"Examen",subject:"Matemática",year:"5° año",division:"1° división",due:"2026-11-20T23:59",description:"Evaluación de los contenidos trabajados durante la unidad.",created:new Date().toISOString()},
    {id:3,title:"Lectura y análisis de texto",type:"Tarea",subject:"Lengua y Literatura",year:"5° año",division:"1° división",due:"2026-11-14T23:59",description:"Leer el material de estudio y responder las preguntas de comprensión.",created:new Date().toISOString()}
  ], deliveries: [], students: [], notifications: [], grades: [], attendance: []
};

let supabase = null;
let activeProfile = null;

async function client(){
  if(USE_LOCAL_DEMO) return null;
  if(!supabase){
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:true } });
  }
  return supabase;
}

export const isSupabaseMode = () => !USE_LOCAL_DEMO;
export function getConfiguredSession(){
  if(USE_LOCAL_DEMO){try{return JSON.parse(localStorage.getItem(SESSION_KEY)||"null")}catch{return null}}
  return activeProfile;
}
function readStore(){try{const saved=localStorage.getItem(STORAGE_KEY);return saved?{...structuredClone(initialData),...JSON.parse(saved)}:structuredClone(initialData)}catch{return structuredClone(initialData)}}
function writeStore(data){localStorage.setItem(STORAGE_KEY,JSON.stringify(data));return data}
function dniEmail(dni){return `${String(dni).replace(/\D/g,"")}@controldetarea.com`;}
function profileFrom(p){return p?{id:p.id,dni:p.dni,email:p.email,name:p.full_name,role:p.role,year:p.year,division:p.division}:null;}

function validateAttachment(file){
  if(!file) return;
  const extension=String(file.name||"").split(".").pop().toLowerCase();
  const limit=USE_LOCAL_DEMO?LOCAL_MAX_FILE_SIZE:MAX_FILE_SIZE;
  if(!ALLOWED_EXTENSIONS.has(extension)){
    throw new Error("Formato no permitido. Usá PDF, Word, PowerPoint, Excel, TXT, JPG, PNG, WEBP o ZIP.");
  }
  if(file.size>limit){
    throw new Error(USE_LOCAL_DEMO
      ? "En modo demostración el archivo puede pesar como máximo 1 MB. Para archivos más grandes, conectá Supabase."
      : "El archivo supera el límite de 10 MB.");
  }
}
function safeFileName(name){
  return String(name||"archivo").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9._-]/g,"_").slice(-90)||"archivo";
}
function fileAsDataUrl(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result));
    reader.onerror=()=>reject(new Error("No se pudo leer el archivo seleccionado."));
    reader.readAsDataURL(file);
  });
}
async function storeAttachment(file,folder){
  if(!file||!file.name) return null;
  validateAttachment(file);
  if(USE_LOCAL_DEMO){
    return {
      file_path:await fileAsDataUrl(file),
      file_name:file.name,
      file_type:file.type||"application/octet-stream",
      file_size:file.size
    };
  }
  const sb=await client();
  const {data:{user},error:userError}=await sb.auth.getUser();
  if(userError) throw userError;
  if(!user) throw new Error("Tu sesión venció. Volvé a ingresar.");
  const path=`${user.id}/${folder}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
  const {error}=await sb.storage.from(FILE_BUCKET).upload(path,file,{
    cacheControl:"3600",
    upsert:false,
    contentType:file.type||"application/octet-stream"
  });
  if(error) throw error;
  return {file_path:path,file_name:file.name,file_type:file.type||"application/octet-stream",file_size:file.size};
}
async function removeStoredAttachment(path){
  if(!path||USE_LOCAL_DEMO||String(path).startsWith("data:")) return;
  try{const sb=await client();await sb.storage.from(FILE_BUCKET).remove([path]);}catch(error){console.warn("No se pudo limpiar el archivo temporal:",error);}
}
function attachmentFields(meta){
  return meta?{file_path:meta.file_path,file_name:meta.file_name,file_type:meta.file_type,file_size:meta.file_size}:{};
}

export async function getFileUrl(path){
  if(!path) throw new Error("Esta entrega no tiene un archivo adjunto.");
  if(String(path).startsWith("data:")) return path;
  const sb=await client();
  const {data,error}=await sb.storage.from(FILE_BUCKET).createSignedUrl(path,3600,{download:true});
  if(error) throw error;
  return data.signedUrl;
}

export async function restoreSession(){
  if(USE_LOCAL_DEMO) return getConfiguredSession();
  const sb=await client();const {data:{session},error}=await sb.auth.getSession();
  if(error) throw error;
  if(!session){activeProfile=null;return null;}
  const {data,error:profileError}=await sb.from("profiles").select("id,dni,email,full_name,role,year,division").eq("id",session.user.id).single();
  if(profileError) throw profileError;
  activeProfile=profileFrom(data);return activeProfile;
}

export async function registerAccount({email,dni,name,password,role="student",year,division,code}){
  email=String(email||"").trim().toLowerCase();
  dni=String(dni||"").replace(/\D/g,"");
  name=String(name||"").trim();
  year=String(year||"");
  division=String(division||"");
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Ingresá un correo electrónico válido.");
  if(!name) throw new Error("Ingresá tu nombre y apellido.");
  if(String(password||"").length<6) throw new Error("La contraseña debe tener al menos 6 caracteres.");
  if(!["student","teacher"].includes(role)) throw new Error("Tipo de cuenta inválido.");
  if(!["1° año","2° año","3° año","4° año","5° año","6° año"].includes(year)) throw new Error("Seleccioná un año válido.");
  if(!["1° división","2° división"].includes(division)) throw new Error("Seleccioná una división válida.");
  if(role==="student"&&!/^\d{7,8}$/.test(dni)) throw new Error("El DNI del alumno debe tener 7 u 8 números.");
  if(role==="teacher"&&!String(code||"").trim()) throw new Error("Ingresá el código de autorización docente.");

  if(USE_LOCAL_DEMO){
    const accounts=JSON.parse(localStorage.getItem(ACCOUNTS_KEY)||"[]");
    if(accounts.some(a=>a.email===email||(role==="student"&&a.dni===dni))) throw new Error("Ya existe una cuenta con ese correo o DNI.");
    if(role==="teacher"&&code!=="CT-Prof-7K9M-26!") throw new Error("Código de autorización incorrecto.");
    const account={dni:role==="student"?dni:null,email,password,name,role,year,division};
    accounts.push(account);localStorage.setItem(ACCOUNTS_KEY,JSON.stringify(accounts));
    const session={dni:account.dni,email,name,role,year,division};localStorage.setItem(SESSION_KEY,JSON.stringify(session));return session;
  }

  const sb=await client();
  const {data,error}=await sb.auth.signUp({email,password,options:{data:{dni:role==="student"?dni:null,full_name:name,year,division}}});
  if(error) throw error;
  if(!data.session||!data.user) throw new Error("La cuenta se creó, pero falta iniciar sesión. Confirmá el correo si Supabase lo solicita y después ingresá con tu email y contraseña.");
  if(role==="teacher"){
    const {error:activationError}=await sb.rpc("activate_teacher",{p_code:String(code).trim(),p_year:year,p_division:division});
    if(activationError) throw activationError;
  }
  const {data:profile,error:profileError}=await sb.from("profiles").select("id,dni,email,full_name,role,year,division").eq("id",data.user.id).single();
  if(profileError) throw profileError;
  activeProfile=profileFrom(profile);return activeProfile;
}

export async function loginAccount({email,dni,password}){
  const loginValue=String(email||dni||"").trim();
  if(!loginValue) throw new Error("Ingresá tu correo electrónico.");
  if(USE_LOCAL_DEMO){
    const accounts=JSON.parse(localStorage.getItem(ACCOUNTS_KEY)||"[]");
    const account=accounts.find(a=>(String(a.email||"").toLowerCase()===loginValue.toLowerCase()||(String(a.dni||"")===loginValue&&/^\d{7,8}$/.test(loginValue)))&&a.password===password);
    if(!account) throw new Error("Correo o contraseña incorrectos.");
    const session={dni:account.dni,email:account.email,name:account.name,role:account.role,year:account.year,division:account.division};
    localStorage.setItem(SESSION_KEY,JSON.stringify(session));return session;
  }
  const sb=await client();let authData=null;
  if(/^\d{7,8}$/.test(loginValue)){
    const legacy=await sb.auth.signInWithPassword({email:dniEmail(loginValue),password});
    if(!legacy.error) authData=legacy.data;
  }else{
    const result=await sb.auth.signInWithPassword({email:loginValue.toLowerCase(),password});
    if(!result.error) authData=result.data;
  }
  if(!authData) throw new Error("Correo o contraseña incorrectos.");
  const {data:profile,error:profileError}=await sb.from("profiles").select("id,dni,email,full_name,role,year,division").eq("id",authData.user.id).single();
  if(profileError) throw profileError;
  activeProfile=profileFrom(profile);return activeProfile;
}
export async function logoutAccount(){
  if(USE_LOCAL_DEMO){localStorage.removeItem(SESSION_KEY);return;}
  const sb=await client();const {error}=await sb.auth.signOut();if(error)throw error;activeProfile=null;
}

export async function getData(){
  if(USE_LOCAL_DEMO){const d=readStore();d.students=JSON.parse(localStorage.getItem(ACCOUNTS_KEY)||"[]").filter(a=>a.role==="student").map((a,i)=>({id:i+1,dni:a.dni,name:a.name}));return d;}
  const sb=await client();
  const teacherMode=activeProfile?.role==="teacher";
  const [tasksQ,deliveriesQ,studentsQ,attendanceQ]=await Promise.all([
    sb.from("tasks").select("*").order("created_at",{ascending:false}),
    sb.from("deliveries").select("*,profiles!deliveries_student_id_fkey(full_name,dni),tasks(title,subject)"),
    teacherMode?sb.from("profiles").select("id,dni,full_name,year,division").eq("role","student"):Promise.resolve({data:[],error:null}),
    teacherMode?sb.from("attendance").select("*").order("created_at",{ascending:false}):Promise.resolve({data:[],error:null})
  ]);
  for(const q of [tasksQ,deliveriesQ,studentsQ,attendanceQ]) if(q.error) throw q.error;
  return {
    tasks:(tasksQ.data||[]).map(t=>({id:t.id,title:t.title,type:t.type,subject:t.subject,year:t.year,division:t.division,due:(()=>{const d=new Date(t.due_at);d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16)})(),description:t.description,created:t.created_at,filePath:t.file_path||null,fileName:t.file_name||null,fileType:t.file_type||null,fileSize:t.file_size||null})),
    deliveries:(deliveriesQ.data||[]).map(d=>({id:d.id,taskId:d.task_id,student:d.profiles?.full_name||"Alumno",studentDni:d.profiles?.dni,sentAt:d.submitted_at,grade:d.grade,feedback:d.feedback,filePath:d.file_path||null,fileName:d.file_name||null,fileType:d.file_type||null,fileSize:d.file_size||null})),
    students:(studentsQ.data||[]).map(s=>({id:s.id,dni:s.dni,name:s.full_name,year:s.year,division:s.division})),
    notifications:[],grades:[],attendance:(attendanceQ.data||[]).map(a=>({id:a.id,studentDni:a.student_dni,status:a.status,date:a.attendance_date}))
  };
}
export async function saveData(data){if(USE_LOCAL_DEMO)return writeStore(data);return data;}
export async function getTask(id){return(await getData()).tasks.find(t=>String(t.id)===String(id))||null;}

export async function createTask(task){
  const {attachment,...fields}=task;
  const meta=await storeAttachment(attachment,"tasks");
  if(USE_LOCAL_DEMO){
    const d=readStore();
    const item={...fields,id:Date.now(),created:new Date().toISOString(),...(meta?{filePath:meta.file_path,fileName:meta.file_name,fileType:meta.file_type,fileSize:meta.file_size}:{})};
    d.tasks.unshift(item);writeStore(d);return item;
  }
  const sb=await client();
  const {data:{user},error:userError}=await sb.auth.getUser();
  if(userError){await removeStoredAttachment(meta?.file_path);throw userError;}
  const payload={title:fields.title,type:fields.type,subject:fields.subject,year:fields.year,division:fields.division,due_at:new Date(fields.due).toISOString(),description:fields.description,teacher_id:user.id,...attachmentFields(meta)};
  const {data,error}=await sb.from("tasks").insert(payload).select().single();
  if(error){await removeStoredAttachment(meta?.file_path);throw error;}
  return {id:data.id,...fields,created:data.created_at,filePath:data.file_path||null,fileName:data.file_name||null,fileType:data.file_type||null,fileSize:data.file_size||null};
}
export async function updateTask(id,changes){
  if(USE_LOCAL_DEMO){const d=readStore(),i=d.tasks.findIndex(t=>String(t.id)===String(id));if(i<0)throw new Error("No se encontró la actividad.");d.tasks[i]={...d.tasks[i],...changes};writeStore(d);return d.tasks[i];}
  const sb=await client();const payload={title:changes.title,type:changes.type,subject:changes.subject,year:changes.year,division:changes.division,due_at:new Date(changes.due).toISOString(),description:changes.description};const {data,error}=await sb.from("tasks").update(payload).eq("id",id).select().single();if(error)throw error;return data;
}
export async function deleteTask(id){
  if(USE_LOCAL_DEMO){const d=readStore();d.tasks=d.tasks.filter(t=>String(t.id)!==String(id));writeStore(d);return true;}
  const sb=await client();
  const {data:task,error:readError}=await sb.from("tasks").select("file_path").eq("id",id).maybeSingle();
  if(readError) throw readError;
  if(task?.file_path) await removeStoredAttachment(task.file_path);
  const {error}=await sb.from("tasks").delete().eq("id",id);if(error)throw error;return true;
}
export async function createDelivery(delivery){
  const meta=await storeAttachment(delivery.attachment,"deliveries");
  if(USE_LOCAL_DEMO){
    const d=readStore();
    const item={...delivery,id:Date.now(),sentAt:new Date().toISOString(),...(meta?{filePath:meta.file_path,fileName:meta.file_name,fileType:meta.file_type,fileSize:meta.file_size}:{})};
    delete item.attachment;d.deliveries.push(item);writeStore(d);return item;
  }
  const sb=await client();
  const {data:{user},error:userError}=await sb.auth.getUser();
  if(userError){await removeStoredAttachment(meta?.file_path);throw userError;}
  const payload={task_id:delivery.taskId,student_id:user.id,...attachmentFields(meta)};
  const {data,error}=await sb.from("deliveries").insert(payload).select().single();
  if(error){await removeStoredAttachment(meta?.file_path);throw error;}
  return {id:data.id,taskId:data.task_id,student:delivery.student,studentDni:delivery.studentDni,sentAt:data.submitted_at,filePath:data.file_path||null,fileName:data.file_name||null,fileType:data.file_type||null,fileSize:data.file_size||null};
}
export async function gradeDelivery(id,grade,feedback=""){
  if(USE_LOCAL_DEMO){const d=readStore(),item=d.deliveries.find(x=>String(x.id)===String(id));if(!item)throw new Error("No se encontró la entrega.");item.grade=grade;item.feedback=feedback;item.gradedAt=new Date().toISOString();writeStore(d);return item;}
  const sb=await client();const {data,error}=await sb.from("deliveries").update({grade,feedback}).eq("id",id).select().single();if(error)throw error;return data;
}
export async function saveAttendance(studentDni,status){
  if(USE_LOCAL_DEMO){const d=readStore();d.attendance.push({studentDni,status,date:new Date().toISOString()});writeStore(d);return;}
  const sb=await client();const {data:student,error:lookupError}=await sb.from("profiles").select("id").eq("dni",studentDni).single();if(lookupError)throw lookupError;const {error}=await sb.from("attendance").insert({student_id:student.id,student_dni:studentDni,status});if(error)throw error;
}
export async function getApiStatus(){return USE_LOCAL_DEMO?{mode:"local",message:"Modo demostración: configurá Supabase para sincronizar datos."}:{mode:"supabase",message:"Conectado a Supabase."};}
