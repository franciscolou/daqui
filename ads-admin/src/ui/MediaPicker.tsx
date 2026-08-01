import { useRef, useState } from 'react';
import { api, errorMessage } from '../lib/api';

export interface UploadedMedia {
  url: string;
  type: 'image' | 'video';
}

// Escolha de foto/vídeo do criativo: sobe pro ads-backend na hora e mostra o
// preview do que foi enviado.

export function MediaPicker({
  value,
  onChange,
}: {
  value: UploadedMedia | null;
  onChange: (next: UploadedMedia | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      onChange(await api.uploadMedia(file));
    } catch (e) {
      onChange(null);
      setError(errorMessage(e, 'Não foi possível enviar o arquivo.'));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        onChange={(e) => pick(e.target.files?.[0])}
      />

      {uploading && (
        <div className="media-preview" style={{ marginTop: 8 }}>
          <div className="placeholder">Enviando…</div>
        </div>
      )}

      {!uploading && value && (
        <>
          <div className="media-preview" style={{ marginTop: 8 }}>
            {value.type === 'video' ? (
              <video src={value.url} muted loop autoPlay playsInline />
            ) : (
              <img src={value.url} alt="" />
            )}
          </div>
          <button
            type="button"
            className="btn-link"
            style={{ marginTop: 6, color: 'var(--danger)' }}
            onClick={() => onChange(null)}
          >
            Remover
          </button>
        </>
      )}

      {error && <div className="err">{error}</div>}
    </div>
  );
}
