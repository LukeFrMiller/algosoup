'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const LINKS = [
  ['Dashboard', '/'],
  ['Hypotheses', '/hypotheses'],
  ['Videos', '/videos'],
  ['Connect', '/connect'],
] as const

export function Nav({
  status,
  action,
}: {
  /** "@username · last refreshed 2h ago" — filled by package G/H */
  status?: React.ReactNode
  /** Backfill button — filled by package G */
  action?: React.ReactNode
}) {
  const pathname = usePathname()
  return (
    <header className="flex h-12 items-center gap-6 border-b bg-background px-6">
      <Link href="/" className="flex items-center gap-2 text-[13px] font-semibold">
        <svg className="size-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="8" r="6.5" />
          <path d="M4.5 9.5c1.2 1.4 5.8 1.4 7 0" />
        </svg>
        AlgoSoup
      </Link>
      <nav className="flex gap-1">
        {LINKS.map(([label, href]) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground',
                active && 'bg-muted text-foreground'
              )}
            >
              {label}
            </Link>
          )
        })}
      </nav>
      <div className="grow" />
      {status && <span className="text-xs text-muted-foreground">{status}</span>}
      {action}
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Account menu"
          className="size-6 rounded-full bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        />
        <DropdownMenuContent align="end">
          <form action="/api/auth/signout" method="post">
            <DropdownMenuItem render={<button type="submit" className="w-full" />}>
              Sign out
            </DropdownMenuItem>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
