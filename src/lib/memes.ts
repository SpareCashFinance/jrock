export type MemeCard = {
  id: string;
  stamp: string;
  src: string;
  file: string;
  alt: string;
  caption: string;
};

export const memes: MemeCard[] = [
  {
    id: "rebuttal",
    stamp: "01",
    src: "/memes/01-rebuttal.jpg",
    file: "jrock-rebuttal.jpg",
    alt: "Jamie’s Pet Rock flexing in a navy Bitcoin tie and matching sneakers",
    caption: "Jamie said Bitcoin does nothing. The rock filed a rebuttal.",
  },
  {
    id: "lining",
    stamp: "02",
    src: "/memes/02-lining.jpg",
    file: "jrock-lining.jpg",
    alt: "The rock opening a black coat lined with glowing green candles",
    caption: "The lining is all candles. The rock does not share its coat.",
  },
  {
    id: "here-we-go",
    stamp: "03",
    src: "/memes/03-here-we-go.jpg",
    file: "jrock-here-we-go.jpg",
    alt: "The rock walking down a sunset alley, seen from behind",
    caption: "Ah shit here we go again.",
  },
  {
    id: "suburb",
    stamp: "04",
    src: "/memes/04-suburb.jpg",
    file: "jrock-suburb.jpg",
    alt: "A giant pet rock looming over a suburb in a dust storm",
    caption: "They called it a pet rock. The suburb disagrees.",
  },
  {
    id: "chart-eye",
    stamp: "05",
    src: "/memes/05-chart-eye.jpg",
    file: "jrock-chart-eye.jpg",
    alt: "Close-up of the rock’s eye with a green candlestick chart in the pupil",
    caption: "The rock only sees one chart.",
  },
  {
    id: "first-class",
    stamp: "06",
    src: "/memes/06-first-class.jpg",
    file: "jrock-first-class.jpg",
    alt: "The rock hanging onto an airplane window shade above the clouds",
    caption: "First class. Still a rock.",
  },
  {
    id: "paper-hands",
    stamp: "07",
    src: "/memes/07-paper-hands.jpg",
    file: "jrock-paper-hands.jpg",
    alt: "The rock standing in a desert sunset beside a paper-hands figure",
    caption: "Paper hands had a meeting. The rock took minutes.",
  },
];
