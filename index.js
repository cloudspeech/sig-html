/* (c) 2023 - by Markus Walther, MIT License.
 *
 * sig-html is a micro framework for web apps based on plain or computed signals + lit-html template notation.
 * 
 * Supported lit-html notation (cf. https://lit.dev):
 *
 * <div attribute="${1}" .property="${2}" ?booleanAttribute="${false}" @event="${e => alert(e)}">${5}</div>
 * 
 * Known restrictions:
 * - Signals are the only mechanism provided for reactivity
 * - any literal variables must span the entire attribute value or text content in which it occurs, i.e. no 'some ${...} other text or template variable' is allowed (for now)
 * - no HTML validation or sanitizing whatsoever
 * - no careful memory or performance optimizations (yet)
 */

// constants
let SUBSCRIBE = 'subscribe';
let TEXTCONTENT = 'textContent';
let ATTRIBUTE = 'Attribute';
let GET = 'get';
let SET = 'set';
let REMOVE = 'remove';
let GETATTRIBUTE = GET + ATTRIBUTE;
let GETATTRIBUTENAMES = GETATTRIBUTE + 'Names';
let APPENDCHILD = 'appendChild';

let DEFAULT_EFFECT = (domNode, value) => [() => (domNode[TEXTCONTENT] = value)]; // set the text content of an assumed Text node to a value
let DEFAULT_REACTION = identity => identity; // the identity value transform
let LIT_HTML_SPECIALS = ".?@";

// module globals
let plugs2Values = {};
let plugCounter = 0;
let parser = new DOMParser();
let d = document;

// helper functions
let parse = htmlText => {
    return parser.parseFromString(htmlText, 'text/html'); // returns document tree corresponding to <html><head></head><body>child nodes</body></html>
};

let extractNodes = dom => dom?.all[2].childNodes; // extract the <html>, then the <body>, then the children under it

let isText = domNode => domNode.nodeType === 3; // is it a Text node?

let isFunction = f => typeof f === 'function';

// determine an attribute's type; returns a triplet of [sanitizedAttribute, attributesFirstCharacter, isLitHTMLSpecialAttribute]
let attributeType =  (attribute = '') => {
    let firstCharacter = attribute.charAt(0);
    // lit-html-style prefixed attribute?
    let isLitHTMLSpecial = LIT_HTML_SPECIALS.includes(firstCharacter);
    return [isLitHTMLSpecial ? /* yes, strip first character */ attribute.slice(1) : /* no, return as-is */ attribute, firstCharacter, isLitHTMLSpecial];
};

let deriveEffect = ([attribute, firstCharacter]) => {
    // given a DOM node and a value:
    return (domNode, value) => {
	// dispatch on the attribute's first character (which signifies in lit-html notation what the attribute stands for)
	switch(firstCharacter) {
	case '.': /* a property */
	    domNode[attribute] = value; // effect: set property to value
	    break;
	case '?': /* a Boolean attribute */
	    domNode[(value ? SET : REMOVE) + ATTRIBUTE](attribute, ''); // effect: add or remove Boolean attribute
	    break;
	case '@': /* an event handler */
	    let {listener, options} = isFunction(value) ? {listener: value, options: false} : value;
	    domNode.addEventListener(attribute, listener, options); // effect: attach event listener for event named in value
	    break;
	default: /* a Text node or a plain, undecorated attribute */
	    if (isText(domNode)) {
		domNode[TEXTCONTENT] = value; // effect: set text content to value
	    } else {
		domNode[SET + ATTRIBUTE](attribute, value); // effect: set attribute to value
	    }
	}
    };
};

let handleEffect = (attribute, domNode, value) => {
    // try to get initial value from attribute value
    if (value === undefined && GETATTRIBUTE in domNode) {
	value = domNode[GETATTRIBUTE](attribute);
    }
    // determine attribute type according to lit-html's notational conventions
    let type = attributeType(attribute);

    // is it a lit-html-annotated attribute?
    let notPlainAttribute = type[2];
    
    if(notPlainAttribute) {
	// yes, remove it (it will replaced by the effect it induces on the DOM node)
	domNode[REMOVE + ATTRIBUTE](attribute);
    }

    // is the value indicative of a filled string-template variable a.k.a. 'plug'?
    if (value in plugs2Values) {
	// yes, get its associated real value
	value = plugs2Values[value];
    }

    // return the tuple of [effect, value], with side effects of handling any signal values
    return [deriveEffect(type), handleSignal(domNode, value, attribute)];
};

let isSignal = signal => signal instanceof Signal;

let handleSignal = (domNode, value, attribute = '') => {
    // value represents a straightforward signal?
    if (isSignal(value)) {
	// yes, subscribe DOM node and get initial value of the signal
	value = value[SUBSCRIBE](domNode, attribute);
    // value represents a computed signal?
    } else if (Array.isArray(value) && isSignal(value[0])) {
	// get its effect
	let effect = value[1];
	// install effect for DOM node
	let reaction = effect(domNode, attribute);
	// compute initial value as reaction to initial signal value
	value = reaction(value);
    }
    // return the - possibly signal-transformed - value
    return value;
};
	  
