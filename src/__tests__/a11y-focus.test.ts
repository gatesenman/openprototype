import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const cssPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../styles.css')

describe('keyboard focus styles', () => {
  it('defines :focus-visible rings for buttons, links, and form fields', () => {
    const css = fs.readFileSync(cssPath, 'utf8')
    expect(css).toMatch(/button:focus-visible/)
    expect(css).toMatch(/a:focus-visible/)
    expect(css).toMatch(/input:focus-visible/)
    expect(css).toMatch(/select:focus-visible/)
    expect(css).toMatch(/textarea:focus-visible/)
    expect(css).toMatch(/outline:\s*2px solid var\(--primary\)/)
  })
})
