/* i18n engine for ISKCON Chernivtsi site.
   Dictionaries: I18N in assets/i18n-dict.js (keys = normalized Ukrainian source).
   Features: localStorage persistence, ?lang= param, dynamic <html lang>,
   text nodes + alt/title/aria-label/data-caption/placeholder + meta tags,
   MutationObserver for dynamic content (avatar chat).
   Safety: observer is always disconnected while translating (no re-entrancy). */
(function(){
"use strict";

var ATTRS = ["alt","title","aria-label","data-caption","placeholder"];
var OBS_OPTS = { childList: true, subtree: true, characterData: true };
var _busy = false;
var observer = null;

function norm(s){ return String(s).replace(/\s+/g," ").trim(); }
function dict(){ return (typeof I18N !== "undefined" && I18N[currentLang]) || {}; }

var store = null;
try { store = localStorage.getItem("lang"); } catch(e){}
var qs = null;
try { qs = new URLSearchParams(location.search).get("lang"); } catch(e){}
var currentLang = (qs === "uk" || qs === "ro" || qs === "en") ? qs : (store || "uk");
if (currentLang !== "uk" && currentLang !== "ro" && currentLang !== "en") currentLang = "uk";

function t(uk){
  var d = dict();
  var k = norm(uk);
  return Object.prototype.hasOwnProperty.call(d, k) ? d[k] : null;
}

/* dictionary values have no edge whitespace (keys are trimmed), so a text node next to <b>/<a>/<em>
   would lose the space separating it from the neighbour ("Kirtan— chanting"). Restore the original's
   edge whitespace unless the translation already provides its own at that edge. */
function keepEdges(orig, tr){
  if (!tr) return orig;
  var lead = orig.match(/^\s+/), trail = orig.match(/\s+$/);
  if (lead && !/^\s/.test(tr)) tr = lead[0] + tr;
  if (trail && !/\s$/.test(tr)) tr = tr + trail[0];
  return tr;
}

function translateTextNode(node){
  /* source text changed by page scripts since our last pass -> take the new value as the source */
  if (node._i18nOrig === undefined || (node._i18nLast !== undefined && node.nodeValue !== node._i18nLast)) node._i18nOrig = node.nodeValue;
  var target = currentLang === "uk" ? node._i18nOrig : keepEdges(node._i18nOrig, t(node._i18nOrig));
  if (node.nodeValue !== target) node.nodeValue = target;
  node._i18nLast = node.nodeValue;
}

function translateEl(el){
  if (el.nodeType === 3) {
    if (norm(el.nodeValue)) translateTextNode(el);
    return;
  }
  if (el.nodeType !== 1) return;
  var tag = el.tagName;
  if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") return;
  for (var i = 0; i < ATTRS.length; i++){
    var a = ATTRS[i];
    if (el.hasAttribute(a)){
      var dk = "_i18n_" + a, lk = "_i18nlast_" + a;
      if (el[dk] === undefined || (el[lk] !== undefined && el.getAttribute(a) !== el[lk])) el[dk] = el.getAttribute(a);
      var tr = t(el[dk]);
      var target = currentLang === "uk" ? el[dk] : (tr !== null ? tr : el[dk]);
      if (el.getAttribute(a) !== target) el.setAttribute(a, target);
      el[lk] = el.getAttribute(a);
    }
  }
  var child = el.firstChild;
  while (child){ translateEl(child); child = child.nextSibling; }
}

function translateMeta(){
  function setMeta(sel, attr){
    var m = document.querySelector(sel);
    if (!m) return;
    if (m._i18n_m === undefined) m._i18n_m = m.getAttribute(attr) || "";
    var tr = t(m._i18n_m);
    var target = currentLang === "uk" ? m._i18n_m : (tr !== null ? tr : m._i18n_m);
    if (m.getAttribute(attr) !== target) m.setAttribute(attr, target);
  }
  var title = document.querySelector("title");
  if (title && title.firstChild){
    if (title._i18nOrig === undefined) title._i18nOrig = title.firstChild.nodeValue;
    var tr = t(title._i18nOrig);
    var tt = currentLang === "uk" ? title._i18nOrig : (tr !== null ? tr : title._i18nOrig);
    if (title.firstChild.nodeValue !== tt) title.firstChild.nodeValue = tt;
  }
  setMeta('meta[name="description"]', "content");
  setMeta('meta[property="og:title"]', "content");
  setMeta('meta[property="og:description"]', "content");
  setMeta('meta[property="og:site_name"]', "content");
  setMeta('meta[name="twitter:title"]', "content");
  setMeta('meta[name="twitter:description"]', "content");
  var loc = document.querySelector('meta[property="og:locale"]');
  if (loc) loc.setAttribute("content", currentLang === "ro" ? "ro_RO" : (currentLang === "en" ? "en_US" : "uk_UA"));
}

function ensureHreflang(){
  if (document.querySelector('link[rel="alternate"][hreflang]')) return;
  var base = location.origin + location.pathname;
  [["uk","uk"],["ro","ro"],["en","en"],["x-default","uk"]].forEach(function(p){
    var l = document.createElement("link");
    l.rel = "alternate"; l.hreflang = p[0];
    l.href = base + "?lang=" + p[1];
    document.head.appendChild(l);
  });
}

function observeOn(){ if (observer && document.body) observer.observe(document.body, OBS_OPTS); }
function observeOff(){ if (observer) observer.disconnect(); }

function translatePage(){
  if (_busy) return; _busy = true;
  observeOff();
  try {
    translateEl(document.body);
    translateMeta();
    ensureHreflang();
  } finally {
    _busy = false;
    observeOn();
  }
}

function setLang(l){
  if (l !== "uk" && l !== "ro" && l !== "en") return;
  if (typeof I18N !== "undefined" && l !== "uk" && !I18N[l]) return;
  currentLang = l;
  try { localStorage.setItem("lang", l); } catch(e){}
  document.documentElement.lang = l;
  document.querySelectorAll(".lang-btn").forEach(function(b){
    b.classList.toggle("active", b.dataset.lang === l);
  });
  translatePage();
}

observer = new MutationObserver(function(muts){
  if (_busy) return;
  _busy = true;
  observeOff();
  try {
    for (var i = 0; i < muts.length; i++){
      var m = muts[i];
      if (m.type === "characterData"){ translateEl(m.target); continue; }
      var an = m.addedNodes;
      for (var j = 0; j < an.length; j++){ translateEl(an[j]); }
    }
  } finally {
    _busy = false;
    observeOn();
  }
});

document.addEventListener("DOMContentLoaded", function(){
  document.querySelectorAll(".lang-btn").forEach(function(b){
    b.addEventListener("click", function(){ setLang(b.dataset.lang); });
  });
  setLang(currentLang);
  observeOn();
});

window.__setLang = setLang;
})();
