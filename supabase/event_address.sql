-- Give an event somewhere to keep its street address and its map link.
-- Run this once in the Supabase Dashboard: SQL Editor -> New query -> paste -> Run.
--
-- The site has always read these two, in lib/content.ts, but there was
-- nowhere to put them and no field for them in /admin/events. That is why
-- the picnic's street address ended up inside the venue name while its city
-- still said Salt Lake City, and why the home page falls back to "Venue
-- announced with registration" instead of naming the place.
--
-- Both are optional. An event with neither keeps working exactly as before:
-- the venue and city are used on their own, and the map button searches for
-- whatever address can be assembled from them.
--
-- After running this, open /admin/events and split the picnic venue up:
--   Venue    South Fork Park
--   Address  4988 S Fork Rd, Provo, UT 84604
--   City     Provo, UT

alter table public.events
  add column if not exists address text;

alter table public.events
  add column if not exists map_url text;
