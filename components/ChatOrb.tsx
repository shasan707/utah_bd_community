"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import OrbShell from "@/components/OrbShell";

/**
 * The chat assistant: our orb on the right, Retell's chat panel underneath.
 *
 * Retell's widget brings its own history, typing state and reconnection, all
 * of which is worth keeping, but it also brings its own button in its own
 * blue, and there is no setting to change either. So their button is hidden
 * and ours stands in front of it, matching the voice orb on the left, and a
 * press is passed through to theirs.
 *
 * All of that has to reach inside a shadow root, which our stylesheet cannot
 * enter. The root is open, so the styles go in through JavaScript instead.
 * The selectors match the stems of Retell's class names, not the whole name,
 * because the hash on the end is rebuilt every time they ship. If they rename
 * those parts the panel simply stops opening from our orb, which is why the
 * orb checks that it found their button before it draws itself at all.
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
 * Their button goes invisible rather than away: it has to stay in the page
 * for a press to be handed to it. The panel gets the ceiling it never had,
 * so a long conversation stops growing off the top of the window.
 */
const SKIN = `
  [class*="_fab"], [class*="_popup_"] {
    opacity: 0 !important;
    pointer-events: none !important;
  }

  /* The "Powered by Retell AI" line under the message box. */
  [class*="_poweredBy"] {
    display: none !important;
  }

  /* The wordmark in the header. The widget writes "Retell" there and will
     only write anything else for a paid white label token, so the text is
     blanked and the association's name put in its place. The padding on the
     left was reserving room for a logo that is no longer drawn. */
  /* The header becomes a person: round photograph, name beside it, and an
     "Online" line under the name.

     The photograph is the widget's own logo image, which it draws with its
     own classes rather than inside the brand box, so it is matched on those:
     Retell style it "height:20px; width:auto; object-fit:contain", a strip
     twenty pixels tall, which is no shape for a face. */
  img[class*="_inlineLogo"],
  img[class*="_chatHeader"] {
    width: 36px !important;
    height: 36px !important;
    border-radius: 9999px !important;
    object-fit: cover !important;
    object-position: 50% 30% !important;
    border: 2px solid rgba(255, 255, 255, 0.9) !important;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2) !important;
    background: ${IVORY} !important;
    flex-shrink: 0 !important;
  }

  /* The name and the status are written here rather than added to the page,
     because the widget is React and would throw away anything inserted into
     it on its next render. Two lines out of two pseudo elements: the row is
     allowed to wrap and the status is given a full width so it drops under
     the name, with order deciding which comes first. */
  [class*="_headerBrand_"] {
    display: flex !important;
    flex-wrap: wrap !important;
    align-items: center !important;
    justify-content: flex-start !important;
    column-gap: 10px !important;
    row-gap: 0 !important;
    text-align: left !important;
    color: ${IVORY} !important;
  }

  [class*="_headerBrand_"] img { order: 1; }

  [class*="_headerBrand_"]::after {
    order: 2;
    content: "BAU Assistant";
    font-size: 15px;
    font-weight: 700;
    line-height: 1.2;
    color: ${IVORY};
    white-space: nowrap;
  }

  [class*="_headerBrand_"]::before {
    order: 3;
    content: "Online";
    flex: 1 0 100%;
    box-sizing: border-box;
    /* 36 for the photograph, 10 for the gap, 13 for the dot. */
    padding-left: 59px;
    margin-top: 1px;
    font-size: 12px;
    font-weight: 500;
    line-height: 1.2;
    color: #b8cbc4;
    background: radial-gradient(circle at 50% 50%, #4ade80 0 3.5px, transparent 4px)
      46px center / 9px 9px no-repeat;
  }

  /* The header sat on white, so its text and icons were near black. */
  [class*="_header_"] { min-height: 62px !important; }
  [class*="_header_"] button,
  [class*="_header_"] svg,
  [class*="_headerLogo"] {
    color: ${IVORY} !important;
  }

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

  [class*="_header_"] {
    background: linear-gradient(145deg, #12705d 0%, ${FOREST} 100%) !important;
  }
`;

function ChatIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
      aria-hidden="true"
    >
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.8 9.8 0 0 1-2.8-.4L4 21l1.4-4.1A8.2 8.2 0 0 1 3.6 11.5 8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z" />
      <path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="h-6 w-6"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/** Every open shadow root on the page, however the host is named. */
function shadowRoots(): ShadowRoot[] {
  const found: ShadowRoot[] = [];
  for (const el of Array.from(document.querySelectorAll("*"))) {
    const root = (el as HTMLElement).shadowRoot;
    if (root) found.push(root);
  }
  return found;
}

/** Retell's own launcher, wherever it has mounted itself. */
function findLauncher(): HTMLElement | null {
  for (const root of shadowRoots()) {
    const fab = root.querySelector<HTMLElement>(
      'button[class*="_fab"], [class*="_fab"] button, [class*="_fabWrap"] button'
    );
    if (fab) return fab;
  }
  return null;
}

function panelIsOpen(): boolean {
  return shadowRoots().some((r) => r.querySelector('[class*="_window_"]'));
}

export default function ChatOrb() {
  // The orb stays hidden until Retell's widget is actually there to drive,
  // so it can never be a button that does nothing when pressed.
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const skinned = useRef(false);

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
      // The supported way to displace Retell's own mark in the header. The
      // wordmark beside it needs the stylesheet above as well, because that
      // one only changes for a paid white label token.
      s.dataset.logoUrl = `${window.location.origin}/assistant.jpg`;
      s.dataset.color = FOREST;
      s.dataset.themeColor = FOREST;
      s.dataset.componentColor = IVORY;
      // Their teaser bubble would point at a button nobody can see.
      s.dataset.showAiPopup = "false";
      s.dataset.autoOpen = "false";

      document.body.appendChild(s);
    }

    let tries = 0;
    const id = setInterval(() => {
      tries += 1;

      if (!skinned.current) {
        for (const root of shadowRoots()) {
          if (!root.querySelector('[class*="_fab"], [class*="_container_"]')) {
            continue;
          }
          if (!root.querySelector(`#${STYLE_ID}`)) {
            const style = document.createElement("style");
            style.id = STYLE_ID;
            style.textContent = SKIN;
            root.appendChild(style);
          }
          // Retell set these on the host from their own config, and an inline
          // value with importance is what outranks that.
          const host = root.host as HTMLElement;
          host.style.setProperty("--color-primary", FOREST, "important");
          host.style.setProperty("--color-primary-hover", "#12705d", "important");
          host.style.setProperty("--color-theme", FOREST, "important");
          skinned.current = true;
        }
      }

      if (findLauncher()) setReady(true);
      // Keeps the icon honest when the panel is closed from its own header.
      setOpen(panelIsOpen());

      // The widget is either up within about a minute or it is not coming,
      // but the open state still needs watching for as long as the page lives.
      if (tries > 120 && !skinned.current) clearInterval(id);
    }, 500);

    return () => clearInterval(id);
  }, []);

  const toggle = useCallback(() => {
    const fab = findLauncher();
    if (!fab) return;
    // Their button is invisible, not absent, so a press still reaches it.
    fab.click();
    setOpen((v) => !v);
  }, []);

  if (!PUBLIC_KEY || !ready) return null;

  return (
    <OrbShell
      side="right"
      label={open ? "Close the chat" : "Chat with us"}
      onClick={toggle}
    >
      {open ? <CloseIcon /> : <ChatIcon />}
    </OrbShell>
  );
}
