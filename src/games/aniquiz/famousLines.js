// Famous Lines — the hand-curated quote list behind AniQuiz's "Famous Lines"
// topic. No data source the arcade uses has quotes (not AniList, not the fact
// pack's outside sources), so this file IS the data. Hand-edited; clues.js
// turns each entry into up to three clues (finish it, who said it, which show).
//
// Bundled with AniQuiz's own lazy chunk rather than shipped beside the fact
// pack: it is a few dozen KB that only AniQuiz parses, the chunk is precached
// for offline play like any other, and a correction is an ordinary deploy.
//
// The rules every entry follows, because each one is a way a clue would lie:
//
// - **No spoilers.** No deaths, betrayals, twist reveals or last words — a
//   board is played by people partway through things. A line from a scene
//   that IS the premise (episode one, an opening narration) is fine.
// - **Only lines the fandom actually quotes,** in the English most people
//   know (the widest-known sub or dub wording). Romaji only where fans quote
//   the Japanese itself ("Yare yare daze", "Ki ni narimasu").
// - **Only lines whose wording and speaker are certain.** A misremembered
//   line marks a player who knows the show wrong. When in doubt it is left
//   out — the list is short on purpose, not by accident.
//
// Fields:
//
//   show     the show's title exactly as the fact pack spells it. The pack's
//            fold (franchiseTitleKey) is the key, so "Dragon Ball" also covers
//            a profile listing Dragon Ball Z. A line from a show the pack lacks
//            can never be in play; clues.test.js fails it.
//   also     other pack shows the line is also from (the same scene in a
//            remake), accepted by "which show is this from?".
//   by       the speaker, spelt as the pack spells them ("Tanjirou Kamado",
//            "Luffy Monkey" — AniList's romanization and order), for two
//            reasons: a "who said it?" option list is the show's pack cast, so
//            a speaker spelt any other way could appear beside themselves as a
//            wrong option, and an answer in a different romanization from the
//            three options around it is a tell. Absent for a narration, a
//            title card or a line several characters share: those make no
//            "who said it?" clue. A speaker the pack does not list at all
//            (Rock Lee, Zeniba) keeps the usual spelling.
//   pack     the pack's name for the speaker when it is a different NAME, not
//            a spelling — All Might is "Toshinori Yagi" there. The options
//            show `by`; the pack name is kept out of them and accepted typed.
//   aka      other names a typed "who said it?" accepts (Luffy, Kakashi, the
//            familiar spellings). Either order of any name is accepted anyway.
//   line     the line, with the part a "finish it" clue blanks in [brackets].
//            Exactly one blank, usually the end.
//   decoys   three wrong endings for multiple choice — plausible in the
//            character's voice, never a paraphrase of the real one (a decoy
//            that means the same thing is a second right answer marked wrong).
//   fame     1 = anyone who has seen the show knows it, 2 = fans know it,
//            3 = deep cut. Half of a line's price; the show's obscurity in the
//            pool is the other half.
//   noShow   true when the line gives its own show away ("Pikachu, I choose
//            you!"). clues.js also catches a title word or the speaker's name
//            in the line by itself; this is for the tells it cannot see.
export const FAMOUS_LINES = [
  // ── Naruto ──
  {
    show: 'Naruto',
    by: 'Naruto Uzumaki',
    aka: ['Naruto'],
    line: 'I’m not gonna run away, and I never go back on my word! That’s [my nindo: my ninja way]!',
    decoys: ['the will of fire', 'what makes a Hokage', 'the promise of a lifetime'],
    fame: 1,
  },
  {
    show: 'Naruto',
    by: 'Naruto Uzumaki',
    aka: ['Naruto'],
    line: 'I’m gonna be Hokage someday. [Believe it]!',
    decoys: ['Just you watch', 'Mark my words', 'You’ll see'],
    fame: 1,
  },
  {
    show: 'Naruto',
    by: 'Kakashi Hatake',
    aka: ['Kakashi'],
    line: 'In the ninja world, those who break the rules are scum, but those who abandon their friends are [worse than scum].',
    decoys: ['no ninja at all', 'already dead to me', 'the lowest of all'],
    fame: 1,
  },
  {
    show: 'Naruto',
    by: 'Kakashi Hatake',
    aka: ['Kakashi'],
    line: 'Things I like and things I hate? [I don’t feel like telling you that].',
    decoys: ['Reading and losing', 'Too many to count', 'You’ll find out soon enough'],
    fame: 2,
  },
  {
    show: 'Naruto',
    by: 'Sasuke Uchiha',
    aka: ['Sasuke'],
    line: 'What I have is not a dream, because I will make it [a reality].',
    decoys: ['my revenge', 'my mission', 'a promise'],
    fame: 2,
  },
  {
    show: 'Naruto',
    by: 'Rock Lee',
    line: 'A dropout will beat a genius [through hard work]!',
    decoys: ['with a single punch', 'when the genius gets lazy', 'once in a lifetime'],
    fame: 2,
  },
  {
    show: 'Naruto',
    by: 'Shikamaru Nara',
    aka: ['Shikamaru'],
    line: 'What a [drag].',
    decoys: ['pain', 'bore', 'mess'],
    fame: 1,
  },
  {
    show: 'Naruto',
    by: 'Pain',
    line: 'Feel pain. Contemplate pain. Accept pain. [Know pain].',
    decoys: ['Become pain', 'Share pain', 'Fear pain'],
    fame: 1,
  },
  {
    show: 'Naruto',
    by: 'Might Guy',
    aka: ['Guy', 'Might Gai'],
    line: 'Ah, the springtime of [youth]!',
    decoys: ['life', 'love', 'friendship'],
    fame: 1,
  },

  // ── ONE PIECE ──
  {
    show: 'ONE PIECE',
    by: 'Luffy Monkey',
    aka: ['Monkey D. Luffy', 'Luffy', 'Monkey D Luffy'],
    line: 'I’m gonna be [King of the Pirates]!',
    decoys: ['the strongest man in the world', 'a Marine admiral', 'the world’s greatest swordsman'],
    fame: 1,
  },
  {
    show: 'ONE PIECE',
    by: 'Zoro Roronoa',
    aka: ['Roronoa Zoro', 'Zoro'],
    line: 'I’m going to become [the world’s greatest swordsman]!',
    decoys: ['the King of the Pirates', 'a brave warrior of the sea', 'the man who finds the All Blue'],
    fame: 1,
  },
  {
    show: 'ONE PIECE',
    by: 'Gol D. Roger',
    aka: ['Gol D Roger', 'Gold Roger'],
    line: 'My treasure? If you want it, I’ll let you have it. Look for it! I left all of it at [that place]!',
    decoys: ['the bottom of the sea', 'the end of the world', 'the top of the Red Line'],
    fame: 1,
  },
  {
    show: 'ONE PIECE',
    by: 'Shanks',
    line: 'It’s just an arm. I bet [this arm] on the new era.',
    decoys: ['my hat', 'my ship', 'my life'],
    fame: 2,
  },

  // ── Attack on Titan ──
  {
    show: 'Attack on Titan',
    by: 'Eren Yeager',
    aka: ['Eren', 'Eren Jaeger'],
    line: 'If you win, you live. If you lose, you die. If you don’t fight, [you can’t win]!',
    decoys: ['you’re already dead', 'you never lose', 'you can’t live'],
    fame: 1,
  },
  {
    show: 'Attack on Titan',
    by: 'Levi',
    aka: ['Levi Ackerman'],
    line: 'The only thing we’re allowed to do is believe that we [won’t regret the choice we made].',
    decoys: ['will live to see the walls fall', 'are stronger than the Titans', 'made the only choice we had'],
    fame: 2,
  },
  {
    show: 'Attack on Titan',
    by: 'Armin Arlert',
    aka: ['Armin'],
    line: 'Someone who can’t sacrifice anything [can never change anything].',
    decoys: ['can never protect anything', 'will never be free', 'has already lost'],
    fame: 2,
  },
  {
    show: 'Attack on Titan',
    line: 'On that day, humanity received a grim reminder. We lived in fear of the Titans and were disgraced to live [in these cages we called walls].',
    decoys: ['as cattle waiting for slaughter', 'without ever seeing the sea', 'in the shadow of our own fear'],
    fame: 1,
  },

  // ── Demon Slayer ──
  {
    show: 'Demon Slayer: Kimetsu no Yaiba',
    by: 'Tanjirou Kamado',
    aka: ['Tanjiro Kamado', 'Tanjiro'],
    line: 'I’ll definitely turn Nezuko back [into a human]!',
    decoys: ['into a Demon Slayer', 'into her old self before nightfall', 'home to the mountain'],
    fame: 1,
    noShow: true,
  },
  {
    show: 'Demon Slayer: Kimetsu no Yaiba',
    by: 'Zenitsu Agatsuma',
    aka: ['Zenitsu'],
    line: 'Thunder Breathing, First Form: [Thunderclap and Flash]!',
    decoys: ['Rice Spirit', 'Heat Lightning', 'Distant Thunder'],
    fame: 1,
  },
  {
    show: 'Demon Slayer: Kimetsu no Yaiba',
    by: 'Giyuu Tomioka',
    aka: ['Giyu Tomioka', 'Giyu'],
    line: 'Water Breathing, Eleventh Form: [Dead Calm].',
    decoys: ['Constant Flux', 'Whirlpool', 'Waterfall Basin'],
    fame: 2,
  },

  // ── JUJUTSU KAISEN ──
  {
    show: 'JUJUTSU KAISEN',
    by: 'Satoru Gojou',
    aka: ['Satoru Gojo', 'Gojo', 'Gojo Satoru'],
    line: 'Throughout heaven and earth, I alone am [the honored one].',
    decoys: ['the strongest', 'the chosen one', 'the last sorcerer'],
    fame: 1,
  },
  {
    show: 'JUJUTSU KAISEN',
    by: 'Satoru Gojou',
    aka: ['Satoru Gojo', 'Gojo', 'Gojo Satoru'],
    line: 'Domain Expansion: [Infinite Void].',
    decoys: ['Malevolent Shrine', 'Chimera Shadow Garden', 'Coffin of the Iron Mountain'],
    fame: 1,
  },

  // ── Death Note ──
  {
    show: 'Death Note',
    by: 'Light Yagami',
    aka: ['Light'],
    line: 'I’ll take a potato chip... [and eat it]!',
    decoys: ['and crush it', 'and write it down', 'and win'],
    fame: 1,
  },
  {
    show: 'Death Note',
    by: 'Light Yagami',
    aka: ['Light'],
    line: 'I will become the god of [the new world].',
    decoys: ['death', 'justice', 'this rotten world'],
    fame: 1,
  },
  {
    show: 'Death Note',
    by: 'Ryuk',
    line: 'Humans are so [interesting].',
    decoys: ['boring', 'fragile', 'predictable'],
    fame: 1,
  },

  // ── My Hero Academia ──
  {
    show: 'My Hero Academia',
    by: 'All Might',
    pack: 'Toshinori Yagi',
    aka: ['Toshinori Yagi'],
    line: 'It’s fine now. Why? Because [I am here]!',
    decoys: ['I’m a hero', 'you’re safe', 'we go beyond'],
    fame: 1,
  },
  {
    show: 'My Hero Academia',
    by: 'All Might',
    pack: 'Toshinori Yagi',
    aka: ['Toshinori Yagi'],
    line: 'Go beyond! [Plus Ultra]!',
    decoys: ['Never give up', 'Smash it', 'One For All'],
    fame: 1,
  },
  {
    show: 'My Hero Academia',
    by: 'All Might',
    pack: 'Toshinori Yagi',
    aka: ['Toshinori Yagi'],
    line: 'Young man... you can [become a hero].',
    decoys: ['become the strongest', 'save them all', 'stand on your own'],
    fame: 1,
  },

  // ── Hunter x Hunter (2011) ──
  {
    show: 'Hunter x Hunter (2011)',
    by: 'Hisoka Morow',
    aka: ['Hisoka'],
    line: 'Bungee Gum possesses the properties of both [rubber and gum].',
    decoys: ['steel and silk', 'glue and rope', 'candy and string'],
    fame: 1,
  },
  {
    show: 'Hunter x Hunter (2011)',
    by: 'Ging Freecss',
    aka: ['Ging'],
    line: 'You should enjoy the little detours to the fullest. Because that’s where you’ll find [the things more important than what you want].',
    decoys: ['the treasure you were really after', 'the friends who will carry you', 'the strength you didn’t know you had'],
    fame: 2,
  },

  // ── One-Punch Man ──
  {
    show: 'One-Punch Man',
    by: 'Saitama',
    line: 'I’m just a guy who’s a hero [for fun].',
    decoys: ['for money', 'on weekends', 'by accident'],
    fame: 1,
  },
  {
    show: 'One-Punch Man',
    by: 'Saitama',
    line: '100 push-ups, 100 sit-ups, 100 squats, and a [10-kilometer run]. Every single day!',
    decoys: ['100-kilometer run', '10-kilometer swim', '1-kilometer sprint'],
    fame: 1,
  },

  // ── Tokyo Ghoul ──
  {
    show: 'Tokyo Ghoul',
    by: 'Ken Kaneki',
    aka: ['Kaneki'],
    line: 'If I were to write a story with me in the lead role, it would certainly be... [a tragedy].',
    decoys: ['a comedy', 'a love story', 'a mystery'],
    fame: 1,
  },
  {
    show: 'Tokyo Ghoul',
    by: 'Yamori',
    aka: ['Jason'],
    line: 'What’s 1000 [minus 7]?',
    decoys: ['minus 13', 'divided by 7', 'times 7'],
    fame: 1,
  },

  // ── Fullmetal Alchemist ──
  {
    show: 'Fullmetal Alchemist',
    also: ['Fullmetal Alchemist: Brotherhood'],
    line: 'Humankind cannot gain anything without first giving something in return. To obtain, something of [equal value must be lost].',
    decoys: ['greater value must be given', 'your own soul must be paid', 'the same weight must be returned'],
    fame: 1,
  },
  {
    show: 'Fullmetal Alchemist: Brotherhood',
    by: 'Edward Elric',
    aka: ['Edward', 'Ed', 'Ed Elric'],
    line: 'A lesson without pain is [meaningless].',
    decoys: ['no lesson at all', 'soon forgotten', 'a gift'],
    fame: 1,
  },
  {
    show: 'Fullmetal Alchemist: Brotherhood',
    also: ['Fullmetal Alchemist'],
    by: 'Edward Elric',
    aka: ['Edward', 'Ed', 'Ed Elric'],
    line: 'Stand up and walk. Keep moving forward. You’ve got [two good legs].',
    decoys: ['a whole life ahead of you', 'people waiting for you', 'nothing left to lose'],
    fame: 2,
  },

  // ── Sword Art Online ──
  {
    show: 'Sword Art Online',
    by: 'Akihiko Kayaba',
    aka: ['Kayaba'],
    line: 'This may be a game, but it is [not something you play].',
    decoys: ['the only world you have left', 'a fight to the death', 'no longer a game'],
    fame: 2,
  },

  // ── Your Name. ──
  {
    show: 'Your Name.',
    by: 'Mitsuha Miyamizu',
    aka: ['Mitsuha'],
    line: 'Please make me [a handsome Tokyo boy] in my next life!',
    decoys: ['a famous idol in Tokyo', 'a cat in the big city', 'anyone but a shrine maiden'],
    fame: 1,
  },

  // ── HAIKYU!! ──
  {
    show: 'HAIKYU!!',
    by: 'Tobio Kageyama',
    aka: ['Kageyama'],
    line: 'As long as I’m here, [you’re invincible].',
    decoys: ['you’ll never fall', 'we can’t lose', 'the ball will always find you'],
    fame: 1,
  },

  // ── SPY x FAMILY ──
  {
    show: 'SPY x FAMILY',
    by: 'Anya Forger',
    aka: ['Anya'],
    line: 'Anya likes [peanuts]!',
    decoys: ['carrots', 'homework', 'broccoli'],
    fame: 1,
  },

  // ── Kaguya-sama: Love is War ──
  {
    show: 'Kaguya-sama: Love is War',
    by: 'Kaguya Shinomiya',
    aka: ['Kaguya'],
    line: 'Oh my... [how cute].',
    decoys: ['how pathetic', 'how bold', 'how foolish'],
    fame: 1,
  },

  // ── Dr. STONE ──
  {
    show: 'Dr. STONE',
    by: 'Senkuu Ishigami',
    aka: ['Senku Ishigami', 'Senku'],
    line: 'This is [exhilarating]!',
    decoys: ['elementary', 'unbelievable', 'a breakthrough'],
    fame: 1,
  },

  // ── Violet Evergarden ──
  {
    show: 'Violet Evergarden',
    by: 'Violet Evergarden',
    aka: ['Violet'],
    line: 'I want to know what [‘I love you’] means.',
    decoys: ['‘goodbye’', '‘thank you’', '‘freedom’'],
    fame: 1,
  },

  // ── Vinland Saga ──
  {
    show: 'Vinland Saga',
    by: 'Thors Snorresson',
    aka: ['Thors'],
    line: 'You have no enemies. No one in this world is your enemy. There is [no one you should hurt].',
    decoys: ['no one you can’t forgive', 'no war worth fighting', 'no one stronger than you'],
    fame: 1,
  },

  // ── No Game, No Life ──
  {
    show: 'No Game, No Life',
    by: 'Sora',
    line: 'Blank [never loses].',
    decoys: ['never quits', 'never plays fair', 'never forgives'],
    fame: 1,
  },

  // ── Code Geass ──
  {
    show: 'Code Geass: Lelouch of the Rebellion',
    by: 'Lelouch Lamperouge',
    aka: ['Lelouch', 'Lelouch vi Britannia'],
    line: 'The only ones who should kill are those who [are prepared to be killed].',
    decoys: ['have nothing left to lose', 'have already died once', 'fight for justice'],
    fame: 1,
  },
  {
    show: 'Code Geass: Lelouch of the Rebellion',
    by: 'Lelouch Lamperouge',
    aka: ['Lelouch', 'Lelouch vi Britannia'],
    line: 'If the king doesn’t lead, [how can he expect his subordinates to follow]?',
    decoys: ['who will protect the throne', 'he is no king at all', 'the kingdom will fall'],
    fame: 2,
  },

  // ── Neon Genesis Evangelion ──
  {
    show: 'Neon Genesis Evangelion',
    by: 'Shinji Ikari',
    aka: ['Shinji'],
    line: 'I mustn’t run away. I mustn’t run away. [I mustn’t run away].',
    decoys: ['I have to pilot it', 'I don’t want to die', 'I’m not a coward'],
    fame: 1,
  },

  // ── Frieren ──
  {
    show: 'Frieren: Beyond Journey’s End',
    by: 'Frieren',
    line: 'Because that’s what Himmel the Hero [would have done].',
    decoys: ['would never forgive', 'always told me to do', 'is still watching'],
    fame: 1,
    noShow: true,
  },

  // ── JoJo's Bizarre Adventure ──
  {
    show: 'JoJo\'s Bizarre Adventure (TV)',
    by: 'Dio Brando',
    aka: ['Dio'],
    line: 'You thought it was your opponent, but it was me, [Dio]!',
    decoys: ['Jotaro', 'Joseph', 'Kira'],
    fame: 1,
  },
  {
    show: 'JoJo\'s Bizarre Adventure (TV)',
    by: 'Dio Brando',
    aka: ['Dio'],
    line: 'Do you remember how many [loaves of bread you’ve eaten in your life]?',
    decoys: ['people you’ve stepped on to get here', 'times you’ve cried', 'stars there are in the sky'],
    fame: 1,
  },
  {
    show: 'JoJo\'s Bizarre Adventure (TV)',
    by: 'Joutarou Kuujou',
    aka: ['Jotaro Kujo', 'Jotaro'],
    line: 'Yare yare [daze].',
    decoys: ['dana', 'desu', 'zoi'],
    fame: 1,
  },
  {
    show: 'JoJo\'s Bizarre Adventure (TV)',
    by: 'Joseph Joestar',
    aka: ['Joseph'],
    line: 'The Joestar family’s secret technique... [run away]!',
    decoys: ['Hamon Overdrive', 'the Ripple', 'never give up'],
    fame: 2,
  },

  // ── Cowboy Bebop ──
  {
    show: 'Cowboy Bebop',
    by: 'Spike Spiegel',
    aka: ['Spike'],
    line: 'Whatever happens, [happens].',
    decoys: ['I’ll deal with it', 'we’ll see', 'it was meant to be'],
    fame: 1,
  },
  {
    show: 'Cowboy Bebop',
    line: 'See you, [space cowboy]...',
    decoys: ['Spike Spiegel', 'star traveler', 'Bebop'],
    fame: 1,
  },
  {
    show: 'Cowboy Bebop',
    by: 'Spike Spiegel',
    aka: ['Spike'],
    line: 'I’m not going there to die. I’m going to find out [if I’m really alive].',
    decoys: ['who I really am', 'if she’s still waiting', 'what I left behind'],
    fame: 2,
  },

  // ── Gurren Lagann ──
  {
    show: 'Gurren Lagann',
    by: 'Kamina',
    line: 'Don’t believe in yourself. Believe in me! Believe in the me [who believes in you]!',
    decoys: ['who never gives up', 'who pierces the heavens', 'who fights beside you'],
    fame: 1,
  },
  {
    show: 'Gurren Lagann',
    by: 'Simon',
    line: 'My drill is the drill that will [pierce the heavens]!',
    decoys: ['break the earth', 'save the world', 'dig to the core'],
    fame: 1,
  },

  // ── Kill la Kill ──
  {
    show: 'Kill la Kill',
    by: 'Satsuki Kiryuuin',
    aka: ['Satsuki Kiryuin', 'Satsuki'],
    line: 'Fear is freedom! Subjugation is liberation! Contradiction is [truth]!',
    decoys: ['strength', 'order', 'life'],
    fame: 2,
  },

  // ── Bleach ──
  {
    show: 'Bleach',
    by: 'Ichigo Kurosaki',
    aka: ['Ichigo'],
    line: 'Bankai: [Tensa Zangetsu]!',
    decoys: ['Senbonzakura Kageyoshi', 'Daiguren Hyorinmaru', 'Hihio Zabimaru'],
    fame: 1,
  },

  // ── Black Clover ──
  {
    show: 'Black Clover',
    by: 'Asta',
    line: 'Not giving up... is [my magic]!',
    decoys: ['my strength', 'my destiny', 'my promise'],
    fame: 1,
  },
  {
    show: 'Black Clover',
    by: 'Asta',
    line: 'I’m gonna become [the Wizard King]!',
    decoys: ['a Magic Knight captain', 'the strongest swordsman', 'a royal knight'],
    fame: 1,
  },

  // ── Fairy Tail ──
  {
    show: 'Fairy Tail',
    by: 'Natsu Dragneel',
    aka: ['Natsu'],
    line: 'I’m all [fired up] now!',
    decoys: ['worn out', 'warmed up', 'burned out'],
    fame: 1,
  },

  // ── KONOSUBA ──
  {
    show: 'KONOSUBA -God\'s blessing on this wonderful world!',
    by: 'Megumin',
    line: 'My name is Megumin! An Arch Wizard who wields [explosion magic]!',
    decoys: ['ice magic', 'healing magic', 'dark magic'],
    fame: 1,
  },

  // ── Black Butler ──
  {
    show: 'Black Butler',
    by: 'Sebastian Michaelis',
    aka: ['Sebastian'],
    line: 'I’m simply [one hell of a butler].',
    decoys: ['an ordinary servant', 'your humble steward', 'the young master’s shadow'],
    fame: 1,
  },

  // ── The Eminence in Shadow ──
  {
    show: 'The Eminence in Shadow',
    by: 'Cid Kagenou',
    aka: ['Cid', 'Shadow'],
    line: 'I... am... [atomic].',
    decoys: ['Shadow', 'the end', 'darkness'],
    fame: 1,
  },

  // ── Gintama ──
  {
    show: 'Gintama',
    by: 'Kotarou Katsura',
    aka: ['Kotaro Katsura', 'Katsura'],
    line: 'It’s not Zura, it’s [Katsura]!',
    decoys: ['Captain Katsura', 'Elizabeth', 'the Joui Patriot'],
    fame: 1,
  },

  // ── Komi Can't Communicate ──
  {
    show: 'Komi Can’t Communicate',
    by: 'Shouko Komi',
    aka: ['Shoko Komi', 'Komi'],
    line: 'My dream is to make [a hundred friends].',
    decoys: ['one true friend', 'a thousand friends', 'it through a whole conversation'],
    fame: 1,
  },

  // ── Hyouka ──
  {
    show: 'Hyouka',
    by: 'Houtarou Oreki',
    aka: ['Oreki', 'Hotaro Oreki'],
    line: 'If I don’t have to do it, I won’t. If I have to do it, [I’ll make it quick].',
    decoys: ['I’ll do it tomorrow', 'someone else will', 'I’ll do it right'],
    fame: 1,
  },
  {
    show: 'Hyouka',
    by: 'Eru Chitanda',
    aka: ['Chitanda'],
    line: 'Watashi, [ki ni narimasu]!',
    decoys: ['ki ni shimasen', 'wakarimasen', 'ganbarimasu'],
    fame: 2,
  },

  // ── My Teen Romantic Comedy SNAFU ──
  {
    show: 'My Teen Romantic Comedy SNAFU',
    by: 'Hachiman Hikigaya',
    aka: ['Hachiman', 'Hikigaya'],
    line: 'Youth is a lie. [It is evil].',
    decoys: ['It is a game', 'It is a crime', 'It is wasted on the young'],
    fame: 2,
  },

  // ── Love, Chunibyo & Other Delusions ──
  {
    show: 'Love, Chunibyo & Other Delusions',
    by: 'Rikka Takanashi',
    aka: ['Rikka'],
    line: 'Explode, synapse! [Vanishment, this world]!',
    decoys: ['Darkness, consume me', 'Tyrant’s Eye, awaken', 'Dark Flame Master, rise'],
    fame: 2,
  },

  // ── The Melancholy of Haruhi Suzumiya ──
  {
    show: 'The Melancholy of Haruhi Suzumiya',
    by: 'Haruhi Suzumiya',
    aka: ['Haruhi'],
    line: 'I have no interest in ordinary humans. If there are any aliens, time travelers, sliders or espers here, [come join me]!',
    decoys: ['step forward', 'I’ll find you', 'speak up now'],
    fame: 1,
  },

  // ── Bakemonogatari ──
  {
    show: 'Bakemonogatari',
    by: 'Tsubasa Hanekawa',
    aka: ['Hanekawa'],
    line: 'I don’t know everything. [I just know what I know].',
    decoys: ['I just pretend to', 'I only know about you', 'Nobody does'],
    fame: 1,
  },

  // ── Puella Magi Madoka Magica ──
  {
    show: 'Puella Magi Madoka Magica',
    by: 'Kyuubey',
    aka: ['Kyubey'],
    line: 'Make a contract with me and [become a magical girl]!',
    decoys: ['save the world', 'live forever', 'never be lonely again'],
    fame: 1,
  },

  // ── Fate/stay night ──
  {
    show: 'Fate/stay night',
    by: 'Archer',
    line: 'I am the bone of [my sword].',
    decoys: ['my blade', 'the earth', 'my soul'],
    fame: 1,
  },
  {
    show: 'Fate/stay night',
    by: 'Saber',
    pack: 'Artoria Pendragon',
    aka: ['Artoria Pendragon'],
    line: 'I ask of you, are you [my Master]?',
    decoys: ['my enemy', 'a Servant', 'the one I seek'],
    fame: 1,
  },

  // ── OSHI NO KO ──
  {
    show: 'OSHI NO KO',
    by: 'Ai Hoshino',
    aka: ['Ai'],
    line: 'To me, lies are [love].',
    decoys: ['armor', 'my job', 'everything'],
    fame: 2,
  },

  // ── Steins;Gate ──
  {
    show: 'Steins;Gate',
    by: 'Rintarou Okabe',
    aka: ['Rintaro Okabe', 'Okabe', 'Hououin Kyouma', 'Kyouma Hououin'],
    line: 'It is the choice of Steins Gate. [El Psy Kongroo].',
    decoys: ['Operation Skuld', 'Tutturu', 'Mwahahaha'],
    fame: 1,
  },

  // ── Kuroko's Basketball ──
  {
    show: 'Kuroko\'s Basketball',
    by: 'Tetsuya Kuroko',
    aka: ['Kuroko'],
    line: 'I am a shadow. But the stronger the light, [the darker the shadow].',
    decoys: ['the brighter the court', 'the harder I fall', 'the less they see me'],
    fame: 2,
  },

  // ── Hajime no Ippo ──
  {
    show: 'Hajime no Ippo: The Fighting!',
    by: 'Ippo Makunouchi',
    aka: ['Ippo'],
    line: 'I want to know what it means to be [strong].',
    decoys: ['a champion', 'free', 'a man'],
    fame: 2,
  },

  // ── Pokémon ──
  {
    show: 'Pokémon',
    line: 'Prepare for trouble! And make it [double]!',
    decoys: ['triple', 'quick', 'worse'],
    fame: 1,
  },
  {
    show: 'Pokémon',
    by: 'Satoshi',
    aka: ['Ash Ketchum', 'Ash'],
    line: 'Pikachu, [I choose you]!',
    decoys: ['come back', 'let’s go home', 'use Thunderbolt'],
    fame: 1,
    noShow: true,
  },

  // ── Dragon Ball ──
  {
    show: 'Dragon Ball',
    by: 'Vegeta',
    line: 'It’s over [nine thousand]!',
    decoys: ['ten thousand', 'a million', 'a hundred thousand'],
    fame: 1,
  },

  // ── Sailor Moon ──
  {
    show: 'Sailor Moon',
    by: 'Usagi Tsukino',
    aka: ['Usagi', 'Serena'],
    line: 'In the name of the Moon, [I’ll punish you]!',
    decoys: ['I’ll protect you', 'you’re finished', 'I’ll heal you'],
    fame: 1,
  },

  // ── Detective Conan ──
  {
    show: 'Detective Conan',
    by: 'Conan Edogawa',
    aka: ['Conan'],
    line: 'There is always only [one truth]!',
    decoys: ['one culprit', 'one way out', 'one witness'],
    fame: 1,
  },

  // ── InuYasha ──
  {
    show: 'InuYasha',
    by: 'Kagome Higurashi',
    aka: ['Kagome'],
    line: '[Sit], boy!',
    decoys: ['Stay', 'Heel', 'Down'],
    fame: 1,
  },

  // ── Trigun ──
  {
    show: 'Trigun',
    by: 'Vash the Stampede',
    aka: ['Vash'],
    line: 'Love and [peace]!',
    decoys: ['war', 'money', 'donuts'],
    fame: 1,
  },

  // ── Spice and Wolf ──
  {
    show: 'Spice and Wolf',
    by: 'Holo',
    line: 'I am Holo [the Wisewolf]!',
    decoys: ['the Moon Hunter', 'the Silver Fang', 'the Wolf Queen'],
    fame: 2,
  },

  // ── Serial Experiments Lain ──
  {
    show: 'Serial Experiments Lain',
    by: 'Lain Iwakura',
    aka: ['Lain'],
    line: 'No matter where you go, [everyone’s connected].',
    decoys: ['you’re never alone', 'the Wired follows', 'someone is watching'],
    fame: 2,
  },

  // ── Ghost in the Shell ──
  {
    show: 'Ghost in the Shell',
    by: 'Motoko Kusanagi',
    aka: ['Motoko', 'The Major', 'Major Kusanagi'],
    line: 'And where does the newborn go from here? The net is [vast and infinite].',
    decoys: ['dark and cold', 'silent and empty', 'a sea of souls'],
    fame: 2,
  },

  // ── Studio Ghibli and the films ──
  {
    show: 'Spirited Away',
    by: 'Zeniba',
    line: 'Once you’ve met someone, you never really forget them. It just takes a while for [your memories to return].',
    decoys: ['you to remember their name', 'the feeling to fade', 'them to find you again'],
    fame: 2,
  },
  {
    show: 'Princess Mononoke',
    by: 'Ashitaka',
    line: 'I came to see with eyes [unclouded by hate].',
    decoys: ['that can see the forest spirits', 'wide open', 'of a child'],
    fame: 2,
  },
  {
    show: 'Howl‘s Moving Castle',
    by: 'Howl',
    line: 'I see no point in living if [I can’t be beautiful].',
    decoys: ['I can’t fly', 'I can’t be free', 'I can’t love'],
    fame: 2,
  },
  {
    show: 'Ponyo',
    by: 'Ponyo',
    line: 'Ponyo loves [Sosuke]!',
    decoys: ['the sea', 'goldfish', 'the moon'],
    fame: 1,
  },
  {
    show: 'Grave of the Fireflies',
    by: 'Seita',
    line: 'September 21st, 1945... that was [the night I died].',
    decoys: ['the night the war ended', 'the last night I saw her', 'the night the city burned'],
    fame: 2,
  },
  {
    show: '5 Centimeters per Second',
    by: 'Akari Shinohara',
    aka: ['Akari'],
    line: 'They say the speed at which cherry blossom petals fall is [five centimeters per second].',
    decoys: ['ten meters per minute', 'one inch per second', 'the speed of a heartbeat'],
    fame: 1,
  },
  {
    show: 'The Girl Who Leapt Through Time',
    line: 'Time waits for [no one].',
    decoys: ['the brave', 'those who wait', 'tomorrow'],
    fame: 2,
  },
];
