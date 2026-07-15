/**
 * Resource Content for original _hyperscript
 *
 * Self-contained documentation — commands, expressions, events, patterns.
 */

export function getCommandsReference(): string {
  return `# _hyperscript Commands Reference

## DOM Manipulation

| Command | Usage | Example |
|---------|-------|---------|
| \`toggle\` | Toggle class/attribute | \`toggle .active on #menu\` |
| \`add\` | Add class/attribute/style | \`add .highlight to me\` |
| \`remove\` | Remove class/attribute/element | \`remove .error from #form\` |
| \`show\` | Show element | \`show #modal with *opacity\` |
| \`hide\` | Hide element | \`hide me with *opacity\` |
| \`put\` | Put value into a position | \`put "Hello" into #greeting\` |
| \`append\` | Add to end | \`append "<li/>" to #list\` |
| \`make\` | Create an element | \`make a <div.card/>\` |
| \`take\` | Take a class exclusively | \`take .active from .tabs\` |
| \`render\` | Render a template | \`render #row with { name: "A" }\` |

## Data Commands

| Command | Usage | Example |
|---------|-------|---------|
| \`set\` | Set variable/property | \`set :count to 0\` |
| \`get\` | Get value | \`get #input.value\` |
| \`increment\` | Add 1 | \`increment :count\` |
| \`decrement\` | Subtract 1 | \`decrement :count\` |

## Events

| Command | Usage | Example |
|---------|-------|---------|
| \`send\` | Dispatch event | \`send refresh to #list\` |
| \`trigger\` | Trigger event | \`trigger submit on #form\` |

## Async & Animation

| Command | Usage | Example |
|---------|-------|---------|
| \`wait\` | Pause (duration or event) | \`wait 500ms\` / \`wait for load\` |
| \`fetch\` | HTTP request | \`fetch /api as json\` |
| \`transition\` | Animate a CSS property | \`transition *opacity to 0 over 500ms\` |
| \`settle\` | Wait for transitions to finish | \`add .fade then settle\` |
| \`measure\` | Measure element box metrics | \`measure #box then log its width\` |

## Control Flow

| Command | Usage | Example |
|---------|-------|---------|
| \`if/else\` | Conditional | \`if me matches .active ... else ... end\` |
| \`repeat\` | Loop N times | \`repeat 5 times ...\` |
| \`for each\` | Iterate | \`for item in items ...\` |
| \`while\` | While loop | \`while :loading wait 100ms\` |

## Navigation

| Command | Usage | Example |
|---------|-------|---------|
| \`go\` | Navigate | \`go to /dashboard\` |
| \`focus\` | Focus element | \`focus #input\` |

## Utility

| Command | Usage | Example |
|---------|-------|---------|
| \`log\` | Console log | \`log me\` |
| \`call\` | Call function | \`call myFunction()\` |
| \`return\` | Exit handler | \`return\` |
`;
}

export function getExpressionsGuide(): string {
  return `# _hyperscript Expressions Guide

## Element References

- \`me\` / \`myself\` - Current element
- \`you\` - Event target
- \`it\` / \`result\` - Last expression result

## Variables

- \`:name\` - Local variable
- \`$name\` - Global variable

## Selectors

- \`#id\` - ID selector
- \`.class\` - Class selector
- \`<tag/>\` - Tag selector
- \`[attr]\` - Attribute selector

## Positional

- \`first\` / \`last\` - First/last in collection
- \`next\` / \`previous\` - Relative navigation
- \`closest\` - Nearest ancestor
- \`parent\` - Direct parent

## Property Access

- \`element's property\` - Possessive syntax
- \`my property\` - Current element property
- \`@attribute\` - Attribute access

## Comparisons

- \`is\` / \`is not\` - Equality
- \`>\`, \`<\`, \`>=\`, \`<=\` - Numeric
- \`matches\` - CSS selector match
- \`contains\` - Membership
- \`exists\` / \`is empty\` - Existence

## Logical

- \`and\` / \`or\` / \`not\` - Boolean operators

## Type Conversion

- \`as String\` - To string
- \`as Number\` - To number
- \`as json\` - Parse JSON
`;
}

export function getEventsReference(): string {
  return `# _hyperscript Events Reference

## Event Syntax

\`\`\`text
on <event>[.<modifier>...] [from <source>] <commands>
\`\`\`

## Common Events

| Event | Description |
|-------|-------------|
| \`click\` | Mouse click |
| \`dblclick\` | Double click |
| \`submit\` | Form submission |
| \`input\` | Input value change |
| \`change\` | Input change (on blur) |
| \`focus\` | Element focused |
| \`blur\` | Element blurred |
| \`keydown\` | Key pressed |
| \`keyup\` | Key released |
| \`mouseenter\` | Mouse enters |
| \`mouseleave\` | Mouse leaves |
| \`scroll\` | Element scrolled |
| \`load\` | Element loaded |

## Event Modifiers

| Modifier | Description |
|----------|-------------|
| \`.once\` | Handle only once |
| \`.prevent\` | Prevent default |
| \`.stop\` | Stop propagation |
| \`.debounce(Nms)\` | Debounce handler |
| \`.throttle(Nms)\` | Throttle handler |

## Key Modifiers

\`\`\`html
<input _="on keydown.enter submit closest form">
<div _="on keydown.escape hide me">
\`\`\`

## Delegated Events

\`\`\`html
<ul _="on click from li toggle .selected on you">
<form _="on input from input validate(you)">
\`\`\`

## Custom Events

\`\`\`html
<button _="on click send refresh to #list">
<div _="on refresh fetch /api/items put it into me">
\`\`\`
`;
}

export function getCommonPatterns(): string {
  return `# Common _hyperscript Patterns

## Toggle Menu
\`\`\`html
<button _="on click toggle .open on #nav">Menu</button>
\`\`\`

## Modal Dialog
\`\`\`html
<button _="on click show #modal with *opacity">Open</button>
<div id="modal" _="on click if target is me hide me with *opacity">
  <div class="content">...</div>
</div>
\`\`\`

## Form Validation
\`\`\`html
<input _="on blur if my value is empty add .error else remove .error">
<form _="on submit prevent default if .error exists return else fetch /api">
\`\`\`

## Loading State
\`\`\`html
<button _="on click add .loading to me fetch /api remove .loading from me">
  Submit
</button>
\`\`\`

## Debounced Search
\`\`\`html
<input _="on input.debounce(300ms)
          fetch /search?q={my value} as json
          put it into #results">
\`\`\`

## Tab Navigation
\`\`\`html
<div class="tabs">
  <button _="on click
            remove .active from .tab-btn
            add .active to me
            hide .tab-content
            show next .tab-content">
    Tab 1
  </button>
</div>
\`\`\`

## Copy to Clipboard
\`\`\`html
<button _="on click
          call navigator.clipboard.writeText(#code.textContent)
          add .copied to me
          wait 2s
          remove .copied from me">
  Copy
</button>
\`\`\`

## Dark Mode Toggle
\`\`\`html
<button _="on click
          toggle .dark on <html/>
          if <html/> matches .dark
            set localStorage.theme to 'dark'
          else
            set localStorage.theme to 'light'
          end">
</button>
\`\`\`
`;
}
