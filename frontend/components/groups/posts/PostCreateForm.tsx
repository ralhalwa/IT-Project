import { useRef, useState } from 'react';
import { X } from 'lucide-react';

export type GroupPostFormType = {
  content: string;
  image: File | null;
};

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (form: GroupPostFormType) => void;
  loading: boolean;
}

export default function CreatePostModal({ isOpen, onClose, onSubmit, loading }: CreatePostModalProps) {
  const [content, setContent] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [validationErrors, setValidationErrors] = useState<{ content?: string; image?: string }>({});
const [isComposing, setIsComposing] = useState(false); 
const formRef = useRef<HTMLFormElement>(null);
  if (!isOpen) return null;

    const validateImage = (file: File): string | null => {
    // Check file size (25MB max)
    if (file.size > 25 * 1024 * 1024) {
      return 'File size too large - maximum 25MB';
    }

    // Check file extension
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif'];
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    
    if (!allowedExtensions.includes(fileExtension)) {
      return 'Invalid file type. Only JPG, PNG, and GIF are allowed';
    }

    // Check MIME type
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowedMimeTypes.includes(file.type)) {
      return 'Invalid file format. Only JPEG, PNG, and GIF images are allowed';
    }

    return null;
  };


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const errors: { content?: string; image?: string } = {};
    if (!content.trim() && !image) {
      errors.content = "Write something or attach an image.";
    }
    
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;

    onSubmit({ content, image });
    setContent('');
    setImage(null);
    setValidationErrors({});
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;

    if (file) {
      const error = validateImage(file);
      if (error) {
        setValidationErrors(prev => ({ ...prev, image: error }));
        e.target.value = ''; // Clear input
        return;
      }
    }

    setImage(file);
    if (validationErrors.image) setValidationErrors(prev => ({ ...prev, image: undefined }));
  };

  const handleRemoveImage = () => {
    setImage(null);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-[#1a1a1a] rounded-xl border bg-[#1b1b1b] border-[rgba(255,0,255,.35)] p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-white">Create New Post</h2>
          <button onClick={onClose} className="text-[#aab9c2] hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

<form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
         <div className="relative">
<div className="flex justify-end">
  <div className="text-[11px] text-[#aab9c2] mt-1">
    Press <span className="font-semibold">Enter</span> to send · <span className="font-semibold">Shift+Enter</span> for new line
  </div>
</div>


  <textarea
    value={content}
    onChange={(e) => {
      setContent(e.target.value);
      if (validationErrors.content) setValidationErrors(prev => ({ ...prev, content: undefined }));
    }}
    onKeyDown={(e) => {
      if (isComposing) return;
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (content.trim() || image) {
          formRef.current?.requestSubmit();
        } else {
          setValidationErrors(prev => ({ ...prev, content: 'Write something or attach an image.' }));
        }
      }
    }}
    onCompositionStart={() => setIsComposing(true)}
    onCompositionEnd={() => setIsComposing(false)}
    className="w-full bg-[#2a2a2a] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-white resize-none"
    rows={4}
    maxLength={500}
    placeholder="What's on your mind?"
  />
  {validationErrors.content && (
    <div className="text-red-400 text-xs mt-1">{validationErrors.content}</div>
  )}
</div>


          <div className="flex items-center justify-between gap-3">
            <label className="inline-flex items-center px-3 py-1.5 rounded-md bg-[#2a2a2a] border border-[rgba(255,0,255,.35)] cursor-pointer text-sm text-white">
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.gif,image/jpeg,image/png,image/gif"
                className="hidden"
                onChange={handleImageChange}
              />
              Upload image
            </label>

            {image && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#cfe]">{image.name}</span>
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="text-xs px-2 py-1 rounded bg-[#232323] border border-[rgba(255,255,255,.12)] hover:border-[rgba(255,0,255,.35)] text-white"
                >
                  Remove
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 text-white rounded-lg bg-[rgba(255,0,255,.35)] transition hover:bg-[rgba(255,0,255,.50)] disabled:opacity-50"
            >
              {loading ? 'Posting...' : 'Create Post'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}