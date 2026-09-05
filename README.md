# Battle of the Multiverse — Collection V2 Supabase

Cette version remplace le `localStorage` de la V1 par de vrais comptes Supabase.

## Ce qui est maintenant serveur

- création / connexion de compte ;
- profil joueur ;
- pack de départ de 20 cartes, réclamable une seule fois ;
- collection ;
- deck (20 cartes max) ;
- compteur de boosters ;
- ouverture de booster (4 cartes) ;
- Pioche Miracle persistante : 3 choix, 1 seule carte conservée ;
- panneau administrateur ;
- catalogue central de cartes.

Les tirages sont réalisés dans PostgreSQL, pas dans le navigateur.

## 1. Créer le projet Supabase

Crée un projet sur Supabase.

Dans **SQL Editor**, colle puis exécute :

`supabase/setup.sql`

## 2. Configurer le front

Dans `supabase-config.js`, remplace :

- `https://YOUR_PROJECT.supabase.co`
- `YOUR_PUBLISHABLE_KEY`

par l'URL et la **Publishable key** de ton projet.

Ne mets JAMAIS de secret key / service-role key dans GitHub Pages.

## 3. Importer ton catalogue existant

Recopie dans cette V2 tes dossiers existants :

- `assets/`
- `univers/`
- éventuellement `booster.mp3`

Puis lance localement :

`python tools/build_cards_sql.py`

Le script parcourt automatiquement tes images et génère :

`supabase/cards_seed.sql`

Copie le contenu de ce fichier dans le SQL Editor Supabase et exécute-le.

Ainsi tu n'as pas besoin de saisir toutes les cartes une par une.

## 4. Te rendre administrateur

Crée d'abord ton compte normalement depuis le site.

Puis, dans le SQL Editor Supabase, exécute une seule fois :

```sql
update public.profiles
set role='admin'
where id=(select id from auth.users where email='TON_EMAIL');
```

Reconnecte-toi. Un bouton **Administration** apparaîtra.

## 5. GitHub Pages

Mets le contenu du dossier à la racine de ton dépôt GitHub, puis active GitHub Pages.

Dans Supabase Auth, ajoute l'URL GitHub Pages de ton site aux URLs autorisées / Redirect URLs.

## Sécurité

La clé publishable Supabase est faite pour être utilisée côté navigateur. La protection repose sur RLS et les fonctions serveur.

Les joueurs n'ont pas de droits directs d'écriture sur :
- `profiles`
- `user_cards`
- `deck_entries`
- les sessions de Pioche Miracle

Les écritures de jeu passent par des fonctions contrôlées.

## Ajouter de nouvelles cartes

Deux façons :

1. Ajouter l'image dans `univers/<univers>/<rarete>/`, puis relancer `tools/build_cards_sql.py` et exécuter le seed.
2. Utiliser `admin.html` pour enregistrer manuellement une nouvelle image déjà présente dans le dépôt.

Le fichier d'image doit toujours être réellement présent sur GitHub Pages ; Supabase enregistre son chemin et ses métadonnées, pas l'image elle-même.


## Déploiement GitHub Pages BOTM_2.0

Cette copie est configurée pour être publiée sous :

`https://yukihyo24.github.io/BOTM_2.0/`

Les liens, imports JavaScript, redirections d'authentification et chemins d'assets du front
ont été verrouillés sur `/BOTM_2.0/` afin d'éviter un renvoi accidentel vers BOTM-3.0.
Les chemins de cartes stockés dans Supabase restent relatifs (`univers/...`) et sont résolus
depuis le dossier réel de `app.js`.
