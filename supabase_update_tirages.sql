-- BOTM_2.0
-- Mise à jour des tirages LIMITÉS + ajout automatique à la collection
-- À exécuter UNE FOIS dans Supabase > SQL Editor.
-- Ne supprime aucun compte, aucune carte et aucune collection existante.

-- Les compteurs restent toujours positifs ou nuls.
alter table public.profiles
  alter column boosters set default 0,
  alter column miracle_draws set default 0;

-- BOOSTER
-- 1 booster consommé côté serveur.
-- 4 cartes sont ajoutées immédiatement à user_cards.
create or replace function public.open_booster(p_universe text)
returns table(card_id bigint, universe text, rarity text, file_name text, image_path text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  cid bigint;
  i integer;
begin
  if uid is null then
    raise exception 'Authentification requise';
  end if;

  if not exists(
    select 1
    from public.cards
    where active and universe = p_universe
  ) then
    raise exception 'Univers vide ou inconnu';
  end if;

  -- Verrouille le profil et retire exactement 1 booster.
  perform 1
  from public.profiles
  where id = uid
  for update;

  update public.profiles
  set boosters = boosters - 1
  where id = uid
    and boosters > 0;

  if not found then
    raise exception 'Aucun booster disponible';
  end if;

  for i in 1..4 loop
    cid := private.pick_card(p_universe);

    if cid is null then
      raise exception 'Impossible de tirer une carte';
    end if;

    perform private.add_user_card(uid, cid);

    return query
    select c.id, c.universe, c.rarity, c.file_name, c.image_path
    from public.cards c
    where c.id = cid;
  end loop;
end;
$$;


-- PIOCHE MIRACLE
-- Une session non résolue est réutilisée : impossible de reroll en rechargeant.
-- Un nouveau jeton n'est consommé que lorsqu'aucune session non résolue n'existe.
create or replace function public.start_miracle_draw(p_universe text)
returns table(session_id uuid, card_id bigint, universe text, rarity text, file_name text, image_path text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  sid uuid;
  cid bigint;
  tries integer := 0;
begin
  if uid is null then
    raise exception 'Authentification requise';
  end if;

  -- Sérialise les tentatives d'un même joueur.
  perform 1
  from public.profiles
  where id = uid
  for update;

  -- S'il existe déjà une Pioche Miracle non résolue,
  -- on restitue exactement les mêmes 3 cartes sans retirer un nouveau jeton.
  select s.id
  into sid
  from public.miracle_sessions s
  where s.user_id = uid
    and not s.resolved
  order by s.created_at desc
  limit 1;

  if sid is not null then
    return query
    select sid, c.id, c.universe, c.rarity, c.file_name, c.image_path
    from public.miracle_choices mc
    join public.cards c on c.id = mc.card_id
    where mc.session_id = sid
    order by c.id;

    return;
  end if;

  if (
    select count(*)
    from public.cards
    where active and universe = p_universe
  ) < 3 then
    raise exception 'Il faut au moins 3 cartes dans cet univers';
  end if;

  update public.profiles
  set miracle_draws = miracle_draws - 1
  where id = uid
    and miracle_draws > 0;

  if not found then
    raise exception 'Aucune Pioche Miracle disponible';
  end if;

  insert into public.miracle_sessions(user_id, universe)
  values(uid, p_universe)
  returning id into sid;

  while (
    select count(*)
    from public.miracle_choices
    where miracle_choices.session_id = sid
  ) < 3 loop

    tries := tries + 1;

    if tries > 100 then
      raise exception 'Impossible de générer trois choix uniques';
    end if;

    cid := private.pick_card(p_universe);

    insert into public.miracle_choices(session_id, card_id)
    values(sid, cid)
    on conflict do nothing;
  end loop;

  return query
  select sid, c.id, c.universe, c.rarity, c.file_name, c.image_path
  from public.miracle_choices mc
  join public.cards c on c.id = mc.card_id
  where mc.session_id = sid
  order by c.id;
end;
$$;


-- Le choix final ajoute UNE SEULE carte à la collection.
create or replace function public.choose_miracle_card(
  p_session_id uuid,
  p_card_id bigint
)
returns table(card_id bigint, universe text, rarity text, file_name text, image_path text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'Authentification requise';
  end if;

  perform 1
  from public.miracle_sessions s
  where s.id = p_session_id
    and s.user_id = uid
    and not s.resolved
  for update;

  if not found then
    raise exception 'Pioche introuvable ou déjà résolue';
  end if;

  if not exists(
    select 1
    from public.miracle_choices
    where session_id = p_session_id
      and miracle_choices.card_id = p_card_id
  ) then
    raise exception 'Carte invalide';
  end if;

  update public.miracle_sessions
  set resolved = true,
      chosen_card_id = p_card_id
  where id = p_session_id;

  perform private.add_user_card(uid, p_card_id);

  return query
  select c.id, c.universe, c.rarity, c.file_name, c.image_path
  from public.cards c
  where c.id = p_card_id;
end;
$$;

-- Permissions d'exécution.
revoke execute on function public.open_booster(text) from public, anon;
revoke execute on function public.start_miracle_draw(text) from public, anon;
revoke execute on function public.choose_miracle_card(uuid,bigint) from public, anon;

grant execute on function public.open_booster(text) to authenticated;
grant execute on function public.start_miracle_draw(text) to authenticated;
grant execute on function public.choose_miracle_card(uuid,bigint) to authenticated;
