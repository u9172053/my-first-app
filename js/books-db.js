import { JA_BOOKS, JA_CLASSICS } from './books-ja.js';
import { EN_EXACT, EN_EXTRA } from './books-en.js';

// ============================================================
//  人気の本プリセット
//  ※語数・文字数はすべて「目安」です（版によって異なります）。
//    記録するときに画面上で修正できます。
//  lv = 読みやすさレベルの目安（0.0〜9.9、SSSのYLに近い感覚）
// ============================================================

// [タイトル, 著者, シリーズ, 語数, レベル]
const EN = [
  // --- 絵本（はじめての1冊） ---
  ['Rosie\'s Walk', 'Pat Hutchins', '', 32, 0.2],
  ['No, David!', 'David Shannon', 'David', 40, 0.2],
  ['Where\'s Spot?', 'Eric Hill', 'Spot', 60, 0.2],
  ['Dear Zoo', 'Rod Campbell', '', 110, 0.3],
  ['Each Peach Pear Plum', 'Janet & Allan Ahlberg', '', 100, 0.4],
  ['David Goes to School', 'David Shannon', 'David', 100, 0.3],
  ['Goodnight Moon', 'Margaret Wise Brown', '', 130, 0.5],
  ['Brown Bear, Brown Bear, What Do You See?', 'Bill Martin Jr. / Eric Carle', 'Bear', 196, 0.4],
  ['Polar Bear, Polar Bear, What Do You Hear?', 'Bill Martin Jr. / Eric Carle', 'Bear', 230, 0.5],
  ['Panda Bear, Panda Bear, What Do You See?', 'Bill Martin Jr. / Eric Carle', 'Bear', 200, 0.5],
  ['From Head to Toe', 'Eric Carle', 'Eric Carle', 220, 0.4],
  ['The Very Hungry Caterpillar', 'Eric Carle', 'Eric Carle', 224, 0.8],
  ['The Very Busy Spider', 'Eric Carle', 'Eric Carle', 300, 0.8],
  ['Go Away, Big Green Monster!', 'Ed Emberley', '', 200, 0.4],
  ['Don\'t Let the Pigeon Drive the Bus!', 'Mo Willems', 'Pigeon', 160, 0.5],
  ['The Pigeon Finds a Hot Dog!', 'Mo Willems', 'Pigeon', 250, 0.6],
  ['Five Little Monkeys Jumping on the Bed', 'Eileen Christelow', 'Five Little Monkeys', 250, 0.6],
  ['Pete the Cat: I Love My White Shoes', 'Eric Litwin / James Dean', 'Pete the Cat', 280, 0.7],
  ['Pete the Cat and His Four Groovy Buttons', 'Eric Litwin / James Dean', 'Pete the Cat', 300, 0.7],
  ['If You Give a Mouse a Cookie', 'Laura Numeroff', 'If You Give...', 291, 1.0],
  ['Little Blue Truck', 'Alice Schertle', 'Little Blue Truck', 300, 0.9],
  ['Llama Llama Red Pajama', 'Anna Dewdney', 'Llama Llama', 300, 0.9],
  ['The Snowy Day', 'Ezra Jack Keats', '', 320, 1.0],
  ['Where the Wild Things Are', 'Maurice Sendak', '', 338, 1.2],
  ['Owl Babies', 'Martin Waddell', '', 360, 1.0],
  ['Swimmy', 'Leo Lionni', 'Leo Lionni', 360, 1.3],
  ['Chicka Chicka Boom Boom', 'Bill Martin Jr.', '', 400, 0.8],
  ['Press Here', 'Hervé Tullet', '', 400, 0.6],
  ['Guess How Much I Love You', 'Sam McBratney', '', 420, 1.0],
  ['Click, Clack, Moo: Cows That Type', 'Doreen Cronin', '', 470, 1.4],
  ['We\'re Going on a Bear Hunt', 'Michael Rosen', '', 500, 0.9],
  ['Peace at Last', 'Jill Murphy', '', 500, 1.0],
  ['Frederick', 'Leo Lionni', 'Leo Lionni', 500, 1.5],
  ['The Pout-Pout Fish', 'Deborah Diesen', 'Pout-Pout Fish', 500, 1.4],
  ['Madeline', 'Ludwig Bemelmans', 'Madeline', 600, 1.5],
  ['Dragons Love Tacos', 'Adam Rubin', '', 600, 1.5],
  ['The Giving Tree', 'Shel Silverstein', '', 620, 1.2],
  ['Caps for Sale', 'Esphyr Slobodkina', '', 670, 1.4],
  ['The Gruffalo', 'Julia Donaldson', 'Gruffalo', 700, 1.5],
  ['The Gruffalo\'s Child', 'Julia Donaldson', 'Gruffalo', 750, 1.6],
  ['Elmer', 'David McKee', 'Elmer', 750, 1.5],
  ['Harold and the Purple Crayon', 'Crockett Johnson', '', 760, 1.3],
  ['Room on the Broom', 'Julia Donaldson', 'Julia Donaldson', 900, 1.6],
  ['The Tiger Who Came to Tea', 'Judith Kerr', '', 900, 1.5],
  ['The Tale of Peter Rabbit', 'Beatrix Potter', 'Peter Rabbit', 950, 2.2],
  ['The Rainbow Fish', 'Marcus Pfister', 'Rainbow Fish', 1000, 1.8],
  ['Corduroy', 'Don Freeman', 'Corduroy', 1000, 1.8],
  ['The Snail and the Whale', 'Julia Donaldson', 'Julia Donaldson', 1000, 1.8],
  ['Owl Moon', 'Jane Yolen', '', 1000, 2.2],
  ['The Day the Crayons Quit', 'Drew Daywalt', '', 1100, 2.0],
  ['Chrysanthemum', 'Kevin Henkes', '', 1900, 2.4],
  ['Curious George', 'H. A. Rey', 'Curious George', 2200, 2.0],

  // --- Dr. Seuss ---
  ['Hop on Pop', 'Dr. Seuss', 'Dr. Seuss', 380, 0.7],
  ['Green Eggs and Ham', 'Dr. Seuss', 'Dr. Seuss', 770, 0.9],
  ['One Fish Two Fish Red Fish Blue Fish', 'Dr. Seuss', 'Dr. Seuss', 900, 1.0],
  ['Fox in Socks', 'Dr. Seuss', 'Dr. Seuss', 900, 1.4],
  ['The Cat in the Hat', 'Dr. Seuss', 'Dr. Seuss', 1626, 1.4],
  ['The Cat in the Hat Comes Back', 'Dr. Seuss', 'Dr. Seuss', 1700, 1.5],
  ['Go, Dog. Go!', 'P. D. Eastman', 'Bright and Early', 700, 0.8],
  ['Are You My Mother?', 'P. D. Eastman', 'Beginner Books', 670, 0.9],

  // --- Mo Willems: Elephant & Piggie ---
  ['Today I Will Fly! (Elephant & Piggie)', 'Mo Willems', 'Elephant & Piggie', 200, 0.4],
  ['There Is a Bird on Your Head! (Elephant & Piggie)', 'Mo Willems', 'Elephant & Piggie', 250, 0.5],
  ['We Are in a Book! (Elephant & Piggie)', 'Mo Willems', 'Elephant & Piggie', 350, 0.6],
  ['Should I Share My Ice Cream? (Elephant & Piggie)', 'Mo Willems', 'Elephant & Piggie', 300, 0.6],
  ['I Will Take a Nap! (Elephant & Piggie)', 'Mo Willems', 'Elephant & Piggie', 300, 0.6],
  ['Elephant & Piggie（1冊・平均）', 'Mo Willems', 'Elephant & Piggie', 300, 0.6],
  ['Knuffle Bunny', 'Mo Willems', 'Knuffle Bunny', 300, 0.9],

  // --- 段階別リーダー（シリーズ平均） ---
  ['Oxford Reading Tree Stage 1+（1冊）', 'Roderick Hunt', 'ORT', 40, 0.1],
  ['Oxford Reading Tree Stage 2（1冊）', 'Roderick Hunt', 'ORT', 70, 0.2],
  ['Oxford Reading Tree Stage 3（1冊）', 'Roderick Hunt', 'ORT', 120, 0.3],
  ['Oxford Reading Tree Stage 4（1冊）', 'Roderick Hunt', 'ORT', 200, 0.5],
  ['Oxford Reading Tree Stage 5（1冊）', 'Roderick Hunt', 'ORT', 280, 0.7],
  ['Oxford Reading Tree Stage 6（1冊）', 'Roderick Hunt', 'ORT', 400, 0.9],
  ['Oxford Reading Tree Stage 7（1冊）', 'Roderick Hunt', 'ORT', 600, 1.1],
  ['Oxford Reading Tree Stage 8（1冊）', 'Roderick Hunt', 'ORT', 850, 1.3],
  ['Oxford Reading Tree Stage 9（1冊）', 'Roderick Hunt', 'ORT', 1100, 1.5],
  ['Scholastic Sight Word Readers（1冊）', 'Scholastic', 'Sight Word Readers', 50, 0.1],
  ['Learn to Read（Creative Teaching Press・1冊）', 'Creative Teaching Press', 'Learn to Read', 50, 0.1],
  ['Bob Books（1冊）', 'Bobby Lynn Maslen', 'Bob Books', 60, 0.1],
  ['Usborne Very First Reading（1冊）', 'Usborne', 'Usborne Very First Reading', 250, 0.5],
  ['Usborne Phonics Readers（1冊）', 'Usborne', 'Usborne Phonics Readers', 150, 0.3],
  ['Step into Reading Step 1（1冊）', 'Random House', 'Step into Reading', 150, 0.4],
  ['Step into Reading Step 2（1冊）', 'Random House', 'Step into Reading', 400, 0.8],
  ['Step into Reading Step 3（1冊）', 'Random House', 'Step into Reading', 1000, 1.4],
  ['Step into Reading Step 4（1冊）', 'Random House', 'Step into Reading', 2500, 2.2],
  ['I Can Read! My First（1冊）', 'HarperCollins', 'I Can Read!', 200, 0.5],
  ['I Can Read! Level 1（1冊）', 'HarperCollins', 'I Can Read!', 600, 1.0],
  ['I Can Read! Level 2（1冊）', 'HarperCollins', 'I Can Read!', 1200, 1.6],
  ['Peppa Pig（絵本・1冊）', 'Ladybird', 'Peppa Pig', 300, 0.7],
  ['Biscuit', 'Alyssa Satin Capucilli', 'Biscuit', 150, 0.3],
  ['Biscuit Finds a Friend', 'Alyssa Satin Capucilli', 'Biscuit', 140, 0.3],
  ['Biscuit（1冊・平均）', 'Alyssa Satin Capucilli', 'Biscuit', 150, 0.3],
  ['Pete the Cat I Can Read（1冊）', 'James Dean', 'Pete the Cat', 300, 0.6],
  ['Clifford the Big Red Dog', 'Norman Bridwell', 'Clifford', 300, 0.8],
  ['Little Critter（1冊）', 'Mercer Mayer', 'Little Critter', 300, 0.8],
  ['Fancy Nancy I Can Read（1冊）', 'Jane O\'Connor', 'Fancy Nancy', 500, 1.2],
  ['Splat the Cat（I Can Read・1冊）', 'Rob Scotton', 'Splat the Cat', 500, 1.0],
  ['Hi! Fly Guy', 'Tedd Arnold', 'Fly Guy', 400, 0.8],
  ['Fly Guy（1冊・平均）', 'Tedd Arnold', 'Fly Guy', 700, 1.0],
  ['Henry and Mudge（1冊）', 'Cynthia Rylant', 'Henry and Mudge', 800, 1.3],
  ['Mr. Putter & Tabby（1冊）', 'Cynthia Rylant', 'Mr. Putter & Tabby', 1000, 1.6],
  ['Arthur（絵本・1冊）', 'Marc Brown', 'Arthur', 1200, 1.8],
  ['Berenstain Bears（1冊）', 'Stan & Jan Berenstain', 'Berenstain Bears', 1500, 1.8],
  ['Little Bear', 'Else Holmelund Minarik', 'Little Bear', 1600, 1.4],
  ['Nate the Great', 'Marjorie Weinman Sharmat', 'Nate the Great', 1600, 1.8],
  ['Frog and Toad Are Friends', 'Arnold Lobel', 'Frog and Toad', 2200, 1.8],
  ['Frog and Toad Together', 'Arnold Lobel', 'Frog and Toad', 2300, 1.8],
  ['Frog and Toad All Year', 'Arnold Lobel', 'Frog and Toad', 2300, 1.9],
  ['Days with Frog and Toad', 'Arnold Lobel', 'Frog and Toad', 2500, 1.9],
  ['Amelia Bedelia', 'Peggy Parish', 'Amelia Bedelia', 2200, 2.0],
  ['Mercy Watson to the Rescue', 'Kate DiCamillo', 'Mercy Watson', 2100, 2.3],

  // --- チャプターブック ---
  ['The Princess in Black（1冊）', 'Shannon Hale', 'Princess in Black', 3000, 2.5],
  ['Cam Jansen（1冊）', 'David A. Adler', 'Cam Jansen', 4000, 2.8],
  ['Magic Tree House #1 Dinosaurs Before Dark', 'Mary Pope Osborne', 'Magic Tree House', 4700, 2.6],
  ['Magic Tree House #2 The Knight at Dawn', 'Mary Pope Osborne', 'Magic Tree House', 5000, 2.6],
  ['Magic Tree House #3 Mummies in the Morning', 'Mary Pope Osborne', 'Magic Tree House', 5000, 2.6],
  ['Magic Tree House #4 Pirates Past Noon', 'Mary Pope Osborne', 'Magic Tree House', 5300, 2.6],
  ['Magic Tree House（1冊・平均）', 'Mary Pope Osborne', 'Magic Tree House', 6000, 2.8],
  ['Flat Stanley', 'Jeff Brown', 'Flat Stanley', 4800, 2.8],
  ['Rainbow Magic（1冊）', 'Daisy Meadows', 'Rainbow Magic', 5000, 3.0],
  ['Owl Diaries（1冊）', 'Rebecca Elliott', 'Owl Diaries', 5000, 2.5],
  ['Dog Man #1', 'Dav Pilkey', 'Dog Man', 6000, 2.5],
  ['Dog Man（1冊・平均）', 'Dav Pilkey', 'Dog Man', 7000, 2.6],
  ['Junie B. Jones and the Stupid Smelly Bus', 'Barbara Park', 'Junie B. Jones', 6600, 3.0],
  ['Junie B. Jones（1冊・平均）', 'Barbara Park', 'Junie B. Jones', 7000, 3.0],
  ['A to Z Mysteries（1冊）', 'Ron Roy', 'A to Z Mysteries', 6500, 3.2],
  ['Horrid Henry（1冊）', 'Francesca Simon', 'Horrid Henry', 9000, 3.5],
  ['The Kingdom of Wrenly（1冊）', 'Jordan Quinn', 'Kingdom of Wrenly', 7000, 3.0],
  ['Dragon Masters（1冊）', 'Tracey West', 'Dragon Masters', 8000, 3.2],
  ['Captain Underpants #1', 'Dav Pilkey', 'Captain Underpants', 7000, 3.0],
  ['Geronimo Stilton（1冊）', 'Geronimo Stilton', 'Geronimo Stilton', 8000, 3.5],
  ['The Hundred Dresses', 'Eleanor Estes', '', 7700, 4.0],
  ['Sarah, Plain and Tall', 'Patricia MacLachlan', '', 8500, 4.0],
  ['The Twits', 'Roald Dahl', 'Roald Dahl', 8000, 4.0],
  ['Fantastic Mr Fox', 'Roald Dahl', 'Roald Dahl', 9300, 4.2],
  ['Zoey and Sassafras（1冊）', 'Asia Citro', 'Zoey and Sassafras', 12000, 4.0],
  ['George\'s Marvellous Medicine', 'Roald Dahl', 'Roald Dahl', 12000, 4.5],

  // --- 児童書 ---
  ['Diary of a Wimpy Kid #1', 'Jeff Kinney', 'Diary of a Wimpy Kid', 19000, 5.0],
  ['Diary of a Wimpy Kid（1冊・平均）', 'Jeff Kinney', 'Diary of a Wimpy Kid', 21000, 5.0],
  ['Because of Winn-Dixie', 'Kate DiCamillo', '', 22000, 5.0],
  ['Stuart Little', 'E. B. White', 'E. B. White', 26000, 5.5],
  ['Number the Stars', 'Lois Lowry', '', 27000, 5.5],
  ['Charlie and the Chocolate Factory', 'Roald Dahl', 'Roald Dahl', 30600, 5.5],
  ['James and the Giant Peach', 'Roald Dahl', 'Roald Dahl', 31000, 5.8],
  ['Charlotte\'s Web', 'E. B. White', 'E. B. White', 32000, 6.0],
  ['Bridge to Terabithia', 'Katherine Paterson', '', 33000, 6.0],
  ['The BFG', 'Roald Dahl', 'Roald Dahl', 37000, 6.0],
  ['The Lion, the Witch and the Wardrobe', 'C. S. Lewis', 'Narnia', 38400, 6.5],
  ['Matilda', 'Roald Dahl', 'Roald Dahl', 40000, 6.0],
  ['Hatchet', 'Gary Paulsen', '', 43000, 6.5],
  ['Holes', 'Louis Sachar', '', 47000, 6.5],
  ['Wonder', 'R. J. Palacio', '', 73000, 6.0],
  ['Harry Potter and the Philosopher\'s Stone', 'J. K. Rowling', 'Harry Potter', 77000, 7.5],
  ['Harry Potter and the Chamber of Secrets', 'J. K. Rowling', 'Harry Potter', 85000, 7.5],
  ['Percy Jackson and the Lightning Thief', 'Rick Riordan', 'Percy Jackson', 87000, 7.0],
  ['Harry Potter and the Prisoner of Azkaban', 'J. K. Rowling', 'Harry Potter', 107000, 7.8],
];


