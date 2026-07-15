/**
 * Authoritative _hyperscript language inventory + curated documentation.
 *
 * `COMMAND_NAMES` / `FEATURE_NAMES` are the canonical surface of the language as
 * registered by `hyperscript.org` (verified against the parser's own command /
 * feature registry — see the drift test in `__tests__/inventory.test.ts`, which
 * fails CI if this list and the installed parser disagree). Everything else here
 * is curated prose keyed off that inventory.
 *
 * When bumping the `hyperscript.org` dependency, run the drift test; if it flags
 * added/removed commands, update `COMMAND_NAMES` (and, ideally, `COMMAND_DOCS`).
 */

// =============================================================================
// Authoritative inventory (matches the canonical parser registry, v0.9.93)
// =============================================================================

/** Every command keyword the canonical parser registers (multi-keyword commands listed per surface form). */
export const COMMAND_NAMES: string[] = [
  'add', 'answer', 'append', 'ask', 'beep!', 'blur', 'break', 'breakpoint', 'call', 'clear',
  'close', 'continue', 'decrement', 'default', 'empty', 'exit', 'fetch', 'focus', 'for', 'get',
  'go', 'halt', 'hide', 'if', 'increment', 'js', 'log', 'make', 'measure', 'morph', 'open',
  'pick', 'put', 'remove', 'render', 'repeat', 'reset', 'return', 'scroll', 'select', 'send',
  'set', 'settle', 'show', 'speak', 'start', 'swap', 'take', 'tell', 'throw', 'toggle',
  'transition', 'trigger', 'wait',
];

/** Top-level feature keywords the canonical parser registers. */
export const FEATURE_NAMES: string[] = [
  'on', 'def', 'init', 'behavior', 'worker', 'install', 'js', 'set', 'bind', 'live', 'when',
];

/**
 * Keywords that look command-like but are NOT registered commands in canonical
 * _hyperscript (they are conditional/loop keywords, modifiers, or plugin-only).
 * The drift test asserts none of these become registered commands unnoticed.
 */
export const NON_COMMANDS: string[] = ['unless', 'while', 'async', 'else', 'then', 'end', 'eventsource', 'socket'];

// =============================================================================
// Command documentation (curated; a subset of COMMAND_NAMES with full detail)
// =============================================================================

export interface CommandDoc {
  name: string;
  description: string;
  syntax: string;
  examples: string[];
  category: string;
}

