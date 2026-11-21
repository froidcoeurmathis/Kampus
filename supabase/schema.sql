-- =====================================================================
--  KAMPUS — base de données Supabase
--  À coller en entier dans Supabase > SQL Editor > New query, puis "Run".
--  On peut le relancer sans risque : il ne casse rien de ce qui existe déjà.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Seules les adresses ULiège peuvent créer un compte
-- ---------------------------------------------------------------------
create or replace function public.kampus_check_uliege_email()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if lower(new.email) !~ '@(student\.)?uliege\.be$' then
    raise exception 'Seules les adresses @student.uliege.be ou @uliege.be peuvent s''inscrire sur Kampus.';
  end if;
  return new;
end $$;

drop trigger if exists kampus_check_email on auth.users;
create trigger kampus_check_email
  before insert on auth.users
  for each row execute function public.kampus_check_uliege_email();

-- ---------------------------------------------------------------------
-- 2. Profils (le nom affiché de chaque étudiant)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  full_name  text not null check (char_length(full_name) between 2 and 80),
  created_at timestamptz not null default now()
);

create or replace function public.kampus_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists kampus_on_new_user on auth.users;
create trigger kampus_on_new_user
  after insert on auth.users
  for each row execute function public.kampus_new_user();

-- ---------------------------------------------------------------------
-- 3. Documents (les fichiers eux-mêmes sont dans le stockage "documents")
-- ---------------------------------------------------------------------
create table if not exists public.files (
  id           uuid primary key default gen_random_uuid(),
  course_code  text not null,                        -- code officiel du cours : un seul espace par cours
  category     text not null check (category in ('cours', 'syntheses', 'exercices', 'examens')),
  name         text not null check (char_length(name) between 1 and 200),
  storage_path text not null unique,
  size_bytes   bigint not null default 0,
  mime_type    text,
  uploader_id  uuid not null default auth.uid() references public.profiles on delete cascade,
  created_at   timestamptz not null default now()
);
create index if not exists files_course_idx on public.files (course_code, category);

-- ---------------------------------------------------------------------
-- 4. Étoiles (1 à 5, une note par personne et par document)
-- ---------------------------------------------------------------------
create table if not exists public.ratings (
  file_id    uuid not null references public.files on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles on delete cascade,
  stars      smallint not null check (stars between 1 and 5),
  updated_at timestamptz not null default now(),
  primary key (file_id, user_id)
);

-- ---------------------------------------------------------------------
-- 5. Chat général de chaque cours
-- ---------------------------------------------------------------------
create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  course_code text not null,
  author_id   uuid not null default auth.uid() references public.profiles on delete cascade,
  body        text not null check (char_length(body) between 1 and 4000),
  ref_file_id uuid references public.files on delete set null,   -- passage précis d'un document (facultatif)
  ref_page    int,
  ref_y       real,                                              -- hauteur sur la page (0 à 100 %)
  ref_label   text,
  created_at  timestamptz not null default now()
);
create index if not exists messages_course_idx on public.messages (course_code, created_at);

-- ---------------------------------------------------------------------
-- 6. Messages privés
-- ---------------------------------------------------------------------
create table if not exists public.direct_messages (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null default auth.uid() references public.profiles on delete cascade,
  recipient_id uuid not null references public.profiles on delete cascade,
  body         text not null check (char_length(body) between 1 and 4000),
  created_at   timestamptz not null default now(),
  read_at      timestamptz,
  check (sender_id <> recipient_id)
);
create index if not exists dm_recipient_idx on public.direct_messages (recipient_id, read_at);
create index if not exists dm_sender_idx on public.direct_messages (sender_id);

-- ---------------------------------------------------------------------
-- 7. Règles de sécurité : qui peut lire / écrire quoi
--    (seuls les étudiants connectés voient quelque chose)
-- ---------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.files           enable row level security;
alter table public.ratings         enable row level security;
alter table public.messages        enable row level security;
alter table public.direct_messages enable row level security;

