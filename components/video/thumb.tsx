'use client'
import { useState } from 'react'
import { PlayIcon } from 'lucide-react'

// Instagram CDN thumbnail, refreshed on every backfill; falls back to a play glyph when the signed URL has expired.
export function Thumb({ src, className = '' }: { src: string | null | undefined; className?: string }) {
  const [broken, setBroken] = useState(false)
  return (
    <div className={`relative h-12 w-9 shrink-0 overflow-hidden rounded bg-border ${className}`}>
      {src && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" referrerPolicy="no-referrer" loading="lazy" onError={() => setBroken(true)} className="size-full object-cover" />
      ) : (
        <PlayIcon className="absolute inset-0 m-auto size-3.5 text-muted-foreground" />
      )}
    </div>
  )
}
