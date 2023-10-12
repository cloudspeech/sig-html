# sig-html
 sig-html is a micro framework for web apps based on plain or computed signals + lit-html template syntax.

 How micro? **943** bytes, when maximally Brotli-compressed!

## Status
This is alpha-quality software and as such not ready for production.

## Supported lit-html syntax

```html
<div attribute="${1}" .property="${2}" ?booleanAttribute="${false}" @event="${e => alert(e)}">${5}</div>
```
This is a subset of the [full lit-html syntax](https://lit.dev/docs/templates/expressions/).

## Known restrictions:
- Signals are the only mechanism provided for reactivity
- any template literal variables must span the _entire_ attribute value or text content in which it occurs, i.e. no `some ${aTemplateVariable} followed by other text or template variable` is allowed (for now)
- no HTML validation or sanitizing whatsoever
- no careful memory or performance optimizations (yet)

## How to try it out

1. Install [bun](https://bun.sh)
2. bun install
3. bun start
4. Point your browser to http://localhost:8080/index.html **or** http://localhost:8080/counter.html **or** http://localhost:8080/spreadsheet.html **or** http://localhost:8080/eventlog.html