export const COMMAND_DOCS: Record<string, CommandDoc> = {
  toggle: { name: 'toggle', category: 'DOM', description: 'Toggle a class, attribute, or visibility on an element', syntax: 'toggle <class|attr> [on <target>]', examples: ['toggle .active on me', 'toggle .open on #menu', 'toggle @disabled on #btn'] },
  add: { name: 'add', category: 'DOM', description: 'Add a class, attribute, or style to an element', syntax: 'add <class|attr|style> [to <target>]', examples: ['add .highlight to me', 'add @disabled to <button/>', 'add { color: red } to me'] },
  remove: { name: 'remove', category: 'DOM', description: 'Remove a class, attribute, or element from the DOM', syntax: 'remove <class|attr|element> [from <target>]', examples: ['remove .error from #form', 'remove me', 'remove @disabled from #btn'] },
  show: { name: 'show', category: 'DOM', description: 'Show a hidden element, optionally with a strategy/transition', syntax: 'show <target> [with <transition>]', examples: ['show #modal', 'show #modal with *opacity'] },
  hide: { name: 'hide', category: 'DOM', description: 'Hide an element, optionally with a strategy/transition', syntax: 'hide <target> [with <transition>]', examples: ['hide me', 'hide #modal with *opacity'] },
  put: { name: 'put', category: 'DOM', description: 'Put a value into an element position or variable', syntax: 'put <value> (into|before|after|at start of|at end of) <target>', examples: ['put "Hello" into #greeting', 'put it at the end of #list', 'put result into me'] },
  append: { name: 'append', category: 'DOM', description: 'Append content to a target (element, array, or string)', syntax: 'append <content> [to <target>]', examples: ['append "<li>New</li>" to #list', 'append x to :items'] },
  make: { name: 'make', category: 'DOM', description: 'Create a new element (or instance) from a query or constructor', syntax: 'make (a|an) <query> [called <name>]', examples: ['make a <div.card/>', 'make an <input/> called field'] },
  take: { name: 'take', category: 'DOM', description: 'Take a class/attribute for this element, removing it from siblings (exclusive)', syntax: 'take <class> [from <group>] [for <target>]', examples: ['take .active from .tabs', 'take .selected for me'] },
  set: { name: 'set', category: 'Data', description: 'Set a variable or element/property value', syntax: 'set <target> to <value>', examples: ['set :count to 0', 'set #input.value to ""', 'set $theme to "dark"'] },
  get: { name: 'get', category: 'Data', description: 'Evaluate an expression and place it in the result (it)', syntax: 'get <expression>', examples: ['get #input.value', 'get closest <form/>'] },
  increment: { name: 'increment', category: 'Data', description: 'Increment a numeric variable or property (by 1 or by an amount)', syntax: 'increment <target> [by <amount>]', examples: ['increment :count', 'increment :n by 5'] },
  decrement: { name: 'decrement', category: 'Data', description: 'Decrement a numeric variable or property (by 1 or by an amount)', syntax: 'decrement <target> [by <amount>]', examples: ['decrement :count', 'decrement :n by 2'] },
  default: { name: 'default', category: 'Data', description: 'Set a variable to a default value only if it is not already set', syntax: 'default <target> to <value>', examples: ['default :count to 0', 'default localStorage.theme to "light"'] },
  send: { name: 'send', category: 'Events', description: 'Send (dispatch) a custom event to a target', syntax: 'send <event>[(<details>)] [to <target>]', examples: ['send refresh to #list', 'send custom:update(id: 3) to <body/>'] },
  trigger: { name: 'trigger', category: 'Events', description: 'Trigger an event on an element (alias of send with implicit target)', syntax: 'trigger <event>[(<details>)] [on <target>]', examples: ['trigger submit on #form', 'trigger click'] },
  wait: { name: 'wait', category: 'Async', description: 'Pause execution for a duration or until an event fires', syntax: 'wait <duration> | wait for <event>', examples: ['wait 500ms', 'wait 2s', 'wait for animationend'] },
  fetch: { name: 'fetch', category: 'Async', description: 'Make an HTTP request; the response is placed in the result (it)', syntax: 'fetch <url> [with <options>] [as <type>]', examples: ['fetch /api/data as json', 'fetch /page as html', 'fetch /api with { method: "POST" }'] },
  call: { name: 'call', category: 'Utility', description: 'Evaluate an expression / call a function, placing the result in it', syntax: 'call <expression>', examples: ['call alert("Hello")', 'call navigator.clipboard.writeText("copied")'] },
  log: { name: 'log', category: 'Utility', description: 'Log values to the console', syntax: 'log <expression> [, <expression> ...]', examples: ['log me', 'log "value:", :count'] },
  js: { name: 'js', category: 'Utility', description: 'Run an inline block of JavaScript (also usable as a top-level feature)', syntax: 'js [(<params>)] <body> end', examples: ['js return Math.random() end', 'js (x) return x * 2 end'] },
  'beep!': { name: 'beep!', category: 'Debug', description: 'Debugging aid: logs the value/expression it is attached to and returns it', syntax: 'beep! <expression>', examples: ['beep! me', 'set x to beep! (1 + 2)'] },
  breakpoint: { name: 'breakpoint', category: 'Debug', description: 'Pause execution in the hyperscript debugger (hdb)', syntax: 'breakpoint', examples: ['on click breakpoint then toggle .active'] },
  go: { name: 'go', category: 'Navigation', description: 'Navigate to a URL or scroll to an element', syntax: 'go to (url <url> | <target> [<position>])', examples: ['go to url "/dashboard"', 'go to top of #section smoothly'] },
  focus: { name: 'focus', category: 'Navigation', description: 'Move focus to an element', syntax: 'focus [on] <target>', examples: ['focus() the #input', 'focus on first <input/>'] },
  blur: { name: 'blur', category: 'Navigation', description: 'Remove focus from an element', syntax: 'blur [from] <target>', examples: ['blur() the #input'] },
  scroll: { name: 'scroll', category: 'Navigation', description: 'Scroll an element into view or to a position', syntax: 'scroll <target> [into view]', examples: ['scroll #section into view'] },
  transition: { name: 'transition', category: 'Animation', description: 'Animate CSS properties on an element over a duration', syntax: 'transition [<target>] <property> to <value> [over <duration>]', examples: ['transition *opacity to 0 over 500ms', 'transition my *height to "0px"'] },
  settle: { name: 'settle', category: 'Animation', description: 'Wait for any in-flight CSS transitions on the element to complete', syntax: 'settle', examples: ['add .fade-out then settle then remove me'] },
  measure: { name: 'measure', category: 'Animation', description: 'Measure an element’s box metrics into the result (top, width, etc.)', syntax: 'measure [<target>]', examples: ['measure #box then log its width'] },
  if: { name: 'if', category: 'Control Flow', description: 'Conditional execution', syntax: 'if <condition> <commands> [else <commands>] end', examples: ['if me matches .active hide me else show me end', 'if #input.value is empty add .error end'] },
  repeat: { name: 'repeat', category: 'Control Flow', description: 'Loop: fixed count, while/until a condition, forever, or for each item', syntax: 'repeat (<n> times | while <c> | until <c> | for <x> in <coll> | forever) <commands> end', examples: ['repeat 5 times increment :count end', 'repeat for item in .rows add .seen to item end'] },
  for: { name: 'for', category: 'Control Flow', description: 'Iterate over a collection (shorthand loop form)', syntax: 'for <item> in <collection> <commands> end', examples: ['for item in .list-item add .processed to item end'] },
  tell: { name: 'tell', category: 'Control Flow', description: 'Run a block of commands with a different implicit target (you/it)', syntax: 'tell <target> <commands> end', examples: ['tell #sidebar toggle .collapsed end'] },
  return: { name: 'return', category: 'Control Flow', description: 'Return a value from a function/handler', syntax: 'return [<value>]', examples: ['return true', 'return :result'] },
  exit: { name: 'exit', category: 'Control Flow', description: 'Exit the current event handler or function early', syntax: 'exit', examples: ['if not valid exit end'] },
  halt: { name: 'halt', category: 'Control Flow', description: 'Halt the current event (optionally the default and/or bubbling) and/or execution', syntax: 'halt [the event] [bubbling] [default]', examples: ['halt the event', 'on submit halt the default'] },
  throw: { name: 'throw', category: 'Control Flow', description: 'Throw an error', syntax: 'throw <value>', examples: ['throw "invalid state"'] },
  break: { name: 'break', category: 'Control Flow', description: 'Break out of the enclosing loop', syntax: 'break', examples: ['repeat forever if done break end end'] },
  continue: { name: 'continue', category: 'Control Flow', description: 'Continue to the next iteration of the enclosing loop', syntax: 'continue', examples: ['for x in xs if x is null continue end log x end'] },
  render: { name: 'render', category: 'Templates', description: 'Render a <template> with a data context into the result', syntax: 'render <template> [with <data>]', examples: ['render #row-template with { name: "A" }'] },
  pick: { name: 'pick', category: 'Utility', description: 'Pick items/matches/substrings from a value (regex, items, or attributes)', syntax: 'pick <what> from <value>', examples: ['pick match of /\\d+/ from "a12b"', 'pick items 1 to 3 from :list'] },
  select: { name: 'select', category: 'DOM', description: 'Select text within an input/textarea, or a range', syntax: 'select [<range>] [in <target>]', examples: ['select the #input'] },
};

