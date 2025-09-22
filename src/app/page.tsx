import YoutubeDownloader from "@/components/app/youtube-downloader";

export default function Home() {
  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4 transition-colors">
      <YoutubeDownloader />
    </main>
  );
}
