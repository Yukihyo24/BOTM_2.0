import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./supabase-config.js";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export const BOTM = {
  universes: ["Catch","Sports","DBZ","Naruto","OP","Pokemon","S_Heros","Mythologie","Television","JV","Animes"],

  imagePath(card) {
    return card.image_path || `univers/${card.universe}/${card.rarity}/${card.file_name}`;
  },

  rarityLabel(r) {
    return ({
      commune:"Commune",
      rare:"Rare",
      super_rare:"Super Rare",
      tres_rare:"Très Rare",
      ultra_rare:"Ultra Rare"
    })[r] || r;
  },

  async session() {
    const { data } = await supabase.auth.getSession();
    return data.session;
  },

  async requireAuth() {
    const session = await this.session();
    if (!session) {
      location.href = "login.html";
      return null;
    }
    return session;
  },

  async profile() {
    const { data, error } = await supabase
      .from("profiles")
      .select("id,username,role,boosters,miracle_draws,starter_claimed")
      .single();
    if (error) throw error;
    return data;
  },

  async collection() {
    const { data, error } = await supabase
      .from("user_cards")
      .select("quantity, cards(id,universe,rarity,file_name,image_path)")
      .order("card_id");
    if (error) throw error;
    return data || [];
  },

  async deck() {
    const { data, error } = await supabase
      .from("deck_entries")
      .select("slot, card_id, cards(id,universe,rarity,file_name,image_path)")
      .order("slot");
    if (error) throw error;
    return data || [];
  },

  async refreshHeader() {
    const session = await this.session();
    if (!session) return;
    try {
      const p = await this.profile();
      document.querySelectorAll("[data-user]").forEach(x => x.textContent = p.username);
      document.querySelectorAll("[data-boosters]").forEach(x => x.textContent = p.boosters);
      document.querySelectorAll("[data-miracles]").forEach(x => x.textContent = p.miracle_draws);
      const collection = await this.collection();
      const total = collection.reduce((n, x) => n + x.quantity, 0);
      document.querySelectorAll("[data-cardcount]").forEach(x => x.textContent = total);
    } catch (e) {
      console.error(e);
    }
  },

  async signOut() {
    await supabase.auth.signOut();
    location.href = "login.html";
  }
};

window.BOTM = BOTM;
window.supabaseClient = supabase;

document.addEventListener("DOMContentLoaded", () => BOTM.refreshHeader());
