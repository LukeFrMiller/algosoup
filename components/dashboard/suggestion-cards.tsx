import { acceptSuggestion, dismissSuggestion } from '@/app/(app)/actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import type { Suggestion } from '@/lib/stats/types'
import { humanise } from '@/lib/suggestions'
import { CHIP, chipText } from './format'

export function SuggestionCards({ suggestions }: { suggestions: Suggestion[] }) {
  if (!suggestions.length)
    return (
      <Card className="py-3.5 px-4 text-xs text-muted-foreground">
        Nothing to suggest yet. Every promising combination is already tracked, or there are not enough mature reels.
      </Card>
    )
  return (
    <div className="flex gap-4">
      {suggestions.map((s) => {
        const kind = humanise(s.kind)
        // Rationale ends with "Make N reels …" — that is the footer line in the mockup.
        const [, body = s.rationale, foot = `Make ${s.target_n} reels.`] = s.rationale.match(/^([^]*?)\s*(Make \d+[^]*)$/) ?? []
        return (
          <Card key={`${s.kind}${chipText(s.pair.a)}${chipText(s.pair.b)}`} className="min-w-0 flex-1">
            <CardHeader className="gap-2">
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="text-[11px]">
                  {kind[0].toUpperCase() + kind.slice(1)}
                </Badge>
                <span className="text-xs text-muted-foreground tabular-nums">{s.pair.n} videos</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={CHIP}>{chipText(s.pair.a)}</span>
                <span className="text-muted-foreground">×</span>
                <span className={CHIP}>{chipText(s.pair.b)}</span>
              </div>
            </CardHeader>
            <CardContent className="flex grow flex-col gap-3">
              <p className="text-xs leading-[1.55]">{body}</p>
              <p className="grow text-xs text-muted-foreground">{foot}</p>
              <div className="flex gap-2">
                <form action={acceptSuggestion.bind(null, s)}>
                  <Button type="submit">Accept as hypothesis</Button>
                </form>
                <form action={dismissSuggestion.bind(null, s)}>
                  <Button type="submit" variant="ghost">
                    Dismiss
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
