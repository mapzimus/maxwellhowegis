/*
 * Black Sam & the Whydah — story data (v3: friendly voice)
 *
 * The narrative follows the true-ish arc of Samuel "Black Sam" Bellamy
 * (c.1689–1717): a poor English sailor who came to Cape Cod, chased the
 * sunken Spanish treasure fleet, turned pirate, was elected captain,
 * captured the ship Whydah Gally, and drowned when she foundered in a
 * nor'easter off Wellfleet on 26 April 1717.
 *
 * The prose is written for readers ~12 and up: short sentences, plain
 * words, light humor in the adventure scenes — and no jokes at all in
 * the scenes that deal with slavery, the wreck, or the gallows, which
 * stay honest but gentle.
 *
 * Scene format:
 *   id: {
 *     chapter: "small caps line above the title",
 *     title:   "Scene Title",
 *     art:     "key into window.ART" (optional),
 *     text:    [ "<html paragraph>" | fn(state), ... ],
 *     choices: [ { text, note?, to, effects?, set?, requires?, requiresNot?,
 *                  hidden?, lockedNote? } ],
 *     minigame: { name, opts?, intro, onWin: {to, effects?, set?},
 *                 onLose: {to, effects?, set?}, skip?: <choice> } (optional),
 *     // ...or for terminal nodes:
 *     ending: true, badge: "…", epilogue: "<html>"
 *   }
 *
 * `to`, `opts`, `effects` and text entries may be functions of state.
 * `requires` may be a flag name or a predicate fn(state); a failed string/fn
 * requirement renders the choice locked unless `hidden: true`.
 * Mini-game scores land in state.scores[name] (e.g. state.scores.helm).
 */

