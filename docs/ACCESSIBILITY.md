# Accessibility

Target: **WCAG 2.2 level AA**. Accessibility is treated as a correctness property, not a theme.

## Implemented

| Principle | Implementation |
| --- | --- |
| Perceivable | Text contrast ≥ 4.5:1 on the dark canvas; confidence shown as a number as well as a bar; verdict has a label and a glyph, never colour alone |
| Operable | Full keyboard path; skip link to `#main`; visible 3px focus ring with offset; no keyboard traps; no time limits other than the run itself, which is cancellable |
| Understandable | Plain-language labels, field hint text, inline validation with `aria-invalid` + `aria-describedby`, consistent navigation, language set on `<html>` |
| Robust | Semantic landmarks (`header`, `nav`, `main`, `footer`), one `h1`, ordered heading levels, lists for lists, `role="meter"` with `aria-valuenow`/`aria-valuetext` |

Additional:

- `aria-live="polite"` announces pipeline progress without interrupting.
- Focus moves to the report heading when a run completes.
- Streaming updates do not steal focus.
- External links state “(opens in a new tab)” and use `rel="noopener noreferrer"`.
- `prefers-reduced-motion` disables animation; `forced-colors` uses system borders.
- Errors use `role="alert"` and are also associated with the input.

## Verification

```bash
npm run test:e2e   # includes @axe-core/playwright scans (home + report)
```

The e2e suite fails on any axe violation of impact `serious` or `critical`. Component tests assert
accessible names and roles rather than implementation details.

## Manual checklist

- [ ] Tab from page load: skip link appears first and works
- [ ] Entire claim → report flow without a mouse
- [ ] Screen reader announces progress and the final verdict
- [ ] 200% browser zoom, no horizontal scrolling
- [ ] Windows high-contrast mode keeps borders and focus visible
- [ ] Reduced motion: no pulsing indicator

## Known gaps

- A full audit with NVDA/VoiceOver on the deployed URL is still recommended before submission.
- The confidence meter relies on `role="meter"`; older screen readers fall back to the adjacent
  numeric label, which is always present.
