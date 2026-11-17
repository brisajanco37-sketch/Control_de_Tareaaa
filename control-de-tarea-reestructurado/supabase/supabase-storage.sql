-- Control de Tarea: almacenamiento privado para materiales y entregas.
-- Ejecutá este script en Supabase > SQL Editor, con permisos de administrador.

-- 1) Columnas para vincular los archivos con las actividades y entregas.
alter table public.tasks
  add column if not exists teacher_id uuid references auth.users(id) on delete set null,
  add column if not exists file_path text,
  add column if not exists file_name text,
  add column if not exists file_type text,
  add column if not exists file_size bigint;

alter table public.deliveries
  add column if not exists file_path text,
  add column if not exists file_name text,
  add column if not exists file_type text,
  add column if not exists file_size bigint;

-- 2) Bucket privado. Los archivos no quedan expuestos mediante URL pública.
insert into storage.buckets (id, name, public, file_size_limit)
values ('archivos-tareas', 'archivos-tareas', false, 10485760)
on conflict (id) do update
set public = false,
    file_size_limit = 10485760;

-- 3) Borrar solamente las políticas de este tutorial, si ya se habían creado.
drop policy if exists "ct_upload_own_class_files" on storage.objects;
drop policy if exists "ct_read_authorized_class_files" on storage.objects;
drop policy if exists "ct_delete_own_class_files" on storage.objects;

-- Los profesores suben archivos de actividades y los alumnos sus entregas.
-- La primera carpeta del objeto siempre es el UID del usuario que lo subió.
create policy "ct_upload_own_class_files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'archivos-tareas'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (
    (
      (storage.foldername(name))[2] = 'tasks'
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role = 'teacher'
      )
    )
    or
    (
      (storage.foldername(name))[2] = 'deliveries'
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role = 'student'
      )
    )
  )
);

-- El docente dueño puede leer los materiales de sus actividades.
-- El alumno puede leer los materiales de su mismo año y división.
-- Las entregas las puede leer el alumno que las envió y el docente dueño de la tarea.
create policy "ct_read_authorized_class_files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'archivos-tareas'
  and (
    exists (
      select 1 from public.tasks t
      where t.file_path = storage.objects.name
        and t.teacher_id = auth.uid()
    )
    or exists (
      select 1
      from public.tasks t
      join public.profiles p on p.id = auth.uid()
      where t.file_path = storage.objects.name
        and p.role = 'student'
        and p.year = t.year
        and p.division = t.division
    )
    or exists (
      select 1
      from public.deliveries d
      join public.tasks t on t.id = d.task_id
      where d.file_path = storage.objects.name
        and (d.student_id = auth.uid() or t.teacher_id = auth.uid())
    )
  )
);

-- Permite limpiar archivos propios si una publicación o entrega falla a mitad del proceso.
create policy "ct_delete_own_class_files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'archivos-tareas'
  and (storage.foldername(name))[1] = auth.uid()::text
);