// =============================================================================
// Expression documentation
// =============================================================================

export interface ExpressionDoc {
  name: string;
  description: string;
  category: string;
  evaluatesTo: string;
  examples: string[];
}

export const EXPRESSION_DOCS: Record<string, ExpressionDoc> = {
  me: { name: 'me', category: 'references', evaluatesTo: 'Element', description: 'The current element (the one the script is attached to). Aliases: I, my, myself.', examples: ['toggle .active on me', 'put "Hello" into me'] },
  you: { name: 'you', category: 'references', evaluatesTo: 'Element', description: 'The element that triggered the event (the event target). Alias: yourself.', examples: ['add .selected to you'] },
  it: { name: 'it', category: 'references', evaluatesTo: 'Any', description: 'The result of the previous command / expression. Aliases: its, result.', examples: ['fetch /api then put it into #output'] },
  result: { name: 'result', category: 'references', evaluatesTo: 'Any', description: 'Alias for "it" — the result of the previous command', examples: ['fetch /api then put result into #output'] },
  its: { name: 'its', category: 'references', evaluatesTo: 'Any', description: "Possessive form of 'it' for property access", examples: ['fetch /api as json then put its name into #output'] },
  event: { name: 'event', category: 'references', evaluatesTo: 'Event', description: 'The current event object inside an event handler', examples: ['log the event', "halt the event's default"] },
  target: { name: 'target', category: 'references', evaluatesTo: 'Element', description: "The event's target element (event.target)", examples: ['if the target matches .btn'] },
  closest: { name: 'closest', category: 'references', evaluatesTo: 'Element', description: 'The nearest ancestor (or self) matching a selector', examples: ['toggle .open on closest .accordion-item'] },
  first: { name: 'first', category: 'positional', evaluatesTo: 'Any', description: 'First item of a collection', examples: ['first of .items', 'the first <li/> in me'] },
  last: { name: 'last', category: 'positional', evaluatesTo: 'Any', description: 'Last item of a collection', examples: ['last of .items'] },
  next: { name: 'next', category: 'positional', evaluatesTo: 'Element', description: 'Next matching element (sibling/DOM order)', examples: ['toggle .open on next .panel'] },
  previous: { name: 'previous', category: 'positional', evaluatesTo: 'Element', description: 'Previous matching element (sibling/DOM order)', examples: ['previous <li/>'] },
  possessive: { name: 'possessive', category: 'properties', evaluatesTo: 'Any', description: "Property access via 's or my/its/your", examples: ["#input's value", 'my textContent', 'its length'] },
  'attribute-ref': { name: 'attribute-ref', category: 'properties', evaluatesTo: 'String', description: 'A DOM attribute, referenced with @', examples: ['toggle @disabled', 'set @data-id to "123"'] },
  'style-ref': { name: 'style-ref', category: 'properties', evaluatesTo: 'String', description: 'A CSS style property, referenced with *', examples: ['set *background-color to "red"', 'transition *opacity to 0'] },
  'query-reference': { name: 'query-reference', category: 'references', evaluatesTo: 'Element | NodeList', description: 'CSS selector query: #id, .class, <tag/>', examples: ['toggle .active on #button', 'remove <li/>'] },
  as: { name: 'as', category: 'conversion', evaluatesTo: 'varies', description: 'Type conversion', examples: ['fetch /api as json', '"42" as Number'] },
  matches: { name: 'matches', category: 'logical', evaluatesTo: 'Boolean', description: 'Whether an element matches a CSS selector', examples: ['if me matches .disabled'] },
  contains: { name: 'contains', category: 'logical', evaluatesTo: 'Boolean', description: 'Whether a string/array/element contains a value', examples: ['if "hello" contains "ell"'] },
  exists: { name: 'exists', category: 'logical', evaluatesTo: 'Boolean', description: 'Whether a value/element exists (is non-empty/non-null)', examples: ['if #modal exists'] },
  'is-empty': { name: 'is-empty', category: 'logical', evaluatesTo: 'Boolean', description: 'Whether a value is empty', examples: ['if #input.value is empty'] },
};

