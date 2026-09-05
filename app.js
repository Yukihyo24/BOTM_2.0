import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import {
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
} from "/BOTM_2.0/supabase-config.js";

/* =========================================================
   SUPABASE
   ========================================================= */

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);


/* =========================================================
   BATTLE OF THE MULTIVERSE
   ========================================================= */

export const BOTM = {

  universes: [
    "Catch",
    "Sports",
    "DBZ",
    "Naruto",
    "OP",
    "Pokemon",
    "S_Heros",
    "Mythologie",
    "Television",
    "JV",
    "Animes"
  ],


  /* =======================================================
     IMAGES DES CARTES
     ======================================================= */

  imagePath(card) {

    if (!card) {
      console.error("BOTM.imagePath : carte inexistante");
      return "";
    }

    /*
     * On utilise en priorité image_path provenant de Supabase.
     *
     * Exemple :
     * univers/Catch/commune/Bayley.jpg
     */

    const path =
      card.image_path ||
      `univers/${card.universe}/${card.rarity}/${card.file_name}`;

    /*
     * Si Supabase contient déjà une URL complète,
     * on ne la modifie pas.
     */

    if (/^https?:\/\//i.test(path)) {
      return path;
    }

    /*
     * Création d'une URL absolue à partir de app.js.
     *
     * Sur GitHub Pages :
     *
     * app.js
     * https://yukihyo24.github.io/BOTM_2.0/app.js
     *
     * devient par exemple :
     *
     * https://yukihyo24.github.io/BOTM_2.0/
     * univers/Catch/commune/Bayley.jpg
     */

    try {

      const cleanPath = path
        .replace(/^\.?\//, "")
        .replace(/^\/+/, "");

      return new URL(cleanPath, import.meta.url).href;

    } catch (error) {

      console.error(
        "Impossible de construire l'URL de l'image :",
        card,
        error
      );

      return path;
    }
  },


  /* =======================================================
     RARETÉS
     ======================================================= */

  rarityLabel(rarity) {

    const labels = {
      commune: "Commune",
      rare: "Rare",
      super_rare: "Super Rare",
      tres_rare: "Très Rare",
      ultra_rare: "Ultra Rare"
    };

    return labels[rarity] || rarity;
  },


  /* =======================================================
     SESSION
     ======================================================= */

  async session() {

    const { data, error } =
      await supabase.auth.getSession();

    if (error) {
      console.error(
        "Erreur récupération session Supabase :",
        error
      );

      return null;
    }

    return data.session;
  },


  /* =======================================================
     AUTHENTIFICATION OBLIGATOIRE
     ======================================================= */

  async requireAuth() {

    const session = await this.session();

    if (!session) {

      location.href = "/BOTM_2.0/login.html";

      return null;
    }

    return session;
  },


  /* =======================================================
     PROFIL JOUEUR
     ======================================================= */

  async profile() {

    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id,username,role,boosters,miracle_draws,starter_claimed"
      )
      .single();

    if (error) {

      console.error(
        "Erreur récupération profil :",
        error
      );

      throw error;
    }

    return data;
  },


  /* =======================================================
     COLLECTION
     ======================================================= */

  async collection() {

    const { data, error } = await supabase
      .from("user_cards")
      .select(`
        quantity,
        cards(
          id,
          universe,
          rarity,
          file_name,
          image_path
        )
      `)
      .order("card_id");

    if (error) {

      console.error(
        "Erreur récupération collection :",
        error
      );

      throw error;
    }

    return data || [];
  },


  /* =======================================================
     DECK
     ======================================================= */

  async deck() {

    const { data, error } = await supabase
      .from("deck_entries")
      .select(`
        slot,
        card_id,
        cards(
          id,
          universe,
          rarity,
          file_name,
          image_path
        )
      `)
      .order("slot");

    if (error) {

      console.error(
        "Erreur récupération deck :",
        error
      );

      throw error;
    }

    return data || [];
  },


  /* =======================================================
     ACTUALISATION DE L'EN-TÊTE
     ======================================================= */

  async refreshHeader() {

    const session = await this.session();

    if (!session) {
      return;
    }

    try {

      const profile = await this.profile();


      /* Pseudo */

      document
        .querySelectorAll("[data-user]")
        .forEach(element => {

          element.textContent =
            profile.username || "Joueur";

        });


      /* Boosters */

      document
        .querySelectorAll("[data-boosters]")
        .forEach(element => {

          element.textContent =
            profile.boosters ?? 0;

        });


      /* Pioches Miracle */

      document
        .querySelectorAll("[data-miracles]")
        .forEach(element => {

          element.textContent =
            profile.miracle_draws ?? 0;

        });


      /* Nombre total de cartes */

      const collection =
        await this.collection();

      const total =
        collection.reduce(
          (number, item) =>
            number + Number(item.quantity || 0),
          0
        );

      document
        .querySelectorAll("[data-cardcount]")
        .forEach(element => {

          element.textContent = total;

        });

    } catch (error) {

      console.error(
        "Erreur actualisation interface BOTM :",
        error
      );
    }
  },


  /* =======================================================
     DÉCONNEXION
     ======================================================= */

  async signOut() {

    const { error } =
      await supabase.auth.signOut();

    if (error) {

      console.error(
        "Erreur déconnexion :",
        error
      );

      return;
    }

    location.href = "/BOTM_2.0/login.html";
  }

};


/* =========================================================
   ACCÈS GLOBAL

   Permet aux autres pages d'utiliser :
   window.BOTM
   window.supabaseClient
   ========================================================= */

window.BOTM = BOTM;
window.supabaseClient = supabase;


/* =========================================================
   INITIALISATION
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => BOTM.refreshHeader()
);