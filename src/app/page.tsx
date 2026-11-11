import YoutubeDownloader from "@/components/app/youtube-downloader";

// El análisis (server action) puede tardar si YouTube responde lento
export const maxDuration = 60;

export default function Home() {
  return (
    <main className="flex min-h-dvh w-full flex-col items-center justify-center p-4">
      <YoutubeDownloader />
    </main>
  );
}
