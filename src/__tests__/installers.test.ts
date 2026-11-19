import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const installersDir = path.join(root, 'installers')

const BINARY_EXTENSIONS = new Set([
  '.appimage',
  '.deb',
  '.rpm',
  '.exe',
  '.dmg',
  '.app',
  '.msi',
])

const PUBLISHED_V010 = [
  'OpenPrototype-0.1.0-1.x86_64.rpm',
  'OpenPrototype-0.1.0-portable-x64.exe',
  'OpenPrototype_0.1.0_amd64.AppImage',
  'OpenPrototype_0.1.0_amd64.deb',
  'OpenPrototype_0.1.0_x64-setup.exe',
]

describe('installer binaries stay on the GitHub release, not in the tree', () => {
  it('keeps only README and SHA256SUMS in installers/', () => {
    const names = fs.readdirSync(installersDir).sort()
    expect(names).toEqual(['README.md', 'SHA256SUMS.txt'])
    for (const name of names) {
      expect(BINARY_EXTENSIONS.has(path.extname(name).toLowerCase())).toBe(false)
    }
  })

  it('lists the published v0.1.0 artifacts in SHA256SUMS.txt', () => {
    const text = fs.readFileSync(path.join(installersDir, 'SHA256SUMS.txt'), 'utf8')
    const files = new Set<string>()
    for (const line of text.trim().split('\n')) {
      const match = /^([0-9a-f]{64})  (.+)$/.exec(line)
      expect(match, line).toBeTruthy()
      files.add(match![2])
    }
    expect([...files].sort()).toEqual([...PUBLISHED_V010].sort())
  })

  it('points the installers README at the v0.1.0 GitHub release, not local files', () => {
    const readme = fs.readFileSync(path.join(installersDir, 'README.md'), 'utf8')
    expect(readme).toContain('https://github.com/gatesenman/openprototype/releases/tag/v0.1.0')
    for (const name of PUBLISHED_V010) {
      expect(readme).toContain(
        `https://github.com/gatesenman/openprototype/releases/download/v0.1.0/${name}`,
      )
    }
    expect(readme).not.toMatch(/^\s*\.\/OpenPrototype/m)
  })

  it('ignores packaged installers in .gitignore', () => {
    const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8')
    for (const pattern of [
      'installers/*.AppImage',
      'installers/*.deb',
      'installers/*.rpm',
      'installers/*.exe',
      'installers/*.dmg',
    ]) {
      expect(gitignore).toContain(pattern)
    }
  })
})
