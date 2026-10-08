# conversor

Mod para [Claude Code](https://claude.com/claude-code): convierte PDF, Word, Excel y PowerPoint a Markdown con [markitdown](https://github.com/microsoft/markitdown) antes de que Claude los lea.

Leer el Markdown en lugar del original gasta menos tokens y se entiende mejor.

## Cómo funciona

- Cuando Claude va a leer un `.pdf`, `.docx`, `.xlsx`, `.xls` o `.pptx`, el mod lo convierte y le entrega el Markdown en su lugar.
- La conversión se guarda junto al original, como `informe.pdf.md`, y se reutiliza mientras el original no cambie.
- Si la conversión falla, o no encuentra texto (un PDF escaneado), Claude lee el original. No se reintenta hasta que el archivo cambie.
- Claude recibe una nota de que está leyendo una conversión, sin las imágenes ni el diseño del original.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `/conversor` | Estado del mod y cuántos documentos convirtió, reutilizó o no pudo convertir en la sesión. |
| `/conversor off` | Lo pausa: los documentos se leen en su formato original. |
| `/conversor on` | Lo reactiva. |

## Requisitos

- Python con el lanzador `py`, el que instala Python en Windows.
- El paquete `markitdown`:

```bash
py -m pip install "markitdown[all]"
```

## Instalación

En el prompt de una sesión de terminal:

```
/plugin install conversor --marketplace zrdqns/claude-code-conversor
```

Responde `y` para añadir el marketplace y elige el alcance (el de usuario lo carga en todas las sesiones, también en las de la app de escritorio).

Para probarlo desde una copia local, sin instalarlo:

```bash
claude --plugin-dir ./claude-code-conversor
```

## Desarrollo

```bash
claude plugin validate .
claude plugin test .
```

El módulo está en [`hooks/register.ts`](hooks/register.ts), su contrato de estado en [`types/index.d.ts`](types/index.d.ts) y los tests en [`tests/`](tests).

## Licencia

[MIT](LICENSE)
