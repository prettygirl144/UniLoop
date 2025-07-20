import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Upload, X, Image, FileText } from "lucide-react";

interface MediaUploaderProps {
  onUploadComplete: (url: string) => void;
  maxFiles?: number;
  acceptedTypes?: string[];
  existingUrls?: string[];
}

export default function MediaUploader({ 
  onUploadComplete, 
  maxFiles = 5, 
  acceptedTypes = ["image/*", "video/*"],
  existingUrls = []
}: MediaUploaderProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      // Convert file to base64 for mock upload
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      return await apiRequest("/api/upload", {
        method: "POST",
        body: JSON.stringify({
          file: base64,
          fileName: file.name,
        }),
      });
    },
    onSuccess: (data) => {
      onUploadComplete(data.url);
      toast({
        title: "Upload successful",
        description: "Media file uploaded successfully",
      });
    },
    onError: () => {
      toast({
        title: "Upload failed",
        description: "Failed to upload media file",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const totalFiles = existingUrls.length + selectedFiles.length + files.length;
    
    if (totalFiles > maxFiles) {
      toast({
        title: "Too many files",
        description: `You can only upload up to ${maxFiles} files`,
        variant: "destructive",
      });
      return;
    }

    setSelectedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async () => {
    if (selectedFiles.length === 0) return;

    setUploadProgress(0);
    
    for (let i = 0; i < selectedFiles.length; i++) {
      try {
        await uploadMutation.mutateAsync(selectedFiles[i]);
        setUploadProgress(((i + 1) / selectedFiles.length) * 100);
      } catch (error) {
        break;
      }
    }
    
    setSelectedFiles([]);
    setUploadProgress(0);
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <Image className="h-4 w-4" />;
    }
    return <FileText className="h-4 w-4" />;
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <Card className="border-dashed border-2 hover:border-primary/50 transition-colors">
        <CardContent className="p-6">
          <div 
            className="text-center cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium">Click to upload media</p>
            <p className="text-xs text-muted-foreground mt-1">
              Support images and videos (max {maxFiles} files)
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={acceptedTypes.join(",")}
            onChange={handleFileSelect}
            className="hidden"
          />
        </CardContent>
      </Card>

      {/* Selected Files */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Selected Files</h4>
          {selectedFiles.map((file, index) => (
            <Card key={index}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getFileIcon(file)}
                    <span className="text-sm font-medium">{file.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({(file.size / 1024 / 1024).toFixed(1)} MB)
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {/* Upload Progress */}
          {uploadMutation.isPending && (
            <div className="space-y-2">
              <Progress value={uploadProgress} className="w-full" />
              <p className="text-xs text-center text-muted-foreground">
                Uploading files... {Math.round(uploadProgress)}%
              </p>
            </div>
          )}
          
          {/* Upload Button */}
          <Button 
            onClick={uploadFiles}
            disabled={uploadMutation.isPending}
            className="w-full"
          >
            {uploadMutation.isPending ? "Uploading..." : `Upload ${selectedFiles.length} file(s)`}
          </Button>
        </div>
      )}

      {/* Existing Media */}
      {existingUrls.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Existing Media</h4>
          <div className="grid grid-cols-2 gap-2">
            {existingUrls.map((url, index) => (
              <Card key={index}>
                <CardContent className="p-2">
                  <img 
                    src={url} 
                    alt={`Media ${index + 1}`}
                    className="w-full h-20 object-cover rounded"
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}