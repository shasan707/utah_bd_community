"use client";

import { useEffect } from "react";

/**
 * The chat assistant, as Retell's own widget in the bottom right corner.
 *
 * This is their script rather than a hand-built chat window: the widget
 * carries its own history, typing state and reconnection, and they keep it
 * working. What is ours is the look, which takes some doing, because the
 * widget draws itself inside a shadow root where our stylesheet cannot reach.
 *
 * The shadow root is open, so the styles below are handed to it directly.
 * They use the stems of Retell's class names rather than the whole name,
 * because the hash on the end changes every time they rebuild. If they ever
 * rename the parts themselves these rules stop matching, and the widget goes
 * back to looking like Retell's own. That is a visual change and nothing more,
 * which is why it is an acceptable way to do this.
 */

const SCRIPT_ID = "retell-widget";
const STYLE_ID = "bau-retell-skin";
const SRC = "https://dashboard.retellai.com/retell-widget-v2.js";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_RETELL_PUBLIC_KEY;
const AGENT_ID =
  process.env.NEXT_PUBLIC_RETELL_CHAT_AGENT_ID ||
  "agent_e4ee635091b0cc85b835fae810";

const FOREST = "#0d4f42";
const IVORY = "#fafaf8";

/**
 * The panel is positioned from the bottom with no ceiling of its own, so a
 * long conversation grows upward until it runs off the top of the window.
 * Giving it a maximum height and letting the message list scroll inside keeps
 * it on the page. The rest matches the orb on the left.
 */
const SKIN = `
  [class*="_window_"] {
    max-height: calc(100vh - 124px) !important;
    max-height: calc(100dvh - 124px) !important;
    display: flex !important;
    flex-direction: column !important;
    overflow: hidden !important;
    border-radius: 22px !important;
    box-shadow: 0 18px 48px rgba(13, 79, 66, 0.22),
                0 4px 12px rgba(13, 79, 66, 0.14) !important;
  }

  /* A flex child will not shrink below its content unless told to, and
     without this the list pushes the panel tall again. */
  [class*="_messages_"] {
    flex: 1 1 auto !important;
    min-height: 0 !important;
    overflow-y: auto !important;
  }

  [class*="_fab"] {
    background: linear-gradient(145deg, #35a98f 0%, #12705d 52%, ${FOREST} 100%) !important;
    box-shadow: 0 14px 34px rgba(13, 79, 66, 0.34),
                0 4px 10px rgba(13, 79, 66, 0.22),
                inset 0 1px 0 rgba(255, 255, 255, 0.32),
                inset 0 -2px 6px rgba(0, 0, 0, 0.14) !important;
    animation: bau-orb-float 5s ease-in-out infinite;
    transition: transform 0.3s ease;
  }

  [class*="_fab"]:hover {
    transform: scale(1.1);
  }

  [class*="_header_"] {
    background: linear-gradient(145deg, #12705d 0%, ${FOREST} 100%) !important;
  }

  @keyframes bau-orb-float {
    0%, 100% { transform: translateY(0); }
    50%      { transform: translateY(-5px); }
  }

  @media (prefers-reduced-motion: reduce) {
    [class*="_fab"] { animation: none; }
  }
`;

/** Every open shadow root on the page, however the host is named. */
function shadowRoots(): ShadowRoot[] {
  const found: ShadowRoot[] = [];
  for (const el of Array.from(document.querySelectorAll("*"))) {
    const root = (el as HTMLElement).shadowRoot;
    if (root) found.push(root);
  }
  return found;
}

export default function ChatOrb() {
  useEffect(() => {
    if (!PUBLIC_KEY) return;

    if (!document.getElementById(SCRIPT_ID)) {
      const s = document.createElement("script");
      s.id = SCRIPT_ID;
      s.src = SRC;
      s.type = "module";
      s.async = true;

      // Chat only. Voice is answered by the orb on the left, and giving this
      // widget a voice agent as well would put two ways to call on one screen.
      s.dataset.publicKey = PUBLIC_KEY;
      s.dataset.agentId = AGENT_ID;
      s.dataset.title = "Bangladeshi Association of Utah";
      s.dataset.botName = "BAU Assistant";
      s.dataset.color = FOREST;
      s.dataset.themeColor = FOREST;
      s.dataset.componentColor = IVORY;
      s.dataset.popupMessage = "Questions about the picnic? Ask us here.";
      s.dataset.showAiPopup = "true";
      s.dataset.showAiPopupTime = "12";
      s.dataset.autoOpen = "false";

      document.body.appendChild(s);
    }

    // The widget mounts whenever its script finishes, so the styles are
    // offered repeatedly for a while rather than once at a guessed moment.
    let tries = 0;
    const id = setInterval(() => {
      tries += 1;
      for (const root of shadowRoots()) {
        if (!root.querySelector('[class*="_fab"], [class*="_container_"]')) {
          continue;
        }
        if (root.getElementById?.(STYLE_ID)) continue;
        if (root.querySelector(`#${STYLE_ID}`)) continue;

        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = SKIN;
        root.appendChild(style);

        // The variables are set on the host by Retell's own stylesheet, and
        // an inline value with importance is what outranks it.
        const host = (root as ShadowRoot).host as HTMLElement;
        host.style.setProperty("--color-primary", FOREST, "important");
        host.style.setProperty("--color-primary-hover", "#12705d", "important");
        host.style.setProperty("--color-theme", FOREST, "important");
      }
      // Roughly thirty seconds, then give up rather than poll for ever.
      if (tries > 60) clearInterval(id);
    }, 500);

    return () => clearInterval(id);
  }, []);

  return null;
}
