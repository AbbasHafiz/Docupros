"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  onCapture: (dataUrl: string) => void;
  onUpload: (dataUrl: string) => void;
};

export function CameraCapture({ onCapture, onUpload }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
        }
      } catch {
        setError(
          "Camera unavailable. Upload a photo of your document instead.",
        );
      }
    }

    void start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const snap = useCallback(() => {
    const video = videoRef.current;
    if (!video || !ready) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    onCapture(canvas.toDataURL("image/jpeg", 0.92));
  }, [onCapture, ready]);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") onUpload(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const openGallery = () => {
    const input = galleryRef.current;
    if (!input) return;
    // Allow selecting the same file again
    input.value = "";
    input.click();
  };

  return (
    <div className="capture-stage">
      <div className="capture-frame">
        {!error ? (
          <video
            ref={videoRef}
            className="capture-video"
            playsInline
            muted
            autoPlay
          />
        ) : (
          <div className="capture-fallback">
            <p>{error}</p>
          </div>
        )}
        <div className="viewfinder" aria-hidden />
      </div>

      <div className="capture-actions">
        <button type="button" className="btn-ghost" onClick={openGallery}>
          Gallery
        </button>
        <button
          type="button"
          className="shutter"
          onClick={snap}
          disabled={!ready}
          aria-label="Capture document"
        />
        <button type="button" className="btn-ghost" onClick={openGallery}>
          Upload
        </button>
      </div>

      {/* No capture= attribute — that forces the camera on mobile */}
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