let _id = 0;
const normTitle = (t) => t.toLowerCase().replace(/[^a-z0-9]/g, '');
const EXACT_BY_TITLE = new Map(EN_EXACT.map((r) => [normTitle(r[0]), r]));
const EN_TITLES = new Set(EN.map((r) => normTitle(r[0])));
export const PRESET_BOOKS = [
  // 定番（手で選んだ本）。全文から数えた語数がある本はそちらを使う
  ...EN.map(([title, author, series, count, lv]) => {
    const ex = EXACT_BY_TITLE.get(normTitle(title));
    return ex
      ? { pid: 'p' + (++_id), lang: 'en', title, author, series, count: ex[2], lv, exact: true, isbn: ex[4], olCover: ex[5], classic: true }
      : { pid: 'p' + (++_id), lang: 'en', title, author, series, count, lv, classic: true };
  }),
  // 名作（Project Gutenberg の全文から数えた実際の語数）
  ...EN_EXACT.filter((r) => !EN_TITLES.has(normTitle(r[0]))).map(([title, author, count, lv, isbn, olCover, pg, rl]) => ({
    pid: 'g' + pg, lang: 'en', title, author, series: author, count, lv, exact: true, isbn, olCover, rl, classic: true,
  })),
  // 定番作家の作品（語数は推定）
  ...EN_EXTRA.map(([title, author, series, count, lv, isbn, olCover, rl]) => ({
    pid: 'e' + isbn, lang: 'en', title, author, series, count, lv, isbn, olCover, rl,
  })),
  // 日本語の本は文字数のデータがないので count=0（記録時に任意で入力）。おすすめは対象年齢で選ぶ
  ...JA_BOOKS.map(([title, author, series, age, isbn, coverOnly]) => ({
    pid: 'j' + (isbn || title), lang: 'ja', title, author, series, count: 0, lv: null, age,
    classic: JA_CLASSICS.has(title),    // 定番（優先して出す）
    coverIsbn: coverOnly || isbn || '', // 表紙を探すISBN
    isbn: isbn || '',                   // 購入リンク用
  })),
];

