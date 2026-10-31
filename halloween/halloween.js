/* =========================================================
   BOTM — HALLOWEEN EVENT 🎃🍬
   ========================================================= */

import { supabase, BOTM } from "/BOTM_2.0/app.js";

const HALLOWEEN = {
  supabase: null,
  BOTM: null,
  remaining: 0,
  windowEnd: null,
  timers: [],
  activeCandies: new Set(),
  initialized: false,

  async init() {
    if (this.initialized) return;

    this.supabase = supabase;
    this.BOTM = BOTM;

    const session = await this.BOTM.session();
    if (!session) {
      console.log("Halloween : aucun joueur connecté.");
      return;
    }

    this.initialized = true;
    console.log("🎃 Événement Halloween activé");
    await this.loadWindow();
  },

  async loadWindow() {
    this.clearTimers();
    this.removeActiveCandies();

    const { data, error } = await this.supabase.rpc("get_halloween_candy_status");

    if (error) {
      console.error("Halloween : impossible de récupérer la tranche", error);
      return;
    }

    if (!data || !data.length) return;

    const status = data[0];
    this.remaining = Number(status.remaining_candies || 0);
    this.windowEnd = new Date(status.window_end);

    console.log(`🍬 ${this.remaining} bonbon(s) disponible(s)`);

    if (this.remaining > 0) this.scheduleCandies();
    this.scheduleNextWindow();
  },

  scheduleCandies() {
    const now = Date.now();
    const end = this.windowEnd.getTime();
    const availableTime = Math.max(1000, end - now - 5000);

    // Le premier apparaît rapidement afin que le joueur voie que l'événement est actif.
    // Les suivants restent répartis aléatoirement dans la tranche de 15 minutes.
    for (let i = 0; i < this.remaining; i++) {
      const delay = i === 0
        ? Math.min(1000 + Math.random() * 2000, availableTime)
        : Math.random() * availableTime;
      const timer = setTimeout(() => this.spawnCandy(), delay);
      this.timers.push(timer);
    }
  },

  spawnCandy() {
    if (!this.windowEnd || Date.now() >= this.windowEnd.getTime()) return;

    const candy = document.createElement("button");
    candy.type = "button";
    candy.className = "halloween-candy";

    const candies = ["🍬", "🍭", "🍫", "🎃"];
    candy.textContent = candies[Math.floor(Math.random() * candies.length)];
    candy.setAttribute("aria-label", "Bonbon Halloween à récupérer");
    candy.title = "Attrape-moi !";

    // Garde le bonbon à l'intérieur de la zone visible.
    const margin = window.innerWidth <= 600 ? 42 : 55;
    const x = margin + Math.random() * Math.max(1, window.innerWidth - margin * 2);
    const y = margin + Math.random() * Math.max(1, window.innerHeight - margin * 2);

    candy.style.left = `${x}px`;
    candy.style.top = `${y}px`;

    document.body.appendChild(candy);
    this.activeCandies.add(candy);

    candy.addEventListener("click", () => this.claimCandy(candy), { once: true });

    // Un bonbon non récupéré reste disponible jusqu'à la fin de sa tranche.
    const lifetime = Math.max(1000, this.windowEnd.getTime() - Date.now());
    candy._disappearTimer = setTimeout(() => {
      if (!this.activeCandies.has(candy)) return;
      candy.classList.add("halloween-candy-disappear");
      setTimeout(() => {
        candy.remove();
        this.activeCandies.delete(candy);
      }, 500);
    }, lifetime);
  },

  async claimCandy(candy) {
    if (candy.dataset.claiming === "true") return;
    candy.dataset.claiming = "true";
    candy.disabled = true;

    clearTimeout(candy._disappearTimer);
    candy.classList.add("halloween-candy-caught");

    const { data, error } = await this.supabase.rpc("claim_halloween_candy");

    if (error) {
      console.error("Halloween : erreur récupération", error);
      candy.remove();
      this.activeCandies.delete(candy);
      return;
    }

    const reward = Array.isArray(data) ? data[0] : data;

    setTimeout(() => {
      candy.remove();
      this.activeCandies.delete(candy);
    }, 420);

    if (!reward) return;

    this.remaining = Number(reward.remaining_candies || 0);
    this.showReward(reward.reward_label);

    try {
      await this.BOTM.refreshHeader();
    } catch (error) {
      console.warn("Halloween : header non actualisé", error);
    }
  },

  showReward(label) {
    const oldPopup = document.querySelector(".halloween-reward");
    if (oldPopup) oldPopup.remove();

    const popup = document.createElement("div");
    popup.className = "halloween-reward";
    popup.setAttribute("role", "status");
    popup.setAttribute("aria-live", "polite");

    const icon = document.createElement("div");
    icon.className = "halloween-reward-icon";
    icon.textContent = "🎃";

    const title = document.createElement("div");
    title.className = "halloween-reward-title";
    title.textContent = "BONBON TROUVÉ !";

    const value = document.createElement("div");
    value.className = "halloween-reward-value";
    value.textContent = String(label ?? "Récompense Halloween");

    popup.append(icon, title, value);
    document.body.appendChild(popup);

    requestAnimationFrame(() => popup.classList.add("halloween-reward-show"));

    setTimeout(() => {
      popup.classList.remove("halloween-reward-show");
      setTimeout(() => popup.remove(), 500);
    }, 3500);
  },

  scheduleNextWindow() {
    if (!this.windowEnd) return;

    const delay = Math.max(1000, this.windowEnd.getTime() - Date.now() + 1500);
    const timer = setTimeout(() => this.loadWindow(), delay);
    this.timers.push(timer);
  },

  clearTimers() {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers = [];
  },

  removeActiveCandies() {
    this.activeCandies.forEach((candy) => {
      clearTimeout(candy._disappearTimer);
      candy.remove();
    });
    this.activeCandies.clear();
  }
};

window.HALLOWEEN = HALLOWEEN;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => HALLOWEEN.init(), { once: true });
} else {
  HALLOWEEN.init();
}
