/* kitapoyun – küçük şablon motoru (statik site için) */
(function () {
  function lookup(path, scope) {
    path = path.trim();
    if (path === 'true') return true;
    if (path === 'false') return false;
    if (path === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
    if (/^'.*'$|^".*"$/.test(path)) return path.slice(1, -1);
    var parts = path.split('.');
    var v = scope;
    for (var i = 0; i < parts.length; i++) {
      if (v == null) return undefined;
      v = v[parts[i]];
    }
    return v;
  }
  var WHOLE = /^\s*\{\{([^}]+)\}\}\s*$/;
  var ANY = /\{\{([^}]+)\}\}/g;
  function interp(str, scope) {
    return str.replace(ANY, function (_, p) {
      var v = lookup(p, scope);
      return v == null ? '' : String(v);
    });
  }
  var BOOL = { disabled: 1, checked: 1, readonly: 1, selected: 1, hidden: 1, required: 1 };
  var EVENTS = { onclick: 'click', onchange: 'input', oninput: 'input', onsubmit: 'submit', onkeydown: 'keydown' };

  function render(node, scope, out) {
    if (node.nodeType === 3) { out.push(document.createTextNode(interp(node.nodeValue, scope))); return; }
    if (node.nodeType !== 1) return;
    var tag = node.localName;
    if (tag === 'sc-for') {
      var list = lookup((node.getAttribute('list') || '').replace(/[{}]/g, ''), scope) || [];
      var as = node.getAttribute('as') || 'item';
      for (var i = 0; i < list.length; i++) {
        var s = Object.create(scope); s[as] = list[i]; s.$index = i;
        kids(node, s, out);
      }
      return;
    }
    if (tag === 'sc-if') {
      var val = lookup((node.getAttribute('value') || '').replace(/[{}]/g, ''), scope);
      if (val) kids(node, scope, out);
      return;
    }
    var el = node.namespaceURI && node.namespaceURI !== 'http://www.w3.org/1999/xhtml'
      ? document.createElementNS(node.namespaceURI, node.localName)
      : document.createElement(tag);
    var deferredValue;
    for (var a = 0; a < node.attributes.length; a++) {
      var at = node.attributes[a], name = at.name, v = at.value, m = WHOLE.exec(v);
      if (/^hint-/.test(name)) continue;
      if (EVENTS[name]) {
        if (m) { var fn = lookup(m[1], scope); if (typeof fn === 'function') {
          var ev = EVENTS[name];
          if (name === 'onchange' && !/^(input|textarea)$/.test(tag)) ev = 'change';
          el.addEventListener(ev, fn);
        } }
        continue;
      }
      if (m) {
        var raw = lookup(m[1], scope);
        if (BOOL[name]) { if (raw && raw !== 'false') el.setAttribute(name, ''); continue; }
        if (name === 'value') { deferredValue = raw == null ? '' : String(raw); continue; }
        el.setAttribute(name, raw == null ? '' : String(raw));
      } else {
        if (name === 'value' && (tag === 'input' || tag === 'textarea')) { deferredValue = interp(v, scope); continue; }
        el.setAttribute(name, interp(v, scope));
      }
    }
    var c = []; kids(node, scope, c);
    for (var k = 0; k < c.length; k++) el.appendChild(c[k]);
    if (deferredValue !== undefined) el.value = deferredValue;
    out.push(el);
  }
  function kids(node, scope, out) {
    var src = node.localName === 'template' ? node.content : node;
    for (var n = src.firstChild; n; n = n.nextSibling) render(n, scope, out);
  }
  function pathOf(el, root) {
    var p = [];
    while (el && el !== root) { var i = 0, s = el; while ((s = s.previousSibling)) i++; p.unshift(i); el = el.parentNode; }
    return el === root ? p : null;
  }
  function byPath(root, p) { var el = root; for (var i = 0; i < p.length && el; i++) el = el.childNodes[p[i]]; return el; }

  window.DCLogic = function DCLogic(props) { this.props = props || {}; this.state = {}; };
  DCLogic.prototype.setState = function (patch) {
    var p = typeof patch === 'function' ? patch(this.state) : patch;
    this.state = Object.assign({}, this.state, p);
    this.__render();
  };
  DCLogic.prototype.forceUpdate = function () { this.__render(); };

  window.mountDC = function (Cls) {
    var tpl = document.getElementById('dc-template');
    var root = document.getElementById('app');
    var inst = new Cls({});
    inst.__render = function () {
      var active = document.activeElement, path = null, sel = null;
      if (active && root.contains(active)) {
        path = pathOf(active, root);
        try { sel = [active.selectionStart, active.selectionEnd]; } catch (e) {}
      }
      var scope = inst.renderVals ? (inst.renderVals() || {}) : {};
      var out = []; kids(tpl, scope, out);
      root.replaceChildren.apply(root, out);
      if (path) {
        var el = byPath(root, path);
        if (el && el.focus) { el.focus(); if (sel && sel[0] != null) { try { el.setSelectionRange(sel[0], sel[1]); } catch (e) {} } }
      }
    };
    inst.__render();
    if (inst.componentDidMount) inst.componentDidMount();
  };
})();
