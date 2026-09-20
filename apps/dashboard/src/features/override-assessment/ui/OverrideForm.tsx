import { useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { SENTIMENTS, sentimentLabel } from '../../../entities/assessment/index.ts'
import { overrideAssessment } from '../api/override-assessment.ts'

/** 判定の sentiment を選んで上書きする。AI の判定は残り、human が優先される */
export function OverrideForm({ assessmentId, current }: { assessmentId: number; current: number }) {
  const router = useRouter()
  const override = useServerFn(overrideAssessment)
  const [value, setValue] = useState(current)
  const [busy, setBusy] = useState(false)
  return (
    <form
      className="actions"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        try {
          await override({ data: { assessmentId, sentiment: value } })
          await router.invalidate()
        } finally {
          setBusy(false)
        }
      }}
    >
      <select
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        aria-label="判定を上書き"
      >
        {SENTIMENTS.map((s) => (
          <option key={s} value={s}>
            {sentimentLabel(s)}
          </option>
        ))}
      </select>
      <button type="submit" disabled={busy || value === current}>
        上書き
      </button>
    </form>
  )
}
