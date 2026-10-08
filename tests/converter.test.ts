import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const PDF = 'c:/docs/report.pdf'
const MD = `${PDF}.md`

const run = ($: Engine, command: string, args: string) =>
  $.command.run({ command, args } as never)

// The engine hands a path on in the host's own spelling.
const norm = (path: string) => path.replace(/\\/g, '/').toLowerCase()

const file = (mtimeMs: number, size = 5000) => ({
  kind: 'file' as const,
  size,
  mtimeMs,
  isLink: false,
})

// A test cannot read a mod's state itself: this one answers it as a command,
// the way a pane of another mod reads it.
const READER = {
  plugins: [
    {
      name: 'reader',
      register(on: On) {
        on('command.run', { command: 'notice' }, async $ => {
          const held = await $.state.get({
            plugin: 'converter',
            key: 'notice',
          } as never)

          return { text: (held.value as { text: string } | null)?.text ?? '' }
        })
      },
    },
  ],
}

/** What the mod last left for a pane to show. */
const said = async ($: Engine) => (await run($, 'notice', '')).text

/** A disk in memory: the stat of each path there, and the commands run. */
const world = (on: On, disk: Record<string, ReturnType<typeof file>>) => {
  const runs: (readonly string[])[] = []
  const reads: string[] = []
  let exitCode = 0
  let made = file(20)
  mock.clock(on, { now: 1000 })
  on('fs.stat', (_, e) => {
    const found = disk[norm(e.path)]
    if (found === undefined) throw new Error('ENOENT')

    return { value: found }
  })
  on('process.run', (_, e) => {
    runs.push(e.argv)
    if (exitCode === 0) disk[norm(e.argv[4] as string)] = made

    return { value: { exitCode, stdout: '', stderr: '' } as never }
  })
  on('tool.call', { tool: 'Read' }, (_, e) => {
    reads.push(norm(e.file_path))

    return { result: 'content' } as never
  })

  return {
    runs,
    reads,
    fail: () => {
      exitCode = 1
    },
    makes: (stat: ReturnType<typeof file>) => {
      made = stat
    },
  }
}

test('converts a PDF and reads the Markdown in its place', READER, async ($, on) => {
  const w = world(on, { [PDF]: file(10) })

  const ran = await $.tool.call({ tool: 'Read', file_path: PDF, pages: '1-3' })

  expect(w.runs).toHaveLength(1)
  expect(w.runs[0]?.[0]).toBe('py')
  expect(norm(w.runs[0]?.[3] ?? '')).toBe(PDF)
  expect(norm(w.runs[0]?.[4] ?? '')).toBe(MD)
  expect(w.reads).toEqual([MD])
  expect(ran.deny).toBeUndefined()
  expect(ran.context?.[0]).toMatch(/markitdown/)
  expect(await said($)).toBe('report.pdf converted to Markdown')
})

test('reuses a fresh conversion and redoes a stale one', async ($, on) => {
  const disk = { [PDF]: file(10), [MD]: file(15) }
  const w = world(on, disk)

  await $.tool.call({ tool: 'Read', file_path: PDF })
  expect(w.runs).toHaveLength(0)
  expect(w.reads).toEqual([MD])

  disk[PDF] = file(30)
  w.makes(file(40))
  await $.tool.call({ tool: 'Read', file_path: PDF })
  expect(w.runs).toHaveLength(1)
})

test('when the conversion fails it reads the original and does not retry', READER, async ($, on) => {
  const w = world(on, { [PDF]: file(10) })
  w.fail()

  await $.tool.call({ tool: 'Read', file_path: PDF })
  await $.tool.call({ tool: 'Read', file_path: PDF })

  expect(w.runs).toHaveLength(1)
  expect(w.reads).toEqual([PDF, PDF])
  expect(await said($)).toMatch(/Could not convert report.pdf/)
})

test('an empty conversion (a scanned PDF) leaves the original to be read', async ($, on) => {
  const w = world(on, { [PDF]: file(10) })
  w.makes(file(20, 3))

  await $.tool.call({ tool: 'Read', file_path: PDF })

  expect(w.reads).toEqual([PDF])
})

test('does not touch other files or act while paused', async ($, on) => {
  const w = world(on, { [PDF]: file(10), 'c:/src/a.ts': file(10) })

  await $.tool.call({ tool: 'Read', file_path: 'c:/src/a.ts' })
  await run($, 'converter', 'off')
  await $.tool.call({ tool: 'Read', file_path: PDF })

  expect(w.runs).toHaveLength(0)
  expect(w.reads).toEqual(['c:/src/a.ts', PDF])
})
