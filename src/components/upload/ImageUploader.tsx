"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Upload, CheckCircle, AlertCircle, Image } from "lucide-react";

interface UploadResult {
  url: string;
  key: string;
  width: number;
  height: number;
  fileSize: number;
  thumbnailUrl: string;
}

interface ImageUploaderProps {
  sceneId: string;
  onUploadComplete: (result: UploadResult) => void;
  className?: string;
}

type UploadStatus = "idle" | "uploading" | "done" | "error";

export function ImageUploader({ sceneId, onUploadComplete, className }: ImageUploaderProps) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const uploadFile = useCallback(
    async (file: File) => {
      setStatus("uploading");
      setProgress(0);
      setErrorMessage("");

      try {
        // Maße/Größe kommen vom Server — der komprimiert Panoramen beim Upload
        const { key, url, width, height, fileSize } = await uploadWithProgress(
          file,
          sceneId,
          setProgress
        );

        const result: UploadResult = {
          url,
          key,
          width: width ?? 0,
          height: height ?? 0,
          fileSize: fileSize ?? file.size,
          thumbnailUrl: url,
        };

        setStatus("done");
        onUploadComplete(result);
      } catch (err) {
        setStatus("error");
        setErrorMessage(err instanceof Error ? err.message : "Unbekannter Fehler");
      }
    },
    [sceneId, onUploadComplete]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: ([file]) => file && uploadFile(file),
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
    },
    maxFiles: 1,
    disabled: status === "uploading",
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
        isDragActive
          ? "border-primary bg-primary/5 scale-[1.01]"
          : "border-border hover:border-primary/50 hover:bg-muted/50",
        status === "uploading" && "cursor-not-allowed opacity-70",
        className
      )}
    >
      <input {...getInputProps()} />

      {status === "idle" && (
        <div className="flex flex-col items-center gap-3">
          <div className="p-3 rounded-full bg-primary/10">
            <Upload className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="font-medium text-sm">
              {isDragActive ? "Bild loslassen..." : "360°-Panorama hochladen"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              JPG, PNG oder WebP · Max. 30 MB · Empfohlen: 2:1 Seitenverhältnis
            </p>
          </div>
        </div>
      )}

      {status === "uploading" && (
        <div className="flex flex-col items-center gap-3">
          <Image className="h-6 w-6 text-primary animate-pulse" />
          <div className="w-full max-w-xs">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">{Math.round(progress)}%</p>
          </div>
        </div>
      )}

      {status === "done" && (
        <div className="flex flex-col items-center gap-2">
          <CheckCircle className="h-6 w-6 text-green-500" />
          <p className="text-sm font-medium text-green-600">Upload erfolgreich!</p>
          <p className="text-xs text-muted-foreground">Klicken um erneut hochzuladen</p>
        </div>
      )}

      {status === "error" && (
        <div className="flex flex-col items-center gap-2">
          <AlertCircle className="h-6 w-6 text-destructive" />
          <p className="text-sm font-medium text-destructive">{errorMessage}</p>
          <p className="text-xs text-muted-foreground">Klicken um erneut zu versuchen</p>
        </div>
      )}
    </div>
  );
}

function uploadWithProgress(
  file: File,
  sceneId: string,
  onProgress: (p: number) => void
): Promise<{
  key: string;
  url: string;
  width: number | null;
  height: number | null;
  fileSize: number | null;
}> {
  return new Promise((resolve, reject) => {
    const body = new FormData();
    body.append("file", file);
    body.append("sceneId", sceneId);

    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) onProgress((e.loaded / e.total) * 100);
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        const msg = (() => { try { return JSON.parse(xhr.responseText).error; } catch { return null; } })();
        reject(new Error(msg ?? `Upload fehlgeschlagen (${xhr.status})`));
      }
    });
    xhr.addEventListener("error", () => reject(new Error("Netzwerkfehler")));
    xhr.open("POST", "/api/upload");
    xhr.send(body);
  });
}
