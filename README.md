# sig-html
 sig-html is a micro framework for web apps based on plain or computed signals + lit-html template syntax.

## Status
This is alpha-quality software and as such not ready for production.

## Supported lit-html syntax

```html
<div attribute="${1}" .property="${2}" ?booleanAttribute="${false}" @event="${e => alert(e)}">${5}</div>
```
This is a subset of the [full lit-html syntax](https://lit.dev/docs/templates/expressions/).

## How to try it out

1. Install [bun](https://bun.sh)
2. bun install
3. bun start
4. Point your browser to http://localhost:8080/index.html **or** http://localhost:8080/counter.html **or** http://localhost:8080/spreadsheet.html **or** http://localhost:8080/eventlog.html
