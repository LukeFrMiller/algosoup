'use client'
// A Select whose value lives in a URL search param; the server page re-renders on change.
import { useRouter } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function ParamSelect({ name, value, options }: { name: string; value: string; options: Record<string, string> }) {
  const router = useRouter()
  return (
    <Select
      value={value}
      items={options}
      onValueChange={(v) => {
        const p = new URLSearchParams(window.location.search)
        p.set(name, String(v))
        router.push(`?${p}`, { scroll: false })
      }}
    >
      <SelectTrigger className="min-w-[150px] bg-background">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(options).map(([k, label]) => (
          <SelectItem key={k} value={k}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
