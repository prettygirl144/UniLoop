import React, { useCallback } from 'react';
import { Bold, Italic, Underline } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Write your message...",
  className = "",
  minHeight = "120px"
}: RichTextEditorProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const insertFormatting = useCallback((format: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    
    let formattedText = '';
    switch (format) {
      case 'bold':
        formattedText = selectedText ? `**${selectedText}**` : '**text**';
        break;
      case 'italic':
        formattedText = selectedText ? `*${selectedText}*` : '*text*';
        break;
      case 'underline':
        formattedText = selectedText ? `_${selectedText}_` : '_text_';
        break;
    }

    const newValue = value.substring(0, start) + formattedText + value.substring(end);
    onChange(newValue);

    // Set cursor position after formatting
    setTimeout(() => {
      if (selectedText) {
        textarea.setSelectionRange(start + formattedText.length, start + formattedText.length);
      } else {
        // Select the placeholder text
        const placeholderStart = start + (format === 'bold' ? 2 : 1);
        const placeholderEnd = placeholderStart + 4; // "text" length
        textarea.setSelectionRange(placeholderStart, placeholderEnd);
      }
      textarea.focus();
    }, 0);
  }, [value, onChange]);

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Formatting Toolbar */}
      <div className="flex gap-1 p-2 border rounded-t border-b-0 bg-gray-50 dark:bg-gray-800">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => insertFormatting('bold')}
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => insertFormatting('italic')}
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => insertFormatting('underline')}
          title="Underline"
        >
          <Underline className="h-4 w-4" />
        </Button>
      </div>

      {/* Text Area */}
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-t-none text-small resize-none"
        style={{ minHeight }}
      />

      {/* Help Text */}
      <p className="text-small text-gray-500">
        Use **bold**, *italic*, and _underline_ for formatting
      </p>
    </div>
  );
}

// Component to render formatted text
interface FormattedTextProps {
  children: string;
  className?: string;
}

export function FormattedText({ children, className = "" }: FormattedTextProps) {
  // Security fix: Escape HTML first, then apply safe formatting
  const formatText = useCallback((text: string) => {
    // First, escape all HTML to prevent XSS attacks
    const escapedText = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    
    // Then apply safe markdown-style formatting
    return escapedText
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/_(.*?)_/g, '<u>$1</u>')
      .replace(/\n/g, '<br>');
  }, []);

  return (
    <div
      className={`text-small ${className}`}
      dangerouslySetInnerHTML={{ __html: formatText(children) }}
    />
  );
}