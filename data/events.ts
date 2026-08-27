export type CommunityEvent = {
  slug: string;
  title: string;
  banglaTitle: string;
  date: string; // ISO
  endTime?: string;
  venue: string;
  city: string;
  tag: string;
  free: boolean;
  blurb: string;
  description: string[];
  palette: "green" | "red" | "gold" | "teal";
};

export const events: CommunityEvent[] = [
  {
    slug: "pitha-utshob-2026",
    title: "Pitha Utshob & Winter Reunion",
    banglaTitle: "Pitha Utshob",
    date: "2026-12-05T17:00:00",
    endTime: "10:00 PM",
    venue: "Riverside Community Hall",
    city: "Salt Lake City, UT",
    tag: "Festival",
    free: true,
    blurb:
      "An evening of warm winter pithas, folk songs, and reunion. The sweetest night of the year.",
    description: [
      "Winter in Bangladesh means pitha, and Utha USA brings that warmth to Utah. Families bring their best bhapa, patishapta, chitoi, and dudh puli, and the community votes for the Pitha Champion of the year.",
      "The evening features live folk music (baul and bhatiali), a children's recitation corner, and steaming cups of cha with adda late into the night. Entry is free and open to everyone. Bring your family, bring a plate, bring your stories.",
    ],
    palette: "gold",
  },
  {
    slug: "bijoy-dibosh-2026",
    title: "Victory Day Celebration",
    banglaTitle: "Victory Day",
    date: "2026-12-16T18:00:00",
    endTime: "9:30 PM",
    venue: "Heritage Auditorium",
    city: "Salt Lake City, UT",
    tag: "National Day",
    free: true,
    blurb:
      "Honoring December 16, 1971 with songs of freedom, tributes, and the flag held high, together.",
    description: [
      "December 16 belongs to every Bangladeshi heart. Utha USA gathers to honor the martyrs and celebrate the birth of Bangladesh with patriotic songs, poetry, and a documentary screening for the new generation.",
      "The evening opens with the national anthem sung together, followed by children's performances of deshattobodhok gaan, a freedom-fighter tribute segment, and dinner. Wear red and green!",
    ],
    palette: "red",
  },
  {
    slug: "ekushey-february-2027",
    title: "Ekushey February, Language Day",
    banglaTitle: "Ekushey February",
    date: "2027-02-21T10:00:00",
    endTime: "1:00 PM",
    venue: "Community Shaheed Minar Grounds",
    city: "Salt Lake City, UT",
    tag: "Remembrance",
    free: true,
    blurb:
      "Probhat feri at dawn, flowers at the Shaheed Minar, and the songs that made a language immortal.",
    description: [
      "The morning begins with a probhat feri procession, barefoot, flowers in hand, to our community Shaheed Minar. We remember Salam, Barkat, Rafiq, Jabbar, and all who gave their lives for the Bangla language in 1952.",
      "The program continues with Bangla poetry recitation by children, a calligraphy corner where kids write their first Bangla letters, and a discussion on keeping Bangla alive in our American-born generation.",
    ],
    palette: "green",
  },
  {
    slug: "boishakhi-mela-2027",
    title: "Boishakhi Mela 1434",
    banglaTitle: "Boishakhi Mela",
    date: "2027-04-17T12:00:00",
    endTime: "10:00 PM",
    venue: "Lakeside Park Festival Grounds",
    city: "Salt Lake City, UT",
    tag: "Mela",
    free: true,
    blurb:
      "Our biggest day of the year. Pohela Boishakh with stalls, panta-ilish, concerts, and thousands of us together.",
    description: [
      "Shubho Noboborsho! The Utha USA Boishakhi Mela welcomes the Bangla New Year the way it deserves: a full day of celebration under the open sky. Food stalls with fuchka, chotpoti, and panta-ilish; clothing and jewelry vendors; a children's fair; and alpona painting on the walkway.",
      "The cultural stage runs all day: dance schools, bands, and a headline concert in the evening. The mela is free and open to the whole city. This is the day we show Utah the colors of Bangladesh.",
    ],
    palette: "red",
  },
  {
    slug: "eid-reunion-2027",
    title: "Eid Reunion Dinner",
    banglaTitle: "Eid Reunion",
    date: "2027-05-22T18:30:00",
    endTime: "10:30 PM",
    venue: "Grand Banquet Hall",
    city: "Salt Lake City, UT",
    tag: "Reunion",
    free: false,
    blurb:
      "Eid Mubarak! An evening of semai, new clothes, salami for the kids, and the whole community as one family.",
    description: [
      "Away from home, Eid can feel quiet, so we celebrate it loudly, together. The Utha USA Eid Reunion brings hundreds of families into one hall for an evening of dinner, semai and desserts, and Eid salami for every child.",
      "Expect a full Bangladeshi dinner, a nasheed and cultural segment, a best-dressed contest for kids, and long adda over cha. Seats are limited, so reserve early.",
    ],
    palette: "teal",
  },
  {
    slug: "summer-picnic-2027",
    title: "Grand Summer Picnic",
    banglaTitle: "Grand Picnic",
    date: "2027-07-10T10:00:00",
    endTime: "6:00 PM",
    venue: "Maple Grove State Park",
    city: "Salt Lake City, UT",
    tag: "Picnic",
    free: false,
    blurb:
      "Buses, biryani, pillow-passing, tug-of-war, and the legendary hari bhanga. A full day of bonobhojon.",
    description: [
      "The great Bangladeshi picnic tradition, Utah edition. Buses leave in the morning, and the day is packed with games: musical chairs for the aunties, tug-of-war for the uncles, hari bhanga and sack races for the kids, with trophies for every champion.",
      "Lunch is a proper picnic feast: khichuri or biryani, dim bhuna, salad, and cha from the flask. A raffle draw closes the day with prizes for the whole family.",
    ],
    palette: "green",
  },
];

export function upcomingEvents(now = new Date()): CommunityEvent[] {
  return events
    .filter((e) => new Date(e.date).getTime() > now.getTime())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export function nextEvent(now = new Date()): CommunityEvent {
  return upcomingEvents(now)[0] ?? events[events.length - 1];
}

export function getEvent(slug: string): CommunityEvent | undefined {
  return events.find((e) => e.slug === slug);
}
