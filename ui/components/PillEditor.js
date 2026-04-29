// ui/components/PillEditor.js — Phase 19c.1 / v2.4.2.1
//
// contenteditable editor that hosts inline uneditable `<span>` binding
// pills alongside free text. Exposes a textarea-compatible surface
// (serialize() / setValue() / focus() / insertPillAtCursor()) so the
// existing SkillAdmin wiring needs minimal changes.
//
// Pill markup:
//   <span class="binding-pill is-scalar" contenteditable="false"
//         data-path="session.customer.name"
//         data-label="Customer name"
//         data-bare="false">Customer name</span>
// Bare variant (Alt-click insertion): data-bare="true"; text shows the
// path itself so the user can tell it won't carry the label to the LLM.
//
// Serialization:
//   labeled pill → "Customer name: {{session.customer.name}}"
//   bare pill    → "{{session.customer.name}}"
//   text node    → passes through as plain text
//
// Deserialization on load: scan the stored template for each {{path}}
// match; if the immediately preceding text ends with "{label}: " (where
// {label} is the manifest label for that path), the label is consumed
// and the pill is non-bare; otherwise the pill is bare.

var BINDING_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

export function createPillEditor(opts) {
  opts = opts || {};
  var manifest = opts.manifest || [];
  var onInput  = typeof opts.onInput === "function" ? opts.onInput : function() {};

  var editor = document.createElement("div");
  editor.className = "pill-editor";
  editor.contentEditable = "true";
  editor.setAttribute("role", "textbox");
  editor.setAttribute("spellcheck", "false");
  editor.setAttribute("aria-label", "Data for the AI");

  // Label lookup for deserialize / insertion.
  var labelByPath = {};
  manifest.forEach(function(f) { labelByPath[f.path] = { label: f.label, kind: f.kind || "scalar" }; });

  setEditorFromString(editor, opts.initialValue || "", labelByPath);

  editor.addEventListener("input", function() { onInput(); });

  // Backspace / Delete at a pill boundary must remove the whole pill,
  // not break it into editable character fragments. (contenteditable
  // default behaviour lets characters disappear one at a time which
  // would corrupt the {{path}} string.)
  editor.addEventListener("keydown", function(e) {
    if (e.key !== "Backspace" && e.key !== "Delete") return;
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return;
    var range = sel.getRangeAt(0);
    // Only act when the selection is at a text-node boundary against a pill.
    var node = range.startContainer;
    var offset = range.startOffset;
    var pill = null;
    if (e.key === "Backspace") {
      if (node.nodeType === Node.TEXT_NODE && offset === 0) {
        pill = findPrevPill(node);
      } else if (node === editor && offset > 0) {
        pill = isPill(editor.childNodes[offset - 1]) ? editor.childNodes[offset - 1] : null;
      }
    } else { // Delete
      if (node.nodeType === Node.TEXT_NODE && offset === node.length) {
        pill = findNextPill(node);
      } else if (node === editor && offset < editor.childNodes.length) {
        pill = isPill(editor.childNodes[offset]) ? editor.childNodes[offset] : null;
      }
    }
    if (pill) {
      e.preventDefault();
      pill.remove();
      onInput();
    }
  });

  // Serialization / mutation surface.
  editor.serialize = function() { return serializeEditor(editor); };
  editor.setValue = function(str) {
    setEditorFromString(editor, str || "", labelByPath);
    onInput();
  };
  editor.insertPillAtCursor = function(path, bare) {
    var meta = labelByPath[path] || { label: path, kind: "scalar" };
    var pill = makePill(path, meta.label, meta.kind, bare);
    insertAtCursor(editor, pill);
    // trailing space lets the cursor land somewhere typeable
    insertAtCursor(editor, document.createTextNode("\u00A0"));
    onInput();
  };
  return editor;
}

// ── Internals ──

function makePill(path, label, kind, bare) {
  var pill = document.createElement("span");
  pill.className = "binding-pill " + (kind === "array" ? "is-array" : "is-scalar") + (bare ? " is-bare" : "");
  pill.contentEditable = "false";
  pill.setAttribute("data-path", path);
  pill.setAttribute("data-label", label);
  pill.setAttribute("data-bare",  bare ? "true" : "false");
  pill.title = bare ? "Bare binding — serialises as {{" + path + "}}"
                    : "Labeled binding — serialises as '" + label + ": {{" + path + "}}'";
  pill.textContent = bare ? ("{{" + path + "}}") : label;
  return pill;
}