// =============================================================================
// Special symbols
// =============================================================================

export const SPECIAL_SYMBOLS = [
  { name: 'class-ref', symbol: '.', description: 'CSS class reference (.active, .hidden)' },
  { name: 'id-ref', symbol: '#', description: 'CSS ID reference (#button, #output)' },
  { name: 'attribute-ref', symbol: '@', description: 'HTML attribute reference (@disabled, @data-id)' },
  { name: 'style-ref', symbol: '*', description: 'CSS style property (*background-color, *opacity)' },
  { name: 'local-var', symbol: ':', description: 'Local (element-scoped) variable (:count, :data)' },
  { name: 'global-var', symbol: '$', description: 'Global variable ($theme, $user)' },
  { name: 'query-literal', symbol: '<tag/>', description: 'CSS query literal (<div/>, <.item/>, <#id/>)' },
  { name: 'possessive', symbol: "'s", description: "Possessive property access (element's property)" },
  { name: 'then', symbol: 'then', description: 'Command chain separator' },
  { name: 'end', symbol: 'end', description: 'Block terminator for if/repeat/for/behavior/def' },
];

// =============================================================================
// Hover docs (keyword -> short doc), for the editor-assist hover tool
// =============================================================================

export interface HoverDoc {
  title: string;
  description: string;
  example: string;
}

export const EXPRESSION_HOVER: Record<string, HoverDoc> = {};
for (const [key, doc] of Object.entries(COMMAND_DOCS)) {
  EXPRESSION_HOVER[key] = { title: doc.name, description: doc.description, example: doc.examples[0] ?? '' };
}
for (const [key, doc] of Object.entries(EXPRESSION_DOCS)) {
  if (!EXPRESSION_HOVER[key]) {
    EXPRESSION_HOVER[key] = { title: doc.name, description: doc.description, example: doc.examples[0] ?? '' };
  }
}