drop policy if exists "profils: lire" on public.profiles;
create policy "profils: lire" on public.profiles for select to authenticated using (true);
drop policy if exists "profils: modifier le sien" on public.profiles;
create policy "profils: modifier le sien" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists "documents: lire" on public.files;
create policy "documents: lire" on public.files for select to authenticated using (true);
drop policy if exists "documents: ajouter" on public.files;
create policy "documents: ajouter" on public.files for insert to authenticated
  with check (uploader_id = (select auth.uid()));
drop policy if exists "documents: supprimer les siens" on public.files;
create policy "documents: supprimer les siens" on public.files for delete to authenticated
  using (uploader_id = (select auth.uid()));

drop policy if exists "notes: lire" on public.ratings;
create policy "notes: lire" on public.ratings for select to authenticated using (true);
drop policy if exists "notes: donner" on public.ratings;
create policy "notes: donner" on public.ratings for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists "notes: changer la sienne" on public.ratings;
create policy "notes: changer la sienne" on public.ratings for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "chat: lire" on public.messages;
create policy "chat: lire" on public.messages for select to authenticated using (true);
drop policy if exists "chat: écrire" on public.messages;
create policy "chat: écrire" on public.messages for insert to authenticated
  with check (author_id = (select auth.uid()));
drop policy if exists "chat: supprimer les siens" on public.messages;
create policy "chat: supprimer les siens" on public.messages for delete to authenticated
  using (author_id = (select auth.uid()));

drop policy if exists "privé: lire les siens" on public.direct_messages;
create policy "privé: lire les siens" on public.direct_messages for select to authenticated
  using ((select auth.uid()) in (sender_id, recipient_id));
drop policy if exists "privé: envoyer" on public.direct_messages;
create policy "privé: envoyer" on public.direct_messages for insert to authenticated
  with check (sender_id = (select auth.uid()));
drop policy if exists "privé: marquer comme lu" on public.direct_messages;
create policy "privé: marquer comme lu" on public.direct_messages for update to authenticated
  using (recipient_id = (select auth.uid())) with check (recipient_id = (select auth.uid()));

-- Accès de base pour les étudiants connectés (les visiteurs non connectés n'ont accès à rien).
-- Les règles ci-dessus décident ensuite, ligne par ligne, ce que chacun peut voir ou faire.
grant usage on schema public to authenticated;
grant select on public.profiles to authenticated;
grant select, insert, delete on public.files to authenticated;
grant select, insert on public.ratings to authenticated;
grant select, insert, delete on public.messages to authenticated;
grant select, insert on public.direct_messages to authenticated;
revoke all on public.profiles, public.files, public.ratings, public.messages, public.direct_messages from anon;

-- Le destinataire peut seulement cocher "lu", pas changer le texte
revoke update on public.direct_messages from authenticated;
grant update (read_at) on public.direct_messages to authenticated;
-- Une note : on peut seulement changer le nombre d'étoiles
revoke update on public.ratings from authenticated;
grant update (stars, updated_at) on public.ratings to authenticated;
-- Un profil : on peut seulement changer son nom
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;

-- ---------------------------------------------------------------------
-- 8. Stockage des fichiers (privé : réservé aux étudiants connectés)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 52428800)          -- 50 Mo maximum par fichier
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists "kampus: lire les fichiers" on storage.objects;
create policy "kampus: lire les fichiers" on storage.objects for select to authenticated
  using (bucket_id = 'documents');
-- Chaque fichier est rangé dans un dossier au nom de la personne qui l'ajoute
drop policy if exists "kampus: déposer ses fichiers" on storage.objects;
create policy "kampus: déposer ses fichiers" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "kampus: supprimer ses fichiers" on storage.objects;
create policy "kampus: supprimer ses fichiers" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------
-- 9. Temps réel : les nouveaux messages arrivent sans recharger la page
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'direct_messages') then
    alter publication supabase_realtime add table public.direct_messages;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'files') then
    alter publication supabase_realtime add table public.files;
  end if;
end $$;