let handleVariables = (domNode, plugs2Values) => {
    // Text node?
    if (isText(domNode)) {
	// yes, try to see whether it contains a plug
	let value = plugs2Values[domNode[TEXTCONTENT]];
	// it does?
	if (value != undefined) {
	    // yes, see if it is a signal, too
	    let parent = domNode.parentNode;
	    let signal = isSignal(value) && value;
	    value = handleSignal(domNode, value);
	    // and - for text - assign its initial text content
	    if (typeof value === 'string' || typeof value === 'number')
		domNode[TEXTCONTENT] = value;
	    else if (parent && signal && 'value' in signal && value instanceof Node) { // for signals containing a piece of DOM...
		// remove text node
		domNode.remove();
		// set its initial DOM content on the parent of the text node
		parent.appendChild(value);
		// and update the signal to point to the parent, so later render(signal,...) works as expected
		signal.value = parent;
	    }
	}
    }

    // HTMLElement node?
    if (!isFunction(domNode[GETATTRIBUTENAMES])) return; // no (also exit for Text nodes)

    // yes, loop through its attributes:
    for(let attribute of domNode[GETATTRIBUTENAMES]()) {
	// getting the appropriate effect and initial value for each
	let [effect, value] = handleEffect(attribute, domNode);
	// and executing that effect initially once
	effect(domNode, value);
    }
};

// API

// replace the string-template variables with unique 'plug' strings s.t. the resulting fully instantiated string can be DOM-parsed.
// Along the way, remember the association of plugs with their corresponding variable values
export let html = (fragments, ...values) => {
    let n = fragments.length;
    let m = values.length;
    // otherwise initialize a result strings array (we need to copy, because fragments originating from tagged string template literals are read-only,
    // i.e. can not be re-assigned in-place)
    let strings = [];
    // for all string fragments, in order:
    for(let i = 0, plug; i < n; i++) {
	// calculate unique string-valued variable filler a.k.a. 'plug' that's unlikely to be confused with a real attribute value or text content
	plug = i < m ? `_${++plugCounter}${Math.random()*1e18}_` : '';
	// the fragment with right-adjacent variable is replaced by the fragment with right-adjacent 'plug'
	strings[i] = fragments[i] + plug;
	// and we remember the association between 'plug' and original variable value
	plugs2Values[plug] = values[i];
    }
    return strings.join('');
};

// render plugged string-template HTML under a root node
export let render = (rootNode, pluggedHTML = '', domTree) => {
    let aSignal = isSignal(rootNode);
    domTree = domTree ?? aSignal ? rootNode.value : d.createDocumentFragment();
    // extract a list of child nodes from parsed, string-template-variables-plugged HTML text
    let domHTML = extractNodes(parse(pluggedHTML));
    // create a corresponding DOM tree, reparenting the child nodes under a new document fragment
    for(let domNode of domHTML) {
	domTree[APPENDCHILD](domNode);
    }
    // walk the entire DOM tree under the document fragment...
    for(let treeWalker = d.createTreeWalker(domTree, 133, null); treeWalker.nextNode();) {
	// ... handling its string template variables-turned-unique-plugs
	handleVariables(treeWalker.currentNode, plugs2Values);
    }
    // finally, append the DOM tree under the root node provided
    return aSignal ? domTree : rootNode ? rootNode[APPENDCHILD](domTree) : domTree;
};

// provide plain and computed signals
export class Signal {
    // private instance variables
    #value;
    #subscribers;
    #effects;

    constructor(initialValue) {
	this.#value = initialValue;
	this.#subscribers = new Set();
	this.#effects = new WeakMap();
    }

    subscribe(domNode, attribute, reaction = DEFAULT_REACTION) {
	this.#subscribers.add(domNode);
	if (isSignal(domNode)) return;
	let effect = deriveEffect(attributeType(attribute));
	let effects = this.#effects.get(domNode) || new Set();
	effects.add((newValue, node) => effect(node, reaction(newValue)));
	this.#effects[SET](domNode, effects);
	return this.#value;
    }

    get value() {
	return this.#value;
    }

    set value(newValue) {
	this.#value = newValue;
	for(let domNode of this.#subscribers) {
	    if (isSignal(domNode)) {
		domNode.value = undefined;
		continue;
	    }
	    for(let effect of (this.#effects[GET](domNode) || DEFAULT_EFFECT(domNode, newValue))) {
		effect(newValue, domNode);
	    }
	}
    }

    // define a derived signal, which applies a value transform a.k.a. reaction whenever a signal value changes
    computed(reaction, when = []) {
	when.forEach(signal => signal.subscribe(this));
	return [this, (domNode, attribute) => {
	    this[SUBSCRIBE](domNode, attribute, reaction);
	    return reaction;
	}];
    }
}
