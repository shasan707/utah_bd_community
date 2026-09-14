/**
 * Where an event is, written out once and used by every page that shows it.
 *
 * The records carry four separate pieces: the name of the place, the street
 * address, the city, and a map link. Only the first and third are always
 * filled in, so each function here works from whatever is present.
 */

type Place = {
  venue: string;
  address?: string;
  city: string;
  mapUrl?: string;
};

/** A US postcode, five digits or the nine digit form. */
const POSTCODE = /\b\d{5}(-\d{4})?\b/;

/**
 * The venue line as it should read.
 *
 * A venue that already carries a postcode is a complete address on its own,
 * and adding the city after it can only repeat the city or contradict it. The
 * picnic is the reason this matters: its venue line is a Provo street address
 * while its city says Salt Lake City, an hour away, so printing both together
 * would send people to the wrong end of the valley.
 */
export function placeLine(e: Place): string {
  const venue = e.venue?.trim() ?? "";
  const city = e.city?.trim() ?? "";
  if (!venue) return city;
  if (!city) return venue;
  if (POSTCODE.test(venue)) return venue;
  if (venue.toLowerCase().includes(city.toLowerCase())) return venue;
  return `${venue}, ${city}`;
}

/**
 * Everything known about the location on one line, for a map search or for
 * copying. The name of the place is worth keeping in front of the street,
 * since "South Fork Park" finds the right gate where a road number alone
 * may not, but not when the name is the street address already.
 */
export function fullAddress(e: Place): string {
  const venue = e.venue?.trim() ?? "";
  const address = e.address?.trim();
  if (!address) return placeLine(e);
  if (!venue || address.toLowerCase().includes(venue.toLowerCase())) {
    return address;
  }
  return `${venue}, ${address}`;
}

/**
 * Where the "Open in Google Maps" button goes: the link saved against the
 * event when there is one, otherwise a search for the address itself, so the
 * button is always offered rather than appearing only for some events.
 */
export function mapsUrl(e: Place): string {
  const saved = e.mapUrl?.trim();
  if (saved) return saved;
  const q = encodeURIComponent(fullAddress(e));
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}
