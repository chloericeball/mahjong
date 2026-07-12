// Interactive lesson content. Every exercise is validated against the real
// game engine by `npm run test:lessons` (src/lessons.test.ts).

export interface TileRow {
  label?: string;
  tiles: string[]; // tile codes; '·' renders a gap
}

export type Step =
  // A short explanation with optional example tiles — no interaction.
  | { kind: 'info'; title: string; body: string; rows?: TileRow[] }
  // Tap ONE tile among `choices`; any index in `correct` is accepted.
  | { kind: 'tap'; prompt: string; rows?: TileRow[]; choices: string[]; correct: number[]; explain: string; wrong?: string }
  // Toggle-select tiles, then Check; must match `correct` exactly.
  | { kind: 'multi'; prompt: string; rows?: TileRow[]; choices: string[]; correct: number[]; explain: string; wrong?: string }
  // Tap the tile to throw away from a full 14-tile hand; any code in `correct` is accepted.
  | { kind: 'discard'; prompt: string; hand: string[]; correct: string[]; explain: string; wrong?: string }
  // Multiple-choice question with text buttons.
  | { kind: 'choice'; prompt: string; rows?: TileRow[]; options: string[]; correct: number; explain: string; wrong?: string };

export interface Lesson {
  id: string;
  icon: string;
  title: string;
  blurb: string;
  steps: Step[];
}

