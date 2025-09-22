"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import Image from "next/image";
import {
  Download,
  Film,
  Loader2,
  Music,
  Search,
  CheckCircle,
  XCircle,
  Youtube,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { performYoutubeAnalysis, downloadYoutubeVideo } from "@/lib/actions";
import type { AnalyzeYoutubeUrlOutput, DownloadYoutubeVideoOutput } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "./theme-toggle";

const formSchema = z.object({
  youtubeUrl: z.string().url("Invalid URL. Please verify it's a YouTube link."),
});

type FormValues = z.infer<typeof formSchema>;

export default function YoutubeDownloader() {
  const [analysisResult, setAnalysisResult] =
    React.useState<AnalyzeYoutubeUrlOutput | null>(null);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [downloadProgress, setDownloadProgress] = React.useState(0);
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [downloadComplete, setDownloadComplete] = React.useState(false);
  const [selectedFormatType, setSelectedFormatType] = React.useState<"video" | "audio">("video");
  const [selectedQuality, setSelectedQuality] = React.useState<string>("");

  const { toast } = useToast();

  const formRef = React.useRef<HTMLFormElement>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      youtubeUrl: "",
    },
  });

  const onSubmit = async (data: FormValues) => {
    setIsAnalyzing(true);
    setAnalysisResult(null);
    setDownloadComplete(false);
    setDownloadProgress(0);

    try {
      const result = await performYoutubeAnalysis(data);
      setAnalysisResult(result);
      const videoFormats = result.formats.filter(f => !f.endsWith('kbps'));
      const audioFormats = result.formats.filter(f => f.endsWith('kbps'));
      
      if (videoFormats.length > 0) {
        setSelectedFormatType('video');
        setSelectedQuality(videoFormats[0]);
      } else if (audioFormats.length > 0) {
        setSelectedFormatType('audio');
        setSelectedQuality(audioFormats[0]);
      }

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Analysis Failed",
        description:
          error instanceof Error
            ? error.message
            : "An unknown error occurred.",
        action: <XCircle className="text-destructive-foreground" />,
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDownload = async () => {
    if (!analysisResult || !selectedQuality) {
      toast({
        variant: "destructive",
        title: "No Quality Selected",
        description: "Please select a quality before downloading."
      });
      return;
    }
    setIsDownloading(true);
    setDownloadProgress(0);
    setDownloadComplete(false);

    try {
      // Simulate progress for the fetch
      let progressInterval = setInterval(() => {
        setDownloadProgress((prev) => {
          if (prev >= 95) { // Stop before 100
            clearInterval(progressInterval);
            return prev;
          }
          return prev + Math.random() * 5 + 1;
        });
      }, 200);

      const result = await downloadYoutubeVideo({ 
        youtubeUrl: form.getValues("youtubeUrl"), 
        format: selectedQuality 
      });

      if (result.success && result.fileName) {
        // Use the API route to download the actual file
        const downloadResponse = await fetch('/api/download', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            youtubeUrl: form.getValues("youtubeUrl"),
            format: selectedQuality
          }),
        });

        if (!downloadResponse.ok) {
          throw new Error('Download failed');
        }

        // Create blob from response
        const blob = await downloadResponse.blob();
        
        // Create download link
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = result.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up blob URL
        window.URL.revokeObjectURL(url);

        clearInterval(progressInterval);
        setDownloadProgress(100);
        setDownloadComplete(true);
        setIsDownloading(false);
        
        toast({
          title: "Download Complete!",
          description: `${result.fileName} has been downloaded to your Downloads folder.`,
          action: <CheckCircle className="text-green-500" />,
        });
      } else {
        throw new Error(result.error || "Download failed: No file data received.");
      }

    } catch (error) {
      setIsDownloading(false);
      setDownloadProgress(0);
      toast({
        variant: "destructive",
        title: "Download Failed",
        description:
          error instanceof Error
            ? error.message
            : "An unknown error occurred during download.",
        action: <XCircle className="text-destructive-foreground" />,
      });
    }
  };
  
  const videoFormats = React.useMemo(() => 
    analysisResult?.formats.filter((f) => !f.endsWith("kbps")) || [],
    [analysisResult]
  );

  const audioFormats = React.useMemo(() => 
    analysisResult?.formats.filter((f) => f.endsWith("kbps")) || [],
    [analysisResult]
  );
  
  const resetState = () => {
    form.reset();
    setAnalysisResult(null);
    setIsAnalyzing(false);
    setIsDownloading(false);
    setDownloadComplete(false);
    setDownloadProgress(0);
  }
  
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text');
    if (pastedText && formSchema.shape.youtubeUrl.safeParse(pastedText).success) {
      form.setValue('youtubeUrl', pastedText, { shouldValidate: true });
       setTimeout(() => {
        formRef.current?.dispatchEvent(
          new Event('submit', {cancelable: true, bubbles: true})
        );
      }, 0);
    }
  };

  React.useEffect(() => {
    if (analysisResult) {
      const formats = selectedFormatType === 'video' ? videoFormats : audioFormats;
      if (formats.length > 0 && !formats.includes(selectedQuality)) {
        setSelectedQuality(formats[0]);
      }
    }
  }, [selectedFormatType, analysisResult, videoFormats, audioFormats, selectedQuality]);

  return (
    <Card className="w-full max-w-2xl shadow-2xl shadow-primary/10">
      <CardHeader className="text-center relative">
        <div className="absolute top-4 right-4">
            <ThemeToggle />
        </div>
        <div className="mx-auto bg-primary text-primary-foreground p-3 rounded-full mb-2 w-fit">
          <Youtube size={32} />
        </div>
        <CardTitle className="text-3xl font-bold tracking-tight">
          StreamSiphon
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Download YouTube videos and audio with ease.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form ref={formRef} onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="youtubeUrl"
              render={({ field }) => (
                <FormItem>
                  <div className="flex gap-2">
                    <FormControl>
                      <Input
                        placeholder="Paste YouTube video URL here..."
                        {...field}
                        onPaste={handlePaste}
                        className="h-12 text-base"
                        disabled={isAnalyzing}
                      />
                    </FormControl>
                    <Button type="submit" size="lg" className="h-12" disabled={isAnalyzing}>
                      {isAnalyzing ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Search />
                      )}
                      <span className="sr-only">Analyze</span>
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        {isAnalyzing && (
            <div className="mt-6 space-y-4">
                <Skeleton className="w-full h-48 rounded-lg" />
                <Skeleton className="w-3/4 h-8" />
                <Skeleton className="w-1/2 h-6" />
            </div>
        )}

        {analysisResult && (
          <div className="mt-6 space-y-6 animate-in fade-in-50 duration-500">
            <Card className="overflow-hidden">
              <div className="grid md:grid-cols-2">
                <div className="relative aspect-video">
                  <Image
                    src={analysisResult.thumbnailUrl}
                    alt={`Thumbnail for ${analysisResult.title}`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                </div>
                <div className="p-6 flex flex-col justify-center">
                  <h3 className="font-semibold text-lg leading-tight line-clamp-2">
                    {analysisResult.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    Duration: {analysisResult.duration}
                  </p>
                </div>
              </div>
            </Card>

            <Tabs value={selectedFormatType} onValueChange={(v) => setSelectedFormatType(v as "video" | "audio")} className="w-full">
              <TabsList className="grid w-full grid-cols-2 h-12">
                <TabsTrigger value="video" className="h-full text-base gap-2" disabled={videoFormats.length === 0}><Film />Video</TabsTrigger>
                <TabsTrigger value="audio" className="h-full text-base gap-2" disabled={audioFormats.length === 0}><Music />Audio</TabsTrigger>
              </TabsList>
              <TabsContent value="video">
                <Select onValueChange={setSelectedQuality} value={selectedQuality} disabled={videoFormats.length === 0}>
                  <SelectTrigger className="w-full h-12 text-base">
                    <SelectValue placeholder="Select video quality" />
                  </SelectTrigger>
                  <SelectContent>
                    {videoFormats.map((format) => (
                      <SelectItem key={format} value={format} className="text-base">
                        {format}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground mt-2">
                  ℹ️ Las calidades HD se combinan automáticamente con el mejor audio disponible
                </p>
              </TabsContent>
              <TabsContent value="audio">
                <Select onValueChange={setSelectedQuality} value={selectedQuality} disabled={audioFormats.length === 0}>
                  <SelectTrigger className="w-full h-12 text-base">
                    <SelectValue placeholder="Select audio quality" />
                  </SelectTrigger>
                  <SelectContent>
                    {audioFormats.map((format) => (
                      <SelectItem key={format} value={format} className="text-base">
                        {format}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TabsContent>
            </Tabs>
            
            {(isDownloading || downloadComplete) && (
              <div className="space-y-2">
                  <Progress value={downloadProgress} className="w-full h-3" />
                  <p className="text-sm text-center text-muted-foreground">
                    {isDownloading ? `Downloading... ${Math.round(downloadProgress)}%` : `Download complete!`}
                  </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
      {analysisResult && (
        <CardFooter className="flex-col gap-2">
            {!downloadComplete ? (
                 <Button onClick={handleDownload} size="lg" className="w-full h-12 text-lg" disabled={isDownloading || !selectedQuality}>
                 {isDownloading ? (
                   <>
                     <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                     Downloading
                   </>
                 ) : (
                   <>
                     <Download className="mr-2 h-5 w-5" />
                     Download {selectedQuality}
                   </>
                 )}
               </Button>
            ) : (
                <Button onClick={resetState} size="lg" className="w-full h-12 text-lg" variant="secondary">
                    Download Another
                </Button>
            )}
        </CardFooter>
      )}
    </Card>
  );
}
