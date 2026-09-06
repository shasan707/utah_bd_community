import type { Palette } from "@/lib/palette";

export type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  /** Simple markdown, see lib/markdown.tsx for what is supported. */
  body: string;
  author: string;
  publishedAt: string; // ISO
  palette: Palette;
  coverUrl?: string;
  tag?: string;
};

/**
 * Sample posts, shown until the committee publishes the first real one from
 * /admin/blog. The moment a published post exists in Supabase, these go away.
 */
export const posts: BlogPost[] = [
  {
    slug: "welcome-to-the-utha-blog",
    title: "Welcome to the Utha blog",
    excerpt:
      "A place for our stories: event recaps, recipes from the pitha table, notes from the committee, and voices from the next generation.",
    body: `Utha means to rise, and this blog is where we write down what rising looks like for Bangladeshi families in Utah.

## What you will find here

- Recaps and photos after every event, so the people who missed it still feel part of it.
- Practical notes from the committee: dates, venues, how registration works, what to bring.
- Recipes and traditions, from the winter pitha table to the Boishakhi feast.
- Stories from members, especially the kids who were born here and are finding their own way to be Bangali.

## Want to write something?

Every member is welcome to contribute. Send a few paragraphs and a photo through the contact page, and the committee will publish it here with your name.

> This is a sample post. Real posts from the committee will replace it soon.`,
    author: "Utha USA",
    publishedAt: "2026-08-20T10:00:00",
    palette: "green",
    tag: "Announcement",
  },
  {
    slug: "how-registration-and-zelle-work",
    title: "How registering and paying for an event works",
    excerpt:
      "Two minutes and three steps: fill the form, send a Zelle with your code in the memo, and your ticket lands in your inbox.",
    body: `We kept event registration as simple as sending money to a friend.

1. **Fill the form** on the Register page. Tell us who is coming and whether you want food coupons.
2. **Send the Zelle** for the exact amount. Put your code, for example R-7X3M, in the memo. That code is how we match your payment to you.
3. **Get your ticket** by email. The moment the bank tells us your Zelle arrived, your registration is confirmed and the ticket goes out by itself.

## A few tips

- The code is on the screen after you register and in the email we send. Write it exactly as shown.
- If you forget the memo, do not worry. We match by name and amount and confirm it by hand.
- You can check where things stand any time from the "track your registration" link in your email.

> This is a sample post. Real posts from the committee will replace it soon.`,
    author: "The committee",
    publishedAt: "2026-08-28T10:00:00",
    palette: "teal",
    tag: "How to",
  },
  {
    slug: "pitha-night-what-to-bring",
    title: "Pitha night: what to bring and how the contest works",
    excerpt:
      "Bhapa, patishapta, chitoi, dudh puli. Bring your best plate, and the community picks the Pitha Champion of the year.",
    body: `Winter in Bangladesh means pitha, and our winter reunion brings that warmth to Utah.

## Bring a plate

Any pitha counts: bhapa, patishapta, chitoi, dudh puli, nakshi, or your own family recipe. Bring enough for eight to ten tastes. We provide plates, tea, and the long tables.

## The contest

- Every plate gets a number, no names on the table.
- Everyone who tastes gets one vote.
- The plate with the most votes wins the Pitha Champion title and a small gift.

## For the kids

There is a recitation corner and a colouring table, so parents can enjoy their cha and adda late into the night.

> This is a sample post. Real posts from the committee will replace it soon.`,
    author: "Utha USA",
    publishedAt: "2026-09-02T10:00:00",
    palette: "gold",
    tag: "Events",
  },
];
