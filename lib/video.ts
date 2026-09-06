/**
 * Turns a pasted video address into something the gallery can play: an
 * embed for YouTube, Vimeo, and Facebook, a plain player for uploaded files,
 * and a link for anything else. Pure, so both server and browser can use it.
 */

export type VideoSource =
  | { type: "youtube"; id: string; embed: string; thumb: string }
  | { type: "vimeo"; embed: string }
  | { type: "facebook"; embed: string }
  | { type: "file"; src: string }
  | { type: "link"; href: string };

const YT =
  /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i;
const VIMEO = /vimeo\.com\/(?:video\/)?(\d+)/i;
const FILE = /\.(mp4|webm|mov|m4v|ogv)(\?.*)?$/i;

export function parseVideo(url: string): VideoSource {
  const u = String(url).trim();
  const yt = YT.exec(u);
  if (yt) {
    return {
      type: "youtube",
      id: yt[1],
      embed: `https://www.youtube-nocookie.com/embed/${yt[1]}?autoplay=1&rel=0`,
      thumb: `https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg`,
    };
  }
  const vm = VIMEO.exec(u);
  if (vm) {
    return { type: "vimeo", embed: `https://player.vimeo.com/video/${vm[1]}?autoplay=1` };
  }
  if (/(facebook\.com|fb\.watch)\//i.test(u)) {
    return {
      type: "facebook",
      embed: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(u)}&show_text=false&autoplay=1`,
    };
  }
  if (FILE.test(u) || /\/storage\/v1\/object\/public\//i.test(u)) {
    return { type: "file", src: u };
  }
  return { type: "link", href: u };
}

/** A thumbnail the tile can show when no cover picture was uploaded. */
export function videoThumbnail(url: string): string | undefined {
  const v = parseVideo(url);
  return v.type === "youtube" ? v.thumb : undefined;
}
