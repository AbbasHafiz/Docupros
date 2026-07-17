"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CropEditor } from "./CropEditor";
import { FilterPicker } from "./FilterPicker";
import { SignaturePad } from "./SignaturePad";
import type {
  DocumentRecord,
  EditorTab,
  EnhanceAdjustments,
  ImageTool,
  MarkupTool,
  OcrWord,
  Quad,
  ScanFilter,
  ScanPage,
} from "@/lib/types";
import { SCAN_FILTERS } from "@/lib/types";
import { getDocument, saveDocument } from "@/lib/storage";
import {
  applyFilter,
  defaultQuad,
  detectDocumentQuad,
  loadImage,
  warpPerspective,
} from "@/lib/imageProcessing";
import { recognizePage } from "@/lib/ocr";
import {
  applyEnhanceAdjustments,
  applySignature,
  drawAnnotationStroke,
  drawFreeText,
  eraseRegion,
  findReplaceOnImage,
  handwritingEraseAtPoints,
  rebuildDocumentText,
  removeHandwriting,
  replaceWordOnImage,
  rotateImage,
  smartEraseAtPoints,
  type HandwritingMode,
} from "@/lib/editOperations";
import { documentHref } from "@/lib/routes";
import { ShareSheet } from "./ShareSheet";

type Props = {
  documentId: string;
  pageId?: string;
};

type PageSnapshot = {
  imageDataUrl: string;
  originalDataUrl?: string;
  filter: ScanFilter;
  ocrText?: string;
  ocrWords?: OcrWord[];
};

const MAX_HISTORY = 30;

const snapshotFromPage = (p: ScanPage): PageSnapshot => ({
  imageDataUrl: p.imageDataUrl,
  originalDataUrl: p.originalDataUrl,
  filter: p.filter,
  ocrText: p.ocrText,
  ocrWords: p.ocrWords ? [...p.ocrWords] : undefined,
});

const IMAGE_TOOLS: { id: ImageTool; label: string; icon: string }[] = [
  { id: "crop", label: "Crop", icon: "▢" },
  { id: "filter", label: "Filter", icon: "◎" },
  { id: "editText", label: "Edit Text", icon: "T" },
  { id: "smartErase", label: "Smart Erase", icon: "⌫" },
  { id: "removeHandwriting", label: "Handwriting", icon: "✍" },
  { id: "retake", label: "Retake", icon: "↻" },
  { id: "sign", label: "Sign", icon: "✎" },
  { id: "addText", label: "Add Text", icon: "A" },
];

