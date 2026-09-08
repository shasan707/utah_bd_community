"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

type Detected = { rawValue: string };
type Detector = { detect(source: HTMLVideoElement): Promise<Detected[]> };
type DetectorCtor = new (options: { formats: string[] }) => Detector;

/**
 * Live camera view that reads QR codes. Uses the browser's own detector on
 * Android Chrome and falls back to jsQR (pure JavaScript) on iPhones, so no
 * app install is needed. Calls onDecode with the raw text every time a code
 * is in view; the page decides what to do with repeats.
 */
export default function Scanner({
  active,
  onDecode,
}: {
  active: boolean;
  onDecode: (text: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const decodeRef = useRef(onDecode);
  const [error, setError] = useState("");
  decodeRef.current = onDecode;

  useEffect(() => {
    if (!active) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    let stream: MediaStream | null = null;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const Ctor = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
    const detector = Ctor ? new Ctor({ formats: ["qr_code"] }) : null;
    setError("");

    const tick = async () => {
      if (stopped) return;
      if (video.readyState >= 2 && video.videoWidth > 0) {
        try {
          if (detector) {
            const found = await detector.detect(video);
            const value = found[0]?.rawValue;
            if (value) decodeRef.current(value);
          } else {
            const scale = Math.min(1, 640 / video.videoWidth);
            const w = Math.round(video.videoWidth * scale);
            const h = Math.round(video.videoHeight * scale);
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(video, 0, 0, w, h);
              const image = ctx.getImageData(0, 0, w, h);
              const hit = jsQR(image.data, w, h, { inversionAttempts: "dontInvert" });
              if (hit?.data) decodeRef.current(hit.data);
            }
          }
        } catch {
          /* a bad frame; try the next one */
        }
      }
      timer = setTimeout(tick, 200);
    };

    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      .then((s) => {
        if (stopped) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        video.srcObject = s;
        return video.play().then(tick);
      })
      .catch((err) => {
        setError(
          err instanceof Error && err.name === "NotAllowedError"
            ? "Camera permission was refused. Allow the camera for this site and try again."
            : "The camera could not be started. Use the search box below instead."
        );
      });

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    };
  }, [active]);

  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-black">
      <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
      <canvas ref={canvasRef} className="hidden" />
      {active && !error && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 m-auto h-[62%] w-[62%] rounded-2xl border-4 border-cream/80"
        />
      )}
      {!active && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-cream/70">
          Camera is off
        </div>
      )}
      {error && (
        <div className="absolute inset-x-0 bottom-0 bg-bengal-red/90 px-4 py-3 text-sm font-medium text-white">
          {error}
        </div>
      )}
    </div>
  );
}
