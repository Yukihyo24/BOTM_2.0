/* =========================================================
   BOTM — HALLOWEEN EVENT 🎃
   ========================================================= */

const HALLOWEEN = {

  supabase: null,
  BOTM: null,

  remaining: 0,
  windowEnd: null,

  timers: [],
  activeCandies: new Set(),

  initialized: false,


  /* =======================================================
     INITIALISATION
     ======================================================= */

  async init() {

    if (this.initialized) return;

    this.supabase = window.supabaseClient;
    this.BOTM = window.BOTM;

    if (!this.supabase || !this.BOTM) {
      console.warn("Halloween : BOTM/Supabase non disponible.");
      return;
    }

    const session = await this.BOTM.session();

    if (!session) {
      return;
    }

    this.initialized = true;

    console.log("🎃 Événement Halloween activé");

    await this.loadWindow();

  },


  /* =======================================================
     RÉCUPÉRATION DE LA TRANCHE ACTUELLE
     ======================================================= */

  async loadWindow() {

    this.clearTimers();

    const { data, error } = await this.supabase.rpc(
      "get_halloween_candy_status"
    );

    if (error) {

      console.error(
        "Halloween : impossible de récupérer la tranche",
        error
      );

      return;
    }

    if (!data || !data.length) {
      return;
    }

    const status = data[0];

    this.remaining =
      Number(status.remaining_candies || 0);

    this.windowEnd =
      new Date(status.window_end);

    console.log(
      `🍬 ${this.remaining} bonbon(s) disponible(s)`
    );

    if (this.remaining > 0) {
      this.scheduleCandies();
    }

    this.scheduleNextWindow();

  },


  /* =======================================================
     PROGRAMMATION DES BONBONS
     ======================================================= */

  scheduleCandies() {

    const now = Date.now();
    const end = this.windowEnd.getTime();

    /*
     * On garde quelques secondes de sécurité avant
     * la fin de la tranche.
     */

    const availableTime =
      Math.max(1000, end - now - 5000);

    for (
      let i = 0;
      i < this.remaining;
      i++
    ) {

      /*
       * Apparition aléatoire pendant le temps
       * restant de la tranche.
       */

      const delay =
        Math.random() * availableTime;

      const timer = setTimeout(
        () => this.spawnCandy(),
        delay
      );

      this.timers.push(timer);
    }
  },


  /* =======================================================
     APPARITION D'UN BONBON
     ======================================================= */

  spawnCandy() {

    if (Date.now() >= this.windowEnd.getTime()) {
      return;
    }

    const candy =
      document.createElement("button");

    candy.type = "button";

    candy.className =
      "halloween-candy";

    /*
     * Plusieurs apparences possibles.
     */

    const candies = [
      "🍬",
      "🍭",
      "🍫",
      "🎃"
    ];

    candy.textContent =
      candies[
        Math.floor(
          Math.random() * candies.length
        )
      ];


    /*
     * Position aléatoire.
     *
     * On évite volontairement les extrêmes
     * de l'écran.
     */

    const margin = 80;

    const maxX =
      Math.max(
        margin,
        window.innerWidth - margin
      );

    const maxY =
      Math.max(
        margin,
        window.innerHeight - margin
      );

    const x =
      margin +
      Math.random() *
      Math.max(0, maxX - margin);

    const y =
      margin +
      Math.random() *
      Math.max(0, maxY - margin);


    candy.style.left =
      `${x}px`;

    candy.style.top =
      `${y}px`;


    /*
     * Accessibilité
     */

    candy.setAttribute(
      "aria-label",
      "Bonbon Halloween"
    );


    document.body.appendChild(candy);

    this.activeCandies.add(candy);


    /*
     * Clic
     */

    candy.addEventListener(
      "click",
      () => this.claimCandy(candy),
      { once: true }
    );


    /*
     * Le bonbon reste présent 60 secondes.
     *
     * S'il disparaît, la récompense n'est PAS
     * consommée côté serveur.
     */

    const disappearTimer =
      setTimeout(() => {

        if (
          this.activeCandies.has(candy)
        ) {

          candy.classList.add(
            "halloween-candy-disappear"
          );

          setTimeout(() => {

            candy.remove();

            this.activeCandies.delete(
              candy
            );

          }, 500);
        }

      }, 60000);

    candy._disappearTimer =
      disappearTimer;
  },


  /* =======================================================
     RÉCUPÉRATION
     ======================================================= */

  async claimCandy(candy) {

    if (
      candy.dataset.claiming === "true"
    ) {
      return;
    }

    candy.dataset.claiming = "true";

    clearTimeout(
      candy._disappearTimer
    );

    candy.classList.add(
      "halloween-candy-caught"
    );


    const { data, error } =
      await this.supabase.rpc(
        "claim_halloween_candy"
      );


    if (error) {

      console.error(
        "Halloween : erreur récupération",
        error
      );

      /*
       * On retire quand même le bonbon
       * s'il n'est plus valide.
       */

      candy.remove();

      this.activeCandies.delete(candy);

      return;
    }


    const reward =
      Array.isArray(data)
        ? data[0]
        : data;


    candy.remove();

    this.activeCandies.delete(candy);


    if (!reward) {
      return;
    }


    this.remaining =
      Number(
        reward.remaining_candies || 0
      );


    this.showReward(
      reward.reward_label
    );


    /*
     * Actualise immédiatement :
     *
     * points
     * boosters
     * pioches miracle
     */

    try {

      await this.BOTM.refreshHeader();

    } catch (error) {

      console.warn(
        "Halloween : header non actualisé",
        error
      );

    }
  },


  /* =======================================================
     MESSAGE DE RÉCOMPENSE
     ======================================================= */

  showReward(label) {

    const popup =
      document.createElement("div");

    popup.className =
      "halloween-reward";


    popup.innerHTML = `
      <div class="halloween-reward-icon">
        🎃
      </div>

      <div class="halloween-reward-title">
        BONBON TROUVÉ !
      </div>

      <div class="halloween-reward-value">
        ${this.escapeHTML(label)}
      </div>
    `;


    document.body.appendChild(popup);


    requestAnimationFrame(() => {

      popup.classList.add(
        "halloween-reward-show"
      );

    });


    setTimeout(() => {

      popup.classList.remove(
        "halloween-reward-show"
      );

      setTimeout(
        () => popup.remove(),
        500
      );

    }, 3500);

  },


  /* =======================================================
     PROCHAINE TRANCHE
     ======================================================= */

  scheduleNextWindow() {

    if (!this.windowEnd) {
      return;
    }

    const delay =
      Math.max(
        1000,
        this.windowEnd.getTime()
        - Date.now()
        + 1500
      );


    const timer =
      setTimeout(
        () => this.loadWindow(),
        delay
      );


    this.timers.push(timer);
  },


  /* =======================================================
     NETTOYAGE
     ======================================================= */

  clearTimers() {

    this.timers.forEach(
      timer => clearTimeout(timer)
    );

    this.timers = [];
  },


  /* =======================================================
     SÉCURITÉ HTML
     ======================================================= */

  escapeHTML(value) {

    const div =
      document.createElement("div");

    div.textContent =
      String(value ?? "");

    return div.innerHTML;
  }

};


/* =========================================================
   DÉMARRAGE
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    /*
     * app.js est un module.
     * On lui laisse un très court instant pour exposer
     * window.BOTM et window.supabaseClient.
     */

    setTimeout(
      () => HALLOWEEN.init(),
      100
    );

  }
);