window.STORY = {
  start: "arrival",

  scenes: {

    /* ================= ACT I — CAPE COD, 1715 ================= */

    arrival: {
      chapter: "Cape Cod · 1715",
      title: "A Sailor Comes Ashore",
      art: "shore",
      text: [
        '<p class="drop">Your boots hit the sand at Eastham, Cape Cod, and you nearly fall over. That\'s what months at sea do to your legs. You are <strong>Samuel Bellamy</strong>, and everyone calls you <em>Black Sam</em> — not because you\'re scary, but because you refuse to wear one of those powdered white wigs the fancy captains love. You just tie your black hair back and get on with it.</p>',
        '<p>You own almost nothing. A sea-chest, a jackknife, and one enormous ambition. But there\'s a rumor crackling through every port on this coast: last summer, a whole Spanish treasure fleet sank off Florida. Eleven ships. Bellies <em>full</em> of silver and gold. And a lot of it is still down there, just waiting for somebody brave enough to go get it.</p>',
        '<p>That\'s a problem for tomorrow, though. Tonight, Cape Cod is quiet under the stars, and the air smells of salt hay, tar, and somebody\'s supper. Where to first?</p>'
      ],
      choices: [
        { text: "Wander up the bluffs, following the smell of apple blossoms.", note: "There's an orchard up there. And someone in it.", to: "orchard" },
        { text: "Head for the warm, glowing windows of the tavern at Great Island.", note: "Where sailors trade news, tall tales, and taller tales.", to: "tavern" },
        { text: "Walk the docks first and just listen.", note: "Harbors know everything before anyone else does.", to: "rumors" }
      ]
    },

    orchard: {
      chapter: "Cape Cod · 1715",
      title: "Maria of the Orchard",
      art: "orchard",
      text: [
        '<p>The orchard is all white blossom and bee-hum, and under a crooked old apple tree stands a girl named <strong>Maria Hallett</strong>. The town says she\'s trouble because she says what she thinks and climbs trees in her good dress. She looks at you like she\'s deciding whether you\'re interesting. You stand up straighter, just in case.</p>',
        '<p>You end up talking until the stars come out — about the sea, about Florida, about how her goat once ate a churchwarden\'s hat (the goat showed no remorse). She is the quickest, bravest person you have ever met, and something in your chest goes quietly and permanently sideways.</p>',
        '<p>"You have the look of a boy about to sail off after gold," she says. "They always do."</p>'
      ],
      choices: [
        { text: "Take her hand and promise it out loud, right there under the tree.", note: "A promise is like an anchor. Heavy. Hard to let go of.", to: "maria_promise" },
        { text: '"The sea makes no promises, so neither will I." Tip your hat like a gentleman.', note: "Honest, at least. Slightly dramatic, but honest.", to: "tavern" },
        { text: "Say nothing — but come back tomorrow night. And the next. And the next.", note: "Some things grow best in secret. Like mushrooms. And plans.", to: "maria_secret" }
      ]
    },

    maria_promise: {
      chapter: "Cape Cod · 1715",
      title: "The Promise",
      art: "orchard",
      text: [
        '<p>"Maria Hallett," you say, and your voice only wobbles a little, "I will come back to this orchard a rich man — or I won\'t come back at all."</p>',
        '<p>She doesn\'t blush or giggle. She studies you the way a shopkeeper studies a coin that might be fake. Then she nods once. "Then you\'d better come back rich, Samuel Bellamy. Because I intend to wait, and I am <em>terrible</em> at waiting."</p>',
        '<p>Her family will be furious. The whole town will gossip. Tonight, neither of you cares even slightly.</p>'
      ],
      choices: [
        { text: "Go find your fortune before your courage cools off.", note: "To the tavern — a rich stranger there is looking for brave sailors.", to: "tavern", set: ["promisedMaria"], effects: { renown: 1 } }
      ]
    },

    maria_secret: {
      chapter: "Cape Cod · Autumn 1715",
      title: "Meetings by Moonlight",
      art: "bluff",
      text: [
        '<p>All autumn you meet in secret — in the orchard, in the dunes, on the high bluff where the wind steals your words and throws them out to sea. Her family wants her to marry some deacon\'s son who owns sixty acres and zero jokes. Instead she sneaks out at night to talk to a penniless sailor with big dreams.</p>',
        '<p>The town notices. Towns always notice. The old ladies watch Maria walk to church with narrowed eyes, and some of them whisper a mean word about her — a word they\'ll use again someday, when the storms come: <em>witch</em>.</p>',
        '<p>"Let them whisper," Maria says, chin up, hair whipping in the wind. "Go get your gold, Sam. I\'ll be on this bluff when your sail comes back over the horizon."</p>'
      ],
      choices: [
        { text: "Promise to come back to her, no matter what it costs.", note: "The town's whispers will follow you both. Whispers are annoyingly fast.", to: "tavern", set: ["promisedMaria", "parishWhispers"], effects: { renown: 1 } }
      ]
    },

    rumors: {
      chapter: "Cape Cod · 1715",
      title: "What the Harbor Knows",
      art: "tavern",
      text: [
        '<p>The docks are better than a newspaper. A whaler from Boston swears the Spanish wrecks lie in water so shallow you could dive them off a rowboat. A gloomy first mate says the Spanish already have soldiers camped on that beach, plus a bad attitude. A seagull screams at you for no reason. You scream back. You feel better.</p>',
        '<p>Then one gray-bearded old sailor, paid in exactly one bowl of chowder, leans in close with something stranger: <em>"They say the King is tired of hanging pirates, lad. They say there\'s talk in London of a pardon — a clean slate for any sea-rover who\'ll quit. A clever fellow could do a great deal of business first, knowing a door like that might open."</em></p>',
        '<p>Also: a goldsmith from Rhode Island has been at the tavern all week, asking for sailors who don\'t scare easily. That sounds suspiciously like you.</p>'
      ],
      choices: [
        { text: "Go find this goldsmith.", note: "Fortune favors the bold. And the well-informed.", to: "tavern", set: ["heardPardon"] }
      ]
    },

    tavern: {
      chapter: "Cape Cod · 1715",
      title: "The Goldsmith's Offer",
      art: "tavern",
      text: [
        '<p>The tavern smells like candle smoke, wet wool, and somebody\'s questionable stew. At a corner table, a well-dressed man waves you over — <strong>Paulsgrave Williams</strong>, a goldsmith from Rhode Island with soft hands, a sharp eye, and a name that takes two full breaths to say.</p>',
        '<p>"The Spanish fleet," he says, tapping a chart, "went down along the Florida coast. Whatever the Spanish divers missed is sitting in the sand, free for the taking. I have money. I have a boat. What I need are people who don\'t frighten." He slides a mug across the table. "Are you such a person, Bellamy?"</p>'
      ],
      choices: [
        { text: "Shake his hand. \"To Florida — and the last one there is a rotten biscuit.\"", note: "Treasure hunting! What could possibly go wrong?", to: "florida", effects: { crew: 1 } },
        { text: "Politely decline, and sign onto an honest cargo ship instead.", note: "Steady pay, no hangman. The sensible choice. Painfully sensible.", to: "honest_path" }
      ]
    },

    /* ---------------- honest branch ---------------- */

    honest_path: {
      chapter: "The Merchant Trade · 1715",
      title: "An Honest Wage",
      art: "map",
      text: [
        '<p>You sign onto a tobacco ship and discover what honest sea work really means: biscuits hard enough to stop a musket ball, a captain who pays in promises, and an officer who yells at you for tying knots too <em>enthusiastically</em>. The whole ship smells of tar, mildew, and regret. Months of it grind the skin off your hands.</p>',
        '<p>Then one black night off the Carolinas, the boatswain leans close and whispers: "Half this crew is ready to take the ship and sail her to Nassau. No more captains. No more rotten pay. We\'d be our own masters. You in, Black Sam?"</p>'
      ],
      choices: [
        { text: "Refuse. Keep your name clean and your neck the normal length.", note: "Grind it out, save your pay, go home someday.", to: "ending_honest" },
        { text: "Grin in the dark. \"I was never built to be anybody's errand boy.\"", note: "Become a pirate. (This is the moment. Right here.)", to: "nassau", effects: { crew: 1 } },
        { text: "Quietly warn the captain before the plot hatches.", note: "Loyalty pays. Not much, but it pays.", to: "honest_report" }
      ]
    },

    honest_report: {
      chapter: "The Merchant Trade · 1715",
      title: "The Captain's Man",
      art: "map",
      text: [
        '<p>You find the captain hunched over his charts and tell him what\'s brewing below deck. He listens without a word. At the next port, the plotters are put ashore with no pay — and you get the boatswain\'s job and the boatswain\'s wages.</p>',
        '<p>Half the crew now glares at you. The ship\'s owners shake your hand. That\'s the deal with being respectable: it pays steadily, and it costs you something every single day.</p>'
      ],
      choices: [
        { text: "Keep the job. Sail the honest line for good.", note: "A long, quiet life. Very long. Very quiet.", to: "ending_honest", set: ["reportedPlot"] }
      ]
    },

    /* ---------------- treasure branch ---------------- */

    florida: {
      chapter: "Florida Coast · 1716",
      title: "The Treasure Coast",
      art: "florida",
      text: [
        '<p>You finally reach the Florida reefs — and your heart drops into your boots. The Spanish got here first. A whole armed camp sprawls along the beach, and their divers have already hauled up the easy silver. Sentries pace the sand with muskets. Their campfires glitter up the shore like angry fireflies.</p>',
        '<p>But out past their lantern light, in the shallows and the sandbars, there has to be <em>something</em> left. Williams looks at you across the rowboat, moonlight on the water. "One night," he whispers. "One night of digging is all we dare. Also, please stop rocking the boat."</p>'
      ],
      minigame: {
        name: "dig",
        intro: "Grab the shovel yourself and dig where your gut says the silver is.",
        opts: { targets: 5, shovels: 9, winAt: 3 },
        onWin: { to: "florida_found", effects: { gold: 2 }, set: ["foundSilver"] },
        onLose: { to: "florida_bust" },
        skip: {
          text: "Have the crew sift the shallows while you watch for sentries.",
          note: "Safer. But nobody digs like a captain who smells silver.",
          to: "florida_bust",
          effects: { gold: 1 }
        }
      }
    },

    florida_found: {
      chapter: "Florida Coast · 1716",
      title: "Silver in the Sand",
      art: "treasure",
      text: [
        '<p>Your shovel hits something that is definitely not a rock. By dawn you\'ve got a sailcloth bundle of crusty black coins — real Spanish silver, cold and heavy and <em>yours</em>. You do a small victory dance. Williams pretends he didn\'t see it. He saw it.</p>',
        '<p>And that\'s when the trouble starts, because Williams weighs a coin in his goldsmith\'s palm and says exactly what you\'re already thinking: "There\'s more silver sailing <em>on</em> this ocean than under it, Sam. All it takes is a black flag and a bold heart. And Nassau is full of crews flying one already."</p>'
      ],
      choices: [
        { text: "\"Then we'll take from the takers. Set course for Nassau!\"", note: "A little silver just makes you hungrier. Funny how that works.", to: "nassau", effects: { crew: 1 } },
        { text: "Take your little fortune home and call it a win.", note: "Quit while you're ahead — and alive. Both are nice.", to: "ending_farmer" }
      ]
    },

    florida_bust: {
      chapter: "Florida Coast · 1716",
      title: "The Picked-Over Bones",
      art: "florida",
      text: [
        '<p>Dawn finds you with blistered hands, boots full of seawater, and a haul of exactly: three blackened coins, one broken belt buckle, and a crab that pinched you and felt no guilt about it. The Spanish have the rest, and it\'s under guard. Your grand treasure hunt has cost you everything you had and paid you back in sand.</p>',
        '<p>"There is another way to get rich on this ocean," Williams says quietly, not quite looking at you. "It takes a black flag and a bold heart. Nassau is full of crews flying one already."</p>'
      ],
      choices: [
        { text: "\"Then we'll take from the takers. Set course for Nassau!\"", note: "Become a pirate. For real this time.", to: "nassau", effects: { crew: 1 } },
        { text: "\"No. I'm going home before this gets us hanged.\"", note: "Walk away from the whole mad business.", to: "ending_farmer" }
      ]
    },

    /* ================= ACT II — THE PIRATE REPUBLIC ================= */

    nassau: {
      chapter: "New Providence, Bahamas · 1716",
      title: "The Pirate Republic",
      art: "nassau",
      text: [
        '<p>Nassau is like no place you\'ve ever seen: a whole beach-city of tents, hammocks, drying laundry and stolen sails, run by no king at all. It smells of woodsmoke, tar, and roasting pig, and it sounds like a hundred arguments, all of them winning. Here you meet <strong>Benjamin Hornigold</strong>, a shrewd old sea-captain, and his fierce French partner <strong>Olivier Levasseur</strong>, who everyone calls <em>La Buse</em> — "the Buzzard" — which he claims is a compliment.</p>',
        '<p>And by the campfire sits a huge, quiet man with a beard like a storm cloud: <strong>Edward Teach</strong>. He plays dice and wins too often. Nobody has heard of him yet. Someday, the whole world will — as <em>Blackbeard</em>.</p>',
        '<p>They\'ll give you a hammock and a share. But first you have to earn it, and there\'s more than one way to make a name on this beach. A fat merchant ship is anchored offshore, ripe for the taking.</p>',
        '<p>On a post nearby sits a seagull, watching you with what can only be described as professional skepticism. You have the strangest feeling you\'ve met before.</p>'
      ],
      choices: [
        { text: "Volunteer for the boarding party. First over the rail!", note: "Show them what you're made of. (Hopefully not bruises.)", to: "first_prize" },
        { text: "Sit down at Teach's fire and challenge him at dice.", note: "A reputation can be won at a campfire too.", to: "teach_wager" },
        { text: "Spend the evening studying Hornigold's sea charts instead.", note: "Knowledge is a quieter weapon. Also less pointy.", to: "hornigold_dispute", set: ["studiedCharts"], effects: { renown: 1 } }
      ]
    },

    teach_wager: {
      chapter: "New Providence · 1716",
      title: "Dice with the Big Fellow",
      art: "tavern",
      text: [
        '<p>Teach makes room at the fire without saying a word, which is somehow scarier than saying a word. The dice are carved from bone. The stakes start friendly and do not stay that way. One by one the other players drop out, groaning, until it\'s just you, the man with the storm-cloud beard, and a pile of coins between you.</p>',
        '<p>He rattles the dice slowly, watching you through the smoke. "Best of three throws, Cape Cod. Winner takes the pile. What are ye?"</p>'
      ],
      minigame: {
        name: "dice",
        intro: "Roll the bones against Teach — lock each die on a high number.",
        opts: { rounds: 3 },
        onWin: { to: "teach_win" },
        onLose: { to: "teach_lose" },
        skip: {
          text: "Lose your nerve and just tip the dice back to him.",
          note: "You forfeit the game — but keep your shirt.",
          to: "teach_lose"
        }
      }
    },

    teach_win: {
      chapter: "New Providence · 1716",
      title: "The Beach Takes Notice",
      art: "tavern",
      text: [
        '<p>The dice clatter, bounce, wobble... and land <em>your</em> way. The whole fire erupts. Teach stares at the coins, then at you, for one long, terrifying second — and then throws back his head and laughs like a cannon going off.</p>',
        '<p>"Bellamy," he says, trying out the name like he\'s planning to keep it somewhere. "I\'ll remember it." You will spend years wondering whether that was a compliment or a warning. Either way, by morning the whole beach knows your name, and half of it wants to sail with you.</p>',
        '<p>The seagull watched the entire game from the tavern roof. It is not impressed. It is the same seagull. You are almost sure it is the same seagull.</p>'
      ],
      choices: [
        { text: "Ride your new fame straight into the boarding party.", note: "Now prove it wasn't just luck.", to: "first_prize", set: ["teachRespect"], effects: { crew: 2, gold: 1 } }
      ]
    },

    teach_lose: {
      chapter: "New Providence · 1716",
      title: "A Wise Retreat",
      art: "tavern",
      text: [
        '<p>You gather your modest winnings under Teach\'s heavy stare — and then use them to buy the whole fire a round of supper, which turns the grumbling into cheering remarkably fast. "Clever pup," Teach mutters, and turns to defeat the next challenger.</p>',
        '<p>You didn\'t win the beach\'s awe tonight. But you spent the whole evening watching how these men bluff, boast, follow, and turn on each other — and that kind of knowledge pays interest forever. At dawn, the boarding party gathers.</p>'
      ],
      choices: [
        { text: "Join the boarding party at first light.", note: "Reputation must be earned the old-fashioned way after all.", to: "first_prize", effects: { renown: 1 } }
      ]
    },

    first_prize: {
      chapter: "Aboard the prize · 1716",
      title: "First Over the Rail",
      art: "boarding",
      text: [
        '<p>The merchant ship doesn\'t give up at the first warning shot — her first mate is a tough customer with a sword in his fist and no intention of handing over his cargo. The grappling irons whirl, fly, and bite with a thunk you feel through your boots. The strip of black water between the two ships gets narrower... and narrower... Your mouth has gone dry as ship\'s biscuit, and Hornigold\'s crew is watching to see exactly where you\'ll be standing when the hulls bump.</p>'
      ],
      minigame: {
        name: "duel",
        intro: "Go over the rail first and cross swords with the mate yourself.",
        opts: { rounds: 3, winAt: 2, speed: 1 },
        onWin: { to: "prize_won", effects: { crew: 2, gold: 1 } },
        onLose: { to: "prize_wounded", effects: { gold: 1 }, set: ["oldWound"] },
        skip: {
          text: "Direct the attack from your own deck, shouting orders like a foghorn.",
          note: "Captains who hang back get fewer scars. Also fewer high-fives.",
          to: "prize_won",
          effects: { gold: 1 },
          set: ["heldBack"]
        }
      }
    },

    prize_won: {
      chapter: "Aboard the prize · 1716",
      title: "The Deck Is Yours",
      art: "boarding",
      text: [
        function (s) {
          return s.flags.heldBack
            ? '<p>The fight is short and lopsided. Your voice carries the boarders over the rail in one big wave, and the mate tosses down his sword before anyone gets seriously hurt. The crew notices you kept a cool head — though a few mutter that you also kept remarkably dry boots.</p>'
            : '<p>You go over the rail first, knock the mate\'s first swing aside, and back him up against his own mast until he drops his sword and puts his hands up. The boarders pour in behind you, roaring your name. A legend is born on that deck — and legends, like fish stories, only grow with retelling.</p>';
        },
        '<p>The cargo hold gives up sugar, cloth, and coins. And when the merchant sailors hear how pirates live — equal shares, a vote for every man, and food you can chew without a hammer — half of them sign up on the spot.</p>'
      ],
      choices: [
        { text: "Head back to the fleet, flushed with victory.", note: "Trouble is waiting there, wearing a captain's coat.", to: "hornigold_dispute" }
      ]
    },

    prize_wounded: {
      chapter: "Aboard the prize · 1716",
      title: "A Hard Lesson",
      art: "boarding",
      text: [
        '<p>The mate is better than you guessed. His second swing catches your shoulder, and suddenly you\'re on one knee seeing stars — and it\'s La Buse\'s pistol pointed at the mate, not your sword, that ends the fight. The ship is captured anyway. You get carried back across the rail like a sack of flour.</p>',
        '<p>The wound will heal. The lesson stays: courage is a coin that buys nothing unless skill is in the purse next to it. The crew respects that you jumped first. They\'ll be watching, next time, to see if you learned anything.</p>'
      ],
      choices: [
        { text: "Heal up, and rejoin the fleet's councils.", note: "A scar is a story you carry with you.", to: "hornigold_dispute" }
      ]
    },

    hornigold_dispute: {
      chapter: "Aboard the Marianne · 1716",
      title: "The Captain's One Rule",
      art: "nassau",
      text: [
        '<p>There\'s a problem in the fleet, and it\'s wearing the captain\'s hat. Old Hornigold, out of some leftover loyalty to a king who never once said thank you, <em>refuses to raid English ships</em>. French ships? Fine. Spanish? Absolutely. Dutch? He\'ll race you there. English? Never.</p>',
        '<p>"Half the ships on this sea are English, and he tips his hat as they sail by," La Buse grumbles. "There is no <em>profit</em> in his politeness." The crew is muttering. And their eyes keep sliding over to <em>you</em>.</p>'
      ],
      choices: [
        { text: "Stand by Hornigold. A captain who keeps one rule may keep others worth keeping.", note: "Loyalty to the old lion.", to: "elected", set: ["honoredHornigold"], effects: { renown: 1 } },
        { text: "Call the whole company to a vote. Let the crew decide who leads.", note: "The pirate way. Democracy, but with more shouting.", to: "elected", effects: { crew: 2 } },
        {
          text: "Take Hornigold aside privately, and talk him into stepping down with dignity.",
          note: "Requires a name the old man respects.",
          lockedNote: "Hornigold barely knows your name yet. Earn a bigger one first.",
          requires: function (s) { return s.stats.renown >= 3; },
          to: "quiet_persuasion"
        }
      ]
    },

    quiet_persuasion: {
      chapter: "Aboard the Marianne · 1716",
      title: "The Old Lion Steps Down",
      art: "nassau",
      text: [
        '<p>You find Hornigold alone at the ship\'s rail and give it to him straight: the vote is coming, he\'s going to lose it, and it will be ugly — unless he walks off the stage before he\'s pushed. He stares at the ship\'s wake for a long, long time.</p>',
        '<p>"Remember this, Bellamy," he finally says. "A crew that eats its captain acquires the taste." Then he calls the vote <em>himself</em>, wishes everyone fair winds, and sails away with the few men still loyal to him — head high, no blood spilled. Even the men who wanted him gone raise a mug to him. And one to you, for pulling it off.</p>'
      ],
      choices: [
        { text: "Stand for election.", note: "The company still has to choose its captain.", to: "elected", set: ["peacefulRise"], effects: { renown: 2 } }
      ]
    },

    elected: {
      chapter: "The Articles · Summer 1716",
      title: "Captain Bellamy",
      art: "prince",
      text: [
        '<p>Pirate crews vote — every sailor\'s voice equal, from the quartermaster down to the powder-boy. And the crew votes for <em>you</em>. Just like that, you\'re Captain Samuel Bellamy of the <em>Marianne</em>, with Williams commanding the second ship. You are twenty-seven years old and you cannot stop grinning.</p>',
        '<p>You write up the ship\'s Articles — the rules everyone signs: fair and equal shares for all, a vote on every big decision, and payment from the common chest for any sailor hurt in the fight. No king\'s navy ever offered sailors half so much. (Also, rule one of piracy: never vote yourself out of snacks.)</p>',
        function (s) {
          return s.flags.heardPardon
            ? '<p>And in the back of your mind sits that dockside rumor — the King\'s pardon, a clean slate for pirates who quit. A door that opens can also close. So: what kind of captain will the sea remember you as?</p>'
            : '<p>Now for the real question: what kind of captain will the sea remember you as?</p>';
        }
      ],
      choices: [
        { text: "A relentless one. Chase every prize, hard and fast.", note: "Fear fills the treasure hold quickest.", to: "shakedown", effects: { gold: 2, crew: 1, renown: -1 } },
        { text: "A generous one. Take from the rich, spare the poor, share everything.", note: "Become the Robin Hood of the Sea.", to: "shakedown", set: ["robinHood"], effects: { renown: 3, crew: 1 } },
        { text: "A careful one. Look into this King's-pardon rumor before the first raid.", note: "There might be a legal exit from an illegal life.", to: "pardon_offer" }
      ]
    },

    pardon_offer: {
      chapter: "New Providence · 1716",
      title: "The King's Mercy",
      art: "map",
      text: [
        '<p>The rumor is real. Word runs down from Boston and across from London: the King, tired of paying hangmen, is weighing a pardon for any pirate who surrenders and promises to quit. Some pirates on the beach laugh at the idea. Others quietly start mending their shore clothes.</p>',
        '<p>Williams turns his mug in slow circles. "Take it now, and we walk away clean — and poor. Or we make one great voyage first and take the pardon after, as rich men... <em>if</em> the offer lasts. And <em>if</em> our luck does."</p>'
      ],
      choices: [
        { text: "Take the pardon now. Walk away with your neck and your little bit of silver.", note: "The only guaranteed exit this business will ever offer.", to: "ending_pardon" },
        { text: "Tear the notice off the post. Freedom first — the King can wait his turn.", note: "Write the Articles. Go hunting.", to: "articles", effects: { renown: 1 } }
      ]
    },

    articles: {
      chapter: "The Articles · Summer 1716",
      title: "Ink and Brotherhood",
      art: "map",
      text: [
        '<p>You write the Articles out fair and read them in a big voice: equal shares and a vote for every sailor. The captain\'s word is law only in battle. Any man hurt in the fight gets paid from the common chest before anyone else sees a coin. Sailors who\'ve been whipped for slow knots and fed biscuits with <em>residents</em> line up to sign, and some of them have tears in their eyes.</p>',
        '<p>"The fine gentlemen rob the poor and hide behind the law," you tell them. "We\'ll take from the rich and stand behind our own courage. Which crew would you rather sail with?"</p>'
      ],
      choices: [
        { text: "To sea, Captain.", note: "The hunting grounds are waiting.", to: "shakedown", effects: { crew: 2 } }
      ]
    },

    /* ================= ACT III — PRINCE OF THE SEA-LANES ================= */

    shakedown: {
      chapter: "Aboard the Marianne · Summer 1716",
      title: "Shake Down the Crew",
      art: "prince",
      text: [
        '<p>A new captain and a green company are a dangerous mix. Before you hunt anything, you drill the crew until they can work the ship in the dark and in a gale. The most important skill of all is the rigging: the bosun barks the orders — <em>Haul! Belay! Cleat!</em> — and every sailor had better remember the sequence, or a sail comes down on somebody\'s head.</p>',
        '<p>The bosun, a walrus-mustached man who has clearly done this a thousand times, folds his arms and looks at you. From a coil of rope nearby, the ship\'s cat watches the drills through half-closed eyes, grading everyone harshly. "After you, <em>Captain</em>," the bosun says, with only a little sarcasm. "Show \'em how it\'s done."</p>'
      ],
      minigame: {
        name: "knots",
        intro: "Take the bosun's orders yourself — watch, then repeat the sequence.",
        opts: { rounds: 4, startLen: 3 },
        onWin: { to: "raiding", effects: { crew: 2, renown: 1 } },
        onLose: { to: "raiding", effects: { crew: 1 }, set: ["fumbledRigging"] },
        skip: {
          text: "Leave the drilling to the bosun and go study your charts.",
          note: "A captain can't do everything. But the crew notices who tries.",
          to: "raiding"
        }
      }
    },

    goat_intro: {
      chapter: "Aboard the Marianne · 1716",
      title: "A New Recruit",
      art: "goat",
      text: [
        '<p>Every ship needs a goat — for the milk, mostly, and for eating the rubbish, and (though no sailor will admit it) for luck. Yours came aboard with the last prize and simply refused to leave. The crew has named him <strong>Bartholomew</strong>. He has amber eyes, an iron stomach, and absolutely no respect for rank.</p>',
        '<p>You are in the middle of a very dignified speech about Freedom and the Brotherhood of the Sea when you notice the crew is not looking at you. They are looking behind you. You turn around. Bartholomew is calmly, thoroughly <em>eating your hat.</em></p>'
      ],
      choices: [
        { text: "Give chase! Nobody eats the captain's hat and gets away with it.", note: "He is faster than he looks. Much faster.", to: "goat_chase_scene", set: ["goatAboard"] },
        { text: "Let him keep the hat. Laugh it off — a captain who can laugh is a captain men follow.", note: "Bartholomew wins this round.", to: "johnjulian", set: ["goatAboard", "goatKeptHat"], effects: { crew: 1, renown: 1 } }
      ]
    },

    goat_chase_scene: {
      chapter: "Aboard the Marianne · 1716",
      title: "The Great Hat Chase",
      art: "goat",
      text: [
        '<p>What follows is not, strictly speaking, the proudest moment of your career as a free prince. It involves a lot of running, a coil of rope, two startled sailors, one very smug goat, and a chase three times around the mainmast while the entire crew cheers — for the goat. From the yardarm, the seagull watches the whole performance. It is the closest to impressed you have ever seen it.</p>'
      ],
      minigame: {
        name: "goatchase",
        intro: "Corner Bartholomew and get your hat back!",
        opts: { need: 5, duration: 15 },
        onWin: { to: "johnjulian", set: ["hatSaved"], effects: { crew: 1, renown: 1 } },
        onLose: { to: "johnjulian", effects: { renown: 1 } },
        skip: {
          text: "Give up and let the goat keep the hat. You have some dignity left. Some.",
          note: "The crew will be telling this story for years either way.",
          to: "johnjulian",
          set: ["goatKeptHat"]
        }
      }
    },

    lookout_scene: {
      chapter: "The Windward Passage · 1717",
      title: "Sails in the Fog",
      art: "fog",
      text: [
        '<p>A thick fog rolls in off the water, the kind you could spread on bread. Somewhere out there, prizes are creeping past blind — but so are patrol ships that would love to catch a pirate napping. You climb to the masthead yourself, because the best eyes on the ship should be the highest.</p>',
        '<p>Shapes loom out of the grey and vanish again. A sail? A gull? A cloud? You have to call it fast, and you have to call it <em>right</em>.</p>'
      ],
      minigame: {
        name: "lookout",
        intro: "Take the masthead watch — spot the sails, ignore the gulls.",
        opts: { rounds: 5, winAt: 3, showMs: 1150 },
        onWin: { to: "whydah_sighted", effects: { renown: 1, gold: 1 } },
        onLose: { to: "whydah_sighted" },
        skip: {
          text: "Leave the watch to sharper eyes and stay on deck.",
          note: "You'll miss a prize or two, but you won't strain your neck.",
          to: "whydah_sighted"
        }
      }
    },

    raiding: {
      chapter: "The Windward Passage · Winter 1716",
      title: "Prince of the Sea-Lanes",
      art: "chase",
      text: [
        '<p>It turns out you are <em>alarmingly</em> good at this. In one season your name races ahead of your sails: more than fifty ships stopped and emptied — sugar, cloth, ivory, coins. You almost never have to fire the cannons; most ships take one look at your flag and simply give up, which is efficient for everyone. Sailors keep quitting honest ships just to join you.</p>',
        '<p>Then you stop a neat little ship called the <em>Anne</em>. Her captain — a stubborn, dignified man named <strong>Captain Beer</strong> — plants his feet on his own deck and refuses to join you, refuses to be scared, and refuses, on principle, to stop glaring. Your quartermaster sighs and asks what you want done.</p>'
      ],
      choices: [
        { text: "Let Beer keep his ship and sail off free. Brave deserves brave.", note: "Mercy.", to: "the_speech", set: ["sparedBeer"], effects: { renown: 2 } },
        { text: "The crew already voted to burn the Anne. Let the vote stand.", note: "The crew's will is the law. That was YOUR rule.", to: "the_speech", effects: { gold: 1, renown: -1 } },
        { text: "First, offer his sailors a place under your Articles.", note: "Every captured ship is also a job fair.", to: "beer_recruit" }
      ]
    },

    beer_recruit: {
      chapter: "The Windward Passage · 1717",
      title: "The Recruiting Deck",
      art: "chase",
      text: [
        '<p>You gather the <em>Anne\'s</em> crew on their own deck and give them the speech you\'ve given a dozen crews: equal shares, a vote for every man, bread without weevils, and a captain who says thank you. Four sailors step across to your side, grinning. The rest study their boots very hard. Captain Beer looks at you like something he scraped off his boot.</p>',
        '<p>The crew\'s vote to burn the ship stands — they want their bonfire. Beer rows away with his loyal men and his extremely low opinion of you, and the <em>Anne</em> makes a bright, sad light on the horizon behind you.</p>'
      ],
      choices: [
        { text: "Sail on. Beer shouted something at you across the water — and you have an answer.", note: "The whole deck heard him call you thieves.", to: "the_speech", effects: { crew: 2, renown: -1 }, set: ["pressedAdvantage"] }
      ]
    },

    the_speech: {
      chapter: "The Free Prince · 1717",
      title: "\"I Am a Free Prince\"",
      art: "prince",
      text: [
        '<p>Beer calls you a thief, loudly, in front of everyone. And something rises up in you — not anger, exactly. Something bigger. You turn to face him, and the whole deck goes silent, and out comes the speech they\'ll still be quoting three hundred years from now:</p>',
        '<p class="quote">"I am a free prince, and I have as much authority to make war on the whole world as he who has a hundred ships at sea and an army of a hundred thousand men in the field. They vilify us, the scoundrels do, when there is only this difference: <em>they rob the poor under the cover of law, and we plunder the rich under the protection of our own courage.</em>"</p>',
        '<p>In plain words: the rich take from everyone and call it business — you take from the rich and at least you\'re honest about it. Beer is not convinced. But every sailor of yours who hears it stands about an inch taller. You\'re not just a captain anymore. You\'re a <em>cause</em>.</p>',
        '<p>Somewhere up in the rigging, a seagull yawns — slowly, and with great care, so that everyone can see it. Your finest speech. The one they\'ll quote for three centuries. Yawned at.</p>'
      ],
      choices: [
        { text: "Turn the fleet toward the Windward Passage and hunt for the greatest prize of all.", note: "Somewhere out there is a ship worthy of a free prince.", to: "goat_intro" }
      ]
    },

    johnjulian: {
      chapter: "The Windward Passage · 1717",
      title: "The Pilot's Eye",
      art: "map",
      text: [
        '<p>Among the newest members of your crew is a boy of about sixteen with an old sailor\'s eyes: <strong>John Julian</strong>, a Miskito Indian from the Central American coast. He reads the water the way other people read books. Twice already, his quiet "not that way, Captain" has saved your ship from reefs that aren\'t on any chart.</p>',
        '<p>He never asks for thanks. He calls the danger, watches the ship slide safely past it, and goes quietly back to reading the water. Most captains would work a boy like that hard and never think twice. Something tells you this one is worth a great deal more than that.</p>'
      ],
      choices: [
        { text: "Take him under your wing. Teach him your letters; let him teach you his water.", note: "A friend at the helm is worth ten at the rail.", to: "lookout_scene", set: ["julianFriend"], effects: { renown: 1 } },
        { text: "Promote him to pilot's mate and put him to work. Sentiment is for shore.", note: "The fleet comes first.", to: "lookout_scene", effects: { crew: 1 } }
      ]
    },

    whydah_sighted: {
      chapter: "The Windward Passage · February 1717",
      title: "A Ship Worthy of a Prince",
      art: "whydah",
      text: [
        '<p>She lifts over the horizon like a promise: the <strong>Whydah Gally</strong> of London. Three hundred tons. Brand new. Built to carry twenty-eight cannons. And, by every rumor on the sea, loaded with sugar, indigo, ivory — and a fortune in gold and silver.</p>',
        '<p>She is also a slave ship, built for the cruelest trade there is, sailing home with the money that trade made. There is nothing funny about that part, and you know it.</p>',
        '<p>Her captain, <strong>Lawrence Prince</strong>, knows his business. She\'s fast, and he means to run. Every spyglass on your quarterdeck is up. Your heart is going like a drum.</p>'
      ],
      choices: [
        { text: "Pile on every sail and chase her down hot.", note: "Three days of flat-out pursuit, ending in cannon smoke.", to: "capture_whydah" },
        { text: "Stalk her patiently — shadow her, tire her out, pick your moment.", note: "A calm chase makes a truer broadside.", to: "capture_whydah", set: ["patientChase"], effects: { renown: 1 } }
      ]
    },

    capture_whydah: {
      chapter: "The Windward Passage · February 1717",
      title: "Taking the Whydah",
      art: "battle",
      text: [
        '<p>The chase runs three whole days across open ocean, your two ships hanging on the Whydah\'s heels like wolves. For three days nobody truly sleeps: the decks lean, the rigging hums, and every rope is stretched singing-tight. On the third dawn, salt-crusted and red-eyed, you get your wish — the wind hands her to you. Captain Prince swings her sideways, gun-ports open. One hard exchange of cannon fire will decide whether she surrenders — or bloodies you first.</p>'
      ],
      minigame: {
        name: "cannon",
        intro: "Aim the great guns yourself. Fire as she crosses your broadside.",
        opts: function (s) {
          return s.flags.patientChase
            ? { shots: 4, winAt: 2, speed: 0.8 }
            : { shots: 4, winAt: 2, speed: 1.05 };
        },
        onWin: { to: "whydah_taken", effects: { gold: 3, crew: 1 } },
        onLose: { to: "whydah_costly", effects: { gold: 2 } },
        skip: {
          text: "Leave the gunnery to old Noland and hold the quarterdeck.",
          note: "The gunner knows his trade. But crews remember whose hand fired the great shot.",
          to: "whydah_costly",
          effects: { gold: 2 },
          set: ["gunnerHandled"]
        }
      }
    },

    whydah_taken: {
      chapter: "February 1717",
      title: "She Strikes Her Colours",
      art: "whydah",
      text: [
        '<p>Your first shot tears through her rigging. Your second changes Captain Prince\'s mind entirely. Down comes the Whydah\'s flag after a single exchange — almost nobody hurt on either side. Sailors will argue for years about whether it was the cleanest great capture ever made. (It was. You checked.)</p>',
        '<p>Prince stands on his quarterdeck holding his hat. And here you do the thing that will get told and retold in every port: you give him your <em>own old ship</em> to sail home in, plus his sea chest, plus a share of coins for the sailors who stood by him. "You are a very strange kind of thief, Captain Bellamy," he says. You get that a lot.</p>',
        '<p>A seagull lands on the rail of the greatest prize ever taken on this coast, inspects it from bow to stern, and is unimpressed. The crew has started calling him <strong>the Admiral</strong>. He outranks you now. Nobody voted on it; it simply happened.</p>'
      ],
      choices: [
        { text: "Go below decks and see what you've won.", note: "The cargo hold — and the people in it.", to: "captives" }
      ]
    },

    whydah_costly: {
      chapter: "February 1717",
      title: "A Costly Prize",
      art: "battle",
      text: [
        function (s) {
          return s.flags.gunnerHandled
            ? '<p>Old Noland\'s guns do their job — but Captain Prince\'s answer is better. His broadside rakes your ship end to end before the Whydah finally surrenders, and three of your sailors don\'t get up again. You bury them at sea the old way, wrapped in sailcloth, while the whole fleet stands silent. The men mutter that the shots that mattered weren\'t yours.</p>'
            : '<p>Your shots go wide, and Captain Prince\'s answer doesn\'t. His broadside rakes your ship end to end before sheer numbers force him to surrender, and three of your sailors don\'t get up again. You bury them at sea the old way, wrapped in sailcloth, while the whole fleet stands silent.</p>';
        },
        '<p>But she\'s yours. Captain Prince sails away in your battered old ship, and you stand on the deck of the greatest prize on the Atlantic coast — knowing exactly what it cost.</p>'
      ],
      choices: [
        { text: "Go below decks and see what you've won.", note: "The cargo hold — and the people in it.", to: "captives", effects: { crew: -1 } }
      ]
    },

    captives: {
      chapter: "Aboard the Whydah · 1717",
      title: "The Hold",
      art: "whydah",
      text: [
        '<p>Below decks, among the barrels and the sacks of coins, there are chains — and there are people in them. Men and women who were stolen from their homes in Africa to be sold, because that is the evil business this ship was built for. They watch you in the lantern light, and every eye goes to the ring of keys on the wall.</p>',
        '<p>Your crew waits at the hatchway. Pirate ships have sailed with free Black sailors for as long as anyone can remember — a good part of your own crew was born in Africa or the islands. Everyone is waiting to see what you\'ll do, Captain.</p>'
      ],
      choices: [
        { text: "Strike the chains off. Offer everyone who wants it a free share and a place in the crew.", note: "Free people fight for you. Prisoners never do.", to: "davis_plea", set: ["freedCaptives"], effects: { renown: 3, crew: 2 } },
        { text: "Count the gold first. Deal with the hold afterward.", note: "Treasure first. It's not your proudest moment.", to: "davis_plea", effects: { gold: 3 } },
        {
          text: "Send John Julian down first, to speak to them before anyone else does.",
          note: "Requires the pilot's friendship.",
          lockedNote: "John Julian doesn't know you well enough to be asked this.",
          requires: "julianFriend",
          to: "davis_plea",
          set: ["freedCaptives", "julianSpoke"],
          effects: { renown: 2, crew: 3 }
        }
      ]
    },

    davis_plea: {
      chapter: "Aboard the Whydah · Spring 1717",
      title: "The Carpenter's Plea",
      art: "boarding",
      text: [
        '<p>Refitting a giant ship takes skilled workers, and pirates recruit skilled workers the rude way: they keep them. <strong>Thomas Davis</strong>, a young Welsh carpenter grabbed from an earlier ship, comes to you with his cap in his hands. "Captain — you promised me my freedom when the next ship was taken. This is the next ship. Please. Let me go home. I don\'t want a single coin of it."</p>',
        '<p>Your quartermaster growls that the crew voted to keep him — in a working fleet, a good carpenter is worth more than gold. Davis just keeps looking at you. A promise from a free prince: what\'s it actually worth?</p>'
      ],
      choices: [
        { text: "\"The crew voted, Davis. When the fleet is safe — then we'll talk.\"", note: "The fleet's needs come first. His face falls.", to: "fleet_council", effects: { crew: 1 } },
        { text: "Swear in front of the whole company that Davis goes free at the next friendly port.", note: "Keep the promise's shape, if not its speed.", to: "fleet_council", set: ["sparedDavis"], effects: { renown: 1 } },
        { text: "Put him aboard the very next neutral ship you meet, with wages in his pocket.", note: "A promise kept in full. And a good carpenter lost.", to: "fleet_council", set: ["sparedDavis", "davisFreed"], effects: { renown: 2, crew: -1 } }
      ]
    },

    fleet_council: {
      chapter: "Flagship of a Free Prince · Spring 1717",
      title: "The Company in Council",
      art: "prince",
      text: [
        '<p>You refit the Whydah as your flagship: twenty-eight cannons, fresh rigging, and a hold packed so full of gold and silver that she sits low in the water like an overfed duck. The shares are weighed out equally and stored between decks — because these are, after all, very organized thieves.</p>',
        function (s) {
          var notes = [];
          if (s.flags.freedCaptives) {
            notes.push(s.flags.julianSpoke
              ? "The people you freed from the hold haven't forgotten it. A dozen of them now stand watches and crew the guns as full share-holders under your Articles — and John Julian says they trust you all the more because he spoke for you first, down in that dark hold."
              : "The people you freed from the hold haven't forgotten it. A dozen of them now stand watches and crew the guns as full share-holders under your Articles.");
          }
          if (s.flags.robinHood) {
            notes.push("Word of your generosity travels faster than your sails; some merchant crews now surrender before you even finish raising the flag, hoping for the famous mercy.");
          }
          if (s.flags.teachRespect) {
            notes.push("Even Teach's old campfire crowd at Nassau sends word now and then, curious what the dice-winner from that first night has made of himself.");
          }
          return notes.length ? '<p>' + notes.join(" ") + '</p>' : '';
        },
        function (s) {
          return s.stats.crew < 3
            ? '<p>But a fleet is made of people, not planks — and your people are grumpy. Too many shares have been paid out in scars and promises. The council you\'ve called is quiet in exactly the wrong way: the quiet of a crew that has already voted in its heart and is just waiting for someone to say it out loud.</p>'
            : '<p>Spring is opening the sea-roads north. The crew is fed, rich, and loud with plans. Every course on the chart is yours to pick, Captain.</p>';
        }
      ],
      choices: [
        { text: "Stand up and put the question of a course to the company.", note: "Every big decision goes to a vote. Even this one. Especially this one.", to: function (s) { return s.stats.crew < 3 ? "mutiny" : "flagship"; } }
      ]
    },

    mutiny: {
      chapter: "Aboard the Whydah · 1717",
      title: "The Company Votes You Down",
      art: "prince",
      text: [
        '<p>You see it in their faces before a single word is spoken. The quartermaster rises — politely, which is somehow worse — and puts the motion: <em>that the company thanks Captain Bellamy for his service, and chooses another to lead.</em> Hands go up like a field of wheat in the wind. You wrote these Articles yourself. Every sailor\'s voice equal. The trap you built for tyrants has closed on you.</p>',
        '<p>Hornigold\'s words at the rail come back to you with the cold weight of a prophecy: <em>a crew that eats its captain acquires the taste.</em></p>'
      ],
      choices: [
        { text: "Step down with all the grace you can find. The Articles are the Articles.", note: "The vote is the vote.", to: "ending_mutiny" },
        { text: "Put your hand on your pistol and dare them to take the ship from a free prince.", note: "Pride has sunk sturdier ships than this one.", to: "ending_mutiny", set: ["foughtMutiny"] }
      ]
    },

    flagship: {
      chapter: "Flagship of a Free Prince · Spring 1717",
      title: "Twenty-Eight Guns",
      art: "treasure",
      text: [
        '<p>The vote is called — and the votes are yours. Bellamy\'s fleet stands ready: the Whydah flying your flag, Williams in the second ship, hundreds of free sailors under Articles, and more coin between decks than most royal governors will ever touch. Somewhere below, the ship\'s cat — chief inspector of rigging drills, tireless critic of your knots — is asleep on a sack of silver, because even the cat is rich now.</p>',
        '<p>Spring is opening the sea-roads north. You have everything you came for. Which leaves only the oldest question there is: <em>where now?</em></p>'
      ],
      choices: [
        {
          text: "North. Point her bow at Cape Cod and the cold gray coast of home.",
          note: function (s) { return s.flags.promisedMaria ? "You made a promise under an apple tree." : "Refit in a quiet northern harbor — and see what's waiting there."; },
          to: function (s) { return s.flags.promisedMaria ? "maria_dream" : "williams_split"; },
          set: ["sailingNorth"]
        },
        { text: "South. Stay in the warm blue water where the prizes are.", note: "Why sail toward cold rocks and a hangman?", to: "caribbean_stay" },
        { text: "One more raiding season first. Fatten the shares, then decide.", note: "\"Just one more\" — famous last words in every language.", to: "last_raids" },
        {
          text: "Neither. Declare your own free nation of the sea, right here, right now.",
          note: "Requires a legend big enough to carry it.",
          lockedNote: "Not even your name is big enough for that. Yet.",
          requires: function (s) { return s.stats.renown >= 8; },
          to: "sea_king"
        },
        {
          text: "Wait — where is the treasure map? ...BARTHOLOMEW.",
          note: "First mate business. Urgent first mate business.",
          requires: "goatAboard",
          requiresNot: "goatMapDone",
          hidden: true,
          to: "goat_map"
        }
      ]
    },

    goat_map: {
      chapter: "Aboard the Whydah · Spring 1717",
      title: "The Goat Ate the Map",
      art: "goat",
      text: [
        '<p>Bartholomew has eaten a corner of the only chart showing where a rival captain buried his loot. He does not look sorry. He looks, if anything, <em>proud</em>. A goat cannot smirk. Bartholomew is somehow smirking.</p>',
        '<p>The quartermaster suggests, not entirely as a joke, that you could turn the goat into a very fine stew. The whole crew holds its breath. Bartholomew chews.</p>'
      ],
      choices: [
        { text: "\"Nobody is eating the goat. Redraw the map from memory and let's move on.\"", note: "The crew loves you a little more. So does the goat, probably.", to: "flagship", set: ["goatMapDone"], effects: { crew: 1, renown: 1 } },
        { text: "Reconstruct the chart the hard way, without the goat's help.", note: "Slow, thorough, and pointedly goat-free.", to: "flagship", set: ["goatMapDone"], effects: { gold: 1 } }
      ]
    },

    last_raids: {
      chapter: "The Capes of Virginia · April 1717",
      title: "One More Season",
      art: "chase",
      text: [
        '<p>"One more season" turns into "one more month" turns into "one more prize." Off Virginia you snap up three ships in a single week, and the shares below decks grow heavier still. But the weather is turning mean — fog thick as porridge, squalls out of the northeast — and one wild night the fleet gets scattered and two of your prize ships simply vanish into the dark, crews and all.</p>',
        '<p>The men count their gold and eye the falling barometer. <em>Enough</em> is a word even pirates learn eventually. Usually the hard way.</p>'
      ],
      choices: [
        { text: "Set the course north. Finally.", note: "Cape Cod, a refit — and whatever else is waiting there.", to: function (s) { return s.flags.promisedMaria ? "maria_dream" : "williams_split"; }, effects: { gold: 2, crew: -1 }, set: ["sailingNorth"] }
      ]
    },

    maria_dream: {
      chapter: "Northward · April 1717",
      title: "The Orchard in the Spyglass",
      art: "orchard",
      text: [
        '<p>The nights get colder as the fleet sails north, and you keep finding yourself on deck at odd hours, spyglass in hand, watching the dark line of the coast. Somewhere up that long shore is an orchard, and a promise: <em>I\'ll come back a rich man, or not at all.</em> Well. You are currently the richest man on this entire ocean. Time to keep your word.</p>',
        function (s) {
          return s.flags.parishWhispers
            ? '<p>The last ship you stopped carried Cape Cod gossip along with its cargo, and some of it lands like a stone in your stomach: a girl in Eastham, in trouble with the town while you were gone. Thrown out by the church. Living alone now in a hut on the Wellfleet bluffs, watching the sea all day. The old ladies finally settled on their word for her. <em>Witch</em>, they say. You know her name before the sailor even says it.</p>'
            : '<p>What will she say when a lord of the sea walks back up that bluff with silver buckles on his shoes? What will the town say — the same town that called you a penniless nobody? You want to know so badly it almost scares you.</p>';
        }
      ],
      choices: [
        { text: "Press on north. Whatever's waiting on that bluff, you'll meet it head-on.", note: "The promise pulls like a tide.", to: "williams_split", effects: { renown: 1 } }
      ]
    },

    williams_split: {
      chapter: "Off Block Island · April 1717",
      title: "The Goldsmith's Request",
      art: "map",
      text: [
        '<p>Off Block Island, Paulsgrave Williams rows over to the Whydah with his hat in his hands and a slightly embarrassed look on his face. "My mother and sisters live on that island, Sam. Give me a day — two at most — to visit them. I\'ll catch up with you off Cape Cod. I\'ll even bring you some of my mother\'s jam."</p>',
        '<p>The old sailors don\'t like splitting the fleet with the barometer falling. But he isn\'t asking as your second-in-command. He\'s asking as your friend — the man who bought the boat, and the chart, and believed in you back when you owned one jackknife and an attitude.</p>'
      ],
      choices: [
        { text: "Let him go. Family is the one treasure you never got to capture.", note: "The fleet splits up — just for a day or two. He says.", to: "north_decision", set: ["williamsSaved"], effects: { renown: 1 } },
        { text: "Keep the fleet together. He can visit his mother next month, as a rich man.", note: "One flag, one course, no stragglers. (No jam, either.)", to: "north_decision", effects: { crew: 1 } }
      ]
    },

    /* ---------------- alternate: never went north ---------------- */

    caribbean_stay: {
      chapter: "The Spanish Main · 1717",
      title: "King of the Warm Waters",
      art: "nassau",
      text: [
        '<p>You can\'t make yourself sail toward the cold gray coast and its hangmen. So you stay — and you <em>reign</em>. For a season, then a year, then longer, no flag on the Caribbean is feared and loved like yours. You never do sail north into that April storm. You never do find out what it was going to cost.</p>',
        '<p>But you never see Cape Cod again, either. Some nights, rich beyond counting under a sky full of unfamiliar stars, you catch yourself thinking about an orchard, and a girl who told you they always sail off after gold.</p>'
      ],
      choices: [
        { text: "Raise a glass to the life you chose, and sail on into legend.", to: "ending_caribbean" }
      ]
    },

    sea_king: {
      chapter: "The Free Commonwealth · 1717",
      title: "A Crown of Salt",
      art: "treasure",
      text: [
        '<p>Why should free sailors beg pardons from a king they never chose? On the careening beach you say the thing nobody has ever quite dared to say: a <em>free commonwealth of the sea</em>. The fleet is its parliament. The Articles are its constitution. Every sailor is a citizen of a nation with no land under it except nine fathoms of green water.</p>',
        '<p>The crew laughs. Then stops laughing. Then <em>votes for it</em>. The news tears through the islands like fire through dry cane: Bellamy has crowned the sea itself. Governors double their harbor guards. London newspapers print your speech with rows of asterisks where the spicy words were. You\'re not a pirate anymore. You\'re a <em>flag</em>.</p>'
      ],
      choices: [
        { text: "Rule your salt kingdom for as long as the wind allows.", note: "No crown sits steady on the ocean.", to: "ending_caribbean", set: ["seaKing"], effects: { renown: 2 } }
      ]
    },

    /* ================= ACT IV — THE NOR'EASTER ================= */

    north_decision: {
      chapter: "Off the New England Coast · 26 April 1717",
      title: "The Cold Coast",
      art: "storm",
      text: [
        function (s) {
          return s.flags.promisedMaria
            ? '<p>The water turns gray and cold. Seagulls wheel over waves you\'ve known since you were a boy. Somewhere past that low line of dunes is an orchard, and a promise you made and never broke. You are one day\'s sail from keeping it.</p>'
            : '<p>The water turns gray and cold, and the easy warmth of the south falls away behind you. You tell the crew you\'re only here to refit in a quiet harbor — patch the hull, take on fresh water. You don\'t tell them about the strange pull you feel toward this coast. You can\'t quite name it yourself.</p>';
        },
        '<p>Then the sky to the northeast turns the color of a day-old bruise. The barometer drops like it\'s trying to escape. The oldest sailors sniff the wind once and go very, very quiet. The Admiral is nowhere to be seen; even the seagull has gone somewhere sensible. The ship\'s cat has vanished deep among the cargo and will not be coaxed out, and the old hands notice things like that. A <strong>nor\'easter</strong> is coming — one of the savage spring storms that have buried a thousand ships in the sandbars off Cape Cod.</p>',
        '<p>Night falls early and absolutely black. The Whydah pitches under your feet. Somewhere close ahead in the dark is the shore: all sandbars, breakers, and bad news. What\'s your order, Captain?</p>'
      ],
      choices: [
        { text: "Turn and claw out to open sea. Fight the storm where there's room to fight it.", note: "Away from the sandbars — if she can take the pounding.", to: "storm_scene", set: ["stormSea"] },
        { text: "Run for the coast. Find shelter behind the land and drop every anchor you own.", note: "Toward safety — and toward the breakers.", to: "storm_scene", set: ["stormShore"] }
      ]
    },

    storm_scene: {
      chapter: "26 April 1717 · The Nor'easter",
      title: "The Wheel in Your Hands",
      art: "storm",
      text: [
        '<p>The storm arrives like a falling wall. Sails blow out of their ropes with bangs like cannon fire. The sea and the sky churn together into one black thing that seems to genuinely dislike you. Sailors tie themselves to the pumps. Somewhere downwind, surf is exploding on the outer sandbar — you can\'t see it, but you can feel it through the deck like a giant\'s heartbeat.</p>',
        function (s) {
          return s.flags.julianFriend
            ? '<p><strong>John Julian</strong> fights his way along the lifeline to the wheel and puts his mouth to your ear, reading the black water out loud — <em>sandbar there, channel there, NOW, Captain, NOW</em> — and the two of you work the great wheel together like one creature with four arms and one very stubborn heart.</p>'
            : '<p>The helmsman looks at you, white as the foam. No pilot alive knows this sandbar in the dark. There\'s just the wheel, the sound of the breakers, and whatever is in your hands tonight.</p>';
        }
      ],
      minigame: {
        name: "helm",
        intro: "Take the wheel yourself. Hold her in the deep water.",
        opts: function (s) {
          return { duration: 22, drift: s.flags.julianFriend ? 0.75 : 1.1 };
        },
        onWin: { to: function (s) { return storm_resolve(s); } },
        onLose: { to: function (s) { return storm_resolve(s); } },
        skip: {
          text: "Tie the wheel in place, send every sailor below, and hope.",
          note: "Give her to the sea and the anchors.",
          to: function (s) { return storm_resolve(s); },
          set: ["lashedWheel"]
        }
      }
    },

    /* ================= ENDINGS ================= */

    ending_wreck: {
      chapter: "26 April 1717 · Off Wellfleet",
      ending: true, badge: "The True Fate",
      title: "The Sea Keeps Her Prince",
      art: "wreck",
      text: [
        '<p>No one beats this storm. The nor\'easter takes the Whydah in its fist and drives her onto the outer sandbar, only five hundred feet from the beach — close enough to see, impossibly far to swim. She strikes, and strikes again, and her mainmast goes over the side. Then the great ship rolls into the freezing surf, and the cold black water closes over her guns, her gold, and her crew.</p>',
        function (s) {
          var extra = s.flags.williamsSaved
            ? ' Paulsgrave Williams, safe at Block Island because you let him go, will search the coast for weeks, and carry the sound of that storm with him for the rest of his life — but he will live it.'
            : '';
          return '<p>Samuel Bellamy — free prince, Robin Hood of the sea, twenty-eight years old and richer than kings — goes down with his ship and his crew, one day\'s sail from the orchard. The ocean he loved keeps him, and keeps its silence.' + extra + '</p>';
        }
      ],
      epilogue: '<p><strong>What really happened:</strong> This is the true ending. The Whydah wrecked off Wellfleet, Cape Cod, in the storm of 26 April 1717. Of about 145 people aboard, only <strong>two</strong> made it to shore alive — the carpenter Thomas Davis and the pilot John Julian. For 267 years the wreck was just a legend, until explorer <strong>Barry Clifford</strong> found it in 1984 and raised a bronze bell stamped <em>"THE WHYDAH GALLY 1716."</em> It is still the only pirate shipwreck ever proven to be real — and its gold is still coming out of the sand today.</p>'
    },

    ending_survivor: {
      chapter: "26 April 1717 · Off Wellfleet",
      ending: true, badge: "A Survivor",
      title: "Cast Up Alive",
      art: "dawnbeach",
      text: [
        '<p>The Whydah is lost — driven onto the bar, dismasted, rolled over in the surf. But your hands on the wheel bought her a few final boat-lengths of deep water, and when she strikes, you are near the rail. A wave that takes so many others instead throws you clear, and the freezing undertow rolls you up onto the sand, coughing and alive.</p>',
        function (s) {
          return s.flags.sparedDavis
            ? '<p>You lie on the cold beach in the gray dawn, one of a tiny handful still breathing. In Boston they put you on trial for piracy — and it is Thomas Davis, the carpenter whose promise you kept, who stands up pale and stubborn in front of the judges and swears you dealt fairly with him when you didn\'t have to. It isn\'t freedom. But it is the difference between the worst ending and a cell, an appeal — and one foggy morning much later, a door someone forgot to lock.</p>'
            : '<p>You lie on the cold beach in the gray dawn, one of a tiny handful still breathing, while the sea scatters gold and broken timber along two miles of shore. You have your life. Right now, it is the only treasure you have left — and horsemen are already riding down the beach toward you.</p>';
        }
      ],
      epilogue: '<p><strong>What really happened:</strong> Only two of the Whydah\'s crew reached shore alive: the carpenter <strong>Thomas Davis</strong> and the pilot <strong>John Julian</strong>. Davis was put on trial in Boston and found not guilty, because he\'d been forced into piracy. Several survivors from another of Bellamy\'s ships were not so lucky. The wreck itself stayed lost until Barry Clifford found it in 1984 — the only pirate shipwreck ever proven to be real.</p>'
    },

    ending_legend: {
      chapter: "26 April 1717 · Off Wellfleet",
      ending: true, badge: "The Legend",
      title: "The Sea Witch's Storm",
      art: "bluff",
      text: [
        '<p>The old people of Cape Cod will tell it differently, and who\'s to say they\'re wrong? They\'ll say the storm was no ordinary storm — that up on the Wellfleet bluff that night stood <strong>Maria Hallett</strong>, the girl from the orchard, who had waited years for a rich man who swore he\'d come back. The town called her the Sea Witch. The stories say she raised the gale herself, to smash her prince\'s ship onto the sand below her feet — so the sea would finally have to give him back to her.</p>',
        '<p>Whatever the truth, the Whydah went down in thunder off that beach, and the gold went into the sand, and your name went into legend and never came out. For a hundred years afterward, treasure hunters walked that shore on wild nights, listening for a drowned captain calling in the surf.</p>'
      ],
      epilogue: '<p><strong>History and legend:</strong> The love story of Bellamy and Maria Hallett — the "Witch of Wellfleet" — is Cape Cod folklore, and nobody knows how much of it is true. What <em>is</em> documented: the wreck, the storm, the lost treasure, and its rediscovery by <strong>Barry Clifford in 1984</strong>, which turned a campfire legend into the only proven pirate shipwreck in the world.</p>'
    },

    ending_pilot: {
      chapter: "27 April 1717 · Cape Cod",
      ending: true, badge: "The Pilot's Debt",
      title: "Through the Needle's Eye",
      art: "dawnbeach",
      text: [
        '<p>No ship should have lived in that water. But you had two things no other captain on this coast had: the best night of helm-work in your whole life, and <strong>John Julian</strong> beside you, reading the black sea like an open book. Together you thread the Whydah between the sandbars — she strikes once, twice, shudders like a struck bell — and you drive her, dying but upright, into the shallows of a little cove the charts barely bother to name.</p>',
        '<p>By dawn the great ship is a ruin and the crew has scattered into the countryside, every sailor carrying what he could. You and Julian and a stubborn handful walk inland out of history — soaked, salt-crusted, rich, and alive. The King\'s men drag the bay for a fortune and find driftwood. The story everyone settles on, because it\'s simpler, is that all hands were lost. Only the seagulls — and one girl on a bluff, who saw two figures walk up out of the surf — know differently. And none of them ever tell.</p>'
      ],
      epilogue: '<p><strong>History and invention:</strong> This escape is the game\'s own "what if." In real life the Whydah broke apart with almost everyone lost — but <strong>John Julian</strong> really was one of the two survivors: a Miskito Indian pilot, probably just sixteen years old. Real history treated him cruelly afterward — he was sold into slavery in Boston. The real sea gave the pilot no miracle. This game gives him one.</p>'
    },

    ending_gallows: {
      chapter: "Boston · November 1717",
      ending: true, badge: "The King's Justice",
      title: "The Gallows at Boston",
      art: "gallows",
      text: [
        '<p>You survive the sea. That turns out to be the unlucky part. The same wave that spares you hands you straight to the King\'s men, and they march you to Boston to stand trial as a pirate. The famous preacher Cotton Mather himself comes to your cell to pray with the condemned, and he writes down every word you say.</p>',
        '<p>The trial is short. The speeches that made whole crews stand taller sound very different read aloud in a courtroom. On a gray November morning they lead you to the harbor gallows, and the crowd is enormous, and somewhere in it — maybe — is a girl from Eastham with sea-gray eyes. You stand straight and meet it like a free prince. The newspapers, for once, print something true.</p>'
      ],
      epilogue: '<p><strong>What really happened:</strong> Bellamy himself drowned, but this ending is real history for his crew: six survivors from his consort ship the <em>Mary Anne</em> were tried in Boston and executed in November 1717, with Cotton Mather attending the condemned men. The records of those trials are among the best sources historians have about Bellamy\'s crew — the words of his sailors, written down at the very end.</p>'
    },

    ending_caribbean: {
      chapter: "The Spanish Main · after 1717",
      ending: true, badge: "The Road Not Taken",
      title: function (s) { return s.flags.seaKing ? "The Salt Crown" : "The Prince Who Lived"; },
      art: "nassau",
      text: [
        function (s) {
          return s.flags.seaKing
            ? '<p>Your commonwealth of the sea lasts three glorious, impossible years — a floating republic of free sailors that no navy can quite corner and no governor dares say out loud. It ends the way sea-things end: not in battle, but in weather, and scattering, and time. But it <em>existed</em>, and no king can un-exist it. You grow old under other flags, wearing a crown of salt that nobody can see and nobody can take.</p>'
            : '<p>You are the pirate who was too smart to sail into a nor\'easter — and so you get the one thing history almost never hands a pirate: <em>old age</em>. You rule the warm sea-lanes for years, sharing the plunder, sparing the captured, feared by every governor and secretly cheered by every underpaid sailor from Havana to the Guinea coast.</p>';
        },
        '<p>But legends are cold company on a warm night. You never keep the promise you did or didn\'t make. You never walk back up that bluff to the orchard. And when you\'re finally old and gray and rich beyond counting, you understand at last that the one treasure you actually wanted was the one you left on a cold gray coast — and never went back for.</p>',
        function (s) {
          return s.flags.goatAboard
            ? '<p>Bartholomew the goat, by the way, outlives three ships and grows so fat and famous that sailors from Tortuga to Madagascar swear he\'s good luck. He never does give the hat back.</p>'
            : '';
        }
      ],
      epilogue: '<p><strong>What really happened:</strong> The real Bellamy wasn\'t so cautious — or so lucky. He sailed north, and the Whydah sank off Wellfleet on 26 April 1717, taking him and nearly all his crew. He was about 28. In roughly one year as a captain he had taken more than 50 ships, which by some counts makes him the richest pirate who ever lived. The wreck was found by <strong>Barry Clifford in 1984</strong> — the only proven pirate shipwreck in the world.</p>'
    },

    ending_pardon: {
      chapter: "New Providence · 1717",
      ending: true, badge: "The King's Mercy",
      title: "A Clean Slate",
      art: "map",
      text: [
        '<p>You take the pardon. It\'s a strange little ceremony — a king\'s officer in a sweaty wig reading Latin at a beach full of pirates, and then, just like that, it\'s done: Samuel Bellamy, honest subject of the Crown, slate wiped clean. A few of the toughest men actually cry. Teach doesn\'t take the pardon; he sails off north with a look in his eye, and the world will hear from <em>him</em> later.</p>',
        '<p>You buy a tidy little trading sloop with honest-ish paperwork and work the islands the legal way. It\'s smaller. It\'s slower. Nobody writes songs about it. But every year or so, news arrives of another old shipmate who danced his last jig at the end of a rope, and you pour a cup out on the sand and thank your own good sense. Most nights, that feels like wisdom. On a few nights, with the wind in the palms, it feels like something else.</p>',
        '<p>The Admiral retires with you. He sits on the rail of your law-abiding little sloop, year after year, and makes it clear that he is unimpressed by honest commerce too. Some things are bigger than any of us.</p>'
      ],
      epilogue: '<p><strong>What really happened:</strong> The King\'s pardon for pirates — the Act of Grace — was real, but it came in <strong>September 1717</strong>, months after the real Bellamy drowned. Hundreds of Nassau pirates took it in 1718, including old Hornigold. Edward Teach — <strong>Blackbeard</strong> — took it too, went right back to piracy, and was killed in battle in 1718. The real Bellamy never got the choice this ending gives you.</p>'
    },

    ending_mutiny: {
      chapter: "Aboard the Whydah · 1717",
      ending: true, badge: "The Articles Cut Both Ways",
      title: "Voted Out",
      art: "nassau",
      text: [
        function (s) {
          return s.flags.foughtMutiny
            ? '<p>You reach for your pistols — and it\'s only because they loved you once that this ends with you in a rowboat instead of somewhere worse. They set you ashore on a pleasant green island with a musket, a barrel of water, and a copy of the Articles you wrote yourself, folded neatly on top of your sea-chest like a receipt.</p>'
            : '<p>You step down the way the Articles require, and because you do it with your chin up, the crew gives you a fair share, a sound little boat, and three loyal volunteers who\'d rather follow a voted-out prince than a brand-new committee. The Whydah — <em>your</em> Whydah — fills her sails and grows small against the northern horizon without you.</p>';
        },
        function (s) {
          return s.flags.goatAboard
            ? '<p>Bartholomew the goat, offered the choice of a doomed flagship or a leaky rowboat with you, chose you. It is the single most flattering thing that has ever happened to you, and you decide not to examine it too closely.</p>'
            : '';
        },
        '<p>Months later, you hear what the sea did to her off Cape Cod — to the ship, and to the crew that took her from you. You spend the rest of a long, strange life never quite deciding whether that vote was the worst thing that ever happened to you, or the only reason you got to have a long, strange life at all.</p>'
      ],
      epilogue: '<p><strong>What really happened:</strong> Pirate crews really did fire their captains by vote — it was the heart of pirate democracy, and it happened to famous captains like Charles Vane, whose crew replaced him with "Calico Jack" Rackham in 1718. Bellamy himself became captain exactly this way, when Hornigold\'s crew got tired of his rules. The Articles cut both ways. In this telling, they cut you — and saved your life doing it.</p>'
    },

    ending_farmer: {
      chapter: "Cape Cod · after 1716",
      ending: true, badge: "The Quiet Life",
      title: "A Landsman's Grave",
      art: "farm",
      text: [
        function (s) {
          return s.flags.foundSilver
            ? '<p>You walk away from the black flag with a bundle of Spanish silver over your shoulder — enough to buy stony land, a sound roof, and a future. You go home to the Cape, marry, and wear your hands out on fences instead of rigging: a farmer of modest, slightly mysterious wealth, about whom the neighbors politely wonder.</p>'
            : '<p>You walk away from the whole mad business before it can walk you up a gallows. You go home to the Cape, marry, and wear your hands out on stony fields instead of rigging, and you grow old among people who never once had a reason to fear your name.</p>';
        },
        '<p>Sometimes, mending a fence in a spring gale, you catch the smell of deep ocean on the wind and just stand there a while, remembering a goldsmith\'s chart and a moonlit beach in Florida. Then you go back to your fence. You die in a warm bed, on dry land, surrounded by family — which, when you do the arithmetic honestly, is no small treasure at all.</p>'
      ],
      epilogue: '<p><strong>What really happened:</strong> The real Samuel Bellamy didn\'t walk away. He became a pirate captain, took the Whydah in February 1717, and drowned when she wrecked off Cape Cod that April — one of the richest and shortest careers in pirate history. His story survives because <strong>Barry Clifford found the wreck in 1984</strong>. Yours, in this version, survives only in a quiet churchyard near the sea. There are worse places.</p>'
    },

    ending_honest: {
      chapter: "The Merchant Trade · after 1715",
      ending: true, badge: "The Honest Road",
      title: "A Longer Neck",
      art: "farm",
      text: [
        function (s) {
          return s.flags.reportedPlot
            ? '<p>The ship\'s owners remember the sailor who saved their ship. One good job leads to a better one, and a better one after that, until one day you\'re standing on your own little quarterdeck while your own first mate touches his hat to you. No fortune. No fleet. No black flag snapping overhead — and no iron cage waiting at the harbor mouth with your name on it, either.</p>'
            : '<p>You keep your name out of the pirate ledgers. You survive the biscuits (barely — one of them chips a tooth), save your small pay coin by coin, and eventually buy a share in an honest little ship. No fortune. No fleet. No black flag snapping overhead — and no iron cage waiting at the harbor mouth with your name on it, either.</p>';
        },
        '<p>You live a long time. And one afternoon, in a tavern, you overhear the story of a pirate called Black Sam Bellamy — a name that might have been yours — who drowned young and rich off Cape Cod with a shipload of gold. You sit very still for a moment. Then you order another mug of cider, and you are quietly, deeply glad it wasn\'t you.</p>'
      ],
      epilogue: '<p><strong>What really happened:</strong> Most of the sailors who joined Bellamy did not choose your caution — and about 145 of them went down with the Whydah off Wellfleet on 26 April 1717. The handful who reached shore were put on trial in Boston. The wreck was rediscovered by <strong>Barry Clifford in 1984</strong>, the only pirate shipwreck ever proven to be real.</p>'
    }

  }
};

