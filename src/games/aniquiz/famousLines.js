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
//   out — the list is short on purpose, not by accident. Every line has been
//   checked against Wikiquote's episode-cited pages or several independent
//   sources (2026-11-09): a close match was corrected to the sourced wording,
//   a line no source has was removed, and a speaker the sources disagree on
//   was dropped (the line stays, with no "who said it?"). A new line gets the
//   same check before it goes in.
// - **The blank is the part every translation shares.** Sub and dub differ
//   around it ("I expect 'yes' or 'woof'" / "only 'yes' or 'woof'"), so the
//   blank goes on the words that do not move ('woof').
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
    line: 'I never give up. I never go back on my word. That’s [my ninja way]!',
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
    line: 'The springtime of [youth] has yet to fade away!',
    decoys: ['life', 'love', 'friendship'],
    fame: 1,
  },
  {
    show: 'Naruto',
    by: 'Kakashi Hatake',
    aka: ['Kakashi'],
    line: 'A ninja must see [underneath the underneath].',
    decoys: ['through every illusion', 'with more than his eyes', 'the enemy before the enemy sees him'],
    fame: 1,
  },
  {
    show: 'Naruto',
    by: 'Haku',
    line: 'When a person has something precious that they want to protect, then [they become genuinely strong].',
    decoys: ['they can never lose', 'they become afraid', 'they stop being a tool'],
    fame: 2,
  },
  {
    show: 'Naruto',
    by: 'Hiruzen Sarutobi',
    aka: ['Hiruzen', 'Third Hokage', 'The Third Hokage'],
    line: 'Inside every ninja of the Hidden Leaf Village burns [the Will of Fire].',
    decoys: ['the spirit of youth', 'the pride of the clan', 'the Hokage’s promise'],
    fame: 1,
  },
  {
    show: 'Naruto',
    by: 'Rock Lee',
    line: 'Please be my girlfriend! [I vow to protect you with my life]!',
    decoys: ['I’ll train every day for you', 'I’ll beat Neji for you', 'The springtime of youth demands it'],
    fame: 2,
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
    line: 'My swords aim to be [the world’s greatest]. I refuse to lose to anyone who calls himself a swordsman.',
    decoys: ['feared by every pirate', 'sharper than the sea', 'the last thing you see'],
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
    line: 'This arm? I [bet] it on the new era.',
    decoys: ['lost', 'traded', 'sold'],
    fame: 2,
  },
  {
    show: 'ONE PIECE',
    by: 'Luffy Monkey',
    aka: ['Monkey D. Luffy', 'Luffy', 'Monkey D Luffy'],
    line: 'I don’t want to conquer anything. I just think the guy with the most freedom on this whole ocean is [the Pirate King]!',
    decoys: ['the strongest man alive', 'the one who finds the treasure', 'the luckiest man in the world'],
    fame: 2,
  },
  {
    show: 'ONE PIECE',
    by: 'Luffy Monkey',
    aka: ['Monkey D. Luffy', 'Luffy', 'Monkey D Luffy'],
    line: 'I decided long ago that I’m gonna be King of the Pirates. If I have to die fighting for that... [then I die]!',
    decoys: ['I’ll just get back up', 'that’s a promise', 'Shanks will understand'],
    fame: 2,
  },
  {
    show: 'ONE PIECE',
    by: 'Zoro Roronoa',
    aka: ['Roronoa Zoro', 'Zoro'],
    line: 'Scars on the back are [a swordsman’s shame].',
    decoys: ['proof of a long journey', 'a captain’s burden', 'nothing to fear'],
    fame: 1,
  },
  {
    show: 'ONE PIECE',
    by: 'Zoro Roronoa',
    aka: ['Roronoa Zoro', 'Zoro'],
    line: 'People can say whatever they want about me, but I’ve never done a single thing in my life [that I regret].',
    decoys: ['without my swords', 'for money', 'halfway'],
    fame: 2,
  },
  {
    show: 'ONE PIECE',
    by: 'Shanks',
    line: 'Guns aren’t for threats, [they’re for actions].',
    decoys: ['they’re for cowards', 'they’re for show', 'they’re for protecting friends'],
    fame: 2,
  },
  {
    show: 'ONE PIECE',
    by: 'Dr. Hiriluk',
    aka: ['Hiriluk', 'Dr Hiriluk'],
    line: 'A man... dies when [people forget him].',
    decoys: ['his heart stops', 'his dream ends', 'he stops fighting'],
    fame: 1,
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
    line: 'The only thing we’re allowed to believe is that we [won’t regret the choice we made].',
    decoys: ['will live to see the walls fall', 'are stronger than the Titans', 'made the only choice we had'],
    fame: 2,
  },
  {
    show: 'Attack on Titan',
    by: 'Armin Arlert',
    aka: ['Armin'],
    line: 'Someone who can’t sacrifice anything can never [change] anything.',
    decoys: ['protect', 'save', 'understand'],
    fame: 2,
  },
  {
    show: 'Attack on Titan',
    line: 'On that day, humanity received a grim reminder. We lived in fear of the Titans and were disgraced to live [in these cages we called walls].',
    decoys: ['as cattle waiting for slaughter', 'without ever seeing the sea', 'in the shadow of our own fear'],
    fame: 1,
  },
  {
    show: 'Attack on Titan',
    line: 'Dedicate your [hearts]!',
    decoys: ['swords', 'lives', 'wings'],
    fame: 1,
  },

  // ── Demon Slayer ──
  {
    show: 'Demon Slayer: Kimetsu no Yaiba',
    by: 'Tanjirou Kamado',
    aka: ['Tanjiro Kamado', 'Tanjiro'],
    line: 'Please tell me how I can turn Nezuko [back into a human]!',
    decoys: ['into a Demon Slayer', 'safely home', 'away from the sun'],
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
    line: 'Domain Expansion: [Unlimited Void].',
    decoys: ['Malevolent Shrine', 'Chimera Shadow Garden', 'Coffin of the Iron Mountain'],
    fame: 1,
  },
  {
    show: 'JUJUTSU KAISEN',
    by: 'Aoi Todo',
    aka: ['Todo', 'Aoi Toudou'],
    line: 'What kind of [girls] do you like?',
    decoys: ['food', 'fights', 'music'],
    fame: 1,
  },
  {
    show: 'JUJUTSU KAISEN',
    by: 'Satoru Gojou',
    aka: ['Satoru Gojo', 'Gojo', 'Gojo Satoru'],
    line: 'Don’t worry. [I’m the strongest].',
    decoys: ['It’s only a curse', 'I never miss', 'You’re not dead yet'],
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
    line: 'I will become the god of [this new world].',
    decoys: ['death', 'justice', 'the Shinigami'],
    fame: 1,
  },
  {
    show: 'Death Note',
    by: 'Ryuk',
    line: 'Humans are so [interesting].',
    decoys: ['boring', 'fragile', 'predictable'],
    fame: 1,
  },
  {
    show: 'Death Note',
    by: 'Light Yagami',
    aka: ['Light'],
    line: 'I am [justice]! I protect the innocent and those who fear evil.',
    decoys: ['the law', 'the hero', 'salvation'],
    fame: 1,
  },
  {
    show: 'Death Note',
    by: 'Ryuk',
    line: 'You’re asking me why? I did it ’cause [I was bored].',
    decoys: ['I was hungry', 'it was fate', 'I lost a bet'],
    fame: 1,
  },
  {
    show: 'Death Note',
    by: 'Light Yagami',
    aka: ['Light'],
    line: 'L, do you know [gods of death love apples]?',
    decoys: ['what a Shinigami looks like', 'how many rules the notebook has', 'who Kira really is'],
    fame: 1,
  },
  {
    show: 'Death Note',
    by: 'L Lawliet',
    aka: ['L'],
    line: 'Kira is childish and he hates losing... I am also childish and [I hate to lose].',
    decoys: ['I love sweets', 'I never sleep', 'I’m never wrong'],
    fame: 2,
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
  {
    show: 'My Hero Academia',
    by: 'Shouta Aizawa',
    aka: ['Aizawa', 'Shota Aizawa', 'Eraser Head'],
    line: 'It was [a logical ruse].',
    decoys: ['a test of nerve', 'a clerical error', 'a final warning'],
    fame: 2,
  },

  // ── Hunter x Hunter (2011) ──
  {
    show: 'Hunter x Hunter (2011)',
    by: 'Hisoka Morow',
    aka: ['Hisoka'],
    line: 'Bungee Gum has the properties of both [rubber and gum].',
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
    line: 'If you were to write a story with me in the lead role, it would certainly be... [a tragedy].',
    decoys: ['a comedy', 'a love story', 'a mystery'],
    fame: 1,
  },
  {
    show: 'Tokyo Ghoul',
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
    line: 'This may be a [game], but it is not something you play.',
    decoys: ['dream', 'test', 'story'],
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
  {
    show: 'Your Name.',
    by: 'Hitoha Miyamizu',
    aka: ['Hitoha'],
    line: 'Tying thread is musubi. [Connecting people] is musubi.',
    decoys: ['Falling in love', 'Dreaming', 'Braiding cords'],
    fame: 2,
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
  {
    show: 'HAIKYU!!',
    by: 'Tetsurou Kuroo',
    aka: ['Kuroo', 'Tetsuro Kuroo'],
    line: 'We’re like the blood in our veins. We must [flow without stopping].',
    decoys: ['never stop running', 'protect the heart', 'stay warm'],
    fame: 2,
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
  {
    show: 'Dr. STONE',
    by: 'Senkuu Ishigami',
    aka: ['Senku Ishigami', 'Senku'],
    line: 'I’m [ten billion percent] sure!',
    decoys: ['a hundred percent', 'a million percent', 'ninety-nine percent'],
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
    line: 'You have no enemies. No one has any enemies. There is [no one that you should hurt].',
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
    line: 'If the king does not lead, [how can he expect his subordinates to follow]?',
    decoys: ['who will protect the throne', 'he is no king at all', 'the kingdom will fall'],
    fame: 2,
  },
  {
    show: 'Code Geass: Lelouch of the Rebellion',
    by: 'Lelouch Lamperouge',
    aka: ['Lelouch', 'Lelouch vi Britannia', 'Zero'],
    line: 'I, Lelouch vi Britannia, command you! Now, all of you... [die]!',
    decoys: ['kneel', 'obey', 'run'],
    fame: 1,
  },
  {
    show: 'Code Geass: Lelouch of the Rebellion',
    by: 'Lelouch Lamperouge',
    aka: ['Lelouch', 'Lelouch vi Britannia', 'Zero'],
    line: 'You can’t change the world [without getting your hands dirty].',
    decoys: ['with words alone', 'by standing still', 'without a little help'],
    fame: 2,
  },
  {
    show: 'Code Geass: Lelouch of the Rebellion',
    by: 'Lelouch Lamperouge',
    aka: ['Lelouch', 'Lelouch vi Britannia', 'Zero'],
    line: 'I am... [Zero].',
    decoys: ['the Black Knight', 'Britannia', 'your enemy'],
    fame: 1,
  },
  {
    show: 'Code Geass: Lelouch of the Rebellion',
    by: 'Suzaku Kururugi',
    aka: ['Suzaku'],
    line: 'A victory won through dishonest means [is no victory at all].',
    decoys: ['is still a victory', 'is a debt to be repaid', 'shames the knight who wins it'],
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
  {
    show: 'Neon Genesis Evangelion',
    by: 'Misato Katsuragi',
    aka: ['Misato'],
    line: 'Sometimes you need a little wishful thinking [to keep on living].',
    decoys: ['to pilot an Eva', 'to get through the night', 'to fall asleep'],
    fame: 2,
  },
  {
    show: 'Neon Genesis Evangelion',
    by: 'Shinji Ikari',
    aka: ['Shinji'],
    line: 'Why don’t you just [try smiling]?',
    decoys: ['say thank you', 'go home', 'ask for help'],
    fame: 2,
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
    line: 'Your first wasn’t JoJo! It was me, [Dio]!',
    decoys: ['Jotaro', 'Joseph', 'Kira'],
    fame: 1,
  },
  {
    show: 'JoJo\'s Bizarre Adventure (TV)',
    by: 'Dio Brando',
    aka: ['Dio'],
    line: 'Can you remember how many [loaves of bread you’ve eaten in your entire life]?',
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
  {
    show: 'JoJo\'s Bizarre Adventure (TV)',
    by: 'Giorno Giovanna',
    aka: ['Giorno'],
    line: 'I, Giorno Giovanna, have [a dream].',
    decoys: ['a plan', 'no regrets', 'a debt to repay'],
    fame: 1,
  },
  {
    show: 'JoJo\'s Bizarre Adventure (TV)',
    by: 'Dio Brando',
    aka: ['Dio', 'DIO'],
    line: 'Za Warudo! [Toki yo tomare]!',
    decoys: ['Muda muda muda', 'Wryyyy', 'Ora ora ora'],
    fame: 1,
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
  {
    show: 'Cowboy Bebop',
    by: 'Faye Valentine',
    aka: ['Faye'],
    line: 'You know the first rule of combat? [Shoot them before they shoot you].',
    decoys: ['Never trust a partner', 'Always know your exit', 'Don’t fight fair'],
    fame: 3,
  },
  {
    show: 'Cowboy Bebop',
    by: 'Spike Spiegel',
    aka: ['Spike'],
    line: 'Most things get better [when I kick them]...',
    decoys: ['after a drink', 'when I ignore them', 'with a little luck'],
    fame: 2,
  },
  {
    show: 'Cowboy Bebop',
    line: 'You’re gonna [carry that weight].',
    decoys: ['pay for this', 'miss me', 'need a bigger ship'],
    fame: 2,
  },
  {
    show: 'Cowboy Bebop',
    by: 'Spike Spiegel',
    aka: ['Spike'],
    line: 'I hate kids and pets. [They’re all a royal pain in the butt]!',
    decoys: ['They never leave you alone', 'They eat all the food', 'They always find me'],
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
    by: 'Kamina',
    line: 'Your drill is the drill that will [pierce the heavens]!',
    decoys: ['break the earth', 'save the world', 'dig to the core'],
    fame: 1,
  },
  {
    show: 'Gurren Lagann',
    by: 'Kamina',
    line: 'Who the hell do you think [I am]?!',
    decoys: ['you’re talking to', 'you’re messing with', 'you’re dealing with'],
    fame: 1,
  },
  {
    show: 'Gurren Lagann',
    by: 'Kamina',
    line: 'Go beyond the impossible and [kick reason to the curb]!',
    decoys: ['never look back', 'believe in yourself', 'take the heavens by force'],
    fame: 1,
  },
  {
    show: 'Gurren Lagann',
    by: 'Simon',
    line: 'If you’re gonna dig, [dig to the heavens].',
    decoys: ['dig deep', 'dig with your heart', 'dig for your friends'],
    fame: 2,
  },
  {
    show: 'Gurren Lagann',
    by: 'Leeron',
    aka: ['Leeron Littner'],
    line: 'When you screw it in, give it [a hard manly twist].',
    decoys: ['everything you’ve got', 'a gentle touch', 'one more turn'],
    fame: 2,
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
  {
    show: 'Bleach',
    by: 'Ichigo Kurosaki',
    aka: ['Ichigo'],
    line: 'I’m not fighting because I think I can win, [I’m fighting because I must win].',
    decoys: ['I’m fighting because I like it', 'I’m fighting because Rukia asked', 'I’m fighting because I’m bored'],
    fame: 2,
  },
  {
    show: 'Bleach',
    by: 'Byakuya Kuchiki',
    aka: ['Byakuya'],
    line: 'No matter how strong a defense, [a stronger offense will always shatter it].',
    decoys: ['pride is stronger still', 'a captain never falls', 'it will crack in time'],
    fame: 3,
  },
  {
    show: 'Bleach',
    by: 'Kisuke Urahara',
    aka: ['Urahara'],
    line: 'There’s no way I, a mere handsome and sexy shopkeeper, could possibly [have bankai]!',
    decoys: ['be a captain', 'fight a Hollow', 'run a business'],
    fame: 2,
  },
  {
    show: 'Bleach',
    by: 'Genryuusai Shigekuni Yamamoto',
    aka: ['Yamamoto', 'Genryusai Yamamoto', 'Head Captain Yamamoto'],
    line: 'All things in the universe, turn to ashes, [Ryūjin Jakka]!',
    decoys: ['Senbonzakura', 'Hyōrinmaru', 'Benihime'],
    fame: 2,
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
  {
    show: 'Black Clover',
    by: 'Yami Sukehiro',
    aka: ['Yami'],
    line: 'Surpass your limits. [Right here, right now]!',
    decoys: ['No matter the cost', 'Or die trying', 'For the Black Bulls'],
    fame: 1,
  },

  // ── Fairy Tail ──
  {
    show: 'Fairy Tail',
    by: 'Natsu Dragneel',
    aka: ['Natsu'],
    line: 'I’m all [fired up]!',
    decoys: ['worn out', 'warmed up', 'burned out'],
    fame: 1,
  },
  {
    show: 'Fairy Tail',
    by: 'Lucy Heartfilia',
    aka: ['Lucy'],
    line: 'Spirits aren’t shields! [I fight alongside them]! That’s my style!',
    decoys: ['They’re my power', 'I just borrow them', 'They obey the keys'],
    fame: 2,
  },

  // ── KONOSUBA ──
  {
    show: 'KONOSUBA -God\'s blessing on this wonderful world!',
    by: 'Megumin',
    line: 'My name is Megumin, the greatest archwizard of [the Crimson Demons]!',
    decoys: ['the Axis Order', 'the Demon King’s army', 'the town of Axel'],
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
  {
    show: 'Gintama',
    by: 'Gintoki Sakata',
    aka: ['Gintoki', 'Gin-san'],
    line: 'This is Gintama! And [I’m the main character]!',
    decoys: ['I’m the strongest', 'this is my house', 'nobody gets to cancel it'],
    fame: 2,
  },
  {
    show: 'Gintama',
    by: 'Gintoki Sakata',
    aka: ['Gintoki', 'Gin-san'],
    line: 'A samurai doesn’t need a reason [to do what’s right].',
    decoys: ['to draw his sword', 'to eat sweets', 'to skip work'],
    fame: 2,
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

  // ── The Melancholy of Haruhi Suzumiya ──
  {
    show: 'The Melancholy of Haruhi Suzumiya',
    by: 'Haruhi Suzumiya',
    aka: ['Haruhi'],
    line: 'I have no interest in ordinary humans. If there are any aliens, time travelers, sliders or espers here, [come join me]!',
    decoys: ['step forward', 'I’ll find you', 'speak up now'],
    fame: 1,
  },
  {
    show: 'The Melancholy of Haruhi Suzumiya',
    by: 'Mikuru Asahina',
    aka: ['Mikuru'],
    line: 'That’s [classified information].',
    decoys: ['a time paradox', 'a long story', 'against the rules'],
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
  {
    show: 'Bakemonogatari',
    by: 'Mayoi Hachikuji',
    aka: ['Hachikuji', 'Mayoi'],
    line: 'Shitsurei, [kamimashita].',
    decoys: ['wasuremashita', 'makemashita', 'mayoimashita'],
    fame: 2,
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
  {
    show: 'Puella Magi Madoka Magica',
    by: 'Mami Tomoe',
    aka: ['Mami'],
    line: 'I’m not afraid of anything anymore. Because... [I’m not alone anymore]!',
    decoys: ['I’m a magical girl', 'I made a contract', 'I have nothing left to lose'],
    fame: 2,
  },
  {
    show: 'Puella Magi Madoka Magica',
    by: 'Homura Akemi',
    aka: ['Homura'],
    line: 'Kindness sometimes leads to [even greater tragedy].',
    decoys: ['a contract with Kyubey', 'regret', 'a broken promise'],
    fame: 2,
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
    line: 'What does it mean to be [strong]?',
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
  {
    show: 'Pokémon',
    line: 'Looks like Team Rocket’s [blasting off again]!',
    decoys: ['in trouble again', 'going down in flames', 'out of here'],
    fame: 1,
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
    line: 'This world is made of... love and [peace]!',
    decoys: ['war', 'money', 'donuts'],
    fame: 1,
  },
  {
    show: 'Trigun',
    by: 'Vash the Stampede',
    aka: ['Vash'],
    line: 'Dangerous toys are fun, but [you could get hurt]!',
    decoys: ['they’re not for kids', 'mine is better', 'I’d rather have donuts'],
    fame: 2,
  },
  {
    show: 'Trigun',
    by: 'Nicholas D. Wolfwood',
    aka: ['Wolfwood', 'Nicholas Wolfwood'],
    line: 'I’m a man of God [for God’s sake]!',
    decoys: ['with a cross to bear', 'and a man of the gun', 'not a saint'],
    fame: 2,
  },
  {
    show: 'Trigun',
    by: 'Milly Thompson',
    aka: ['Milly'],
    line: 'You should never get between people and [their pudding].',
    decoys: ['their money', 'their dreams', 'their guns'],
    fame: 3,
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
    show: 'Spirited Away',
    by: 'Chihiro Ogino',
    aka: ['Chihiro', 'Sen'],
    line: 'I’m not leaving [till you give me a job]!',
    decoys: ['without my parents', 'until you say my name', 'without Haku'],
    fame: 2,
  },
  {
    show: 'Princess Mononoke',
    by: 'Ashitaka',
    line: 'To see with eyes [unclouded by hate].',
    decoys: ['that can see the forest spirits', 'wide open', 'of a child'],
    fame: 2,
  },
  {
    show: 'Princess Mononoke',
    by: 'Jigo',
    line: 'So you say you’re under a curse? Well so what. [So’s the whole damn world].',
    decoys: ['Pay me first', 'Eat your soup', 'Curses wear off'],
    fame: 2,
  },
  {
    show: 'Princess Mononoke',
    by: 'Lady Eboshi',
    aka: ['Eboshi'],
    line: 'Cut off a wolf’s head and [it still has the power to bite].',
    decoys: ['the forest will be ours', 'the pack will scatter', 'the gods will fall'],
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

  // ── Chainsaw Man ──
  {
    show: 'Chainsaw Man',
    by: 'Makima',
    line: 'I expect ‘yes’ or [‘woof’] for answers.',
    decoys: ['‘meow’', '‘sir’', '‘of course’'],
    fame: 1,
  },
  {
    show: 'Chainsaw Man',
    by: 'Denji',
    line: 'Gonna put [jam] on my bread, and share it with you.',
    decoys: ['butter', 'honey', 'peanut butter'],
    fame: 1,
  },

  // ── Re:ZERO -Starting Life in Another World- ──
  {
    show: 'Re:ZERO -Starting Life in Another World-',
    by: 'Rem',
    line: 'Let’s start from here. From square one... no, [from zero]!',
    decoys: ['from tomorrow', 'from the mansion', 'with Emilia-sama'],
    fame: 1,
  },

  // ── Mob Psycho 100 ──
  {
    show: 'Mob Psycho 100',
    by: 'Arataka Reigen',
    aka: ['Reigen'],
    line: 'When things go south, it’s okay to [run away]!',
    decoys: ['give up', 'lose', 'fight dirty'],
    fame: 2,
  },

  // ── Samurai Champloo ──
  {
    show: 'Samurai Champloo',
    by: 'Mugen',
    line: 'If living means bowing down to the likes of you bastards, [I’d rather die on my feet with my head held high].',
    decoys: ['I’ll take my chances', 'count me out', 'I’ll cut you all down'],
    fame: 2,
  },
  {
    show: 'Samurai Champloo',
    by: 'Jin',
    line: 'You can’t fight the current, [you have to flow with it].',
    decoys: ['you have to cut through it', 'you have to wait it out', 'it will take you anyway'],
    fame: 3,
  },

  // ── Soul Eater ──
  {
    show: 'Soul Eater',
    by: 'Death the Kid',
    aka: ['Kid'],
    line: 'Symmetry is what makes [the world beautiful].',
    decoys: ['a Reaper strong', 'a soul whole', 'a weapon perfect'],
    fame: 2,
  },

  // ── Hellsing ──
  {
    show: 'Hellsing',
    by: 'Alucard',
    line: 'Beautiful night, isn’t it, Police Girl? It’s especially beautiful, of course, [if you’re a bloodsucker].',
    decoys: ['under a full moon', 'when someone dies', 'if you work for Hellsing'],
    fame: 2,
  },

  // ── Akira ──
  {
    show: 'Akira',
    by: 'Shoutarou Kaneda',
    aka: ['Kaneda', 'Shotaro Kaneda'],
    line: 'That’s [Mister Kaneda] to you, punk!',
    decoys: ['Captain Kaneda', 'Lord Kaneda', 'Doctor Kaneda'],
    fame: 1,
  },

  // ── Toradora! ──
  {
    show: 'Toradora!',
    by: 'Taiga Aisaka',
    aka: ['Taiga'],
    line: 'Maybe that’s why the world keeps it hidden from everyone. If it’s hard to get, [that makes it even more special].',
    decoys: ['nobody really wants it', 'you have to fight for it', 'it’s probably not real'],
    fame: 2,
  },

  // ── Yu Yu Hakusho: Ghostfiles ──
  {
    show: 'Yu Yu Hakusho: Ghostfiles',
    by: 'Hiei',
    line: 'I have the power of the Black Dragon, because [now I am the dragon]!',
    decoys: ['I was born in darkness', 'my Jagan Eye wills it', 'I fear nothing'],
    fame: 3,
  },

  // ── Assassination Classroom ──
  {
    show: 'Assassination Classroom',
    by: 'Koro-sensei',
    aka: ['Korosensei', 'Koro sensei'],
    line: 'It would be nice if you could [kill me before graduation].',
    decoys: ['graduate with honors', 'beat me on a test', 'call me by my name'],
    fame: 2,
  },
];
