import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

type SeedQuestion = {
  question: string;
  choices: string[];
  correctIndex: number;
};

type SeedStory = {
  title: string;
  body: string;
  imageUrl?: string;
  questions: SeedQuestion[];
};

type SeedLevel = {
  code: string;
  title: string;
  isFree: boolean;
  stories: SeedStory[];
};

const levels: SeedLevel[] = [
  {
    code: "L1",
    title: "レベル1：ひらがなを よもう",
    isFree: true,
    stories: [
      {
        title: "くまさんと はちみつ",
        body: "くまさんが もりを あるいて います。\nあまい においが しました。\n「はちみつの におい だ！」\nくまさんは きの うえを みました。\nはちの すが ありました。\nくまさんは ゆっくり ちかづきました。\nはちみつを すこし たべました。\n「とても おいしい」と くまさんは いいました。",
        imageUrl: "/images/stories/bear-honey.svg",
        questions: [
          {
            question: "くまさんは どこを あるいて いましたか。",
            choices: ["もり", "うみ", "まち"],
            correctIndex: 0,
          },
          {
            question: "くまさんが みつけた においは なんの においでしたか。",
            choices: ["おはなの におい", "はちみつの におい", "パンの におい"],
            correctIndex: 1,
          },
          {
            question: "くまさんは さいごに どう おもいましたか。",
            choices: ["まずい", "おいしい", "からい"],
            correctIndex: 1,
          },
        ],
      },
      {
        title: "うさぎの おおきな ジャンプ",
        body: "うさぎが はたけで あそんで います。\n「たかく ジャンプ したいな」\nうさぎは おおきく いきを すいました。\nそして ぴょんと とびました。\nとても たかく とべました。\nともだちの りすが はくしゅ しました。\n「すごいね！」と りすが いいました。\nうさぎは にっこり わらいました。",
        imageUrl: "/images/stories/rabbit-jump.svg",
        questions: [
          {
            question: "うさぎは どこで あそんで いましたか。",
            choices: ["はたけ", "がっこう", "こうえん"],
            correctIndex: 0,
          },
          {
            question: "うさぎは なにを しましたか。",
            choices: ["およいだ", "ジャンプ した", "ねむった"],
            correctIndex: 1,
          },
          {
            question: "だれが はくしゅ しましたか。",
            choices: ["くま", "りす", "とり"],
            correctIndex: 1,
          },
        ],
      },
    ],
  },
  {
    code: "L2",
    title: "レベル2：かんたんな 漢字",
    isFree: true,
    stories: [
      {
        title: "雨の日の 学校",
        body: "今日は 雨が 降っています。\n太郎くんは 傘を 持って 学校へ 行きました。\n道には 大きな 水たまりが ありました。\n太郎くんは 水たまりを 上手に よけました。\n学校に 着くと、友だちが 「おはよう」と 言いました。\n太郎くんも 「おはよう」と 元気に 答えました。",
        imageUrl: "/images/stories/rainy-school.svg",
        questions: [
          {
            question: "今日の 天気は どうですか。",
            choices: ["晴れ", "雨", "雪"],
            correctIndex: 1,
          },
          {
            question: "太郎くんは 何を 持って 行きましたか。",
            choices: ["傘", "本", "ボール"],
            correctIndex: 0,
          },
          {
            question: "道には 何が ありましたか。",
            choices: ["犬", "水たまり", "花"],
            correctIndex: 1,
          },
        ],
      },
      {
        title: "海で 見つけた 貝がら",
        body: "夏休みに、花子さんは 家族と 海へ 行きました。\n砂浜を 歩いていると、きれいな 貝がらを 見つけました。\n貝がらは 白くて、小さな 星の 形を していました。\n花子さんは その 貝がらを 大切に 持ち帰りました。\n家に 帰ってから、貝がらを つくえの 上に 飾りました。",
        imageUrl: "/images/stories/beach-seashell.svg",
        questions: [
          {
            question: "花子さんは どこへ 行きましたか。",
            choices: ["山", "海", "川"],
            correctIndex: 1,
          },
          {
            question: "見つけた 貝がらは どんな 形でしたか。",
            choices: ["丸い形", "星の形", "四角い形"],
            correctIndex: 1,
          },
          {
            question: "貝がらを どこに 飾りましたか。",
            choices: ["つくえの上", "げんかん", "本だな"],
            correctIndex: 0,
          },
        ],
      },
    ],
  },
  {
    code: "L3",
    title: "レベル3：すこし ながい おはなし",
    isFree: false,
    stories: [
      {
        title: "森の音楽会",
        body: "秋になると、森の動物たちは 毎年 音楽会を 開きます。\n今年は りすさんが バイオリンを、くまさんが 太鼓を、\nうさぎさんが 歌を 担当することに なりました。\n練習の 日々が 続きましたが、なかなか 音が そろいません。\n「もう一度、みんなで 合わせてみよう」と りすさんが 提案しました。\n何度も 練習を 重ねた結果、ついに きれいな 音楽が できあがりました。\n音楽会の 当日、森中の 動物たちが 集まり、\n大きな 拍手が 鳴りやみませんでした。",
        imageUrl: "/images/stories/forest-concert.svg",
        questions: [
          {
            question: "音楽会は いつ 開かれますか。",
            choices: ["春", "夏", "秋"],
            correctIndex: 2,
          },
          {
            question: "くまさんが 担当した 楽器は 何ですか。",
            choices: ["バイオリン", "太鼓", "歌"],
            correctIndex: 1,
          },
          {
            question: "音が そろわなかったとき、りすさんは 何と 言いましたか。",
            choices: [
              "「もうやめよう」",
              "「もう一度、みんなで合わせてみよう」",
              "「ひとりでやろう」",
            ],
            correctIndex: 1,
          },
        ],
      },
      {
        title: "宇宙飛行士になった少年",
        body: "健太くんは 小さいころから 星を 見るのが 大好きでした。\n毎晩、望遠鏡で 夜空を 観察し、宇宙飛行士になる夢を 抱いていました。\n大人になった 健太くんは 一生懸命 勉強と 訓練を 続けました。\nそして ついに、宇宙船に 乗り込む日が やってきました。\n宇宙から見た地球は、青く 輝いていて、とても美しかったです。\n健太くんは 心の中で つぶやきました。\n「この景色を、いつか 子どもたちにも 見せてあげたいな」",
        imageUrl: "/images/stories/astronaut-boy.svg",
        questions: [
          {
            question: "健太くんが 小さいころ 好きだった ことは 何ですか。",
            choices: ["星を見ること", "サッカー", "絵をかくこと"],
            correctIndex: 0,
          },
          {
            question: "宇宙から見た地球は どんな色でしたか。",
            choices: ["赤色", "青色", "緑色"],
            correctIndex: 1,
          },
          {
            question: "健太くんは 心の中で 何と つぶやきましたか。",
            choices: [
              "「早く帰りたいな」",
              "「この景色を子どもたちにも見せてあげたいな」",
              "「もう宇宙はいやだな」",
            ],
            correctIndex: 1,
          },
        ],
      },
    ],
  },
];

