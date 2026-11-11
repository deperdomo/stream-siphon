"use client";

import * as React from "react";
import {
  ArrowRight,
  Check,
  ClipboardPaste,
  Download,
  Film,
  Loader2,
  Music,
  Package2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { performYoutubeAnalysis } from "@/lib/actions";
import type { DownloadRequest, VideoAnalysis } from "@/lib/types";
import { cn, isYoutubeUrl } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";

type Kind = DownloadRequest["kind"];

const KINDS: { value: Kind; label: string; icon: React.ElementType }[] = [
  { value: "video", label: "Video", icon: Film },
  { value: "audio", label: "Audio", icon: Music },
  { value: "dual", label: "Ambos", icon: Package2 },
];
const BITRATES = ["192", "128", "96"];
const BEST = "best";

export default function YoutubeDownloader() {
  const [url, setUrl] = React.useState("");
  const [urlError, setUrlError] = React.useState("");
  const [analysis, setAnalysis] = React.useState<VideoAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [kind, setKind] = React.useState<Kind>("video");
  const [height, setHeight] = React.useState(BEST);
  const [kbps, setKbps] = React.useState(BITRATES[0]);
  // null = sin descarga en curso; done = archivos entregados al navegador
  const [download, setDownload] = React.useState<{ progress: number; message: string; done?: boolean } | null>(null);

  const { toast } = useToast();
  const isDownloading = !!download && !download.done;
  const busy = isAnalyzing || isDownloading;

  const fail = (title: string, description: string) =>
    toast({ variant: "destructive", title, description });

  const analyze = async (value: string) => {
    value = value.trim();
    if (!isYoutubeUrl(value)) {
      setUrlError("Introduce un enlace de YouTube válido.");
      return;
    }
    setUrlError("");
    setIsAnalyzing(true);
    setAnalysis(null);
    setDownload(null);
    try {
      const result = await performYoutubeAnalysis(value);
      if ("error" in result) return fail("No se pudo analizar el video", result.error);
      setAnalysis(result);
      setKind("video");
      setHeight(BEST);
    } catch {
      fail("No se pudo analizar el video", "Error de conexión con el servidor.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const setAndAnalyze = (text: string) => {
    setUrl(text);
    if (isYoutubeUrl(text.trim())) analyze(text);
  };

  const pasteFromClipboard = async () => {
    try {
      setAndAnalyze(await navigator.clipboard.readText());
    } catch {
      fail("Sin acceso al portapapeles", "Pega el enlace manualmente con Ctrl/Cmd + V.");
    }
  };

  const reset = () => {
    setUrl("");
    setUrlError("");
    setAnalysis(null);
    setDownload(null);
  };

  const handleDownload = async () => {
    setDownload({ progress: 0, message: "Iniciando…" });
    try {
      const body: DownloadRequest = {
        youtubeUrl: url.trim(),
        kind,
        height: height === BEST ? undefined : Number(height),
        kbps: Number(kbps),
      };
      const response = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok || !response.body) {
        throw new Error((await response.json().catch(() => null))?.error ?? "El servidor rechazó la descarga.");
      }

      // El servidor emite una línea JSON por evento: progreso… y al final los archivos o un error
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      let files: { id: string; filename: string }[] | undefined;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line) continue;
          const event = JSON.parse(line);
          if (event.error) throw new Error(event.error);
          if (event.files) files = event.files;
          else setDownload({ progress: event.progress, message: event.message });
        }
      }
      if (!files) throw new Error("La conexión se cortó antes de terminar. Inténtalo de nuevo.");

      // El navegador descarga cada archivo directamente (sin cargarlo en memoria)
      for (const file of files) {
        const link = document.createElement("a");
        link.href = `/api/download?id=${file.id}`;
        link.download = file.filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        await new Promise((r) => setTimeout(r, 800));
      }
      setDownload({ progress: 100, message: files.length > 1 ? "Archivos listos" : "Archivo listo", done: true });
    } catch (error) {
      setDownload(null);
      fail("La descarga falló", error instanceof Error ? error.message : "Error desconocido.");
    }
  };

  const bestLabel = analysis?.heights[0] ? `Mejor disponible (${analysis.heights[0]}p)` : "Mejor disponible";
  const kindIndex = KINDS.findIndex((k) => k.value === kind);

  return (
    <div className="material w-full max-w-xl rounded-[1.75rem] p-6 sm:p-8">
      <header className="relative flex flex-col items-center text-center">
        <div className="absolute -right-2 -top-2">
          <ThemeToggle />
        </div>
        <h1 className="text-4xl font-semibold leading-[1.05] tracking-[-0.022em]">StreamSiphon</h1>
        <p className="mt-2 text-muted-foreground">Descarga video y audio de YouTube.</p>
      </header>

      <form
        className="mt-8"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          analyze(url);
        }}
      >
        <div className="relative">
          <Input
            type="url"
            inputMode="url"
            autoComplete="off"
            aria-label="Enlace de YouTube"
            aria-invalid={!!urlError}
            aria-describedby={urlError ? "url-error" : undefined}
            placeholder="Pega un enlace de YouTube"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setUrlError("");
            }}
            onPaste={(e) => {
              const text = e.clipboardData.getData("text");
              if (!isYoutubeUrl(text.trim())) return; // pegado normal
              e.preventDefault();
              setAndAnalyze(text);
            }}
            disabled={busy}
            className="h-12 rounded-full border-transparent bg-muted pl-5 pr-24 text-base md:text-base"
          />
          <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 gap-1">
            {url ? (
              <Button type="button" variant="ghost" size="icon" className="size-9 rounded-full text-muted-foreground" onClick={reset} disabled={busy}>
                <X />
                <span className="sr-only">Borrar</span>
              </Button>
            ) : (
              <Button type="button" variant="ghost" size="icon" className="size-9 rounded-full text-muted-foreground" onClick={pasteFromClipboard} disabled={busy}>
                <ClipboardPaste />
                <span className="sr-only">Pegar desde el portapapeles</span>
              </Button>
            )}
            <Button type="submit" size="icon" className="size-9 rounded-full" disabled={busy || !url}>
              {isAnalyzing ? <Loader2 className="animate-spin" /> : <ArrowRight />}
              <span className="sr-only">Analizar</span>
            </Button>
          </div>
        </div>
        {urlError && (
          <p id="url-error" role="alert" className="mt-2 pl-5 text-sm text-destructive">
            {urlError}
          </p>
        )}
      </form>

      {isAnalyzing && (
        <div className="mt-6 flex animate-pulse items-center gap-4" aria-label="Analizando video">
          <div className="aspect-video w-36 shrink-0 rounded-xl bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-4/5 rounded-full bg-muted" />
            <div className="h-4 w-1/3 rounded-full bg-muted" />
          </div>
        </div>
      )}

      {analysis && (
        <div className="materialize mt-6 space-y-5">
          <div className="flex items-center gap-4">
            {analysis.thumbnailUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={analysis.thumbnailUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="aspect-video w-36 shrink-0 rounded-xl object-cover shadow-md"
              />
            )}
            <div className="min-w-0">
              <h2 className="line-clamp-2 font-semibold leading-snug">{analysis.title}</h2>
              {analysis.duration && (
                <p className="mt-1 text-sm tabular-nums text-muted-foreground">{analysis.duration}</p>
              )}
            </div>
          </div>

          {/* Control segmentado: el indicador se desliza hasta la opción elegida */}
          <div role="radiogroup" aria-label="Formato" className="relative grid grid-cols-3 rounded-full bg-muted p-1">
            <div
              aria-hidden
              className="segment-thumb absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-full bg-card shadow-sm dark:bg-secondary-foreground/20"
              style={{ transform: `translateX(${kindIndex * 100}%)` }}
            />
            {KINDS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={kind === value}
                disabled={isDownloading}
                onClick={() => {
                  setKind(value);
                  setDownload(null);
                }}
                className={cn(
                  "pressable relative z-10 flex h-9 items-center justify-center gap-1.5 rounded-full text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
                  kind === value ? "text-foreground" : "text-muted-foreground"
                )}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {kind !== "audio" && (
              <Select value={height} onValueChange={setHeight} disabled={isDownloading}>
                <SelectTrigger aria-label="Calidad de video" className={cn("h-11 rounded-xl text-base", kind === "video" && "sm:col-span-2")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={BEST}>{bestLabel}</SelectItem>
                  {analysis.heights.map((h) => (
                    <SelectItem key={h} value={String(h)}>
                      {h}p
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {kind !== "video" && (
              <Select value={kbps} onValueChange={setKbps} disabled={isDownloading}>
                <SelectTrigger aria-label="Calidad de audio" className={cn("h-11 rounded-xl text-base", kind === "audio" && "sm:col-span-2")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BITRATES.map((b) => (
                    <SelectItem key={b} value={b}>
                      MP3 · {b} kbps
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <p className="text-sm text-muted-foreground">
            {kind === "video" && "Un archivo MP4 con video y audio."}
            {kind === "audio" && "Un archivo MP3 solo con el audio."}
            {kind === "dual" && "Dos archivos: el video en MP4 y el audio en MP3."}
          </p>

          {download && (
            <div className="space-y-2" role="status" aria-live="polite">
              <Progress value={download.progress} className="h-1.5 bg-muted" />
              <p className="text-center text-sm tabular-nums text-muted-foreground">{download.message}</p>
            </div>
          )}

          {download?.done ? (
            <Button onClick={reset} variant="secondary" className="h-12 w-full rounded-full text-base">
              <Check />
              Descargar otro video
            </Button>
          ) : (
            <Button onClick={handleDownload} className="h-12 w-full rounded-full text-base" disabled={isDownloading}>
              {isDownloading ? <Loader2 className="animate-spin" /> : <Download />}
              {isDownloading ? "Descargando…" : "Descargar"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