export const LESSONS: Lesson[] = [
  {
    id: 'tiles',
    icon: '🀇',
    title: 'Meet the Tiles',
    blurb: 'Suits, honors and flowers — learn to read every tile.',
    steps: [
      {
        kind: 'info',
        title: 'Welcome to mahjong!',
        body: 'Mahjong is played with 144 tiles. Before anything else, let\'s learn to recognize them. There are three suits numbered 1–9, plus honor tiles and bonus flowers.',
        rows: [
          { label: 'Dots 筒', tiles: ['d1', 'd5', 'd9'] },
          { label: 'Bamboo 索', tiles: ['b1', 'b5', 'b9'] },
          { label: 'Characters 萬', tiles: ['c1', 'c5', 'c9'] },
        ],
      },
      {
        kind: 'tap',
        prompt: 'Suited tiles show their number and suit symbol. Tap the DOTS (筒) tile.',
        choices: ['c3', 'b7', 'd5', 'wE'],
        correct: [2],
        explain: 'Dots tiles show a number over 筒 (barrel). This is the 5 of Dots.',
        wrong: 'Look for the 筒 symbol under the number.',
      },
      {
        kind: 'tap',
        prompt: 'Now tap the BAMBOO (索) tile.',
        choices: ['d2', 'c9', 'b4', 'gR'],
        correct: [2],
        explain: 'Bamboo tiles show a number over 索. This is the 4 of Bamboo.',
        wrong: 'Bamboo tiles carry the 索 symbol.',
      },
      {
        kind: 'tap',
        prompt: 'Character (萬) tiles use Chinese numerals: 一1 二2 三3 四4 五5 六6 七7 八8 九9. Tap the FIVE of Characters (五萬).',
        choices: ['c3', 'b5', 'c5', 'd5'],
        correct: [2],
        explain: '五 means five, 萬 marks the Characters suit — so 五萬 is the 5 of Characters.',
        wrong: '五 is the numeral for five; the tile must also show 萬.',
      },
      {
        kind: 'tap',
        prompt: 'Honor tiles have NO numbers: four winds (東南西北) and three dragons (中發白). Tap the honor tile.',
        choices: ['d9', 'b1', 'wN', 'c7'],
        correct: [2],
        explain: '北 is the North wind — an honor tile. Honors never form runs, only pairs and triplets.',
        wrong: 'Honor tiles show only a single character, no number.',
      },
      {
        kind: 'tap',
        prompt: 'Flowers are bonus tiles. Draw one and it\'s set aside for bonus points — you draw a replacement. Tap the flower.',
        choices: ['f2', 'd1', 'gG', 'b8'],
        correct: [0],
        explain: 'Flowers never stay in your hand — they go face-up next to it and earn bonus faan.',
        wrong: 'Look for the 🌸.',
      },
      {
        kind: 'info',
        title: 'You can read the tiles!',
        body: 'Recap: three suits (Dots 筒, Bamboo 索, Characters 萬) numbered 1–9 with four copies of each; winds and dragons as honors; flowers as bonuses. Next: how tiles combine into sets.',
      },
    ],
  },
  {
    id: 'sets',
    icon: '🀞',
    title: 'Runs, Triplets & Pairs',
    blurb: 'The building blocks of every winning hand.',
    steps: [
      {
        kind: 'info',
        title: 'The building blocks',
        body: 'A winning hand is FOUR sets plus ONE pair. A set is a run (three consecutive tiles, same suit) or a triplet (three identical tiles).',
        rows: [
          { label: 'Run 順子', tiles: ['b4', 'b5', 'b6'] },
          { label: 'Triplet 刻子', tiles: ['c7', 'c7', 'c7'] },
          { label: 'Pair 眼', tiles: ['gR', 'gR'] },
        ],
      },
      {
        kind: 'tap',
        prompt: 'Complete the run: tap the tile that finishes it.',
        rows: [{ tiles: ['d3', 'd4', '·'] }],
        choices: ['d5', 'd6', 'b5', 'c2'],
        correct: [0],
        explain: 'd3-d4-d5 is a run: three consecutive Dots. b5 doesn\'t work — runs never mix suits.',
        wrong: 'A run needs consecutive numbers in the SAME suit.',
      },
      {
        kind: 'tap',
        prompt: 'This one is open on both ends. Tap a tile that completes the run — there\'s more than one answer!',
        rows: [{ tiles: ['b6', 'b7', '·'] }],
        choices: ['b5', 'b8', 'b3', 'wS'],
        correct: [0, 1],
        explain: 'Both b5 (5-6-7) and b8 (6-7-8) complete it. Two-sided shapes like 6-7 are gold — twice the chances.',
        wrong: 'You need a Bamboo tile adjacent to 6-7.',
      },
      {
        kind: 'tap',
        prompt: 'Complete the TRIPLET.',
        rows: [{ tiles: ['c7', 'c7', '·'] }],
        choices: ['c7', 'c8', 'd7', 'gW'],
        correct: [0],
        explain: 'A triplet is three IDENTICAL tiles — only another c7 works. There are exactly 4 copies of each tile.',
        wrong: 'Identical means same suit AND same number.',
      },
      {
        kind: 'choice',
        prompt: 'Can these three tiles form a run?',
        rows: [{ tiles: ['d8', 'd9', 'b1'] }],
        options: ['Yes — 8, 9, 1 wraps around', 'No'],
        correct: 1,
        explain: 'No! Runs never wrap from 9 back to 1, and never cross suits. 8-9 can only be completed by a 7.',
      },
      {
        kind: 'tap',
        prompt: 'Which of these tiles can NEVER be part of a run?',
        choices: ['wW', 'd4', 'b6', 'c2'],
        correct: [0],
        explain: 'Honors (winds & dragons) have no numbers, so they only form pairs and triplets.',
        wrong: 'Think about which tile has no number.',
      },
      {
        kind: 'multi',
        prompt: 'Every winning hand needs exactly ONE pair. Select the TWO tiles that form a pair.',
        choices: ['gR', 'b2', 'gR', 'c5'],
        correct: [0, 2],
        explain: 'The two Red Dragons 中 form the pair. Hold on to pairs — they can become your "eyes" or grow into a triplet.',
        wrong: 'A pair is two identical tiles. Select both of them.',
      },
    ],
  },
  {
    id: 'win',
    icon: '🀄',
    title: 'The Winning Hand',
    blurb: '4 sets + 1 pair = 糊. Learn to spot a win.',
    steps: [
      {
        kind: 'info',
        title: 'What winning looks like',
        body: 'You win when your 14 tiles split perfectly into four sets and one pair. Sets can be any mix of runs and triplets.',
        rows: [
          { tiles: ['d1', 'd2', 'd3', '·', 'b4', 'b5', 'b6', '·', 'c7', 'c8', 'c9', '·', 'gR', 'gR', 'gR', '·', 'wE', 'wE'] },
        ],
      },
      {
        kind: 'tap',
        prompt: 'This hand of 13 needs ONE more tile to win. Tap the tile that wins!',
        rows: [{ label: 'Your hand', tiles: ['d1', 'd2', 'd3', 'b4', 'b5', 'b6', 'c7', 'c8', 'c9', 'wE', 'wE', 'wE', 'gR'] }],
        choices: ['gR', 'gG', 'wE', 'd4'],
        correct: [0],
        explain: 'The lone gR needs a partner to become the pair: three runs + wE triplet + gR pair = win!',
        wrong: 'Count the sets: three runs and the wE triplet are done. What\'s missing is the pair.',
      },
      {
        kind: 'choice',
        prompt: 'Is this a winning hand?',
        rows: [{ tiles: ['d2', 'd3', 'd4', 'b1', 'b1', 'b1', 'c6', 'c7', 'c8', 'wS', 'wS', 'wS', 'gR', 'gR'] }],
        options: ['Yes 糊!', 'No'],
        correct: 0,
        explain: 'Yes: run d2-d3-d4, triplet b1, run c6-c7-c8, triplet wS, pair gR. Four sets + one pair.',
      },
      {
        kind: 'choice',
        prompt: 'How about this one?',
        rows: [{ tiles: ['d1', 'd2', 'd3', 'b5', 'b6', 'b7', 'c2', 'c2', 'c2', 'wE', 'wE', 'wW', 'wW', 'gW'] }],
        options: ['Yes 糊!', 'No'],
        correct: 1,
        explain: 'No — after three sets, wE-wE / wW-wW / gW are two pairs and a floater. You need exactly ONE pair, and honors can\'t make runs.',
      },
      {
        kind: 'multi',
        prompt: 'Some hands wait on more than one tile. Select ALL tiles that complete this hand.',
        rows: [{ label: 'Your hand', tiles: ['d4', 'd5', 'd6', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'c1', 'c1', 'c9', 'c9'] }],
        choices: ['c1', 'c9', 'c5', 'b8'],
        correct: [0, 1],
        explain: 'c1-c1 / c9-c9 is a dual-pair wait: a third c1 makes a triplet with c9 as the pair — or vice versa.',
        wrong: 'Two pairs sit at the end of the hand. Either one can grow into the triplet.',
      },
    ],
  },
  {
    id: 'turns',
    icon: '🀐',
    title: 'Draw & Discard',
    blurb: 'Play real turns and learn which tile to let go.',
    steps: [
      {
        kind: 'info',
        title: 'Your turn',
        body: 'You always hold 13 tiles. Each turn: DRAW one (now 14), then DISCARD one. If the drawn tile completes your hand you declare a self-draw win 自摸 instead. Time to practice choosing discards!',
      },
      {
        kind: 'discard',
        prompt: 'You just drew wN (North wind). Tap the best tile to discard.',
        hand: ['d2', 'd3', 'd4', 'b6', 'b7', 'b8', 'c3', 'c4', 'c5', 'c8', 'c8', 'gW', 'gW', 'wN'],
        correct: ['wN'],
        explain: 'The lone North wind can\'t join a run and has no partner. Throwing it leaves you READY: c8 or gW completes your hand!',
        wrong: 'Everything else is part of a run or a pair. Which tile is all alone with no future?',
      },
      {
        kind: 'discard',
        prompt: 'Harder: nothing here is an honor. Tap the tile this hand needs least.',
        hand: ['d4', 'd5', 'd6', 'b3', 'b4', 'b5', 'b9', 'c2', 'c3', 'c4', 'c6', 'c7', 'gG', 'gG'],
        correct: ['b9'],
        explain: 'The isolated b9 only extends one way (needs exactly b7-b8). Dropping it leaves c6-c7 waiting on c5 or c8 — a two-sided wait, and you\'re ready!',
        wrong: 'Middle tiles make runs easily; edge tiles (1s and 9s) with no neighbors don\'t. Find the stranded tile.',
      },
      {
        kind: 'choice',
        prompt: 'You draw a flower 🌸. What happens?',
        options: [
          'Keep it in your hand as a wildcard',
          'Set it aside face-up and draw a replacement tile',
          'You must discard it',
        ],
        correct: 1,
        explain: 'Flowers go face-up beside your hand for bonus faan, and you immediately draw again. It costs you nothing!',
      },
      {
        kind: 'choice',
        prompt: 'Early in a hand, which discard is usually SAFEST for you to throw first?',
        options: ['A middle tile like c5', 'A lone honor like wW', 'One of a pair'],
        correct: 1,
        explain: 'Lone honors are hard to use (no runs!) and early on nobody is ready to punish you. Keep flexible middle tiles and never break pairs without reason.',
      },
    ],
  },
  {
    id: 'claims',
    icon: '🀅',
    title: 'Claiming Discards',
    blurb: 'Chow, Pung, Kong — take what others throw away.',
    steps: [
      {
        kind: 'info',
        title: 'Stealing tiles (legally)',
        body: 'When someone discards a tile you need, you can CLAIM it: Chow 上 completes a run (only from the player on your LEFT), Pung 碰 completes a triplet (from ANYONE), Kong 槓 is four-of-a-kind, and Win 糊 beats everything. Claimed sets go face-up and are locked.',
      },
      {
        kind: 'choice',
        prompt: 'You hold c4-c5. The player on your LEFT discards c3. What can you call?',
        rows: [{ label: 'You hold', tiles: ['c4', 'c5'] }, { label: 'Discarded', tiles: ['c3'] }],
        options: ['Chow 上', 'Pung 碰', 'Nothing'],
        correct: 0,
        explain: 'c3-c4-c5 is a run, and the tile came from your left — a legal Chow. The set is placed face-up, then you discard.',
      },
      {
        kind: 'choice',
        prompt: 'You hold b8-b8. The player ACROSS the table discards b8. What can you call?',
        rows: [{ label: 'You hold', tiles: ['b8', 'b8'] }, { label: 'Discarded', tiles: ['b8'] }],
        options: ['Chow 上', 'Pung 碰', 'Nothing — wrong player'],
        correct: 1,
        explain: 'Pung! Unlike Chow, a Pung can be claimed from ANY player at the table.',
      },
      {
        kind: 'choice',
        prompt: 'You hold d6-d7. The player ACROSS discards d5. Can you Chow it?',
        rows: [{ label: 'You hold', tiles: ['d6', 'd7'] }, { label: 'Discarded', tiles: ['d5'] }],
        options: ['Yes', 'No'],
        correct: 1,
        explain: 'No — Chow only works on discards from the player to your LEFT. (If d5 completed a WIN, you could claim it from anyone.)',
      },
      {
        kind: 'choice',
        prompt: 'Two players want the same discard: you call Pung, an opponent calls Win. Who gets the tile?',
        options: ['You — Pung was called first', 'The winner', 'The dealer decides'],
        correct: 1,
        explain: 'Priority is fixed: Win beats Pung/Kong, which beat Chow. Speed doesn\'t matter.',
      },
      {
        kind: 'choice',
        prompt: 'Claiming has a cost. What do you give up when you Pung?',
        options: [
          'Nothing — free tiles are always good',
          'The set is exposed and locked, and you lose the Fully Concealed bonus',
          'You must skip your next turn',
        ],
        correct: 1,
        explain: 'Exposed sets can never change, reveal your plan to opponents, and a hand with claims loses the 門前清 concealed bonus. Claim when it clearly speeds you up.',
      },
    ],
  },
  {
    id: 'waits',
    icon: '🀃',
    title: 'Ready Hands & Waits',
    blurb: 'Read your own hand: know exactly which tiles win.',
    steps: [
      {
        kind: 'info',
        title: 'Ready 聽牌',
        body: 'When you\'re ONE tile from winning, you are ready (tenpai / 聽牌). Strong players always know which tiles they\'re waiting for — and how many are left. Let\'s train that skill.',
      },
      {
        kind: 'multi',
        prompt: 'Select ALL the tiles this hand wins on.',
        rows: [{ label: 'Your hand', tiles: ['d1', 'd2', 'd3', 'd4', 'b5', 'b6', 'b7', 'c3', 'c4', 'c5', 'gR', 'gR', 'gR'] }],
        choices: ['d1', 'd4', 'd2', 'b4'],
        correct: [0, 1],
        explain: 'd1-d2-d3-d4 splits two ways: d1 makes the d1-d1 pair + d2-d3-d4 run, while d4 makes the d1-d2-d3 run + d4-d4 pair. Two waits!',
        wrong: 'Four in a row (1-2-3-4) can split two ways: run + pair on either end.',
      },
      {
        kind: 'multi',
        prompt: 'This one has a closed wait. Select ALL winning tiles.',
        rows: [{ label: 'Your hand', tiles: ['b4', 'b6', 'c1', 'c2', 'c3', 'd7', 'd8', 'd9', 'wS', 'wS', 'wS', 'gG', 'gG'] }],
        choices: ['b5', 'b3', 'b7', 'gG'],
        correct: [0],
        explain: 'b4-_-b6 needs exactly b5 to fill the gap. A closed wait 坎張 — only 4 copies exist, so it\'s a narrow wait.',
        wrong: 'Everything is complete except b4 and b6. What fits between them?',
      },
      {
        kind: 'discard',
        prompt: 'You\'re NOT ready yet — but one discard gets you there. Tap it.',
        hand: ['c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'd8', 'd8', 'b1', 'b2', 'b3', 'wN', 'wN', 'wW'],
        correct: ['wW'],
        explain: 'Dropping the lone West wind leaves two runs + b1-b2-b3 + d8-d8 + wN-wN: ready, winning on d8 or wN.',
        wrong: 'Find the tile with no partner and no run potential.',
      },
      {
        kind: 'choice',
        prompt: 'Which wait would you rather have?',
        options: [
          'b7-b8 waiting on b6 or b9 (up to 8 winning tiles)',
          'b1-b2 waiting on b3 only (up to 4 winning tiles)',
        ],
        correct: 0,
        explain: 'Two-sided waits win twice as often. When you have a choice, shape your hand toward open waits — and watch the discard pool to see how many of your winning tiles are already gone.',
      },
    ],
  },
  {
    id: 'scoring',
    icon: '🀆',
    title: 'Scoring: Faan 番',
    blurb: 'Bigger patterns, bigger payouts — learn what\'s worth chasing.',
    steps: [
      {
        kind: 'info',
        title: 'How payouts work',
        body: 'Your hand\'s patterns earn faan 番, and each faan DOUBLES the base payout (base = 2^faan). Win by discard: the discarder pays 3× base. Self-draw 自摸: all three opponents pay — every faan matters!',
      },
      {
        kind: 'choice',
        prompt: 'This winning hand is one suit + honors. Which pattern is that, and how much is it worth?',
        rows: [{ tiles: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9', 'wE', 'wE', 'wE', 'gG', 'gG'] }],
        options: ['Mixed One Suit 混一色 — 3 faan', 'Pure One Suit 清一色 — 7 faan', 'Common Hand 平糊 — 1 faan'],
        correct: 0,
        explain: 'One suit PLUS honors = Mixed One Suit, 3 faan. Drop the honors for a pure single suit and it jumps to 7 faan.',
      },
      {
        kind: 'choice',
        prompt: 'You have a triplet of Red Dragons 中中中. What does it add?',
        rows: [{ tiles: ['gR', 'gR', 'gR'] }],
        options: ['Nothing — dragons are just honors', '1 faan', '8 faan'],
        correct: 1,
        explain: 'Each dragon triplet = 1 faan. Collect ALL THREE dragon triplets for Great Dragons 大三元 — 8 faan!',
      },
      {
        kind: 'choice',
        prompt: 'Which hand pays more?',
        options: ['All Triplets 對對糊 (3 faan)', 'Pure One Suit 清一色 (7 faan)'],
        correct: 1,
        explain: 'Pure One Suit is one of the best realistic hands: 7 faan = 128× base payout vs 8× for All Triplets.',
      },
      {
        kind: 'choice',
        prompt: 'You win by SELF-DRAW 自摸. Who pays you?',
        options: ['Only the last discarder', 'All three opponents', 'The dealer'],
        correct: 1,
        explain: 'Self-draw: everyone pays. Win by discard: the discarder pays triple — which is why careless discards are so expensive. That\'s the whole game in one sentence: build fast, discard safe.',
      },
      {
        kind: 'info',
        title: 'You\'re ready to play! 🎉',
        body: 'You know the tiles, sets, turns, claims, waits and scoring. Jump into a game vs AI with Coach mode ON — it will show your waits and suggest discards while you find your feet. 祝你好運!',
      },
    ],
  },
];
