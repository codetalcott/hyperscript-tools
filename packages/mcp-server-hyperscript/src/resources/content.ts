/**
 * Resource Content for original _hyperscript
 *
 * Self-contained documentation — commands, expressions, events, patterns.
 *
 * Every `_="…"` attribute and every entry in an "Example" table column is
 * checked against the real parser by `__tests__/examples.test.ts`.
 */

export function getCommandsReference(): string {
  return `# _hyperscript Commands Reference

Common commands at a glance. For the full list of commands the parser recognizes, use the \`get_language_info\` tool; for syntax details, \`get_command_docs\`.

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
| \`render\` | Render a template | \`render #row with name: "A"\` |

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
| \`if\` / \`else\` | Conditional | \`if me matches .active hide me else show me end\` |
| \`repeat\` | Loop N times | \`repeat 5 times increment :count end\` |
| \`repeat while\` | Loop while a condition holds | \`repeat while :loading wait 100ms end\` |
| \`for\` | Iterate over a collection | \`for x in [1, 2, 3] log x end\` |

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

## References

| Syntax | Meaning | Example |
|--------|---------|---------|
| \`me\` / \`my\` / \`I\` | The element the script is attached to | \`add .active to me\` |
| \`it\` / \`its\` / \`result\` | The result of the previous command | \`fetch /api as json then put its name into me\` |
| \`event\` | The event being handled | \`log event.type\` |
| \`target\` / \`detail\` | The event's target and detail | \`if target matches .btn add .pressed to target end\` |
| \`you\` / \`your\` / \`yourself\` | The current element inside a \`tell\` block | \`tell <li/> in me add .seen to you end\` |

## Variables

| Syntax | Meaning | Example |
|--------|---------|---------|
| \`name\` | Local variable (current handler or function) | \`set total to 0\` |
| \`:name\` | Element-scoped variable | \`increment :count\` |
| \`$name\` | Global variable | \`set $theme to "dark"\` |

## Selectors

| Syntax | Meaning | Example |
|--------|---------|---------|
| \`#id\` | Element by id | \`show #modal\` |
| \`.class\` | Elements by class | \`hide .tooltip\` |
| \`<selector/>\` | Any CSS selector | \`add .checked to <input[type=checkbox]/> in me\` |

## Positional

| Syntax | Meaning | Example |
|--------|---------|---------|
| \`first\` / \`last\` | First/last item of a collection | \`add .top to the first <li/> in me\` |
| \`next\` / \`previous\` | Next/previous matching element in document order | \`toggle .open on next .panel\` |
| \`closest\` | Nearest matching ancestor, including the element itself | \`remove closest <li/>\` |
| \`closest parent\` | Nearest matching ancestor, excluding the element itself | \`add .has-error to closest parent <div/>\` |

## Property Access

| Syntax | Meaning | Example |
|--------|---------|---------|
| \`'s\` | Possessive property access | \`put #input's value into me\` |
| \`my\` / \`its\` | Property of me / of the result | \`log my textContent\` |
| \`@attr\` | Attribute | \`set @data-id to "7"\` |
| \`*style\` | Inline style property | \`set *color to "red"\` |

## Comparisons

| Syntax | Meaning | Example |
|--------|---------|---------|
| \`is\` / \`is not\` | Equality | \`if :count is 0 hide #badge end\` |
| \`<\`, \`>\`, \`<=\`, \`>=\` | Numeric comparison | \`if :count > 3 add .many to me end\` |
| \`matches\` | CSS selector match | \`if me matches .active remove .active from me end\` |
| \`contains\` | Membership / substring | \`if my value contains "@" remove .error from me end\` |
| \`exists\` / \`is empty\` | Presence | \`if #modal exists show #modal end\` |

## Logical

| Syntax | Meaning | Example |
|--------|---------|---------|
| \`and\` / \`or\` / \`not\` | Boolean operators | \`if :open and not :busy hide me end\` |

## Type Conversion

| Syntax | Meaning | Example |
|--------|---------|---------|
| \`as Number\` / \`as String\` | Convert a value | \`set n to my value as Number\` |
| \`as JSON\` | Parse a JSON string | \`set data to my textContent as JSON\` |
| \`as JSONString\` | Serialize to a JSON string | \`put :data as JSONString into #debug\` |

Conversion names are case-sensitive. \`fetch\` has its own response types: \`as json\`, \`as html\`, \`as text\`, \`as response\`.
`;
}

export function getEventsReference(): string {
  return `# _hyperscript Events Reference

## Event Handler Syntax

\`\`\`text
on [every | first] <event>[(<args>)][[<filter>]] [<count>]
   [from <source> | elsewhere] [in <selector>]
   [debounced at <time> | throttled at <time>]
   [or <another event> ...]
   [queue (all | first | last | none)]
  <commands>
[end]
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

## Handler Modifiers

| Modifier | Meaning | Example |
|----------|---------|---------|
| \`every\` | Run each event's handler at once instead of queueing | \`on every click increment :clicks\` |
| \`first\` | Handle only the first event | \`on first click add .seen to me\` |
| count | Handle only the Nth event, a range, or from N on | \`on click 3 and on add .annoyed to me\` |
| \`[filter]\` | Only events where the expression is true; the event's properties are in scope | \`on keydown[key is 'Enter'] send search to #results\` |
| \`from\` | Listen on another element | \`on click from #save add .saving to me\` |
| \`elsewhere\` | Events outside this element | \`on click from elsewhere hide me\` |
| \`in\` | Delegation: only events inside a matching element, which becomes \`it\` | \`on click in <li/> toggle .selected on it\` |
| \`debounced at\` | Wait until the events pause | \`on input debounced at 300ms send search to #results\` |
| \`throttled at\` | At most one event per interval | \`on scroll throttled at 100ms log window.scrollY\` |
| \`queue\` | What to do with events that arrive while the handler runs (default \`last\`) | \`on click queue none wait 1s\` |

_hyperscript has no dot modifiers: \`on click.once\` or \`on keydown.enter\` parses, but listens for an event literally named "click.once" or "keydown.enter", which never fires.

## Preventing Default and Propagation

| Example | Effect |
|---------|--------|
| \`halt the event\` | Prevent the default action and stop propagation, then continue |
| \`halt the event's default\` | Prevent the default action only, then continue |
| \`halt the event's bubbling\` | Stop propagation only, then continue |
| \`halt\` | Prevent the default and stop propagation, then exit the handler |

## Key Events

\`\`\`html
<input _="on keydown[key is 'Enter'] send search to #results">
<div _="on keydown[key is 'Escape'] from window hide me">
\`\`\`

## Delegated Events

\`\`\`html
<ul _="on click in <li/> toggle .selected on it">
\`\`\`

## Custom Events

\`\`\`html
<button _="on click send refresh to #list">
<div id="list" _="on refresh fetch /api/items put it into me">
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
<input _="on blur if my value is empty add .error to me else remove .error from me end">
<form _="on submit
          halt the event's default
          if <.error/> in me exists exit end
          fetch /api/submit with { method: 'POST' }">
\`\`\`

## Loading State
\`\`\`html
<button _="on click add .loading to me fetch /api remove .loading from me">
  Submit
</button>
\`\`\`

## Debounced Search
\`\`\`html
<input _="on input debounced at 300ms
          fetch \`/search?q=\${encodeURIComponent(my value)}\` as html
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