// 日本語の本の文字数の目安ボタン
export const JA_CHAR_PRESETS = [
  { label: '赤ちゃん絵本', chars: 150 },
  { label: '絵本', chars: 1000 },
  { label: '長めの絵本', chars: 3000 },
  { label: '幼年童話', chars: 10000 },
  { label: '児童書', chars: 40000 },
];

// 「シリーズ（1冊）」の表紙に使う代表作（表紙の検索にだけ使います）
export const COVER_QUERY = {
  'ORT': ['Oxford Reading Tree', ''],
  'Sight Word Readers': ['Sight Word Readers', 'Scholastic'],
  'Learn to Read': ['Learn to Read', 'Creative Teaching Press'],
  'Bob Books': ['Bob Books Set 1 Beginning Readers', ''],
  'Usborne Very First Reading': ['Usborne Very First Reading', ''],
  'Usborne Phonics Readers': ['Fox on a Box', 'Phil Roxbee Cox'],
  'Peppa Pig': ['Peppa Pig', 'Ladybird'],
  'Pete the Cat': ['Pete the Cat: Play Ball!', 'James Dean'],
  'Little Critter': ['Just Me and My Dad', 'Mercer Mayer'],
  'Fancy Nancy': ['Fancy Nancy and the Boy from Paris', "Jane O'Connor"],
  'Splat the Cat': ['Splat the Cat: A Whale of a Tale', 'Rob Scotton'],
  'Henry and Mudge': ['Henry and Mudge: The First Book', 'Cynthia Rylant'],
  'Mr. Putter & Tabby': ['Mr. Putter & Tabby Pour the Tea', 'Cynthia Rylant'],
  'Arthur': ["Arthur's Nose", 'Marc Brown'],
  'Berenstain Bears': ['The Berenstain Bears and the Spooky Old Tree', 'Stan Berenstain'],
  'Princess in Black': ['The Princess in Black', 'Shannon Hale'],
  'Cam Jansen': ['Cam Jansen and the Mystery of the Stolen Diamonds', 'David A. Adler'],
  'Rainbow Magic': ['Ruby the Red Fairy', 'Daisy Meadows'],
  'Owl Diaries': ["Eva's Treetop Festival", 'Rebecca Elliott'],
  'A to Z Mysteries': ['The Absent Author', 'Ron Roy'],
  'Horrid Henry': ['Horrid Henry', 'Francesca Simon'],
  'Kingdom of Wrenly': ['The Lost Stone', 'Jordan Quinn'],
  'Dragon Masters': ['Rise of the Earth Dragon', 'Tracey West'],
  'Geronimo Stilton': ['Lost Treasure of the Emerald Eye', 'Geronimo Stilton'],
  'Zoey and Sassafras': ['Dragons and Marshmallows', 'Asia Citro'],
  'Elephant & Piggie': ['We Are in a Book!', 'Mo Willems'],
  'Biscuit': ['Biscuit', 'Alyssa Satin Capucilli'],
  'Fly Guy': ['Hi! Fly Guy', 'Tedd Arnold'],
  'Magic Tree House': ['Dinosaurs Before Dark', 'Mary Pope Osborne'],
  'Dog Man': ['Dog Man', 'Dav Pilkey'],
  'Junie B. Jones': ['Junie B. Jones and the Stupid Smelly Bus', 'Barbara Park'],
  'Diary of a Wimpy Kid': ['Diary of a Wimpy Kid', 'Jeff Kinney'],
};
