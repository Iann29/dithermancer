import type { CSSProperties } from 'react'
import type { PixelTheme } from '../types'

export interface LegendItem {
  key: string
  label: string
  colorHex: string
}

export function Legend(props: {
  items: LegendItem[]
  selected: string | null
  onToggle: (key: string) => void
  theme: PixelTheme
}) {
  const { items, selected, onToggle, theme } = props
  const wrap: CSSProperties = {
    position: 'absolute',
    top: 2,
    right: 6,
    display: 'flex',
    gap: 14,
    fontFamily: theme.font,
    fontSize: theme.fontSize,
    lineHeight: 1,
    userSelect: 'none',
  }
  return (
    <div style={wrap}>
      {items.map((it) => {
        const dimmed = selected !== null && selected !== it.key
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onToggle(it.key)}
            style={{
              all: 'unset',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              opacity: dimmed ? 0.38 : 1,
              color: theme.text,
              transition: 'opacity 120ms linear',
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                background: it.colorHex,
                display: 'inline-block',
              }}
            />
            {it.label}
          </button>
        )
      })}
    </div>
  )
}
