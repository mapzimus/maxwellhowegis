// events.js — random shipboard events for the long open-water stretches. A deck of
// story cards drawn only when BOTH an 8–16 game-hour budget and a 25 real-second
// floor have run out, never over an open scene or a finished voyage. Gates read the
// sky; choices spend crew, plunder, or canvas, or mend the reckoning. The FIRST
// choice of every card is the crew's safe default — the autopilot presses the first
// button, so it must never be the reckless one.

const HOURS_MIN = 8; // game-hours between cards, at least
const HOURS_MAX = 16; // game-hours between cards, at most (re-rolled after each)
const REAL_HOLD = 25; // real seconds of quiet sailing before the next card

export function createEvents({ story, voyage, nav, ship, weather }) {
  // Until a weather module is wired in, read the sky off the storm flag.
  const sky = (weather && weather.state) ? weather : {
    get state() {
      return nav.stormOn
        ? { kind: "storm", seaState: 0.85, visibility: 0.3 }
        : { kind: "fair", seaState: 0.3, visibility: 0.9 };
    },
  };

  // Crew never drops below the two souls history put ashore; plunder never goes negative.
  function loseCrew(n) { voyage.state.crew = Math.max(2, voyage.state.crew - n); }
  function gainPlunder(n) { voyage.state.plunder = Math.max(0, voyage.state.plunder + n); }
  function easeSail() { ship.setSail(Math.max(0, ship.sail - 1)); }
  // A short follow-up card so an outcome lands in words, not just numbers. The scene
  // has already hidden itself when onChoose runs, so showing again is safe.
  function aftermath(title, text) { story.show({ title, text, button: "Continue" }); }

  // The deck. Choice order matters: the autopilot clicks the first button, so the
  // first choice is always the safe one. The wonder cards carry no cost.
  const DECK = [
    {
      id: "speak-fisherman",
      title: "A Fishing Ketch",
      weight: 10,
      text: [
        "A small ketch labors under your lee, nets out. Her master waves his hat. Fishermen know these waters better than any chart.",
        "To speak her costs an hour. But two reckonings laid side by side beat one alone.",
      ],
      choices: [
        {
          label: "Speak her",
          onChoose: () => {
            nav.correctDrTowardTruth(0.5);
            aftermath("Reckonings Compared", [
              "Her master calls his position across the water. John Julian rubs out the old mark and pricks a fresh one on the chart.",
              "The reckoning stands closer to the truth now.",
            ]);
          },
        },
        { label: "Sail on" },
      ],
    },
    {
      id: "split-topsail",
      title: "The Topsail Splits",
      weight: 8,
      when: ({ weather }) => weather.state.seaState > 0.5,
      text: [
        "A gust finds a worn seam. The main topsail splits with a crack like a cannon shot, and loose canvas thrashes above the deck.",
      ],
      choices: [
        {
          label: "Shorten sail and mend it",
          onChoose: () => {
            easeSail();
            aftermath("Needle and Palm", [
              "The crew takes in canvas and bends on a spare. Two hours pass before she draws clean again.",
              "Slower, but whole.",
            ]);
          },
        },
        {
          label: "Drive her on",
          onChoose: () => {
            loseCrew(2);
            aftermath("A Hard Bargain", [
              "Men go aloft to fight the flogging canvas. A sea rolls her hard, and two are swept from the yard into the dark water. The ship never slows.",
              "The crew keeps their silence after that.",
            ]);
          },
        },
      ],
    },
    {
      id: "man-overboard",
      title: "Man Overboard",
      weight: 8,
      text: [
        "A cry from aft — a hand has gone over the rail. His head shows in the wake, one arm raised.",
        "Heaving to costs time and steerage way.",
      ],
      choices: [
        {
          label: "Heave to and pull him out",
          onChoose: () => {
            aftermath("Hauled From the Sea", [
              "The ship rounds up. A line goes over, and he comes in coughing brine, alive.",
              "An hour lost. A shipmate kept.",
            ]);
          },
        },
        {
          label: "The sea keeps what it takes",
          onChoose: () => {
            loseCrew(1);
            aftermath("The Sea Keeps Him", [
              "The wake closes over the place where he was.",
              "The men go back to their work without a word. Their looks stay dark for days.",
            ]);
          },
        },
      ],
    },
    {
      id: "rum-found",
      title: "Rum in the Hold",
      weight: 9,
      text: [
        "The cooper finds a cask of rum stowed behind the water barrels, unmarked and unclaimed.",
        "Word runs the deck faster than any order.",
      ],
      choices: [
        {
          label: "Share it out",
          onChoose: () => {
            aftermath("A Merry Watch", [
              "Every man gets his tot, and songs go round the deck till the watch changes.",
              "A cheerful crew is a willing crew.",
            ]);
          },
        },
        {
          label: "Lock it away",
          onChoose: () => {
            gainPlunder(30);
            aftermath("Under Lock and Key", [
              "The cask goes below with the rest of the plunder — worth thirty pieces at any port.",
              "The men grumble at the lock. The ledger does not.",
            ]);
          },
        },
      ],
    },
    {
      id: "merchant-prize",
      title: "Sail Ho",
      weight: 9,
      when: ({ weather }) => weather.state.visibility > 0.6,
      text: [
        "The masthead lookout sings out — a fat merchantman to leeward, deep-laden and slow. She has not seen you yet.",
        "A chase means hours off your course, and boarding is never free.",
      ],
      choices: [
        {
          label: "Run her down and take her",
          onChoose: () => {
            gainPlunder(120);
            loseCrew(1);
            aftermath("A Prize Taken", [
              "Three hours of chase, one shot across her bow, and she strikes her colors. Coin and good cloth come over the rail — a hundred and twenty pieces' worth.",
              "One of your men stays aboard her to sail the prize away. You will not see him again this voyage.",
            ]);
          },
        },
        { label: "Let her pass" },
      ],
    },
    {
      id: "becalmed-doldrums",
      title: "Becalmed",
      weight: 8,
      when: ({ weather }) => weather.state.kind === "calm",
      text: [
        "The wind dies away to nothing. The sails hang slack, and the sea lies flat as poured glass.",
        "The ship drifts. The crew waits on your word.",
      ],
      choices: [
        {
          label: "Wet the sails and whistle for wind",
          onChoose: () => {
            aftermath("Whistling for Wind", [
              "Buckets go up the rigging, and the crew wets the canvas to hold what little air stirs. Old hands whistle low, calling the wind the way their fathers did.",
              "By and by, a cat's-paw ruffles the water.",
            ]);
          },
        },
        {
          label: "Break out the sweeps",
          onChoose: () => {
            loseCrew(1);
            aftermath("At the Sweeps", [
              "The crew bends to the long oars under a flat sun, and the ship crawls ahead.",
              "One man pulls past all his strength and is carried below, done for the voyage.",
            ]);
          },
        },
      ],
    },
    {
      id: "rat-in-the-bread",
      title: "Rats in the Bread Room",
      weight: 8,
      text: [
        "The cook reports rats in the bread room — droppings in the biscuit and a hole gnawed clean through a flour sack.",
      ],
      choices: [
        {
          label: "Ship's boy and his terrier sort it",
          onChoose: () => {
            aftermath("The Terrier's Work", [
              "The ship's boy turns his terrier loose among the sacks. By the dog watch the count stands at eleven rats to one proud dog.",
              "The bread room is quiet again.",
            ]);
          },
        },
        {
          label: "Toss the spoiled bread",
          onChoose: () => {
            aftermath("Short Rations", [
              "The spoiled biscuit goes over the side, gulls fighting astern for it.",
              "Rations run a little short until the next port. The men tighten their belts.",
            ]);
          },
        },
      ],
    },
    {
      id: "whale-breach",
      title: "A Whale Breaches",
      weight: 14,
      text: [
        "Off the bow, a whale heaves its whole body clear of the sea and falls back in a mountain of white water. The boom rolls over the deck like far-off guns.",
        "Even the oldest hands stop to watch.",
      ],
      choices: [{ label: "Continue" }],
    },
    {
      id: "dolphins",
      title: "Dolphins on the Bow",
      weight: 14,
      text: [
        "A school of dolphins takes station under the bowsprit, riding the bow wave easy as you please. They hold there the better part of an hour.",
        "Sailors call them a good omen. No one aboard argues.",
      ],
      choices: [{ label: "Continue" }],
    },
    {
      id: "st-elmos-fire",
      title: "St. Elmo's Fire",
      weight: 7,
      when: ({ weather }) => weather.state.seaState > 0.7,
      text: [
        "Cold blue fire crawls along the yards, and the masthead burns with a pale light that gives no heat. Some of the crew cross themselves.",
        "Old hands say it means the worst of the weather is passing.",
      ],
      choices: [{ label: "Continue" }],
    },
    {
      id: "navigators-doubt",
      title: "The Navigator's Doubt",
      weight: 9,
      text: [
        "John Julian stands long over the traverse board, pegs and chalk before him. The numbers will not sit easy tonight.",
        "\"By my count we run ahead of the reckoning,\" he says. \"Or the current sets us off. I cannot tell which.\"",
      ],
      choices: [
        { label: "Trust the reckoning" },
        {
          label: "Take in sail tonight",
          onChoose: () => {
            easeSail();
            aftermath("A Cautious Night", [
              "Canvas comes in, and the ship rides easy through the dark hours. Slower, but no shoal will catch her asleep.",
              "Julian nods at the board and says no more.",
            ]);
          },
        },
      ],
    },
  ];

  let hoursSince = 0;
  let hoursNeeded = HOURS_MIN + Math.random() * (HOURS_MAX - HOURS_MIN);
  let realSince = 0;
  let lastWall = performance.now();
  let fired = 0;
  let lastId = null;

  // Weighted draw among the cards whose gates pass; never the same card twice running
  // unless it is the only candidate.
  function pick() {
    let pool = DECK.filter((e) => !e.when || e.when({ weather: sky, voyage }));
    if (pool.length > 1) pool = pool.filter((e) => e.id !== lastId);
    let total = 0;
    for (const e of pool) total += e.weight;
    if (!total) return null;
    let r = Math.random() * total;
    for (const e of pool) {
      r -= e.weight;
      if (r <= 0) return e;
    }
    return pool[pool.length - 1];
  }

  function fire(e) {
    lastId = e.id;
    fired++;
    hoursSince = 0;
    realSince = 0;
    hoursNeeded = HOURS_MIN + Math.random() * (HOURS_MAX - HOURS_MIN);
    story.show({ title: e.title, text: e.text, choices: e.choices });
  }

  // gameHours: voyage time since the last call; realDt: real seconds. The caller only
  // runs this while no overlay is open, so a long wall-clock gap means the world was
  // paused — restart the quiet spell so a card never lands on the heels of another.
  function update(gameHours, realDt) {
    if (voyage.ended || story.isOpen()) return;
    const now = performance.now();
    if (now - lastWall > 1500) realSince = 0;
    lastWall = now;
    hoursSince += gameHours || 0;
    realSince += realDt || 0;
    if (hoursSince < hoursNeeded || realSince < REAL_HOLD) return;
    const e = pick();
    if (e) fire(e);
  }

  // Test hook: fire a card by id, skipping gates and cooldowns.
  function _debugFire(id) {
    const e = DECK.find((x) => x.id === id);
    if (e) fire(e);
  }

  return { update, _debugFire, get count() { return fired; } };
}