async function main() {
  for (const [levelIndex, level] of levels.entries()) {
    const createdLevel = await prisma.level.upsert({
      where: { code: level.code },
      update: {
        title: level.title,
        order: levelIndex,
        isFree: level.isFree,
      },
      create: {
        code: level.code,
        title: level.title,
        order: levelIndex,
        isFree: level.isFree,
      },
    });

    for (const [storyIndex, story] of level.stories.entries()) {
      const existingStory = await prisma.story.findFirst({
        where: { levelId: createdLevel.id, title: story.title },
      });

      const createdStory = existingStory
        ? await prisma.story.update({
            where: { id: existingStory.id },
            data: {
              body: story.body,
              imageUrl: story.imageUrl,
              order: storyIndex,
            },
          })
        : await prisma.story.create({
            data: {
              levelId: createdLevel.id,
              title: story.title,
              body: story.body,
              imageUrl: story.imageUrl,
              order: storyIndex,
            },
          });

      // クイズは毎回作り直す（シードの単純化のため）
      await prisma.quizQuestion.deleteMany({
        where: { storyId: createdStory.id },
      });

      for (const [qIndex, q] of story.questions.entries()) {
        await prisma.quizQuestion.create({
          data: {
            storyId: createdStory.id,
            question: q.question,
            choices: JSON.stringify(q.choices),
            correctIndex: q.correctIndex,
            order: qIndex,
          },
        });
      }
    }
  }

  console.log("シードデータの投入が完了しました。");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
