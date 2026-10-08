import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

const DOCUMENT = /\.(pdf|docx|xlsx|xls|pptx)$/i
const CONVERT_MS = 120000
// Under this many bytes the conversion found no text (a scanned PDF): the
// original reads better.
const EMPTY_BYTES = 64
const MAX_FAILURES = 100
const SCRIPT = [
  'import sys',
  'from markitdown import MarkItDown',
  'text = MarkItDown().convert(sys.argv[1]).text_content',
  "open(sys.argv[2], 'w', encoding='utf-8').write(text)",
].join('\n')

const failures = atom({ plugin: 'conversor', key: 'failures' } as const, {})
const tally = atom({ plugin: 'conversor', key: 'tally' } as const, {
  converted: 0,
  reused: 0,
  failed: 0,
})
const isPaused = atom({ plugin: 'conversor', key: 'isPaused' } as const, false)
const notice = atom({ plugin: 'conversor', key: 'notice' } as const, null)

const baseName = (path: string) =>
  path.slice(Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1)

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'conversor',
      description:
        'Estado del conversor de documentos; "off" lo pausa y "on" lo reactiva',
    })

    return next(e)
  })

  on('command.run', { command: 'conversor' }, async ($, e) => {
    const word = e.args.trim().toLowerCase()
    if (word === 'off' || word === 'on') {
      await update($, isPaused, () => word === 'off')
    }
    const [paused, sum] = await Promise.all([read($, isPaused), read($, tally)])

    return {
      text:
        `Conversor ${paused ? 'en pausa' : 'activo'}. En esta sesión: ` +
        `${sum.converted} convertidos, ${sum.reused} reutilizados, ${sum.failed} fallidos. ` +
        (paused ? '/conversor on lo reactiva.' : '/conversor off lo pausa.'),
    }
  })

  on('tool.call', { tool: 'Read' }, async ($, e, next) => {
    if (!DOCUMENT.test(e.file_path)) return next(e)
    if (await read($, isPaused)) return next(e)
    const source = await $.fs.stat(e.file_path).catch(() => undefined)
    if (source === undefined || source.kind !== 'file') return next(e)

    const target = `${e.file_path}.md`
    const name = baseName(e.file_path)
    let made = await $.fs.stat(target).catch(() => undefined)
    const isFresh =
      made !== undefined && made.kind === 'file' && made.mtimeMs >= source.mtimeMs

    if (!isFresh) {
      if ((await read($, failures))[e.file_path] === source.mtimeMs) {
        return next(e)
      }
      const ran = await $.process
        .run(['py', '-c', SCRIPT, e.file_path, target], {
          timeoutMs: CONVERT_MS,
        })
        .catch(() => undefined)
      made =
        ran !== undefined && ran.exitCode === 0
          ? await $.fs.stat(target).catch(() => undefined)
          : undefined

      if (made === undefined || made.kind !== 'file') {
        await update($, failures, all => ({
          ...Object.fromEntries(Object.entries(all).slice(1 - MAX_FAILURES)),
          [e.file_path]: source.mtimeMs,
        }))
        await update($, tally, sum => ({ ...sum, failed: sum.failed + 1 }))
        const at = await $.clock.now()
        await update($, notice, () => ({
          text: `No se pudo convertir ${name}; se leyó el original`,
          at,
        }))

        return next(e)
      }
    }
    if (made === undefined || made.size < EMPTY_BYTES) return next(e)

    await update($, tally, sum =>
      isFresh
        ? { ...sum, reused: sum.reused + 1 }
        : { ...sum, converted: sum.converted + 1 },
    )
    if (!isFresh) {
      const at = await $.clock.now()
      await update($, notice, () => ({
        text: `${name} convertido a Markdown`,
        at,
      }))
    }

    // A page range means nothing in the Markdown; offset and limit still do.
    const { pages: _pages, ...rest } = e
    const ran = await next({ ...rest, file_path: target })
    if (ran.deny !== undefined) return ran

    return {
      ...ran,
      context: [
        ...(ran.context ?? []),
        `Este resultado es ${target}: la conversión a Markdown de ${e.file_path} hecha con markitdown. ` +
          'Las imágenes y el diseño del original no están; si hacen falta, /conversor off permite leer el original.',
      ],
    }
  })
}
