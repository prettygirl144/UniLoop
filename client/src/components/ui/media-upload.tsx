import React, { useCallback } from 'react';
import { Upload, X, Image, FileImage } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface MediaUploadProps {
  value: string[];
  onChange: (files: string[]) => void;
  maxFiles?: number;
  maxSize?: number; // in MB
  accept?: string;
  className?: string;
}

export function MediaUpload({
  value = [],
  onChange,
  maxFiles = 5,
  maxSize = 5,
  accept = "image/*,.gif",
  className = ""
}: MediaUploadProps) {
  const handleFileUpload = useCallback((files: FileList | null) => {
    if (!files) return;

    const newFiles: string[] = [];
    const maxSizeBytes = maxSize * 1024 * 1024;

    Array.from(files).forEach((file) => {
      // Validate file size
      if (file.size > maxSizeBytes) {
        alert(`File ${file.name} is too large. Maximum size is ${maxSize}MB`);
        return;
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert(`File ${file.name} is not a supported image format`);
        return;
      }

      // Create blob URL for preview
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        newFiles.push(dataUrl);
        
        // Update when all files are processed
        if (newFiles.length === Array.from(files).filter(f => 
          f.size <= maxSizeBytes && f.type.startsWith('image/')
        ).length) {
          const updatedFiles = [...value, ...newFiles].slice(0, maxFiles);
          onChange(updatedFiles);
        }
      };
      reader.readAsDataURL(file);
    });
  }, [value, onChange, maxFiles, maxSize]);

  const removeFile = useCallback((index: number) => {
    const newFiles = [...value];
    newFiles.splice(index, 1);
    onChange(newFiles);
  }, [value, onChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleFileUpload(e.dataTransfer.files);
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* File Upload Area */}
      <div
        className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-center hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <div className="space-y-2">
          <Upload className="h-8 w-8 text-gray-400 mx-auto" />
          <div>
            <label htmlFor="media-upload" className="cursor-pointer">
              <span className="text-small text-blue-600 hover:text-blue-500">
                Click to upload
              </span>
              <span className="text-small text-gray-500"> or drag and drop</span>
            </label>
            <input
              id="media-upload"
              type="file"
              multiple
              accept={accept}
              onChange={(e) => handleFileUpload(e.target.files)}
              className="hidden"
            />
          </div>
          <p className="text-small text-gray-500">
            {accept.includes('image') ? 'Images' : 'Files'} up to {maxSize}MB each (max {maxFiles} files)
          </p>
        </div>
      </div>

      {/* File Previews */}
      {value.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {value.map((file, index) => (
            <Card key={index} className="relative group">
              <CardContent className="p-2">
                <div className="aspect-square relative">
                  {file.startsWith('data:image') ? (
                    <img
                      src={file}
                      alt={`Upload ${index + 1}`}
                      className="w-full h-full object-cover rounded"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center">
                      <FileImage className="h-8 w-8 text-gray-400" />
                    </div>
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeFile(index)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}