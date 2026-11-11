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
// - **Spoilers are fair game** (changed 2026-11-10, the user's call: a table
//   is assumed to have finished what it watched). Deaths, reveals and last
//   words are in — Whitebeard's "The One Piece is real!", Itachi's "Forgive
//   me, Sasuke". This was "no spoilers" until then; nothing here relies on it.
// - **Only lines spoken in an anime** (a series or a film). A line that is
//   only in the manga or light novel — not animated yet, or cut — stays out,
//   however famous: the topic is about what a viewer heard. Kayaba's "this may
//   be a game, but it is not something you play" left on that rule (it is the
//   light novel's epigraph).
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
//   same check before it goes in. Since 2026-11-10 the bar is looser, at the
//   user's call — coverage matters more than a perfect source for every
//   show: when sources disagree, the most credible one's wording goes in, and
//   a line only fan quote sites carry goes in with the wording fans use. The
//   batches added that way are marked in the git history ("fifth" to "eighth
//   batch"). A subtitle archive now settles the exact words where it has
//   the show (see the game's CLAUDE.md): lines added since are in it word for
//   word, and the looser-bar lines it covers were reworded to it or replaced.
// - **Translations differ; the blank stays meaningful.** Sub and dub word
//   things differently ("can never change anything" / "can change nothing").
//   The line takes the official wording, and the blank stays on the ending
//   that makes the line; every other sourced wording of it goes in `alt`.
//   Wording that differs only AROUND the blank ("I expect 'yes' or 'woof'" /
//   "only 'yes' or 'woof'") needs nothing: the blank does not move.
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
//   alt      other wordings of the ending people know the line by — another
//            translation, or the fan spelling ("Infinite Void" beside the
//            official "Unlimited Void"). Only for wordings a source has. The
//            option always shows `line`'s own (official) wording, never a
//            slash of both, which would give the answer away; an `alt` is
//            accepted and named on the reveal ("Also accepted: Infinite Void").
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
    alt: ['my nindo, my ninja way'],
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
  {
    show: 'Naruto',
    by: 'Deidara',
    line: 'Art is [an explosion]!',
    decoys: ['eternal', 'patience', 'a lie'],
    fame: 1,
  },
  {
    show: 'Naruto',
    by: 'Sai',
    line: 'The best way to defuse a troublesome situation is by smiling, even if it’s only [a fake smile].',
    decoys: ['for a moment', 'at your enemy', 'to yourself'],
    fame: 2,
  },
  {
    show: 'Naruto',
    by: 'Itachi Uchiha',
    aka: ['Itachi'],
    line: 'Forgive me, Sasuke. [This is the last time].',
    decoys: ['I had no choice', 'Live on', 'I was always watching'],
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
    line: 'This arm? I bet it on [the new era].',
    alt: ['the new age', 'the next generation'],
    decoys: ['my crew', 'the One Piece', 'a game of dice'],
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
  {
    show: 'ONE PIECE',
    by: 'Edward Newgate',
    aka: ['Whitebeard'],
    line: 'The One Piece... [is real]!',
    decoys: ['is a lie', 'is mine', 'is gone'],
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
    line: 'Someone who can’t sacrifice anything [can never change anything].',
    alt: ['can change nothing', 'can never hope to change anything'],
    decoys: ['can never protect anything', 'will never be free', 'has already lost'],
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
  {
    show: 'Attack on Titan',
    by: 'Reiner Braun',
    aka: ['Reiner'],
    line: 'My Titan is the [Armored] Titan, and his is the Colossal Titan.',
    decoys: ['Female', 'Beast', 'Cart'],
    fame: 1,
  },
  {
    show: 'Attack on Titan',
    by: 'Levi',
    aka: ['Levi Ackerman'],
    line: 'Give up on your dreams and [die].',
    decoys: ['live', 'rest', 'run'],
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
  {
    show: 'Demon Slayer: Kimetsu no Yaiba',
    by: 'Tanjirou Kamado',
    aka: ['Tanjiro Kamado', 'Tanjiro'],
    line: 'Don’t enter into someone else’s heart [without permission]!',
    decoys: ['and break it', 'in their sleep', 'to steal their dreams'],
    fame: 2,
  },
  {
    show: 'Demon Slayer: Kimetsu no Yaiba',
    by: 'Enmu',
    line: 'Good morning. [You should have stayed asleep].',
    decoys: ['Did you sleep well', 'The train is mine', 'Breakfast is served'],
    fame: 2,
  },
  {
    show: 'Demon Slayer: Kimetsu no Yaiba',
    by: 'Kyoujurou Rengoku',
    aka: ['Rengoku', 'Kyojuro Rengoku'],
    line: 'No matter how weak or unworthy you feel... [keep your heart burning], grit your teeth and move forward.',
    decoys: ['protect the weak', 'sharpen your blade', 'never look back'],
    fame: 1,
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
    alt: ['Infinite Void'],
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
  {
    show: 'JUJUTSU KAISEN',
    by: 'Sukuna',
    aka: ['Ryomen Sukuna'],
    line: 'Be proud. [You are strong].',
    decoys: ['You are weak', 'You are mine', 'You are forgiven'],
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
    alt: ['the new world'],
    decoys: ['death', 'justice', 'the Shinigami'],
    fame: 1,
  },
  {
    show: 'Death Note',
    by: 'Ryuk',
    line: 'Humans are so [interesting].',
    alt: ['much fun'],
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
  {
    show: 'Death Note',
    by: 'Light Yagami',
    aka: ['Light'],
    line: 'That’s right, [I am Kira].',
    decoys: ['I am L', 'I’m innocent', 'I am the second L'],
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
    alt: ['rubber and chewing gum'],
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
  {
    show: 'Hunter x Hunter (2011)',
    by: 'Isaac Netero',
    aka: ['Netero'],
    line: 'You know nothing of [the bottomless malice within the human heart].',
    decoys: ['the true strength of Nen', 'the weight of a prayer', 'the gratitude in these palms'],
    fame: 2,
  },
  {
    show: 'Hunter x Hunter (2011)',
    by: 'Meruem',
    line: 'Will you say [my name] one last time?',
    decoys: ['goodbye', 'you’ll stay', 'that you forgive me'],
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
  {
    show: 'Fullmetal Alchemist: Brotherhood',
    by: 'Edward Elric',
    aka: ['Edward', 'Ed', 'Ed Elric'],
    line: 'Don’t call me [little]!',
    decoys: ['Fullmetal', 'kid', 'Edward'],
    fame: 1,
  },
  {
    show: 'Fullmetal Alchemist: Brotherhood',
    by: 'Roy Mustang',
    aka: ['Mustang'],
    line: 'Keep moving, whatever it takes. Even if the way ahead lies through [a river of mud].',
    decoys: ['a sea of fire', 'a field of graves', 'a wall of soldiers'],
    fame: 2,
  },
  {
    show: 'Fullmetal Alchemist: Brotherhood',
    by: 'Edward Elric',
    aka: ['Edward', 'Ed', 'Ed Elric'],
    line: 'Nah, me and God... [we don’t get along too well].',
    decoys: ['we’ve never met', 'we made a deal', 'we’re even'],
    fame: 2,
  },
  {
    show: 'Fullmetal Alchemist: Brotherhood',
    line: 'Nothing is [impossible], alright?',
    decoys: ['free', 'forever', 'mine'],
    fame: 2,
  },

  // ── Your Name. ──
  {
    show: 'Your Name.',
    by: 'Mitsuha Miyamizu',
    aka: ['Mitsuha'],
    line: 'Please make me [a handsome Tokyo boy] in my next life!',
    alt: ['a handsome boy in the city'],
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
  {
    show: 'Your Name.',
    by: 'Hitoha Miyamizu',
    aka: ['Hitoha'],
    line: 'Treasure the experience. [Dreams fade away after you wake up].',
    decoys: ['Every thread comes undone', 'The gods are always watching', 'Your body remembers what you forget'],
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
  {
    show: 'HAIKYU!!',
    by: 'Shouyou Hinata',
    aka: ['Hinata', 'Shoyo Hinata'],
    line: 'The view from the top... [it’s a view I could never see on my own].',
    decoys: ['it’s where the Little Giant stood', 'it’s worth every jump', 'it’s mine now'],
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
  {
    show: 'Kaguya-sama: Love is War',
    by: 'Chika Fujiwara',
    aka: ['Chika'],
    line: 'It’s no fair to have girls’ talk without me! Please leave an issue like that to [Love Detective Chika]!',
    decoys: ['the Student Council', 'President Shirogane', 'Kaguya-san'],
    fame: 2,
  },
  {
    show: 'Kaguya-sama: Love is War',
    line: 'Love is war! [The person who falls in love loses]!',
    decoys: ['The one who confesses wins', 'Only the clever survive', 'Pride comes before the fall'],
    fame: 2,
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
    alt: ['10 billion percent'],
    decoys: ['a hundred percent', 'a million percent', 'ninety-nine percent'],
    fame: 1,
  },
  {
    show: 'Dr. STONE',
    by: 'Senkuu Ishigami',
    aka: ['Senku', 'Senku Ishigami'],
    line: 'Science is just the name for the steady, [pain-in-the-ass effort] that goes into doing it.',
    decoys: ['spark of genius', 'ten billion percent', 'leap of faith'],
    fame: 2,
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
  {
    show: 'Violet Evergarden',
    by: 'Violet Evergarden',
    aka: ['Violet'],
    line: 'I will travel anywhere to meet your request. [Auto Memory Doll] Violet Evergarden, at your service.',
    decoys: ['Postal Courier', 'Royal Scribe', 'Ghostwriter'],
    fame: 1,
  },

  // ── Vinland Saga ──
  {
    show: 'Vinland Saga',
    by: 'Thors Snorresson',
    aka: ['Thors'],
    line: 'You have no enemies. No one has any enemies. There is [no one that you should hurt].',
    alt: ['no one it’s okay to hurt'],
    decoys: ['no one you can’t forgive', 'no war worth fighting', 'no one stronger than you'],
    fame: 1,
  },
  {
    show: 'Vinland Saga',
    by: 'Thorfinn Karlsefni',
    aka: ['Thorfinn'],
    line: 'I have [no enemies].',
    decoys: ['nothing left', 'no regrets', 'no home'],
    fame: 1,
  },
  {
    show: 'Vinland Saga',
    by: 'Thors Snorresson',
    aka: ['Thors'],
    line: 'A true warrior [doesn’t need a sword].',
    decoys: ['never runs from a fight', 'fights for his king', 'is never afraid'],
    fame: 3,
  },

  // ── No Game, No Life ──
  {
    show: 'No Game, No Life',
    by: 'Sora',
    line: 'Blank [never loses].',
    decoys: ['never quits', 'never plays fair', 'never forgives'],
    fame: 1,
  },
  {
    show: 'No Game, No Life',
    line: 'On my oath to the covenant: [Aschente]!',
    decoys: ['Disboard', 'Checkmate', 'Ixseed'],
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
  {
    show: 'Frieren: Beyond Journey’s End',
    by: 'Himmel',
    line: 'To live is to be [known and remembered by others].',
    decoys: ['always on a journey', 'to leave something behind', 'kind to everyone'],
    fame: 2,
  },
  {
    show: 'Frieren: Beyond Journey’s End',
    by: 'Himmel',
    line: 'You showed me a spell to create [a field of flowers].',
    decoys: ['a sea of stars', 'a rain of light', 'a ring of fire'],
    fame: 2,
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
    alt: ['breads you have eaten in your life'],
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
  {
    show: 'Kill la Kill',
    by: 'Ryuuko Matoi',
    aka: ['Ryuko Matoi', 'Ryuko'],
    line: 'I’ll take my own path [no matter what anyone else says].',
    decoys: ['and wear what I want', 'till I find my father’s killer', 'even if it kills me'],
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
  {
    show: 'Bleach',
    by: 'Ichigo Kurosaki',
    aka: ['Ichigo'],
    line: 'A miracle only happens once, huh? So [what do you call this]?',
    decoys: ['why am I still standing', 'let’s make it twice', 'I’ll make my own'],
    fame: 2,
  },
  {
    show: 'Bleach',
    by: 'Ichigo Kurosaki',
    aka: ['Ichigo'],
    line: 'Become strong not just for your own sake, but [for your friends].',
    decoys: ['for your pride', 'for Soul Society', 'for the ones who came before'],
    fame: 2,
  },
  {
    show: 'Bleach',
    by: 'Sousuke Aizen',
    aka: ['Aizen', 'Sosuke Aizen'],
    line: 'Admiration is the state [furthest away from understanding].',
    decoys: ['closest to worship', 'of a fool', 'every captain envies'],
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
  {
    show: 'KONOSUBA -God\'s blessing on this wonderful world!',
    by: 'Kazuma Satou',
    aka: ['Kazuma', 'Kazuma Sato'],
    line: 'In the name of true gender equality, I will [dropkick] any rotten woman who deserves it!',
    alt: ['deliver a dropkick to'],
    decoys: ['steal from', 'spare', 'lecture'],
    fame: 1,
  },
  {
    show: 'KONOSUBA -God\'s blessing on this wonderful world!',
    by: 'Megumin',
    line: '[Explosion]!',
    decoys: ['Inferno', 'Lightning Strike', 'Freeze Gust'],
    fame: 3,
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
  {
    show: 'Black Butler',
    by: 'Ciel Phantomhive',
    aka: ['Ciel'],
    line: 'We have no need for the past. All we need are [the present and the future].',
    decoys: ['revenge and nothing more', 'Sebastian and the contract', 'the Queen’s orders'],
    fame: 1,
  },
  {
    show: 'Black Butler',
    by: 'Sebastian Michaelis',
    aka: ['Sebastian'],
    line: 'Yes, [my lord].',
    decoys: ['my lady', 'Your Majesty', 'master'],
    fame: 2,
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
    alt: ['100 friends'],
    decoys: ['one true friend', 'a thousand friends', 'it through a whole conversation'],
    fame: 1,
  },
  {
    show: 'Komi Can’t Communicate',
    by: 'Hitohito Tadano',
    aka: ['Tadano'],
    line: 'Okay, then, I’ll be your first friend. And [I’ll help you get 99 more].',
    decoys: ['I won’t tell anyone', 'I’ll talk for you', 'I’ll sit next to you'],
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
  {
    show: 'My Teen Romantic Comedy SNAFU',
    by: 'Hachiman Hikigaya',
    aka: ['Hachiman', 'Hikigaya'],
    line: 'I want something [genuine].',
    decoys: ['simple', 'quiet', 'to be left alone'],
    fame: 1,
  },

  // ── The Melancholy of Haruhi Suzumiya ──
  {
    show: 'The Melancholy of Haruhi Suzumiya',
    by: 'Haruhi Suzumiya',
    aka: ['Haruhi'],
    line: 'I have no interest in ordinary humans. If there are any aliens, time travelers, sliders or espers here, [come join me]!',
    alt: ['come see me'],
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
    alt: ['El Psy Congroo'],
    decoys: ['Operation Skuld', 'Tutturu', 'Mwahahaha'],
    fame: 1,
  },
  {
    show: 'Steins;Gate',
    by: 'Mayuri Shiina',
    aka: ['Mayuri', 'Mayushii'],
    line: '[Tutturu]~! Mayushii desu!',
    decoys: ['Okarin', 'Nyan nyan', 'El Psy'],
    fame: 1,
  },
  {
    show: 'Steins;Gate',
    by: 'Rintarou Okabe',
    aka: ['Okabe', 'Okarin', 'Hououin Kyouma'],
    line: 'The world only needs [one mad scientist]!',
    decoys: ['one time machine', 'one lab', 'one lab assistant'],
    fame: 2,
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
  {
    show: 'Kuroko\'s Basketball',
    by: 'Daiki Aomine',
    aka: ['Aomine'],
    line: 'The only one who can beat me is [me].',
    decoys: ['Kuroko', 'Akashi', 'nobody'],
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
  {
    show: 'Trigun',
    line: 'If you keep saving butterflies, [spiders will starve to death]!',
    decoys: ['you’ll never save yourself', 'the humans will win', 'Rem will never come back'],
    fame: 1,
  },

  // ── Spice and Wolf ──
  {
    show: 'Spice and Wolf',
    by: 'Holo',
    line: 'I am Holo [the Wisewolf]!',
    alt: ['the Wise Wolf'],
    decoys: ['the Moon Hunter', 'the Silver Fang', 'the Wolf Queen'],
    fame: 2,
  },

  // ── Serial Experiments Lain ──
  {
    show: 'Serial Experiments Lain',
    by: 'Lain Iwakura',
    aka: ['Lain'],
    line: 'No matter where you go, [everyone’s connected].',
    alt: ['everyone is always connected'],
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
    show: 'Howl‘s Moving Castle',
    by: 'Calcifer',
    line: 'I don’t cook! I’m a scary and powerful [fire demon]!',
    decoys: ['wizard', 'dragon', 'witch'],
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
    show: 'Grave of the Fireflies',
    by: 'Setsuko',
    line: 'Why do fireflies [have to die so soon]?',
    decoys: ['glow at night', 'come to the shelter', 'like the river'],
    fame: 2,
    noShow: true,
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
  {
    show: 'Chainsaw Man',
    by: 'Power',
    line: 'Prostrate yourselves, humans! For [I am Power]!',
    decoys: ['I am the Blood Fiend', 'I am your queen', 'I hunger for blood'],
    fame: 2,
  },

  // ── Re:ZERO -Starting Life in Another World- ──
  {
    show: 'Re:ZERO -Starting Life in Another World-',
    by: 'Rem',
    line: 'Let’s start from here. From square one... no, [from zero]!',
    decoys: ['from tomorrow', 'from the mansion', 'with Emilia-sama'],
    fame: 1,
  },
  {
    show: 'Re:ZERO -Starting Life in Another World-',
    by: 'Emilia',
    line: 'It’s more satisfying to hear a single [“thank you”] than a lot of “sorry”s.',
    decoys: ['“I love you”', '“good job”', '“welcome back”'],
    fame: 2,
  },
  {
    show: 'Re:ZERO -Starting Life in Another World-',
    line: 'My brain [trembles]...',
    decoys: ['burns', 'aches', 'sings'],
    fame: 2,
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
  {
    show: 'Mob Psycho 100',
    by: 'Arataka Reigen',
    aka: ['Reigen'],
    line: 'You should never accept money [you feel you haven’t earned].',
    decoys: ['from a spirit', 'from a minor', 'without a receipt'],
    fame: 2,
  },
  {
    show: 'Mob Psycho 100',
    by: 'Arataka Reigen',
    aka: ['Reigen'],
    line: '[Salt Splash]!',
    decoys: ['Spirit Punch', 'Holy Water Mist', 'Banishing Kick'],
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
  {
    show: 'Soul Eater',
    by: 'Black☆Star',
    aka: ['Black Star', 'BlackStar'],
    line: 'I’m the man who will [surpass God]!',
    decoys: ['become a Death Scythe', 'defeat the Kishin', 'be the strongest meister'],
    fame: 1,
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
  {
    show: 'Akira',
    line: 'My job isn’t to believe or disbelieve. It is [to act or not act]!',
    decoys: ['to protect Neo-Tokyo', 'to follow orders', 'to stop Akira'],
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
  {
    show: 'Toradora!',
    by: 'Ryuuji Takasu',
    aka: ['Ryuuji', 'Ryuji Takasu'],
    line: 'In this world there’s this thing [that no one’s ever seen].',
    decoys: ['that everyone wants', 'that never changes', 'that only tigers know'],
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
  {
    show: 'Assassination Classroom',
    by: 'Koro-sensei',
    aka: ['Korosensei', 'Koro sensei'],
    line: 'An assassin who neglects to sharpen his blade [is no assassin at all].',
    decoys: ['will never graduate', 'deserves to fail', 'is just a student'],
    fame: 2,
  },
  {
    show: 'Assassination Classroom',
    by: 'Koro-sensei',
    line: 'Otherwise... you’ll never be able to kill me at my max speed of [Mach 20].',
    decoys: ['Mach 10', 'Mach 5', 'the speed of light'],
    fame: 2,
  },

  // ── DARLING in the FRANXX ──
  {
    show: 'DARLING in the FRANXX',
    by: 'Zero Two',
    line: 'I [found you], my darling!',
    decoys: ['lost you', 'chose you', 'warned you'],
    fame: 1,
  },
  {
    show: 'DARLING in the FRANXX',
    by: 'Zero Two',
    line: 'From this day forward, you are now [my darling]!',
    decoys: ['my partner', 'my pilot', 'my prey'],
    fame: 2,
  },
  {
    show: 'DARLING in the FRANXX',
    by: 'Zero Two',
    aka: ['002'],
    line: 'Wow, your taste makes my heart race. [The taste of danger].',
    decoys: ['The taste of honey', 'The taste of a human', 'The taste of my darling'],
    fame: 2,
  },

  // ── SPY x FAMILY ──
  {
    show: 'SPY x FAMILY',
    by: 'Anya Forger',
    aka: ['Anya'],
    line: 'I’m Anya. I’ve always been [Papa’s daughter].',
    decoys: ['Mama’s favorite', 'a good girl', 'top of my class'],
    fame: 2,
  },
  {
    show: 'SPY x FAMILY',
    by: 'Anya Forger',
    aka: ['Anya'],
    line: 'A spy... An assassin... I’m... [so excited]!',
    alt: ['waku waku'],
    decoys: ['so scared', 'so hungry', 'so confused'],
    fame: 2,
  },
  {
    show: 'SPY x FAMILY',
    by: 'Loid Forger',
    aka: ['Loid', 'Twilight'],
    line: 'To create a world where children won’t have to cry... [That’s why I became a spy].',
    alt: ['that was the whole reason I became a spy'],
    decoys: ['That’s what Operation Strix is for', 'That’s what Westalis wants', 'That’s what a father does'],
    fame: 2,
  },
  {
    show: 'SPY x FAMILY',
    by: 'Loid Forger',
    aka: ['Loid', 'Twilight'],
    line: 'Even in sickness, or in sadness... No matter what hardships await us, [let us be there for one another].',
    alt: ['let’s help each other'],
    decoys: ['let us keep our secrets', 'I will protect this family', 'the mission comes first'],
    fame: 1,
  },

  // ── The Disastrous Life of Saiki K. ──
  {
    show: 'The Disastrous Life of Saiki K.',
    by: 'Kusuo Saiki',
    aka: ['Saiki'],
    line: 'Good [grief].',
    decoys: ['riddance', 'gracious', 'luck'],
    fame: 1,
  },
  {
    show: 'The Disastrous Life of Saiki K.',
    by: 'Riki Nendou',
    aka: ['Nendou', 'Nendo'],
    line: 'Yo, [partner]!',
    decoys: ['boss', 'loser', 'nerd'],
    fame: 1,
  },

  // ── Made in Abyss ──
  {
    show: 'Made in Abyss',
    by: 'Riko',
    line: 'I want to become a White Whistle as soon as I can... and [catch up with my mother]!',
    decoys: ['find a relic worth a fortune', 'beat every Red Whistle', 'see the bottom with Reg'],
    fame: 2,
  },
  {
    show: 'Made in Abyss',
    line: 'Longing seizes people more powerfully than poison and [more deeply than illness].',
    decoys: ['more surely than death', 'more swiftly than the curse', 'more gently than sleep'],
    fame: 2,
  },
  {
    show: 'Made in Abyss',
    by: 'Bondrewd',
    line: 'I am Bondrewd. Delver of the Abyss. [The Lord of Dawn], as some people call me.',
    decoys: ['The Lord of Dusk', 'The Keeper of Orth', 'The Sovereign of the Deep'],
    fame: 3,
  },
  {
    show: 'Made in Abyss',
    by: 'Reg',
    line: 'Riko... I’m going with you... [To the bottom of the Abyss].',
    decoys: ['To the surface', 'Wherever your mother is', 'To the Sea of Corpses'],
    fame: 1,
    noShow: true,
  },

  // ── FLCL ──
  {
    show: 'FLCL',
    by: 'Haruko Haruhara',
    aka: ['Haruko'],
    line: 'Nothing can happen till [you swing the bat].',
    decoys: ['you plug in the guitar', 'the robot comes out', 'you grow up'],
    fame: 2,
  },
  {
    show: 'FLCL',
    by: 'Naota Nandaba',
    aka: ['Naota'],
    line: 'Nothing amazing happens here. [Everything is ordinary].',
    decoys: ['The iron is hot', 'Nobody ever leaves', 'It’s all Medical Mechanica'],
    fame: 2,
  },

  // ── Berserk ──
  {
    show: 'Berserk',
    by: 'Griffith',
    line: 'A dream... It’s something you do for yourself, [not for others].',
    decoys: ['not for a king', 'not for gold', 'not for glory'],
    fame: 2,
  },

  // ── Paprika ──
  {
    show: 'Paprika',
    by: 'Paprika',
    line: 'And now, boys and girls, [it’s show time]!',
    decoys: ['dream on', 'wake up', 'it’s parade time'],
    fame: 2,
  },

  // ── Another ──
  {
    show: 'Another',
    by: 'Mei Misaki',
    aka: ['Mei'],
    line: 'That’s so cute. Did you think I was [a ghost]?',
    decoys: ['a doll', 'a transfer student', 'your classmate'],
    fame: 2,
  },
  {
    show: 'Another',
    by: 'Mei Misaki',
    aka: ['Mei'],
    line: '...Mei. [Mei Misaki].',
    decoys: ['Mei Akazawa', 'Mei Mochizuki', 'Mei Sakaki'],
    fame: 2,
  },

  // ── Darker than Black ──
  {
    show: 'Darker than Black',
    by: 'Hei',
    line: 'Contractors are liars. [I’m no different].',
    decoys: ['They pay in blood', 'Trust no one', 'So are humans'],
    fame: 2,
  },

  // ── OSHI NO KO ──
  {
    show: 'OSHI NO KO',
    by: 'Ai Hoshino',
    aka: ['Ai'],
    line: 'Idols sparkle through the magic of lies. Lies are [the most exquisite love]!',
    decoys: ['the only truth', 'an idol’s armor', 'what fans want'],
    fame: 1,
  },
  {
    show: 'OSHI NO KO',
    by: 'Ai Hoshino',
    aka: ['Ai'],
    line: 'Ruby, Aqua... I love you. Ah... [I finally said it].',
    decoys: ['it was all a lie', 'I’m so sorry', 'I want to live'],
    fame: 2,
  },

  // ── The Seven Deadly Sins ──
  {
    show: 'The Seven Deadly Sins',
    by: 'Escanor',
    line: 'Who [decided] that?',
    decoys: ['said', 'asked for', 'believes'],
    fame: 1,
  },
  {
    show: 'The Seven Deadly Sins',
    by: 'Meliodas',
    line: 'I will get stronger for [what I must protect now].',
    decoys: ['the Holy Knights', 'my own sake', 'the next fight'],
    fame: 2,
  },

  // ── Akame ga Kill! ──
  {
    show: 'Akame ga Kill!',
    by: 'Esdeath',
    line: 'The weak are destined to lie beneath [the boots of the strong].',
    decoys: ['the feet of the Empire', 'the snows of the north', 'the shadow of the throne'],
    fame: 2,
  },
  {
    show: 'Akame ga Kill!',
    by: 'Esdeath',
    line: 'Panicking [leads to an early grave].',
    decoys: ['is for the weak', 'won’t save you', 'makes the hunt fun'],
    fame: 2,
  },
  {
    show: 'Akame ga Kill!',
    by: 'Tatsumi',
    line: 'If I can’t even save one girl, how will I save [an entire village]?',
    decoys: ['the Empire', 'Night Raid', 'myself'],
    fame: 1,
  },

  // ── Weathering With You ──
  {
    show: 'Weathering With You',
    by: 'Hodaka Morishima',
    aka: ['Hodaka'],
    line: 'I want you more than [any blue sky]!',
    decoys: ['the sun itself', 'this whole city', 'any summer'],
    fame: 2,
  },
  {
    show: 'Weathering With You',
    by: 'Hodaka Morishima',
    aka: ['Hodaka'],
    line: 'The weather can stay [crazy]!',
    decoys: ['cold', 'this way', 'gray'],
    fame: 2,
  },

  // ── I Want to Eat Your Pancreas ──
  {
    show: 'I Want to Eat Your Pancreas',
    line: 'I want to eat [your pancreas].',
    decoys: ['your heart', 'your cooking', 'with you tonight'],
    fame: 1,
  },
  {
    show: 'I Want to Eat Your Pancreas',
    by: 'Sakura Yamauchi',
    aka: ['Sakura'],
    line: 'Living means [having bonds with others].',
    decoys: ['doing what you want', 'being remembered', 'never giving up'],
    fame: 2,
  },

  // ── Classroom of the Elite ──
  {
    show: 'Classroom of the Elite',
    by: 'Kiyotaka Ayanokouji',
    aka: ['Ayanokouji', 'Ayanokoji', 'Kiyotaka Ayanokoji'],
    line: 'I’ve never once thought of you as an ally. All people are nothing but [tools].',
    decoys: ['strangers', 'obstacles', 'liars'],
    fame: 1,
  },
  {
    show: 'Classroom of the Elite',
    by: 'Kiyotaka Ayanokouji',
    aka: ['Ayanokouji', 'Ayanokoji'],
    line: 'In this world, [winning is everything].',
    decoys: ['talent is everything', 'nobody can be trusted', 'the strong make the rules'],
    fame: 2,
  },

  // ── Monster ──
  {
    show: 'Monster',
    by: 'Johan Liebert',
    aka: ['Johan'],
    line: 'The only thing humans are equal in is [death].',
    decoys: ['fear', 'sin', 'loneliness'],
    fame: 1,
  },
  {
    show: 'Monster',
    by: 'Johan Liebert',
    aka: ['Johan'],
    line: 'Hatred is born when [people gather together].',
    decoys: ['a name is lost', 'the strong rule', 'love is denied'],
    fame: 2,
  },

  // ── Sword Art Online ──
  {
    show: 'Sword Art Online',
    by: 'Kazuto Kirigaya',
    aka: ['Kirito'],
    line: 'Everybody can fight. It’s just a choice of [whether you should].',
    decoys: ['who you fight for', 'when to stop', 'how you lose'],
    fame: 2,
  },
  {
    show: 'Sword Art Online',
    by: 'Kazuto Kirigaya',
    aka: ['Kirito'],
    line: '[Starburst Stream]!',
    decoys: ['Vorpal Strike', 'Sonic Leap', 'Horizontal Square'],
    fame: 3,
  },

  // ── A Silent Voice ──
  {
    show: 'A Silent Voice',
    by: 'Shouya Ishida',
    aka: ['Shoya Ishida', 'Shoya', 'Ishida'],
    line: 'I wanted to tell you... [that I’m sorry]. For everything.',
    decoys: ['that I missed you', 'that I’m leaving', 'that it wasn’t me'],
    fame: 2,
  },
  {
    show: 'A Silent Voice',
    by: 'Shouya Ishida',
    aka: ['Shoya Ishida', 'Shoya', 'Ishida'],
    line: 'I haven’t [changed at all] since back then.',
    decoys: ['spoken to anyone', 'forgiven myself', 'looked anyone in the eye'],
    fame: 2,
  },

  // ── Rascal Does Not Dream of Bunny Girl Senpai ──
  {
    show: 'Rascal Does Not Dream of Bunny Girl Senpai',
    by: 'Mai Sakurajima',
    aka: ['Mai'],
    line: 'If you’re lying, I’ll make you eat Pocky [through your nose].',
    decoys: ['for a whole week', 'off the floor', 'until you cry'],
    fame: 1,
  },
  {
    show: 'Rascal Does Not Dream of Bunny Girl Senpai',
    by: 'Sakuta Azusagawa',
    aka: ['Sakuta'],
    line: 'Even if the whole world hated me, I could keep living if [that person needed me].',
    decoys: ['Mai-san remembered me', 'Kaede smiled at me', 'nobody could see me'],
    fame: 2,
  },
  {
    show: 'Rascal Does Not Dream of Bunny Girl Senpai',
    by: 'Sakuta Azusagawa',
    aka: ['Sakuta'],
    line: 'To Mai Sakurajima-senpai, in class 3-1... I’m [in love with you], Sakurajima-senpai!',
    decoys: ['not going to forget you', 'sorry for everything', 'waiting for you'],
    fame: 2,
  },

  // ── The Rising of the Shield Hero ──
  {
    show: 'The Rising of the Shield Hero',
    by: 'Naofumi Iwatani',
    aka: ['Naofumi'],
    line: 'I’ll fight [an entire country] if I must!',
    decoys: ['the other three heroes', 'the Waves alone', 'the church itself'],
    fame: 2,
  },
  {
    show: 'The Rising of the Shield Hero',
    by: 'Naofumi Iwatani',
    aka: ['Naofumi'],
    line: 'I’ve gained [more important things] thanks to becoming the Shield Hero.',
    decoys: ['more enemies than friends', 'nothing but debt', 'the right to revenge'],
    fame: 2,
  },

  // ── Blue Exorcist ──
  {
    show: 'Blue Exorcist',
    by: 'Rin Okumura',
    aka: ['Rin'],
    line: 'I’ll become an exorcist and [kick Satan’s ass]!',
    decoys: ['protect my brother', 'save the True Cross Academy', 'prove I’m human'],
    fame: 1,
  },
  {
    show: 'Blue Exorcist',
    by: 'Rin Okumura',
    aka: ['Rin'],
    line: 'Don’t just mindlessly [judge people as you please]!',
    decoys: ['follow orders', 'swing your sword', 'trust a demon'],
    fame: 2,
  },

  // ── Kakegurui ──
  {
    show: 'Kakegurui',
    by: 'Yumeko Jabami',
    aka: ['Yumeko'],
    line: 'I want to gamble [more and more]!',
    decoys: ['with my life', 'against the council', 'one last time'],
    fame: 2,
  },
  {
    show: 'Kakegurui',
    by: 'Yumeko Jabami',
    aka: ['Yumeko'],
    line: 'I dislike situations where I know for sure if I’m going to win or lose. Because [it’s not really gambling].',
    decoys: ['it’s already over', 'the stakes are too low', 'there’s no risk to my life'],
    fame: 2,
  },

  // ── ERASED ──
  {
    show: 'ERASED',
    by: 'Satoru Fujinuma',
    aka: ['Satoru'],
    line: 'I call the phenomenon [“Revival”].',
    decoys: ['“Rewind”', '“Replay”', '“Return”'],
    fame: 2,
  },
  {
    show: 'ERASED',
    by: 'Satoru Fujinuma',
    aka: ['Satoru'],
    line: '“Believing” is really [a term of hope of wanting to believe].',
    decoys: ['just another word for giving up', 'something only children can do', 'the same as knowing'],
    fame: 3,
  },
  {
    show: 'ERASED',
    by: 'Kayo Hinazuki',
    aka: ['Kayo', 'Hinazuki'],
    line: '[Are you stupid]?',
    decoys: ['Are you lost', 'Are you following me', 'Are you okay'],
    fame: 2,
  },

  // ── Your lie in April ──
  {
    show: 'Your lie in April',
    by: 'Kaori Miyazono',
    aka: ['Kaori'],
    line: 'Whether you’re sad, you’re a mess, or you’ve hit rock bottom, [you still have to play]!',
    decoys: ['you still have to smile', 'the music won’t wait', 'spring will come again'],
    fame: 2,
  },
  {
    show: 'Your lie in April',
    by: 'Kaori Miyazono',
    aka: ['Kaori'],
    line: 'Music is [freedom].',
    decoys: ['a battle', 'a lie', 'forever'],
    fame: 2,
  },

  // ── The Promised Neverland ──
  {
    show: 'The Promised Neverland',
    by: 'Emma',
    line: 'Even if it’s impossible, I want to [escape with everyone].',
    decoys: ['see the outside world', 'protect Norman', 'find our real parents'],
    fame: 1,
  },
  {
    show: 'The Promised Neverland',
    by: 'Ray',
    line: 'You haven’t actually [given up], have you?',
    decoys: ['told Mom', 'left the house', 'forgotten Norman'],
    fame: 2,
  },
  {
    show: 'The Promised Neverland',
    line: 'Run... And run... And survive. Then [destroy this damned world we live in]!',
    decoys: ['never come back to this farm', 'find the one who wrote the books', 'save the other farms'],
    fame: 1,
  },

  // ── Horimiya ──
  {
    show: 'Horimiya',
    by: 'Izumi Miyamura',
    aka: ['Miyamura'],
    line: 'I don’t think there’s a person in this world [you can’t eventually be friends with].',
    decoys: ['who’s truly alone', 'who doesn’t hide something', 'worth hating forever'],
    fame: 2,
  },
  {
    show: 'Horimiya',
    by: 'Kyouko Hori',
    aka: ['Hori', 'Kyoko Hori'],
    line: 'Everyone has a side of them [they don’t want anyone to know about].',
    decoys: ['that only family sees', 'they’re proud of', 'that comes out at night'],
    fame: 2,
  },

  // ── Noragami ──
  {
    show: 'Noragami',
    by: 'Yato',
    line: 'I want to become someone who can [make people happy]!',
    decoys: ['build my own shrine', 'never be forgotten', 'cut ties for good'],
    fame: 2,
  },
  {
    show: 'Noragami',
    by: 'Yato',
    line: 'It’s okay, because [I’m sure we’ll meet again].',
    decoys: ['I’m a god', 'you paid five yen', 'nobody will remember'],
    fame: 2,
  },

  // ── Parasyte -the maxim- ──
  {
    show: 'Parasyte -the maxim-',
    by: 'Migi',
    line: 'Upon researching the concept of demons, I believe that, among all life, [humans are the closest thing to it].',
    decoys: ['parasites are the furthest from it', 'none deserve the name', 'only you could become one'],
    fame: 2,
  },
  {
    show: 'Parasyte -the maxim-',
    by: 'Shinichi Izumi',
    aka: ['Shinichi'],
    line: 'You shouldn’t mouth off [when you don’t know shit].',
    decoys: ['to a parasite', 'with your mouth full', 'about my mother'],
    fame: 2,
  },

  // ── Death Parade ──
  {
    show: 'Death Parade',
    by: 'Decim',
    line: 'Life is always full of [unfairness].',
    decoys: ['surprises', 'regret', 'choices'],
    fame: 2,
  },
  {
    show: 'Death Parade',
    by: 'Decim',
    line: 'I am not human, [but I feel].',
    decoys: ['and I never will be', 'but I judge', 'so I cannot lie'],
    fame: 2,
  },

  // ── That Time I Got Reincarnated as a Slime ──
  {
    show: 'That Time I Got Reincarnated as a Slime',
    by: 'Rimuru Tempest',
    aka: ['Rimuru'],
    line: 'I may have underestimated you, but [not as much as you underestimated me].',
    decoys: ['I won’t make that mistake twice', 'you overestimated yourself', 'a slime never forgets'],
    fame: 2,
  },
  {
    show: 'That Time I Got Reincarnated as a Slime',
    by: 'Veldora Tempest',
    aka: ['Veldora'],
    line: 'What?! A mere slime proposes friendship with me, [the feared Storm Dragon]?!',
    decoys: ['the King of Monsters', 'the Demon Lord', 'the sealed Wind God'],
    fame: 2,
  },

  // ── Mushoku Tensei: Jobless Reincarnation ──
  {
    show: 'Mushoku Tensei: Jobless Reincarnation',
    by: 'Rudeus Greyrat',
    aka: ['Rudeus'],
    line: 'There’s only one thing I need to do. [Train as much as I can] while I grow up.',
    decoys: ['Stay out of trouble', 'Find a good teacher', 'Never leave this house'],
    fame: 3,
  },
  {
    show: 'Mushoku Tensei: Jobless Reincarnation',
    by: 'Rudeus Greyrat',
    aka: ['Rudeus'],
    line: 'I shouldn’t discount the possibility [that I’m unique].',
    decoys: ['that this is a dream', 'that I’m already dead', 'that magic is real'],
    fame: 3,
  },

  // ── Tokyo Revengers ──
  {
    show: 'Tokyo Revengers',
    by: 'Manjirou Sano',
    aka: ['Mikey', 'Manjiro Sano'],
    line: 'Put one finger on my Street Hawk and [I’ll kill you].',
    decoys: ['you’re out of Toman', 'you buy me a new one', 'Draken pays for it'],
    fame: 2,
  },
  {
    show: 'Tokyo Revengers',
    by: 'Ken Ryuuguji',
    aka: ['Draken', 'Ken Ryuguji'],
    line: 'You don’t have to bow your head. Just have [a heart that cares for others].',
    decoys: ['the guts to fight', 'respect for Mikey', 'a reason to win'],
    fame: 1,
  },
  {
    show: 'Tokyo Revengers',
    line: 'Please save everyone... Our [crybaby hero].',
    decoys: ['time leaper', 'Toman captain', 'first friend'],
    fame: 2,
  },

  // ── PSYCHO-PASS ──
  {
    show: 'PSYCHO-PASS',
    by: 'Shougo Makishima',
    aka: ['Makishima', 'Shogo Makishima'],
    line: 'I think the only time people really have value is when [they act according to their own will].',
    decoys: ['the Sibyl System measures them', 'they are afraid', 'they stop thinking'],
    fame: 2,
  },
  {
    show: 'PSYCHO-PASS',
    by: 'Shougo Makishima',
    aka: ['Makishima', 'Shogo Makishima'],
    line: 'I wonder what sort of criteria you use to [divide people into good and evil].',
    decoys: ['decide who lives', 'measure a soul', 'trust the Sibyl System'],
    fame: 2,
  },
  {
    show: 'PSYCHO-PASS',
    by: 'Akane Tsunemori',
    aka: ['Akane'],
    line: 'The law doesn’t protect people. [People protect the law].',
    decoys: ['The Sibyl System does', 'The Dominator does', 'Enforcers do'],
    fame: 2,
  },

  // ── Miss Kobayashi's Dragon Maid ──
  {
    show: 'Miss Kobayashi\'s Dragon Maid',
    by: 'Tohru',
    line: 'Living here with you [is my life now].',
    decoys: ['is only temporary', 'is a dragon’s duty', 'beats any other world'],
    fame: 2,
  },
  {
    show: 'Miss Kobayashi\'s Dragon Maid',
    by: 'Tohru',
    line: 'I was raised to repay all favours, even if owed to [foolish, inferior humans]!',
    decoys: ['my sworn enemies', 'the gods themselves', 'Kobayashi-san’s boss'],
    fame: 2,
  },
  {
    show: 'Miss Kobayashi\'s Dragon Maid',
    by: 'Kobayashi',
    line: 'Most people don’t try to become adults, [they just can’t stay children any longer].',
    decoys: ['they just get older', 'they just get jobs', 'they just stop dreaming'],
    fame: 1,
  },

  // ── BLUE LOCK ──
  {
    show: 'BLUE LOCK',
    by: 'Jinpachi Ego',
    aka: ['Ego'],
    line: 'You will not become the greatest strikers in the world, unless you have [the ego to match].',
    decoys: ['the team behind you', 'the talent to back it up', 'a reason to win'],
    fame: 2,
  },
  {
    show: 'BLUE LOCK',
    by: 'Yoichi Isagi',
    aka: ['Isagi'],
    line: 'I want to win with [my own goal]!',
    decoys: ['my teammates', 'Bachira', 'a perfect pass'],
    fame: 2,
  },

  // ── Solo Leveling ──
  {
    show: 'Solo Leveling',
    by: 'Jin-U Seong',
    aka: ['Sung Jinwoo', 'Jinwoo', 'Jinwoo Sung', 'Sung Jin-Woo'],
    line: '[Arise].',
    decoys: ['Kneel', 'Obey', 'Begone'],
    fame: 1,
  },
  {
    show: 'Solo Leveling',
    by: 'Jin-U Seong',
    aka: ['Sung Jinwoo', 'Jinwoo'],
    line: 'If I don’t kill, I will be killed. [I can’t run away anymore].',
    decoys: ['I have to level up', 'That’s what the System wants', 'That’s how hunters live'],
    fame: 2,
  },
  {
    show: 'Solo Leveling',
    by: 'Jin-U Seong',
    aka: ['Sung Jinwoo', 'Jinwoo'],
    line: 'I’m saying you should get ready [to become hunted].',
    decoys: ['to kneel', 'to run', 'for the dungeon break'],
    fame: 1,
  },

  // ── Angel Beats! ──
  {
    show: 'Angel Beats!',
    by: 'Yuri Nakamura',
    aka: ['Yuri'],
    line: 'We have no choice but to accept [the one and only life we’re given].',
    decoys: ['Angel’s rules', 'whatever God decides', 'that we’re already dead'],
    fame: 2,
  },
  {
    show: 'Angel Beats!',
    by: 'Kanade Tachibana',
    aka: ['Kanade', 'Angel'],
    line: 'Messing around at night together... [This calls for punishment].',
    decoys: ['That’s against the rules', 'Have some mapo tofu', 'Go back to class'],
    fame: 2,
  },
  {
    show: 'Angel Beats!',
    by: 'Hideki Hinata',
    aka: ['Hinata'],
    line: 'If I can meet you again, against the 6 billion to 1 odds, and even if your body can’t move, [I’ll marry you].',
    decoys: ['I’ll carry you', 'I’ll play baseball with you', 'I’ll stay with you here'],
    fame: 2,
  },

  // ── The Future Diary ──
  {
    show: 'The Future Diary',
    by: 'Yuno Gasai',
    aka: ['Yuno'],
    line: 'I’m crazy!? What’s crazy is [this world that refuses to let me be with you]!',
    decoys: ['the diary that wrote it', 'every other diary holder', 'a god who plays games'],
    fame: 1,
  },
  {
    show: 'The Future Diary',
    by: 'Yuno Gasai',
    aka: ['Yuno'],
    line: 'Maybe the future is bad. But [there’s a future beyond that], right?',
    decoys: ['the diary can be wrong', 'I’ll change it for you', 'we’ll face it together'],
    fame: 2,
  },

  // ── Anohana: The Flower We Saw That Day ──
  {
    show: 'Anohana: The Flower We Saw That Day',
    by: 'Meiko Honma',
    aka: ['Menma'],
    line: 'I love you, [Jintan].',
    decoys: ['Yukiatsu', 'Poppo', 'Anaru'],
    fame: 1,
  },
  {
    show: 'Anohana: The Flower We Saw That Day',
    by: 'Jinta Yadomi',
    aka: ['Jinta', 'Jintan'],
    line: 'Everyone’s changed... That’s not it. [The one who’s changed the most]... is me.',
    decoys: ['The one who ran away', 'The one Menma chose', 'The one who stayed behind'],
    fame: 2,
  },

  // ── Cyberpunk: Edgerunners ──
  {
    show: 'Cyberpunk: Edgerunners',
    by: 'Lucy',
    aka: ['Lucyna Kushinada'],
    line: 'You don’t make a name as a cyberpunk by how you live. You’re remembered [by how you die].',
    decoys: ['by the chrome you wear', 'by who you take down', 'by the eddies you leave'],
    fame: 1,
  },
  {
    show: 'Cyberpunk: Edgerunners',
    by: 'David Martinez',
    aka: ['David'],
    line: 'I made it to [the top of the tower], Lucy.',
    decoys: ['the Moon', 'Arasaka', 'the end of the line'],
    fame: 2,
  },

  // ── DAN DA DAN ──
  {
    show: 'DAN DA DAN',
    by: 'Momo Ayase',
    aka: ['Momo'],
    line: 'Okarun, [see you tomorrow]!',
    decoys: ['don’t be late', 'thanks for today', 'stay away from tunnels'],
    fame: 1,
    noShow: true,
  },
  {
    show: 'DAN DA DAN',
    by: 'Ken Takakura',
    aka: ['Okarun', 'Takakura'],
    line: 'Give me back my [kintama]!',
    alt: ['balls'],
    decoys: ['glasses', 'soul', 'phone'],
    fame: 1,
  },

  // ── Fire Force ──
  {
    show: 'Fire Force',
    line: 'The flame is the soul’s breath. The black smoke is the soul’s release. [Látom].',
    decoys: ['Ignis', 'Sol', 'Ashes'],
    fame: 2,
  },
  {
    show: 'Fire Force',
    by: 'Shinra Kusakabe',
    aka: ['Shinra'],
    line: 'I swore that I’d become a hero! [I will save everything]!',
    decoys: ['I will find my brother', 'I will beat Burns', 'I will never run'],
    fame: 2,
  },

  // ── The Quintessential Quintuplets ──
  {
    show: 'The Quintessential Quintuplets',
    by: 'Fuutarou Uesugi',
    aka: ['Fuutarou', 'Futaro Uesugi'],
    line: 'Love? That is the stupidest, [furthest removed act from academics].',
    decoys: ['biggest waste of study time', 'most expensive habit there is', 'least logical thing a student can do'],
    fame: 2,
  },
  {
    show: 'The Quintessential Quintuplets',
    by: 'Itsuki Nakano',
    aka: ['Itsuki'],
    line: 'Please take [responsibility].',
    decoys: ['a break', 'my hand', 'notes'],
    fame: 2,
  },

  // ── Bungo Stray Dogs ──
  {
    show: 'Bungo Stray Dogs',
    by: 'Osamu Dazai',
    aka: ['Dazai'],
    line: 'You can’t do a [double suicide] alone...',
    decoys: ['duet', 'heist', 'stakeout'],
    fame: 2,
  },
  {
    show: 'Bungo Stray Dogs',
    by: 'Atsushi Nakajima',
    aka: ['Atsushi'],
    line: 'This ends now, [Akutagawa].',
    decoys: ['Dazai', 'Port Mafia', 'Mori'],
    fame: 1,
  },

  // ── Tower of God ──
  {
    show: 'Tower of God',
    by: 'Rachel',
    line: 'I want to [see the stars].',
    decoys: ['go home', 'be free', 'find my mother'],
    fame: 1,
  },
  {
    show: 'Tower of God',
    by: 'Aguero Agnis Khun',
    aka: ['Khun Aguero Agnis', 'Khun'],
    line: 'What’s more important is not to be controlled by their rules. You impose [your own rules].',
    decoys: ['your own test', 'your own price', 'your own team'],
    fame: 2,
  },

  // ── Hell’s Paradise ──
  {
    show: 'Hell’s Paradise',
    by: 'Gabimaru',
    line: 'I am [hollow]!',
    decoys: ['immortal', 'a shinobi', 'a monster'],
    fame: 1,
  },
  {
    show: 'Hell’s Paradise',
    by: 'Gabimaru',
    line: 'Why [can’t I die]?',
    decoys: ['can’t I go home', 'won’t she wait', 'am I still here'],
    fame: 2,
  },

  // ── Wotakoi: Love is Hard for Otaku ──
  {
    show: 'Wotakoi: Love is Hard for Otaku',
    by: 'Hirotaka Nifuji',
    aka: ['Hirotaka'],
    line: 'If we dated, I would help you [grind for materials or levels] whenever you wanted.',
    decoys: ['carry your bags at every con', 'read every doujin you like', 'never touch your consoles'],
    fame: 2,
  },

  // ── Overlord ──
  {
    show: 'Overlord',
    by: 'Ainz Ooal Gown',
    pack: 'Momonga',
    aka: ['Ainz', 'Momonga'],
    line: 'Let’s show them [the power of Nazarick]!',
    decoys: ['the fear of death', 'what a guild can do', 'the might of the undead'],
    fame: 2,
  },
  {
    show: 'Overlord',
    by: 'Ainz Ooal Gown',
    pack: 'Momonga',
    aka: ['Ainz', 'Momonga'],
    line: 'Death by sword. Death by broken bones. Death by crushing. There’s not much difference, right? [You die at the end].',
    decoys: ['Pick the one you like', 'It’s all the same pain', 'Nazarick will decide'],
    fame: 2,
  },

  // ── The Irregular at Magic High School ──
  {
    show: 'The Irregular at Magic High School',
    by: 'Miyuki Shiba',
    aka: ['Miyuki'],
    line: 'As expected of [Onii-sama].',
    decoys: ['Senpai', 'Sensei', 'Ojou-sama'],
    fame: 1,
  },

  // ── Durarara!! ──
  {
    show: 'Durarara!!',
    by: 'Izaya Orihara',
    aka: ['Izaya'],
    line: 'I love [humans]!',
    decoys: ['chaos', 'information', 'myself'],
    fame: 1,
  },
  {
    show: 'Durarara!!',
    by: 'Izaya Orihara',
    aka: ['Izaya'],
    line: 'This world is so entertaining because [it doesn’t do anyone’s bidding]!',
    decoys: ['humans are so predictable', 'Shizu-chan is in it', 'nobody knows who I am'],
    fame: 1,
  },

  // ── GOBLIN SLAYER ──
  {
    show: 'GOBLIN SLAYER',
    by: 'Goblin Slayer',
    line: 'I’m not saving the world. I just [kill goblins].',
    decoys: ['take the gold', 'protect this town', 'follow the guild'],
    fame: 1,
  },
  {
    show: 'GOBLIN SLAYER',
    by: 'Goblin Slayer',
    line: 'There isn’t a single reason [to let them live].',
    decoys: ['to fear them', 'to go easy', 'to wait for help'],
    fame: 1,
  },
  {
    show: 'GOBLIN SLAYER',
    line: 'Did you know... that if you envy others, [you become a goblin]?',
    decoys: ['you lose yourself', 'you never grow up', 'the gods turn away'],
    fame: 1,
  },

  // ── Black Lagoon ──
  {
    show: 'Black Lagoon',
    by: 'Revy',
    aka: ['Rebecca Lee', 'Two Hands'],
    line: 'Don’t cry, fool. You’ve gotta enjoy life, or [you’ll let it waste away].',
    alt: ['you’ll end up wasting it'],
    decoys: ['someone takes it from you', 'you’re already dead', 'the bullets win'],
    fame: 2,
  },

  // ── Clannad ──
  {
    show: 'Clannad',
    by: 'Nagisa Furukawa',
    aka: ['Nagisa'],
    line: 'Even so, can you go on [loving this place]?',
    decoys: ['walking up this hill', 'waiting for me', 'believing in miracles'],
    fame: 1,
  },
  {
    show: 'Clannad',
    by: 'Kotomi Ichinose',
    aka: ['Kotomi'],
    line: 'The world is beautiful, even when it’s filled with [sadness and tears].',
    decoys: ['strangers', 'endless rain', 'broken promises'],
    fame: 1,
  },

  // ── Kaiju No. 8 ──
  {
    show: 'Kaiju No. 8',
    by: 'Kafka Hibino',
    aka: ['Kafka'],
    line: 'When that time comes, [I’ll always be by your side]!',
    decoys: ['I’ll clean up after you', 'I’ll be a kaiju', 'I’ll be your captain'],
    fame: 2,
  },

  // ── DON'T TOY WITH ME, MISS NAGATORO ──
  {
    show: 'DON\'T TOY WITH ME, MISS NAGATORO',
    by: 'Hayase Nagatoro',
    aka: ['Nagatoro'],
    line: 'Senpai is just fine as [just Senpai].',
    decoys: ['my toy', 'a creep', 'anyone else'],
    fame: 2,
  },

  // ── BEASTARS ──
  {
    show: 'BEASTARS',
    by: 'Legoshi',
    line: 'I’m beginning to understand it now, [the reason I was born a wolf].',
    decoys: ['why the herbivores fear us', 'what Haru really wants', 'how to stay hidden'],
    fame: 2,
  },

  // ── Date A Live ──
  {
    show: 'Date A Live',
    by: 'Kotori Itsuka',
    aka: ['Kotori'],
    line: 'Now, let our [date] begin.',
    decoys: ['game', 'duel', 'lesson'],
    fame: 1,
  },

  // ── Ouran High School Host Club ──
  {
    show: 'Ouran High School Host Club',
    by: 'Tamaki Suou',
    aka: ['Tamaki'],
    line: 'The Ouran Host Club [will be waiting for you].',
    decoys: ['is closed for today', 'only takes the rich', 'will repay your debt'],
    fame: 2,
  },

  // ── MASHLE: MAGIC AND MUSCLES ──
  {
    show: 'MASHLE: MAGIC AND MUSCLES',
    by: 'Mash Burnedead',
    aka: ['Mash'],
    line: 'Seven limited [cream puffs], please.',
    decoys: ['muffins', 'eclairs', 'donuts'],
    fame: 1,
  },

  // ── Nisekoi ──
  {
    show: 'Nisekoi',
    line: '[Zawsze] in love.',
    decoys: ['Falling', 'Fooling', 'Never'],
    fame: 1,
  },

  // ── TONIKAWA: Over The Moon For You ──
  {
    show: 'TONIKAWA: Over The Moon For You',
    by: 'Tsukasa Yuzaki',
    aka: ['Tsukasa'],
    line: 'I’ll go out with you if [you marry me].',
    decoys: ['you pass your exams', 'you catch me', 'you buy me dinner'],
    fame: 1,
  },

  // ── Terror in Resonance ──
  {
    show: 'Terror in Resonance',
    by: 'Nine',
    line: 'Remember us... remember... [that we lived].',
    decoys: ['what they did', 'the bombs', 'our names'],
    fame: 2,
  },

  // ── Plastic Memories ──
  {
    show: 'Plastic Memories',
    by: 'Isla',
    line: 'Memories do not always soften with time, sometimes [some grow edges like knives].',
    decoys: ['they fade into nothing', 'they’re all we have left', 'they belong to someone else'],
    fame: 2,
  },

  // ── The Garden of Words ──
  {
    show: 'The Garden of Words',
    by: 'Yukari Yukino',
    aka: ['Yukari'],
    line: 'A faint clap of thunder. Clouded skies. Perhaps rain will come. If so, [will you stay here with me]?',
    decoys: ['will you walk me home', 'I will make you shoes', 'I will wait for you'],
    fame: 2,
  },

  // ── Fruits Basket (2019) ──
  {
    show: 'Fruits Basket (2019)',
    line: 'What do you think comes of snow when it melts? [Spring comes]!',
    alt: ['It becomes spring'],
    decoys: ['It becomes water', 'It becomes a river', 'It becomes the sea'],
    fame: 1,
  },

  // ── Elfen Lied ──
  {
    show: 'Elfen Lied',
    by: 'Kurama',
    line: 'Warmth, love, and affection. [These are the things I have taken away from you].',
    decoys: ['These are what make us human', 'These are what you lost', 'These are what I could never give'],
    fame: 2,
  },

  // ── Call of the Night ──
  {
    show: 'Call of the Night',
    by: 'Nazuna Nanakusa',
    aka: ['Nazuna'],
    line: 'Stay up until [you’re satisfied with your day], kid.',
    decoys: ['the sun comes up', 'you find a vampire', 'you can’t stand it'],
    fame: 1,
  },

  // ── K-ON! ──
  {
    show: 'K-ON!',
    by: 'Yui Hirasawa',
    aka: ['Yui'],
    line: '[Fun things] are fun.',
    decoys: ['Cute things', 'Sweet things', 'Loud things'],
    fame: 1,
  },

  // ── Welcome to the N-H-K ──
  {
    show: 'Welcome to the N-H-K',
    by: 'Tatsuhiro Satou',
    aka: ['Satou', 'Satou Tatsuhiro', 'Tatsuhiro Sato'],
    line: 'It’s [a conspiracy] of the NHK!',
    decoys: ['the fault', 'a program', 'the secret'],
    fame: 1,
  },

  // ── Danganronpa: The Animation ──
  {
    show: 'Danganronpa: The Animation',
    by: 'Monokuma',
    line: '[Upupupu]...!',
    alt: ['Puhuhuhu'],
    decoys: ['Muhahaha', 'Nyahaha', 'Kukuku'],
    fame: 1,
  },
  {
    show: 'Danganronpa: The Animation',
    by: 'Junko Enoshima',
    aka: ['Junko'],
    line: 'Wherever there is hope, [there is most definitely despair].',
    decoys: ['Monokuma is watching', 'there is always a traitor', 'someone has to die'],
    fame: 2,
  },

  // ── Yuri!!! on ICE ──
  {
    show: 'Yuri!!! on ICE',
    by: 'Victor Nikiforov',
    aka: ['Victor', 'Viktor Nikiforov', 'Viktor'],
    line: 'I’m not going to go easy on you, though. [That’s just how I show my love].',
    decoys: ['That’s what a coach is for', 'You’re my student now', 'Gold is all that counts'],
    fame: 2,
  },

  // ── Delicious in Dungeon ──
  {
    show: 'Delicious in Dungeon',
    by: 'Marcille Donato',
    aka: ['Marcille'],
    line: 'I’m sick and tired of [eating monsters]!',
    decoys: ['this dungeon', 'Laios’s plans', 'walking'],
    fame: 1,
  },

  // ── SAKAMOTO DAYS ──
  {
    show: 'SAKAMOTO DAYS',
    line: '[No killing]. That’s the rule of the Sakamoto household.',
    decoys: ['No lying', 'No gambling', 'No sweets'],
    fame: 1,
  },

  // ── Lycoris Recoil ──
  {
    show: 'Lycoris Recoil',
    by: 'Chisato Nishikigi',
    aka: ['Chisato'],
    line: 'What I want to do always gets [top priority]!',
    decoys: ['done last', 'turned into a mission', 'checked with Mika first'],
    fame: 1,
  },

  // ── Perfect Blue ──
  {
    show: 'Perfect Blue',
    by: 'Mima Kirigoe',
    aka: ['Mima'],
    line: 'Excuse me. [Who are you]?',
    decoys: ['Where am I', 'Is this real', 'What day is it'],
    fame: 1,
  },

  // ── Cells at Work! ──
  {
    show: 'Cells at Work!',
    by: 'Platelet',
    line: '[Anone], anone!',
    decoys: ['Ano', 'Nee', 'Hai'],
    fame: 1,
  },
  {
    show: 'Cells at Work!',
    by: 'Hakkekkyuu U-1146',
    aka: ['White Blood Cell', 'U-1146', 'Neutrophil'],
    line: '[Die], germ!',
    decoys: ['Halt', 'Begone', 'Surrender'],
    fame: 2,
  },
  {
    show: 'Cells at Work!',
    line: 'Inside the human body... roughly [37.2 trillion] cells are working hard every day.',
    decoys: ['60 trillion', '100 billion', '3.7 million'],
    fame: 2,
  },

  // ── Beyond the Boundary ──
  {
    show: 'Beyond the Boundary',
    by: 'Mirai Kuriyama',
    aka: ['Mirai'],
    line: 'It’s because everyone is alone, senpai. Everyone is [all alone].',
    decoys: ['a monster', 'a stranger', 'afraid'],
    fame: 2,
  },

  // ── Angels of Death ──
  {
    show: 'Angels of Death',
    by: 'Rachel Gardner',
    aka: ['Rachel', 'Ray'],
    line: 'Please... [kill me].',
    decoys: ['save me', 'forgive me', 'leave me'],
    fame: 1,
  },

  // ── Toilet-bound Hanako-kun ──
  {
    show: 'Toilet-bound Hanako-kun',
    line: 'Hanako-san, Hanako-san, [are you there]?',
    decoys: ['grant my wish', 'come out and play', 'are you watching'],
    fame: 1,
  },

  // ── Maid-Sama! ──
  {
    show: 'Maid-Sama!',
    by: 'Misaki Ayuzawa',
    aka: ['Misaki'],
    line: 'Usui, you [perverted outer space alien]!',
    decoys: ['stuck-up rich boy', 'lazy good-for-nothing', 'shameless stalker'],
    fame: 1,
  },

  // ── High School DxD ──
  {
    show: 'High School DxD',
    by: 'Issei Hyoudou',
    aka: ['Issei', 'Issei Hyodo'],
    line: 'I’m going to become [the Harem King]!',
    decoys: ['the Red Dragon Emperor', 'a High-Class Devil', 'Rias’s knight'],
    fame: 1,
  },

  // ── Yona of the Dawn ──
  {
    show: 'Yona of the Dawn',
    by: 'Yona',
    line: 'Drawing a bow means taking and losing lives. My father hated pain. But, Father, if I do not take lives, [I cannot live].',
    decoys: ['I cannot protect them', 'I am no princess', 'they will take mine'],
    fame: 2,
  },

  // ── Magi: The Labyrinth of Magic ──
  {
    show: 'Magi: The Labyrinth of Magic',
    by: 'Aladdin',
    line: 'If you keep lying like that, no one, not even yourself, [will believe you anymore].',
    decoys: ['can save you', 'will remember who you were', 'will follow you'],
    fame: 2,
  },
  {
    show: 'Magi: The Labyrinth of Magic',
    by: 'Morgiana',
    line: 'I will not hesitate anymore. I’ll reach my destination, [no matter where it is].',
    decoys: ['and find my homeland', 'with Alibaba', 'for Aladdin'],
    fame: 1,
  },

  // ── March comes in like a lion ──
  {
    show: 'March comes in like a lion',
    by: 'Rei Kiriyama',
    aka: ['Rei'],
    line: 'I don’t want to [lose].',
    decoys: ['win', 'play', 'go home'],
    fame: 2,
  },
  {
    show: 'March comes in like a lion',
    by: 'Rei Kiriyama',
    aka: ['Rei'],
    line: 'Becoming a pro is like [jumping onto a moving train that doesn’t stop].',
    decoys: ['climbing a mountain alone', 'playing shogi in the dark', 'leaving home for good'],
    fame: 1,
  },

  // ── Monthly Girls' Nozaki-kun ──
  {
    show: 'Monthly Girls\' Nozaki-kun',
    by: 'Chiyo Sakura',
    aka: ['Chiyo', 'Sakura'],
    line: 'I’m your [fan]!',
    decoys: ['friend', 'classmate', 'assistant'],
    fame: 1,
  },

  // ── Guilty Crown ──
  {
    show: 'Guilty Crown',
    by: 'Shuu Ouma',
    aka: ['Shu Ouma', 'Shu'],
    line: 'The right to use my friends as a weapon, that is [the sinful crown I shall adorn].',
    decoys: ['the power of the King', 'the Void I was given', 'what makes me a king'],
    fame: 2,
  },

  // ── The Ancient Magus' Bride ──
  {
    show: 'The Ancient Magus\' Bride',
    by: 'Elias Ainsworth',
    aka: ['Elias'],
    line: 'However your past or upbringing may have been, it makes no difference regarding the fact that [you’re here].',
    alt: ['you’re here now'],
    decoys: ['you’re a Sleigh Beggy', 'you belong to me', 'you were sold'],
    fame: 1,
  },

  // ── Log Horizon ──
  {
    show: 'Log Horizon',
    by: 'Shiroe',
    line: 'Being strong on your own [is meaningless].',
    decoys: ['is lonely', 'is the goal', 'wins nothing'],
    fame: 2,
  },
  {
    show: 'Log Horizon',
    line: 'Living your life to the fullest ’til the moment of your death, [this is the rule to live by in any world].',
    decoys: ['is what the Round Table stands for', 'is how an Adventurer plays', 'is all a guild can ask'],
    fame: 1,
  },

  // ── SK8 the Infinity ──
  {
    show: 'SK8 the Infinity',
    by: 'Reki Kyan',
    aka: ['Reki'],
    line: 'No limits, only possibility. [Skating is infinite].',
    decoys: ['S is waiting', 'Skating is freedom', 'Let’s ride'],
    fame: 1,
  },
  {
    show: 'SK8 the Infinity',
    by: 'Reki Kyan',
    aka: ['Reki'],
    line: 'Skating is a lot more fun when [you skate together with someone else].',
    decoys: ['you win at S', 'you build your own board', 'nobody is watching'],
    fame: 1,
  },

  // ── Blue Spring Ride ──
  {
    show: 'Blue Spring Ride',
    by: 'Shuuko Murao',
    aka: ['Shuuko', 'Murao'],
    line: 'The feeling of not wanting to lose, everyone has it. If you find it unfair, [you’ll have to work harder yourself].',
    decoys: ['you’ll have to let go', 'it isn’t love', 'you’ve already lost'],
    fame: 2,
  },

  // ── Kiznaiver ──
  {
    show: 'Kiznaiver',
    by: 'Katsuhira Agata',
    aka: ['Katsuhira'],
    line: 'I’m not perfect, I hurt people, but [when I say sorry I mean it].',
    decoys: ['I can’t feel it', 'I’ll share the pain', 'I never mean to'],
    fame: 2,
  },

  // ── The Case Study of Vanitas ──
  {
    show: 'The Case Study of Vanitas',
    by: 'Vanitas',
    line: 'I will do as I please. I will use the methods I choose. It matters not what you people want! [I will save the vampires].',
    decoys: ['I will find the Book of Vanitas', 'I will have my revenge', 'I will end the curse-bearers'],
    fame: 2,
  },
  {
    show: 'The Case Study of Vanitas',
    by: 'Vanitas',
    line: 'As one might expect, it takes [one monster] to battle another!',
    alt: ['a monster'],
    decoys: ['a vampire', 'one liar', 'a doctor'],
    fame: 1,
  },

  // ── The Pet Girl of Sakurasou ──
  {
    show: 'The Pet Girl of Sakurasou',
    by: 'Mashiro Shiina',
    aka: ['Mashiro'],
    line: 'It’s more interesting when [the future’s uncertain].',
    decoys: ['Sorata is watching', 'there’s Baumkuchen', 'nobody knows me'],
    fame: 2,
  },

  // ── Golden Time ──
  {
    show: 'Golden Time',
    by: 'Kouko Kaga',
    aka: ['Kouko', 'Koko Kaga', 'Koko'],
    line: 'I don’t want to waste a single second or meter. From your first step and second of the day, [I want to be with you].',
    decoys: ['I want you to remember me', 'I’ll be watching', 'you belong to me'],
    fame: 2,
  },
  {
    show: 'Golden Time',
    by: 'Banri Tada',
    aka: ['Banri'],
    line: 'I may be unreliable, and I may not be able to do anything, but I’m here. [I’ll always be with you].',
    decoys: ['I remember everything', 'I’m not leaving Tokyo', 'I’m still Banri'],
    fame: 1,
  },

  // ── Charlotte ──
  {
    show: 'Charlotte',
    by: 'Yuu Otosaka',
    aka: ['Yuu', 'Yu Otosaka'],
    line: 'I will go plunder the ability of every wielder [all over the world], and save them.',
    decoys: ['at the academy', 'in Japan', 'before they break out'],
    fame: 2,
  },

  // ── The Devil is a Part-Timer! ──
  {
    show: 'The Devil is a Part-Timer!',
    by: 'Satan Jacob',
    aka: ['Sadao Maou', 'Maou', 'Satan'],
    line: 'Hear me, Emilia: I shall become [a regular employee] in this world!',
    decoys: ['the ruler', 'the shift manager', 'a hero'],
    fame: 2,
  },

  // ── My Dress-Up Darling ──
  {
    show: 'My Dress-Up Darling',
    by: 'Wakana Gojou',
    aka: ['Wakana', 'Gojo', 'Gojou'],
    line: 'I couldn’t believe something so [beautiful] could exist in this world.',
    decoys: ['cute', 'perfect', 'delicate'],
    fame: 1,
  },
  {
    show: 'My Dress-Up Darling',
    by: 'Marin Kitagawa',
    aka: ['Marin'],
    line: 'You need to speak up about how you’re feeling, [for your own sake].',
    decoys: ['before it’s too late', 'even if it’s weird', 'no matter who’s listening'],
    fame: 1,
  },

  // ── Food Wars! ──
  {
    show: 'Food Wars!',
    by: 'Souma Yukihira',
    aka: ['Soma Yukihira', 'Soma', 'Souma'],
    line: '[Glad you enjoyed it]!',
    alt: ['Glad you liked it', 'It wasn’t much', 'Osomatsu'],
    decoys: ['Bon appétit', 'Eat up', 'Itadakimasu'],
    fame: 2,
  },

  // ── Love, Chunibyo & Other Delusions ──
  {
    show: 'Love, Chunibyo & Other Delusions',
    by: 'Rikka Takanashi',
    aka: ['Rikka'],
    line: 'Explode, reality! Shatter, synapse! [Vanishment, this world]!',
    decoys: ['Awaken, Wicked Eye', 'Behold, the Unseen Horizon', 'Return, Dark Flame Master'],
    fame: 2,
  },

  // ── Devilman Crybaby ──
  {
    show: 'Devilman Crybaby',
    by: 'Miki Makimura',
    aka: ['Miki'],
    line: 'When I run forward, maybe [something behind me will change].',
    decoys: ['I can outrun the demons', 'Akira will catch up', 'I won’t have to look back'],
    fame: 1,
  },
  {
    show: 'Devilman Crybaby',
    by: 'Ryo Asuka',
    aka: ['Ryou Asuka', 'Ryo'],
    line: 'Demons exist, and [one could be right next to you].',
    decoys: ['they want this world back', 'they feed on fear', 'they were here first'],
    fame: 1,
  },

  // ── To Your Eternity ──
  {
    show: 'To Your Eternity',
    by: 'Fushi',
    line: 'You gotta use your strength [while you still have it].',
    decoys: ['to protect the ones you love', 'or the Nokker will take it', 'before it uses you'],
    fame: 1,
  },
  {
    show: 'To Your Eternity',
    by: 'Fushi',
    line: 'I want to meet all sorts of people and [feel all sorts of things].',
    decoys: ['learn all their names', 'protect every one of them', 'take all their forms'],
    fame: 1,
  },

  // ── BANANA FISH ──
  {
    show: 'BANANA FISH',
    by: 'Eiji Okumura',
    aka: ['Eiji'],
    line: 'If I’m going to die anyway, [at least I’ll die trying].',
    decoys: ['I want to be with Ash', 'I’ll go back to Japan', 'let it be in New York'],
    fame: 1,
  },

  // ── Nichijou - My Ordinary Life ──
  {
    show: 'Nichijou - My Ordinary Life',
    by: 'Nano Shinonome',
    aka: ['Nano'],
    line: 'I don’t have any [special features].',
    decoys: ['wind-up keys', 'robot parts', 'friends at school'],
    fame: 1,
  },

  // ── Suzume ──
  {
    show: 'Suzume',
    by: 'Suzume Iwato',
    aka: ['Suzume'],
    line: '[Ittekimasu]!',
    alt: ['I’m off'],
    decoys: ['Tadaima', 'Itadakimasu', 'Oyasumi'],
    fame: 1,
  },

  // ── The God of High School ──
  {
    show: 'The God of High School',
    by: 'Mo-Ri Jin',
    aka: ['Jin Mori', 'Mori'],
    line: 'A dream means nothing, if you don’t [grab it with your own hands]!',
    decoys: ['fight for it every day', 'share it with your friends', 'win the tournament'],
    fame: 1,
  },
  {
    show: 'The God of High School',
    by: 'Mo-Ri Jin',
    aka: ['Jin Mori', 'Mori'],
    line: 'The stronger our opponents are, [the more fun it’ll be]!',
    decoys: ['the harder I’ll train', 'the faster I’ll win', 'the more I’ll learn'],
    fame: 1,
  },

  // ── WONDER EGG PRIORITY ──
  {
    show: 'WONDER EGG PRIORITY',
    by: 'Neiru Aonuma',
    aka: ['Neiru'],
    line: 'I’m not like you. [I love myself].',
    decoys: ['I don’t need friends', 'I don’t cry', 'I’m not afraid'],
    fame: 1,
  },

  // ── The Misfit of Demon King Academy: History’s Strongest Demon King Reincarnates and Goes to School with His Descendants ──
  {
    show: 'The Misfit of Demon King Academy: History’s Strongest Demon King Reincarnates and Goes to School with His Descendants',
    by: 'Anos Voldigoad',
    aka: ['Anos'],
    line: 'Save those tears for later. If you want to [do right by your mother], I’ll create an opportunity for you now.',
    decoys: ['finish this fight', 'stand up and walk', 'bow to the Demon King'],
    fame: 1,
  },
  {
    show: 'The Misfit of Demon King Academy: History’s Strongest Demon King Reincarnates and Goes to School with His Descendants',
    by: 'Anos Voldigoad',
    aka: ['Anos'],
    line: 'But even during times of hellish suffering, isn’t [caring for one another] what families do?',
    decoys: ['fighting side by side', 'forgiving everything', 'eating dinner together'],
    fame: 1,
  },

  // ── 86 EIGHTY-SIX ──
  {
    show: '86 EIGHTY-SIX',
    by: 'Vladilena Milizé',
    aka: ['Lena'],
    line: 'The news you see every morning isn’t true. [People are dying]!',
    decoys: ['The war is lost', 'The drones are people', 'The Legion are winning'],
    fame: 2,
  },
  {
    show: '86 EIGHTY-SIX',
    by: 'Shinei Nouzen',
    aka: ['Shin', 'Undertaker'],
    line: 'I remember them. Because [I have to take them with me].',
    decoys: ['I can hear their voices', 'I promised I would', 'nobody else will'],
    fame: 2,
  },

  // ── Is It Wrong to Try to Pick Up Girls in a Dungeon? ──
  {
    show: 'Is It Wrong to Try to Pick Up Girls in a Dungeon?',
    line: 'I am [Ganesha]!',
    decoys: ['Hestia', 'Loki', 'Freya'],
    fame: 2,
  },
  {
    show: 'Is It Wrong to Try to Pick Up Girls in a Dungeon?',
    by: 'Bell Cranel',
    aka: ['Bell'],
    line: 'I wanted to save you because you’re you. I didn’t want you to leave, because you’re you. [I can’t find another reason].',
    decoys: ['That’s what a hero does', 'The goddess told me to', 'You’re part of our Familia'],
    fame: 1,
  },

  // ── Zom 100: Bucket List of the Dead ──
  {
    show: 'Zom 100: Bucket List of the Dead',
    by: 'Akira Tendou',
    aka: ['Akira', 'Akira Tendo'],
    line: 'Starting today... I don’t have to [go to work] anymore?',
    decoys: ['see my boss', 'wake up early', 'wear a tie'],
    fame: 2,
  },

  // ── BOCCHI THE ROCK! ──
  {
    show: 'BOCCHI THE ROCK!',
    by: 'Nijika Ijichi',
    aka: ['Nijika'],
    line: 'Show me [Bocchi-chan’s rock]!',
    decoys: ['your guitar solo', 'what Guitar Hero can do', 'the Kessoku Band'],
    fame: 2,
    noShow: true,
  },

  // ── Seraph of the End: Vampire Reign ──
  {
    show: 'Seraph of the End: Vampire Reign',
    by: 'Yuuichirou Hyakuya',
    aka: ['Yuichiro Hyakuya', 'Yu', 'Yuu'],
    line: 'I’ll [exterminate every last vampire]!',
    decoys: ['get Mika back', 'become a Moon Demon', 'join the Demon Army'],
    fame: 1,
  },

  // ── Vivy -Fluorite Eye's Song- ──
  {
    show: 'Vivy -Fluorite Eye\'s Song-',
    by: 'Vivy',
    line: 'My mission is to [make everyone happy by singing].',
    decoys: ['stop the war against humans', 'protect Matsumoto', 'reach the Main Stage'],
    fame: 2,
  },

  // ── Golden Kamuy ──
  {
    show: 'Golden Kamuy',
    by: 'Asirpa',
    aka: ['Asir Pa', 'Ashiripa'],
    line: 'We’re alive, so of course [we get hungry].',
    decoys: ['we get hurt', 'we have to hunt', 'we keep walking'],
    fame: 1,
  },
  {
    show: 'Golden Kamuy',
    by: 'Saichi Sugimoto',
    aka: ['Sugimoto'],
    line: 'The weak get eaten. [That’s the same everywhere], right?',
    decoys: ['That’s how the war was', 'That’s the Ainu way', 'That’s what gold does'],
    fame: 1,
  },

  // ── World Trigger ──
  {
    show: 'World Trigger',
    by: 'Yuuma Kuga',
    aka: ['Yuma Kuga', 'Yuma'],
    line: 'Rules make the world work. [They don’t protect you].',
    decoys: ['Border wrote them all', 'They break all the time', 'Neighbors don’t follow them'],
    fame: 1,
  },

  // ── Record of Ragnarok ──
  {
    show: 'Record of Ragnarok',
    by: 'Adam',
    line: 'Is there any man that needs a reason [to protect his own children]?',
    decoys: ['to fight a god', 'to defy heaven', 'to throw a punch'],
    fame: 2,
  },
  {
    show: 'Record of Ragnarok',
    line: 'If you lose your sword, then hit with your fists! If you lose your fists, then [bite with your teeth]!',
    decoys: ['pray to the gods', 'fight with your will', 'use your head'],
    fame: 1,
  },

  // ── The Apothecary Diaries ──
  {
    show: 'The Apothecary Diaries',
    by: 'Maomao',
    line: 'About what kind of [poison] I would use to die.',
    decoys: ['herb', 'knife', 'medicine'],
    fame: 2,
  },
  {
    show: 'The Apothecary Diaries',
    by: 'Maomao',
    line: 'I guess I’m the only one that enjoys [eating poison].',
    decoys: ['being a food taster', 'working in the rear palace', 'Master Jinshi’s company'],
    fame: 2,
  },

  // ── Rent-a-Girlfriend ──
  {
    show: 'Rent-a-Girlfriend',
    by: 'Kazuya Kinoshita',
    aka: ['Kazuya'],
    line: 'She may be a rental, but Mizuhara is... [the best girlfriend anyone could ask for]!',
    decoys: ['way out of my league', 'my grandma’s favourite person', 'just doing her job'],
    fame: 2,
  },

  // ── Saga of Tanya the Evil ──
  {
    show: 'Saga of Tanya the Evil',
    by: 'Tanya Degurechaff',
    aka: ['Tanya'],
    line: 'Damn you, [Being X].',
    decoys: ['General Zettour', 'the Republic', 'Lieutenant Weiss'],
    fame: 2,
  },
  {
    show: 'Saga of Tanya the Evil',
    by: 'Tanya Degurechaff',
    aka: ['Tanya'],
    line: 'Safe, rear-echelon deployments... [How I love you]!',
    decoys: ['Where did you go', 'You were a lie', 'How I miss you'],
    fame: 1,
  },

  // ── Masamune-kun's Revenge ──
  {
    show: 'Masamune-kun\'s Revenge',
    by: 'Masamune Makabe',
    aka: ['Masamune'],
    line: 'I’m going to make Adagaki Aki fall for me, and then [dump her on the spot].',
    decoys: ['tell her who I really am', 'never speak to her again', 'make her my girlfriend for real'],
    fame: 2,
  },

  // ── Arifureta: From Commonplace to World's Strongest ──
  {
    show: 'Arifureta: From Commonplace to World\'s Strongest',
    by: 'Hajime Nagumo',
    aka: ['Hajime'],
    line: 'I want to survive and go home... [Everything between me and home is my enemy]!',
    decoys: ['Nothing else matters to me', 'I’ll take whatever power I need', 'This Labyrinth won’t stop me'],
    fame: 2,
  },

  // ── Ranking of Kings ──
  {
    show: 'Ranking of Kings',
    by: 'Kage',
    line: 'It’s not fake! Someday, Bojji is gonna be [a real-life king]!',
    decoys: ['the strongest swordsman', 'my best friend forever', 'taller than his father'],
    fame: 2,
  },

  // ── Steins;Gate 0 ──
  {
    show: 'Steins;Gate 0',
    by: 'Mayuri Shiina',
    aka: ['Mayuri', 'Mayushii'],
    line: 'But... I love [Hououin Kyouma] even more!',
    decoys: ['Kurisu-san', 'the lab', 'Upa'],
    fame: 2,
  },

  // ── Blood Blockade Battlefront ──
  {
    show: 'Blood Blockade Battlefront',
    by: 'Klaus von Reinherz',
    aka: ['Klaus'],
    line: 'The human spirit can never truly... [be defeated]!',
    decoys: ['be explained', 'be bought', 'be sealed away'],
    fame: 1,
  },

  // ── Shikimori's Not Just a Cutie ──
  {
    show: 'Shikimori\'s Not Just a Cutie',
    by: 'Yuuki Izumi',
    aka: ['Izumi', 'Yuu Izumi'],
    line: 'My girlfriend is super cute, but sometimes she’s... [incredibly cool].',
    decoys: ['incredibly scary', 'a total klutz', 'way too jealous'],
    fame: 2,
  },

  // ── Alya Sometimes Hides Her Feelings in Russian ──
  {
    show: 'Alya Sometimes Hides Her Feelings in Russian',
    by: 'Masachika Kuze',
    aka: ['Masachika', 'Kuze'],
    line: 'This cute Russian girl next to me fawns over me exclusively in Russian, and [I know]!',
    decoys: ['she thinks I’m asleep', 'nobody else notices', 'she knows I know'],
    fame: 2,
  },

  // ── How NOT to Summon a Demon Lord ──
  {
    show: 'How NOT to Summon a Demon Lord',
    by: 'Diablo',
    line: 'I am Diablo, [the Demon Lord from another world]!',
    decoys: ['the strongest summoner alive', 'master of Cross Reverie', 'the one who conquers Faltra'],
    fame: 2,
  },

  // ── The World's Finest Assassin Gets Reincarnated in Another World as an Aristocrat ──
  {
    show: 'The World\'s Finest Assassin Gets Reincarnated in Another World as an Aristocrat',
    by: 'Lugh Tuatha Dé',
    aka: ['Lugh'],
    line: 'Do you want me to save the world, or do you want me to [kill the Hero]?',
    decoys: ['become the Hero', 'kill the Demon Lord', 'protect the Hero'],
    fame: 1,
  },

  // ── My Love Story with Yamada-kun at Lv999 ──
  {
    show: 'My Love Story with Yamada-kun at Lv999',
    by: 'Akane Kinoshita',
    aka: ['Akane'],
    line: 'This is why I can’t stand [gamer guys]!',
    decoys: ['college guys', 'pretty boys', 'younger guys'],
    fame: 2,
  },

  // ── Gachiakuta ──
  {
    show: 'Gachiakuta',
    line: 'Send the filth to [the Pit]!',
    decoys: ['the river', 'the furnace', 'the sky'],
    fame: 1,
  },

  // ── given ──
  {
    show: 'given',
    by: 'Mafuyu Satou',
    aka: ['Mafuyu', 'Mafuyu Sato'],
    line: 'You see, I... had someone I [really, truly loved].',
    decoys: ['never got to thank', 'played guitar with', 'promised to sing for'],
    fame: 2,
  },
];