function isPill(node) { return node && node.nodeType === Node.ELEMENT_NODE && node.classList && node.classList.contains("binding-pill"); }

function findPrevPill(textNode) {
  var prev = textNode.previousSibling;
  return isPill(prev) ? prev : null;
}
function findNextPill(textNode) {
  var next = textNode.nextSibling;
  return isPill(next) ? next : null;
}

function insertAtCursor(editor, node) {
  editor.focus();
  var sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) {
    editor.appendChild(node);
    return;
  }
  var range = sel.getRangeAt(0);
  if (!editor.contains(range.startContainer)) {
    editor.appendChild(node);
    range = document.createRange();
    range.setStartAfter(node);
    range.collapse(true);
    sel.removeAllRanges(); sel.addRange(range);
    return;
  }
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

export function serializeEditor(editor) {
  var out = "";
  editor.childNodes.forEach(function(node) { out += serializeNode(node); });
  return out;
}

function serializeNode(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    // Normalise NBSPs back to regular spaces so the LLM sees normal prose.
    return (node.nodeValue || "").replace(/\u00A0/g, " ");
  }
  if (isPill(node)) {
    var path = node.getAttribute("data-path");
    var label = node.getAttribute("data-label");
    var bare = node.getAttribute("data-bare") === "true";
    if (bare) return "{{" + path + "}}";
    return label + ": {{" + path + "}}";
  }
  // Strip any unexpected element wrapping (e.g. pasted HTML) — keep its text content.
  if (node.nodeType === Node.ELEMENT_NODE) {
    var out = "";
    node.childNodes.forEach(function(c) { out += serializeNode(c); });
    return out;
  }
  return "";
}

// Parse a stored plain-text template into pills + text nodes.
// Exported for tests so we can assert round-trip fidelity without DOM.
//
// v2.4.16 · investigated parser behavior re: "half text / half capsule" UX
// concern (iter-5 review · Bucket B1.5 item 2). When the preceding text
// doesn't EXACTLY match `{label}: ` for the binding's field-manifest label,
// the look-behind below leaves the text alone and the pill is rendered as
// bare (textContent === "{{path}}"). Visually: plain text + capsule. This
// is the documented contract — see `docs/TAXONOMY.md §9 KD9` and Suite 47
// PE4. A future v2.4.17 polish pass may add a UX hint (amber underline +
// tooltip) so users distinguish "bare-pill-by-design" from "wrong template".
// Behavior change deferred pending user direction.
export function parseToSegments(template, labelByPath) {
  var segments = [];
  var cursor = 0;
  var re = new RegExp(BINDING_RE.source, "g");
  var m;
  while ((m = re.exec(template)) !== null) {
    var path = m[1];
    var meta = labelByPath[path] || null;
    var bindingStart = m.index;
    var bindingEnd   = m.index + m[0].length;

    // Look-behind for "{label}: " — if present, this is a labeled pill
    // and we consume the label from the preceding text.
    var preText = template.slice(cursor, bindingStart);
    var isLabeled = false;
    if (meta && preText.length >= meta.label.length + 2) {
      var tail = preText.slice(preText.length - (meta.label.length + 2));
      if (tail === meta.label + ": ") {
        isLabeled = true;
        preText = preText.slice(0, preText.length - (meta.label.length + 2));
      }
    }
    if (preText.length > 0) segments.push({ type: "text", value: preText });
    segments.push({
      type:  "pill",
      path:  path,
      label: meta ? meta.label : path,
      kind:  meta ? meta.kind  : "scalar",
      bare:  !isLabeled
    });
    cursor = bindingEnd;
  }
  if (cursor < template.length) {
    segments.push({ type: "text", value: template.slice(cursor) });
  }
  return segments;
}

function setEditorFromString(editor, template, labelByPath) {
  editor.innerHTML = "";
  var segments = parseToSegments(template, labelByPath);
  segments.forEach(function(seg) {
    if (seg.type === "text") {
      editor.appendChild(document.createTextNode(seg.value));
    } else {
      editor.appendChild(makePill(seg.path, seg.label, seg.kind, seg.bare));
    }
  });
}