export function PageEditor({ documentId, pageId }: Props) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [doc, setDoc] = useState<DocumentRecord | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [tab, setTab] = useState<EditorTab>("images");
  const [imageTool, setImageTool] = useState<ImageTool | null>(null);
  const [markupTool, setMarkupTool] = useState<MarkupTool>("pen");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [brushSize, setBrushSize] = useState(32);
  const [hwMode, setHwMode] = useState<HandwritingMode>("both");
  const [hwStrength, setHwStrength] = useState(55);
  const [drawing, setDrawing] = useState(false);
  const [adjust, setAdjust] = useState<EnhanceAdjustments>({
    brightness: 0,
    contrast: 0,
    sharpness: 0,
  });
  const [words, setWords] = useState<OcrWord[]>([]);
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [ocrProgress, setOcrProgress] = useState(0);
  const [addText, setAddText] = useState("");
  const [addFontSize, setAddFontSize] = useState(28);
  const [addColor, setAddColor] = useState("#111111");
  const [placeMode, setPlaceMode] = useState<"text" | "sign" | null>(null);
  const [floatingText, setFloatingText] = useState<{
    text: string;
    x: number;
    y: number;
    fontSize: number;
    color: string;
  } | null>(null);
  const [scale, setScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [inkColor, setInkColor] = useState("#e11d48");
  const [inkWidth, setInkWidth] = useState(4);
  const [signOpen, setSignOpen] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [cropRaw, setCropRaw] = useState<string | null>(null);
  const [cropQuad, setCropQuad] = useState<Quad | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [previews, setPreviews] = useState<Partial<Record<ScanFilter, string>>>(
    {},
  );
  const strokePoints = useRef<{ x: number; y: number }[]>([]);
  const textDragRef = useRef<{
    ox: number;
    oy: number;
    startX: number;
    startY: number;
  } | null>(null);
  const textPinchRef = useRef<{
    startDist: number;
    startSize: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const naturalSizeRef = useRef({ w: 1, h: 1 });
  const fitScaleRef = useRef(1);
  const stageRef = useRef<HTMLDivElement>(null);
  const pinchRef = useRef<{ startDist: number; startZoom: number } | null>(
    null,
  );
  const undoStackRef = useRef<PageSnapshot[]>([]);
  const redoStackRef = useRef<PageSnapshot[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const page = doc?.pages[pageIndex];

  const syncHistoryFlags = () => {
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(redoStackRef.current.length > 0);
  };

  const clearHistory = () => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    syncHistoryFlags();
  };

  const needsPrecisionZoom =
    imageTool === "editText" ||
    imageTool === "smartErase" ||
    imageTool === "removeHandwriting" ||
    imageTool === "addText" ||
    placeMode === "sign" ||
    placeMode === "text" ||
    Boolean(floatingText) ||
    tab === "markup";

  useEffect(() => {
    let cancelled = false;
    void getDocument(documentId).then((d) => {
      if (cancelled) return;
      if (!d) {
        setDoc(null);
        setLoading(false);
        return;
      }
      setDoc(d);
      const idx = pageId
        ? Math.max(0, d.pages.findIndex((p) => p.id === pageId))
        : 0;
      const safe = idx === -1 ? 0 : idx;
      setPageIndex(safe);
      const p = d.pages[safe];
      if (p) {
        setWords(p.ocrWords ?? []);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [documentId, pageId]);

  const paintCanvas = useCallback(
    async (src: string, overlayWords?: OcrWord[], zoomOverride?: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const img = await loadImage(src);
      const maxW = Math.min(window.innerWidth - 24, 900);
      const maxH = Math.min(window.innerHeight * 0.46, 520);
      const fit = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
      fitScaleRef.current = fit;
      const z = zoomOverride ?? zoom;
      const s = fit * z;
      naturalSizeRef.current = {
        w: img.naturalWidth,
        h: img.naturalHeight,
      };
      setScale(s);
      canvas.width = Math.max(1, Math.round(img.naturalWidth * s));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * s));
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const list = overlayWords ?? words;
      if (imageTool === "editText" && list.length) {
        for (const w of list) {
          const active = w.id === selectedWordId;
          ctx.strokeStyle = active ? "#16a34a" : "rgba(22, 163, 74, 0.65)";
          ctx.lineWidth = active ? 2.5 : 1.5;
          ctx.fillStyle = active
            ? "rgba(22, 163, 74, 0.18)"
            : "rgba(22, 163, 74, 0.08)";
          const x = w.bbox.x0 * s;
          const y = w.bbox.y0 * s;
          const ww = (w.bbox.x1 - w.bbox.x0) * s;
          const hh = (w.bbox.y1 - w.bbox.y0) * s;
          ctx.fillRect(x, y, ww, hh);
          ctx.strokeRect(x, y, ww, hh);
        }
      }
    },
    [imageTool, selectedWordId, words, zoom],
  );

  useEffect(() => {
    if (!page || cropRaw) return;
    void paintCanvas(page.imageDataUrl);
  }, [page, paintCanvas, cropRaw]);

  const setZoomClamped = (next: number) => {
    const z = Math.min(4, Math.max(1, Math.round(next * 100) / 100));
    setZoom(z);
  };

  const zoomBy = (delta: number) => setZoomClamped(zoom + delta);

  const zoomToFit = () => setZoomClamped(1);

  const scrollWordIntoView = (word: OcrWord) => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;
    const s = scale || fitScaleRef.current * zoom;
    const cx = ((word.bbox.x0 + word.bbox.x1) / 2) * s;
    const cy = ((word.bbox.y0 + word.bbox.y1) / 2) * s;
    stage.scrollTo({
      left: Math.max(0, cx - stage.clientWidth / 2),
      top: Math.max(0, cy - stage.clientHeight / 2),
      behavior: "smooth",
    });
  };
  const persistPage = async (
    nextImage: string,
    patch: Partial<ScanPage> = {},
    options: { recordHistory?: boolean } = {},
  ) => {
    if (!doc || !page) return;
    const recordHistory = options.recordHistory !== false;
    if (recordHistory) {
      undoStackRef.current = [
        ...undoStackRef.current.slice(-(MAX_HISTORY - 1)),
        snapshotFromPage(page),
      ];
      redoStackRef.current = [];
      syncHistoryFlags();
    }
    const pages = doc.pages.map((p, i) =>
      i === pageIndex
        ? {
            ...p,
            originalDataUrl: p.originalDataUrl ?? p.imageDataUrl,
            imageDataUrl: nextImage,
            ...patch,
          }
        : p,
    );
    const updated: DocumentRecord = {
      ...doc,
      pages,
      thumbnail: pages[0]?.imageDataUrl,
      updatedAt: Date.now(),
      ocrText: rebuildDocumentText(pages.map((p) => p.ocrText)),
    };
    await saveDocument(updated);
    setDoc(updated);
    const nextWords = patch.ocrWords ?? words;
    if (patch.ocrWords) setWords(patch.ocrWords);
    await paintCanvas(nextImage, nextWords);
  };

  const restoreSnapshot = async (snap: PageSnapshot) => {
    if (!doc || !page) return;
    const pages = doc.pages.map((p, i) =>
      i === pageIndex
        ? {
            ...p,
            imageDataUrl: snap.imageDataUrl,
            originalDataUrl: snap.originalDataUrl,
            filter: snap.filter,
            ocrText: snap.ocrText,
            ocrWords: snap.ocrWords,
          }
        : p,
    );
    const updated: DocumentRecord = {
      ...doc,
      pages,
      thumbnail: pages[0]?.imageDataUrl,
      updatedAt: Date.now(),
      ocrText: rebuildDocumentText(pages.map((p) => p.ocrText)),
    };
    await saveDocument(updated);
    setDoc(updated);
    setWords(snap.ocrWords ?? []);
    setSelectedWordId(null);
    await paintCanvas(snap.imageDataUrl, snap.ocrWords ?? []);
  };

  const undoEdit = async () => {
    if (!doc || !page || undoStackRef.current.length === 0 || busy) return;
    const previous = undoStackRef.current[undoStackRef.current.length - 1];
    undoStackRef.current = undoStackRef.current.slice(0, -1);
    redoStackRef.current = [
      ...redoStackRef.current.slice(-(MAX_HISTORY - 1)),
      snapshotFromPage(page),
    ];
    syncHistoryFlags();
    setBusy(true);
    try {
      await restoreSnapshot(previous);
      setStatus("Undone");
      window.setTimeout(() => setStatus(null), 1200);
    } finally {
      setBusy(false);
    }
  };

  const redoEdit = async () => {
    if (!doc || !page || redoStackRef.current.length === 0 || busy) return;
    const next = redoStackRef.current[redoStackRef.current.length - 1];
    redoStackRef.current = redoStackRef.current.slice(0, -1);
    undoStackRef.current = [
      ...undoStackRef.current.slice(-(MAX_HISTORY - 1)),
      snapshotFromPage(page),
    ];
    syncHistoryFlags();
    setBusy(true);
    try {
      await restoreSnapshot(next);
      setStatus("Redone");
      window.setTimeout(() => setStatus(null), 1200);
    } finally {
      setBusy(false);
    }
  };

  const undoEditRef = useRef(undoEdit);
  const redoEditRef = useRef(redoEdit);
  undoEditRef.current = undoEdit;
  redoEditRef.current = redoEdit;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (
        tag === "input" ||
        tag === "textarea" ||
        target?.isContentEditable
      ) {
        return;
      }
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        void undoEditRef.current();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        void redoEditRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const pointerToImage = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const { w, h } = naturalSizeRef.current;
    return {
      x: ((e.clientX - rect.left) / Math.max(1, rect.width)) * w,
      y: ((e.clientY - rect.top) / Math.max(1, rect.height)) * h,
    };
  };

  const applyFloatingText = async () => {
    if (!page || !floatingText?.text.trim()) return;
    setBusy(true);
    try {
      const next = await drawFreeText(
        page.imageDataUrl,
        floatingText.text,
        floatingText.x,
        floatingText.y,
        floatingText.fontSize,
        floatingText.color,
      );
      await persistPage(next);
      setFloatingText(null);
      setStatus("Text added");
      window.setTimeout(() => setStatus(null), 1600);
    } finally {
      setBusy(false);
    }
  };

  const cancelFloatingText = () => {
    setFloatingText(null);
    setStatus(null);
  };

  const onFloatingTextPointerDown = (e: React.PointerEvent) => {
    if (!floatingText) return;
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const pt = pointerToImage(e);
    textDragRef.current = {
      ox: pt.x - floatingText.x,
      oy: pt.y - floatingText.y,
      startX: floatingText.x,
      startY: floatingText.y,
    };
  };

  const onFloatingTextPointerMove = (e: React.PointerEvent) => {
    if (!floatingText || !textDragRef.current) return;
    e.stopPropagation();
    e.preventDefault();
    const pt = pointerToImage(e);
    setFloatingText({
      ...floatingText,
      x: pt.x - textDragRef.current.ox,
      y: pt.y - textDragRef.current.oy,
    });
  };

  const onFloatingTextPointerUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    textDragRef.current = null;
  };

  const onFloatingTextTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && floatingText) {
      textDragRef.current = null;
      const [a, b] = [e.touches[0], e.touches[1]];
      textPinchRef.current = {
        startDist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
        startSize: floatingText.fontSize,
      };
    }
  };

  const onFloatingTextTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && textPinchRef.current && floatingText) {
      e.preventDefault();
      const [a, b] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const ratio = dist / Math.max(1, textPinchRef.current.startDist);
      const next = Math.round(
        Math.min(120, Math.max(10, textPinchRef.current.startSize * ratio)),
      );
      setFloatingText({ ...floatingText, fontSize: next });
      setAddFontSize(next);
    }
  };

  const onFloatingTextTouchEnd = () => {
    textPinchRef.current = null;
  };

  const selectTool = async (tool: ImageTool) => {
    setPlaceMode(null);
    setFloatingText(null);
    setImageTool(tool);
    setTab("images");

    // Precision tools: bump zoom so fine work is usable on phones
    if (
      tool === "editText" ||
      tool === "smartErase" ||
      tool === "removeHandwriting" ||
      tool === "addText" ||
      tool === "sign"
    ) {
      setZoomClamped(Math.max(zoom, 1.75));
    }

    if (tool === "retake" && page) {
      router.push(
        `/scan?append=${documentId}&retake=${page.id}${
          doc?.kind === "id_card" ? "&mode=id_card" : ""
        }`,
      );
      return;
    }

    if (tool === "sign") {
      setSignOpen(true);
      return;
    }

    if (tool === "crop" && page) {
      setBusy(true);
      try {
        const src = page.originalDataUrl ?? page.imageDataUrl;
        setCropRaw(src);
        const img = await loadImage(src);
        const detected = await detectDocumentQuad(src);
        setCropQuad(
          detected ?? defaultQuad(img.naturalWidth, img.naturalHeight),
        );
      } finally {
        setBusy(false);
      }
      return;
    }

    if (tool === "filter" && page) {
      setBusy(true);
      try {
        const next: Partial<Record<ScanFilter, string>> = {
          original: page.originalDataUrl ?? page.imageDataUrl,
        };
        const base = page.originalDataUrl ?? page.imageDataUrl;
        await Promise.all(
          SCAN_FILTERS.filter((f) => f.id !== "original").map(async (f) => {
            next[f.id] = await applyFilter(base, f.id);
          }),
        );
        setPreviews(next);
      } finally {
        setBusy(false);
      }
      return;
    }

    if (tool === "editText" && page) {
      if (!words.length) {
        setBusy(true);
        setStatus("Detecting text…");
        setOcrProgress(0);
        try {
          const result = await recognizePage(page.imageDataUrl, setOcrProgress);
          setWords(result.words);
          await persistPage(page.imageDataUrl, {
            ocrText: result.text,
            ocrWords: result.words,
          });
          setStatus(
            result.words.length
              ? "Tap a word to edit"
              : "No text detected",
          );
        } finally {
          setBusy(false);
        }
      }
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!page || cropRaw) return;
    const pt = pointerToImage(e);

    if (placeMode === "text" && addText.trim()) {
      // Place a floating text box first — drag / pinch to adjust, then Apply
      setFloatingText({
        text: addText.trim(),
        x: pt.x,
        y: pt.y,
        fontSize: addFontSize,
        color: addColor,
      });
      setPlaceMode(null);
      setStatus("Drag to move · pinch to resize · tap Apply");
      return;
    }

    if (placeMode === "sign" && signature) {
      void (async () => {
        setBusy(true);
        try {
          const next = await applySignature(
            page.imageDataUrl,
            signature,
            pt.x,
            pt.y,
            Math.min(page ? 280 : 280, 320),
          );
          setPlaceMode(null);
          await persistPage(next);
          setStatus("Signature placed");
        } finally {
          setBusy(false);
        }
      })();
      return;
    }

    if (imageTool === "editText") {
      const hit = words.find(
        (w) =>
          pt.x >= w.bbox.x0 &&
          pt.x <= w.bbox.x1 &&
          pt.y >= w.bbox.y0 &&
          pt.y <= w.bbox.y1,
      );
      if (hit) {
        setSelectedWordId(hit.id);
        setEditText(hit.text);
        if (zoom < 2) setZoomClamped(2);
        // scroll after zoom repaint
        window.setTimeout(() => scrollWordIntoView(hit), 80);
      }
      return;
    }

    if (
      imageTool === "smartErase" ||
      imageTool === "removeHandwriting" ||
      (tab === "markup" && (markupTool === "pen" || markupTool === "highlight"))
    ) {
      setDrawing(true);
      strokePoints.current = [pt];
      canvasRef.current?.setPointerCapture(e.pointerId);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawing || !page) return;
    const pt = pointerToImage(e);

    strokePoints.current.push(pt);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    void loadImage(page.imageDataUrl).then((img) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      if (imageTool === "smartErase" || imageTool === "removeHandwriting") {
        ctx.fillStyle =
          imageTool === "removeHandwriting"
            ? "rgba(220, 38, 38, 0.35)"
            : "rgba(255,255,255,0.75)";
        for (const p of strokePoints.current) {
          ctx.beginPath();
          ctx.arc(p.x * scale, p.y * scale, brushSize * scale, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        ctx.strokeStyle =
          markupTool === "highlight" ? "rgba(250, 204, 21, 0.45)" : inkColor;
        ctx.lineWidth =
          (markupTool === "highlight" ? inkWidth * 3 : inkWidth) * scale;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        const pts = strokePoints.current;
        ctx.moveTo(pts[0].x * scale, pts[0].y * scale);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x * scale, pts[i].y * scale);
        }
        ctx.stroke();
      }
    });
  };

  const onPointerUp = () => {
    if (!drawing || !page) return;
    setDrawing(false);
    const points = strokePoints.current;
    strokePoints.current = [];
    if (imageTool === "crop") return;
    if (points.length === 0) return;

    void (async () => {
      setBusy(true);
      try {
        if (imageTool === "smartErase") {
          const next = await smartEraseAtPoints(
            page.imageDataUrl,
            points,
            brushSize,
          );
          await persistPage(next);
          setStatus("Smart erase applied");
        } else if (imageTool === "removeHandwriting") {
          const next = await handwritingEraseAtPoints(
            page.imageDataUrl,
            points,
            brushSize,
          );
          await persistPage(next);
          setStatus("Handwriting brushed away");
        } else if (tab === "markup") {
          const next = await drawAnnotationStroke(
            page.imageDataUrl,
            points,
            markupTool === "highlight" ? "rgba(250, 204, 21, 0.45)" : inkColor,
            markupTool === "highlight" ? inkWidth * 3 : inkWidth,
          );
          await persistPage(next);
          setStatus("Markup saved");
        }
      } finally {
        setBusy(false);
      }
    })();
  };

  const applyCropPerspective = async () => {
    if (!cropRaw || !cropQuad) return;
    setBusy(true);
    try {
      const warped = await warpPerspective(cropRaw, cropQuad);
      await persistPage(warped);
      setCropRaw(null);
      setCropQuad(null);
      setImageTool(null);
      setStatus("Crop applied");
    } finally {
      setBusy(false);
    }
  };

  const applyWordEdit = async () => {
    if (!page || !selectedWordId) return;
    const word = words.find((w) => w.id === selectedWordId);
    if (!word) return;
    setBusy(true);
    try {
      const next = await replaceWordOnImage(page.imageDataUrl, word, editText);
      const nextWords = words
        .filter((w) => w.id !== word.id)
        .concat(editText.trim() ? [{ ...word, text: editText.trim() }] : []);
      setWords(nextWords);
      await persistPage(next, {
        ocrWords: nextWords,
        ocrText: nextWords.map((w) => w.text).join(" "),
      });
      setStatus("Text updated");
    } finally {
      setBusy(false);
    }
  };

  const eraseSelectedWord = async () => {
    if (!page || !selectedWordId) return;
    const word = words.find((w) => w.id === selectedWordId);
    if (!word) return;
    setBusy(true);
    try {
      const next = await eraseRegion(page.imageDataUrl, word.bbox, 3);
      const nextWords = words.filter((w) => w.id !== word.id);
      setWords(nextWords);
      setSelectedWordId(null);
      await persistPage(next, {
        ocrWords: nextWords,
        ocrText: nextWords.map((w) => w.text).join(" "),
      });
      setStatus("Text erased");
    } finally {
      setBusy(false);
    }
  };

  const runFindReplace = async (all: boolean) => {
    if (!page || !findText.trim()) return;
    setBusy(true);
    try {
      const { image, changed, remainingWords } = await findReplaceOnImage(
        page.imageDataUrl,
        words,
        findText,
        replaceText,
        all,
      );
      setWords(remainingWords);
      await persistPage(image, {
        ocrWords: remainingWords,
        ocrText: remainingWords.map((w) => w.text).join(" "),
      });
      setStatus(changed ? `Replaced ${changed}` : "No matches");
    } finally {
      setBusy(false);
    }
  };

  const applyFilterChoice = async (filter: ScanFilter) => {
    if (!page) return;
    setBusy(true);
    try {
      const base = page.originalDataUrl ?? page.imageDataUrl;
      const next =
        filter === "original" ? base : await applyFilter(base, filter);
      await persistPage(next, { filter });
      setStatus(`${SCAN_FILTERS.find((f) => f.id === filter)?.label} filter`);
    } finally {
      setBusy(false);
    }
  };

  const applyAdjustments = async () => {
    if (!page) return;
    setBusy(true);
    try {
      const next = await applyEnhanceAdjustments(page.imageDataUrl, adjust);
      await persistPage(next);
      setAdjust({ brightness: 0, contrast: 0, sharpness: 0 });
      setStatus("Enhanced");
    } finally {
      setBusy(false);
    }
  };

  const shareDoc = () => {
    setShareOpen(true);
  };

  const deleteCurrentPage = async () => {
    if (!doc || !page) return;
    if (doc.pages.length <= 1) {
      alert("Keep at least one page.");
      return;
    }
    if (!confirm("Delete this page?")) return;
    const pages = doc.pages.filter((_, i) => i !== pageIndex);
    const updated = {
      ...doc,
      pages,
      thumbnail: pages[0]?.imageDataUrl,
      updatedAt: Date.now(),
    };
    await saveDocument(updated);
    setDoc(updated);
    setPageIndex(Math.min(pageIndex, pages.length - 1));
    setWords(pages[Math.min(pageIndex, pages.length - 1)]?.ocrWords ?? []);
    clearHistory();
  };

  const goPage = (dir: -1 | 1) => {
    if (!doc) return;
    const next = Math.min(
      doc.pages.length - 1,
      Math.max(0, pageIndex + dir),
    );
    setPageIndex(next);
    setWords(doc.pages[next]?.ocrWords ?? []);
    setSelectedWordId(null);
    setImageTool(null);
    setCropRaw(null);
    setFloatingText(null);
    setPlaceMode(null);
    setZoom(1);
    clearHistory();
  };

  if (loading) {
    return <div className="center-pad muted">Opening editor…</div>;
  }

  if (!doc) {
    return (
      <div className="center-pad">
        <p className="muted">Document not found.</p>
        <Link href="/" className="btn-primary">
          Back to library
        </Link>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="center-pad">
        <p className="muted">No pages.</p>
        <Link href={documentHref(doc.id)} className="btn-primary">
          Back
        </Link>
      </div>
    );
  }

  return (
    <div className="cs-editor">
      <header className="cs-topbar">
        <button
          type="button"
          className="cs-icon-btn"
          aria-label="Close"
          onClick={() => router.push(documentHref(doc.id))}
        >
          ✕
        </button>
        <div className="cs-history-actions" role="toolbar" aria-label="History">
          <button
            type="button"
            className="cs-icon-btn"
            aria-label="Undo"
            title="Undo (Ctrl+Z)"
            disabled={!canUndo || busy}
            onClick={() => void undoEdit()}
          >
            ↶
          </button>
          <button
            type="button"
            className="cs-icon-btn"
            aria-label="Redo"
            title="Redo (Ctrl+Y)"
            disabled={!canRedo || busy}
            onClick={() => void redoEdit()}
          >
            ↷
          </button>
        </div>
        <div className="cs-top-actions">
          <button
            type="button"
            className="text-btn"
            onClick={() => shareDoc()}
            disabled={busy}
          >
            Share
          </button>
          <button
            type="button"
            className="btn-done"
            onClick={() => router.push(documentHref(doc.id))}
          >
            Done
          </button>
        </div>
      </header>

      {(busy || status) && (
        <div className="busy-bar" aria-live="polite">
          {busy
            ? `Working…${ocrProgress && imageTool === "editText" ? ` ${ocrProgress}%` : ""}`
            : status}
        </div>
      )}

      {cropRaw && cropQuad ? (
        <div className="step-panel">
          <CropEditor
            imageSrc={cropRaw}
            quad={cropQuad}
            onChange={setCropQuad}
          />
          <div className="step-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setCropRaw(null);
                setCropQuad(null);
                setImageTool(null);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={() => void applyCropPerspective()}
            >
              Apply crop
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="cs-zoom-bar" role="toolbar" aria-label="Zoom">
            <button
              type="button"
              className="cs-zoom-btn"
              aria-label="Zoom out"
              disabled={zoom <= 1}
              onClick={() => zoomBy(-0.25)}
            >
              −
            </button>
            <button
              type="button"
              className="cs-zoom-pct"
              onClick={zoomToFit}
              title="Fit to screen"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              className="cs-zoom-btn"
              aria-label="Zoom in"
              disabled={zoom >= 4}
              onClick={() => zoomBy(0.25)}
            >
              +
            </button>
            <button
              type="button"
              className="cs-zoom-fit"
              onClick={zoomToFit}
            >
              Fit
            </button>
            {needsPrecisionZoom && zoom < 1.5 && (
              <span className="cs-zoom-hint">Pinch or + to zoom</span>
            )}
          </div>

          <div
            className={`cs-stage ${zoom > 1 ? "is-zoomed" : ""}`}
            ref={stageRef}
            onTouchStart={(e) => {
              if (floatingText) return;
              if (e.touches.length === 2) {
                const [a, b] = [e.touches[0], e.touches[1]];
                const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
                pinchRef.current = { startDist: dist, startZoom: zoom };
              }
            }}
            onTouchMove={(e) => {
              if (floatingText) return;
              if (e.touches.length === 2 && pinchRef.current) {
                e.preventDefault();
                const [a, b] = [e.touches[0], e.touches[1]];
                const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
                const ratio = dist / Math.max(1, pinchRef.current.startDist);
                setZoomClamped(pinchRef.current.startZoom * ratio);
              }
            }}
            onTouchEnd={() => {
              pinchRef.current = null;
            }}
          >
            <button
              type="button"
              className="cs-trash"
              aria-label="Delete page"
              onClick={() => void deleteCurrentPage()}
            >
              🗑
            </button>
            <div className="editor-canvas-stack">
              <canvas
                ref={canvasRef}
                className={`editor-canvas ${
                  imageTool === "smartErase" ||
                  imageTool === "removeHandwriting" ||
                  placeMode ||
                  tab === "markup"
                    ? "tool-erase"
                    : ""
                } ${imageTool === "editText" ? "tool-text" : ""} ${
                  placeMode ? "place-mode" : ""
                }`}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onDoubleClick={() => {
                  if (zoom < 2) setZoomClamped(2.25);
                  else zoomToFit();
                }}
              />
              {floatingText && (
                <div
                  className="floating-text"
                  style={{
                    left: floatingText.x * scale,
                    top: floatingText.y * scale,
                    fontSize: floatingText.fontSize * scale,
                    color: floatingText.color,
                  }}
                  onPointerDown={onFloatingTextPointerDown}
                  onPointerMove={onFloatingTextPointerMove}
                  onPointerUp={onFloatingTextPointerUp}
                  onPointerCancel={onFloatingTextPointerUp}
                  onTouchStart={onFloatingTextTouchStart}
                  onTouchMove={onFloatingTextTouchMove}
                  onTouchEnd={onFloatingTextTouchEnd}
                >
                  {floatingText.text}
                  <span className="floating-text-handle" aria-hidden />
                </div>
              )}
            </div>
          </div>

          <div className="cs-pager">
            <button
              type="button"
              className="cs-icon-btn"
              disabled={pageIndex === 0}
              onClick={() => goPage(-1)}
              aria-label="Previous page"
            >
              ‹
            </button>
            <span>
              {pageIndex + 1}/{doc.pages.length}
            </span>
            <button
              type="button"
              className="cs-icon-btn"
              disabled={pageIndex >= doc.pages.length - 1}
              onClick={() => goPage(1)}
              aria-label="Next page"
            >
              ›
            </button>
          </div>
        </>
      )}

      {/* Active tool panels */}
      {!cropRaw && imageTool === "filter" && (
        <div className="cs-sheet">
          <FilterPicker
            value={page.filter}
            previewSrc={page.originalDataUrl ?? page.imageDataUrl}
            previews={previews}
            onChange={(f) => void applyFilterChoice(f)}
          />
          <label className="slider-row">
            <span>Brightness</span>
            <input
              type="range"
              min={-50}
              max={50}
              value={adjust.brightness}
              onChange={(e) =>
                setAdjust((a) => ({ ...a, brightness: Number(e.target.value) }))
              }
            />
          </label>
          <label className="slider-row">
            <span>Contrast</span>
            <input
              type="range"
              min={-50}
              max={50}
              value={adjust.contrast}
              onChange={(e) =>
                setAdjust((a) => ({ ...a, contrast: Number(e.target.value) }))
              }
            />
          </label>
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={() => void applyAdjustments()}
          >
            Apply enhance
          </button>
        </div>
      )}

      {!cropRaw && imageTool === "editText" && (
        <div className="cs-sheet">
          <p className="panel-title">Edit Text</p>
          {selectedWordId ? (
            <div className="text-edit-box">
              <label className="field">
                <span>Selected</span>
                <input
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                />
              </label>
              <div className="row-actions">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => void applyWordEdit()}
                >
                  Replace
                </button>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => void eraseSelectedWord()}
                >
                  Erase
                </button>
              </div>
            </div>
          ) : (
            <p className="hint">Tap a highlighted word on the page.</p>
          )}
          <div className="text-edit-box">
            <p className="subhead">Find & replace</p>
            <label className="field">
              <span>Find</span>
              <input
                value={findText}
                onChange={(e) => setFindText(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Replace</span>
              <input
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
              />
            </label>
            <div className="row-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => void runFindReplace(false)}
              >
                One
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => void runFindReplace(true)}
              >
                All
              </button>
            </div>
          </div>
        </div>
      )}

      {!cropRaw && imageTool === "smartErase" && (
        <div className="cs-sheet">
          <p className="panel-title">Smart Erase</p>
          <p className="hint">
            Brush over stains, stamps, or marks — fills with paper color.
          </p>
          <label className="slider-row">
            <span>Brush {brushSize}px</span>
            <input
              type="range"
              min={12}
              max={90}
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
            />
          </label>
        </div>
      )}

      {!cropRaw && imageTool === "removeHandwriting" && (
        <div className="cs-sheet">
          <p className="panel-title">Remove Handwriting</p>
          <p className="hint">
            Auto-clean pen marks, or brush only handwriting-like ink.
          </p>
          <div className="row-actions">
            {(
              [
                ["both", "Color + thin"],
                ["color", "Color ink"],
                ["thin", "Thin black"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`mini-chip ${hwMode === id ? "is-active" : ""}`}
                onClick={() => setHwMode(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="slider-row">
            <span>Auto strength {hwStrength}%</span>
            <input
              type="range"
              min={20}
              max={90}
              value={hwStrength}
              onChange={(e) => setHwStrength(Number(e.target.value))}
            />
          </label>
          <label className="slider-row">
            <span>Brush {brushSize}px</span>
            <input
              type="range"
              min={12}
              max={90}
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
            />
          </label>
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={() =>
              void (async () => {
                if (!page) return;
                setBusy(true);
                try {
                  const next = await removeHandwriting(
                    page.imageDataUrl,
                    hwMode,
                    hwStrength / 100,
                  );
                  await persistPage(next);
                  setStatus("Handwriting removed");
                } finally {
                  setBusy(false);
                }
              })()
            }
          >
            Auto remove on page
          </button>
        </div>
      )}

      {!cropRaw && imageTool === "addText" && (
        <div className="cs-sheet">
          <p className="panel-title">Add Text</p>
          <p className="hint">
            Place text, then drag with your finger to move and pinch to change
            size before applying.
          </p>
          <label className="field">
            <span>Text</span>
            <input
              value={addText}
              onChange={(e) => {
                const v = e.target.value;
                setAddText(v);
                if (floatingText) {
                  setFloatingText({ ...floatingText, text: v });
                }
              }}
              placeholder="Type text"
            />
          </label>
          <label className="slider-row">
            <span>Size {floatingText?.fontSize ?? addFontSize}</span>
            <input
              type="range"
              min={12}
              max={96}
              value={floatingText?.fontSize ?? addFontSize}
              onChange={(e) => {
                const n = Number(e.target.value);
                setAddFontSize(n);
                if (floatingText) {
                  setFloatingText({ ...floatingText, fontSize: n });
                }
              }}
            />
          </label>
          <div className="row-actions">
            {["#111111", "#e11d48", "#2563eb", "#16a34a", "#ca8a04"].map(
              (c) => (
                <button
                  key={c}
                  type="button"
                  className={`swatch ${
                    (floatingText?.color ?? addColor) === c ? "is-active" : ""
                  }`}
                  style={{ background: c }}
                  onClick={() => {
                    setAddColor(c);
                    if (floatingText) {
                      setFloatingText({ ...floatingText, color: c });
                    }
                  }}
                />
              ),
            )}
          </div>
          {!floatingText ? (
            <button
              type="button"
              className={`btn-secondary ${placeMode === "text" ? "is-active-btn" : ""}`}
              disabled={!addText.trim()}
              onClick={() =>
                setPlaceMode((m) => (m === "text" ? null : "text"))
              }
            >
              {placeMode === "text" ? "Tap page to place…" : "Place on page"}
            </button>
          ) : (
            <div className="row-actions" style={{ marginTop: "0.35rem" }}>
              <button
                type="button"
                className="btn-primary"
                disabled={busy || !floatingText.text.trim()}
                onClick={() => void applyFloatingText()}
              >
                Apply text
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={cancelFloatingText}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {!cropRaw && imageTool === "crop" && (
        <div className="cs-sheet">
          <p className="hint">Adjust corners on the crop view above.</p>
        </div>
      )}

      {!cropRaw && tab === "markup" && (
        <div className="cs-sheet">
          <div className="row-actions">
            <button
              type="button"
              className={`mini-chip ${markupTool === "pen" ? "is-active" : ""}`}
              onClick={() => setMarkupTool("pen")}
            >
              Pen
            </button>
            <button
              type="button"
              className={`mini-chip ${markupTool === "highlight" ? "is-active" : ""}`}
              onClick={() => setMarkupTool("highlight")}
            >
              Highlight
            </button>
          </div>
          {markupTool === "pen" && (
            <div className="row-actions">
              {["#e11d48", "#2563eb", "#ca8a04", "#16a34a", "#111111"].map(
                (c) => (
                  <button
                    key={c}
                    type="button"
                    className={`swatch ${inkColor === c ? "is-active" : ""}`}
                    style={{ background: c }}
                    onClick={() => setInkColor(c)}
                  />
                ),
              )}
            </div>
          )}
          <label className="slider-row">
            <span>Size {inkWidth}</span>
            <input
              type="range"
              min={2}
              max={24}
              value={inkWidth}
              onChange={(e) => setInkWidth(Number(e.target.value))}
            />
          </label>
        </div>
      )}

      {!cropRaw && tab === "page" && (
        <div className="cs-sheet">
          <div className="row-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() =>
                void (async () => {
                  setBusy(true);
                  try {
                    const next = await rotateImage(page.imageDataUrl, 90);
                    setWords([]);
                    await persistPage(next, { ocrWords: [], ocrText: "" });
                  } finally {
                    setBusy(false);
                  }
                })()
              }
            >
              Rotate 90°
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => void selectTool("retake")}
            >
              Retake
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={() => void deleteCurrentPage()}
            >
              Delete page
            </button>
          </div>
        </div>
      )}

      {/* Bottom CamScanner-style chrome */}
      <div className="cs-bottom">
        <div className="cs-tabs">
          {(
            [
              ["images", "Images"],
              ["markup", "Markup"],
              ["page", "Page"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`cs-tab ${tab === id ? "is-active" : ""}`}
              onClick={() => {
                setTab(id);
                if (id !== "images") setImageTool(null);
                setPlaceMode(null);
                setCropRaw(null);
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "images" && (
          <div className="cs-tools">
            {IMAGE_TOOLS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`cs-tool ${imageTool === t.id ? "is-active" : ""}`}
                onClick={() => void selectTool(t.id)}
              >
                <span className="cs-tool-icon" aria-hidden>
                  {t.icon}
                </span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <SignaturePad
        open={signOpen}
        onClose={() => setSignOpen(false)}
        onSave={(dataUrl) => {
          setSignature(dataUrl);
          setSignOpen(false);
          setImageTool("sign");
          setPlaceMode("sign");
          setStatus("Tap the page to place signature");
        }}
      />

      {placeMode === "sign" && (
        <div className="busy-bar">Tap page to place signature</div>
      )}

      {doc && (
        <ShareSheet
          doc={doc}
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          onStatus={(msg) => {
            setStatus(msg);
            if (msg) window.setTimeout(() => setStatus(null), 2200);
          }}
        />
      )}
    </div>
  );
}