/*
 * storm_resolve — decide the shipwreck outcome from the player's whole record.
 *
 * Inputs:
 *  - state.scores.helm  : 0–100 performance at the storm mini-game
 *                         (absent if the wheel was lashed — treated as 35)
 *  - flags.julianFriend : the pilot stands beside you at the wheel
 *  - flags.promisedMaria + renown : feeds the Sea Witch legend
 *  - flags.sparedDavis / crew     : who will speak for you if you live
 *  - flags.stormShore + renown    : the beach-legend variant
 */
function storm_resolve(state) {
  var helm = (state.scores && typeof state.scores.helm === "number") ? state.scores.helm : 35;
  var renown = state.stats.renown;
  var crew = state.stats.crew;
  var f = state.flags;

  // A near-perfect run with the pilot at your shoulder threads the bars.
  if (helm >= 85 && f.julianFriend) return "ending_pilot";

  // The legend ending: a richly-earned reputation + the promise to Maria.
  if (renown >= 8 && f.promisedMaria) return "ending_legend";

  // A strong run gets you ashore alive — what happens next depends on
  // who will stand up for you, and how many friends you still have.
  if (helm >= 60) {
    return (f.sparedDavis || crew >= 7) ? "ending_survivor" : "ending_gallows";
  }

  // A famed captain who ran for shore becomes the beach-legend too.
  if (f.stormShore && renown >= 9) return "ending_legend";

  // Otherwise: the sea keeps her prince, as she did in 1717.
  return "ending_wreck";
}
