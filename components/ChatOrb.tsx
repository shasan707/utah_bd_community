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

  /* The "Powered by Retell AI" line under the message box. The association
     answers its own telephone; whose software it runs on is not something a
     visitor asked about. */
  [class*="_poweredBy"] {
    display: none !important;
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
