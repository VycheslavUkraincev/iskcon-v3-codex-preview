/* Головна: «Найближча неділя» — дата найближчої недільної програми (13:30–17:30, Europe/Kyiv),
   «Додати в календар» — шаблон Google Calendar (щотижня), тихе посилання на .ics на 5 найближчих неділь і «Запросити друга» (Web Share, інакше — копіювання тексту з посиланням).
   Тексти — ключі словника (assets/i18n-dict.js). Свята не враховуються: під блоком стоїть примітка про Telegram. */
(function(){
"use strict";

var box = document.getElementById("next-sunday");
if (!box || typeof Intl === "undefined") return;

var TZ = "Europe/Kyiv";
var START = [13, 30], END = [17, 30], COUNT = 5;
var LOCALES = { uk: "uk-UA", en: "en-GB", ro: "ro-RO" };

function norm(s){ return String(s).replace(/\s+/g," ").trim(); }
function lang(){ var l = document.documentElement.lang; return (l === "en" || l === "ro") ? l : "uk"; }
function tr(uk){
  var l = lang();
  if (l === "uk" || typeof I18N === "undefined" || !I18N[l]) return uk;
  return I18N[l][norm(uk)] || uk;
}

/* календарні частини моменту t у Києві */
var fmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", weekday: "short",
  year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" });
function kyiv(t){
  var p = {};
  fmt.formatToParts(new Date(t)).forEach(function(x){ p[x.type] = x.value; });
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, mi: +p.minute, wd: p.weekday };
}
/* київський місцевий час -> UTC (з урахуванням переходу на літній/зимовий час) */
function kyivToUtc(y, m, d, h, mi){
  var guess = Date.UTC(y, m - 1, d, h, mi), t = guess;
  for (var i = 0; i < 2; i++){
    var k = kyiv(t);
    t = guess - (Date.UTC(k.y, k.m - 1, k.d, k.h, k.mi) - t);
  }
  return t;
}

/* найближча неділя: сьогодні, якщо неділя і програма ще не закінчилась */
function nextSundays(){
  var now = kyiv(Date.now());
  var wd = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(now.wd);
  var add = (7 - wd) % 7;
  if (add === 0 && now.h * 60 + now.mi >= END[0] * 60 + END[1]) add = 7;
  var out = [];
  for (var i = 0; i < COUNT; i++){
    var c = new Date(Date.UTC(now.y, now.m - 1, now.d + add + 7 * i));
    out.push({ y: c.getUTCFullYear(), m: c.getUTCMonth() + 1, d: c.getUTCDate() });
  }
  return out;
}

function dateLabel(s){
  return new Intl.DateTimeFormat(LOCALES[lang()], { day: "numeric", month: "long", timeZone: "UTC" })
    .format(new Date(Date.UTC(s.y, s.m - 1, s.d, 12)));
}

function pageUrl(){
  var c = document.querySelector('link[rel="canonical"]');
  var url = c ? c.href : location.href.split("#")[0];
  return lang() === "uk" ? url : url + "?lang=" + lang();
}

var slot = box.querySelector("[data-next-sunday]");
var status = box.querySelector("[data-invite-status]");
function render(){
  slot.textContent = dateLabel(nextSundays()[0]);
  status.textContent = "";
  if (gcal) gcal.href = gcalUrl();
}

/* ---- Google Calendar: основна дія — шаблон події, що повторюється щонеділі (файл не завантажується) ---- */
function gcalLocal(s, hm){
  return s.y + String(s.m).padStart(2, "0") + String(s.d).padStart(2, "0") + "T" + String(hm[0]).padStart(2, "0") + String(hm[1]).padStart(2, "0") + "00";
}
function gcalUrl(){
  var s = nextSundays()[0], q = [
    ["action", "TEMPLATE"],
    ["text", tr("Недільна програма — ІСККОН Чернівці")],
    ["dates", gcalLocal(s, START) + "/" + gcalLocal(s, END)],
    ["ctz", TZ],
    ["recur", "RRULE:FREQ=WEEKLY;BYDAY=SU"],
    ["location", tr("вул. Скальда (Комарова), 40А, Чернівці")],
    ["details", tr("Святкові програми за вайшнавським календарем та дні посту Екадаші — слідкуйте за оголошеннями в Telegram.") + "\n" + pageUrl()]
  ];
  return "https://calendar.google.com/calendar/render?" + q.map(function(p){ return p[0] + "=" + encodeURIComponent(p[1]); }).join("&");
}
var gcal = box.querySelector("[data-gcal]");

/* ---- .ics (тихе посилання поруч) ---- */
function icsStamp(t){ return new Date(t).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); }
function icsText(s){ return String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n"); }
function fold(line){
  /* рядки ≤ 75 октетів (RFC 5545), не розриваючи символи UTF-8 */
  var enc = new TextEncoder(), out = [], cur = "", n = 0;
  for (var ch of line){
    var b = enc.encode(ch).length;
    if (n + b > (out.length ? 74 : 75)){ out.push(cur); cur = ""; n = 0; }
    cur += ch; n += b;
  }
  out.push(cur);
  return out.join("\r\n ");
}
function buildIcs(){
  var stamp = icsStamp(Date.now()), url = pageUrl();
  var lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ISKCON Chernivtsi//iskcon.cv.ua//UK", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  nextSundays().forEach(function(s){
    var ymd = s.y + String(s.m).padStart(2, "0") + String(s.d).padStart(2, "0");
    lines.push("BEGIN:VEVENT",
      "UID:sunday-" + ymd + "@iskcon.cv.ua",
      "DTSTAMP:" + stamp,
      "DTSTART:" + icsStamp(kyivToUtc(s.y, s.m, s.d, START[0], START[1])),
      "DTEND:" + icsStamp(kyivToUtc(s.y, s.m, s.d, END[0], END[1])),
      "SUMMARY:" + icsText(tr("Недільна програма — ІСККОН Чернівці")),
      "LOCATION:" + icsText(tr("вул. Скальда (Комарова), 40А, Чернівці")),
      "DESCRIPTION:" + icsText(tr("Святкові програми за вайшнавським календарем та дні посту Екадаші — слідкуйте за оголошеннями в Telegram.") + "\n" + url),
      "URL:" + url,
      "END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
box.querySelector("[data-ics]").addEventListener("click", function(){
  var blob = new Blob([buildIcs()], { type: "text/calendar;charset=utf-8" });
  var a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "iskcon-chernivtsi-sunday.ics";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function(){ URL.revokeObjectURL(a.href); }, 4000);
});

/* ---- «Запросити друга» ---- */
box.querySelector("[data-invite]").addEventListener("click", function(){
  var text = tr("Запрошую на недільну програму в ІСККОН Чернівці: {date}, 13:30, вул. Скальда (Комарова), 40А. Вхід вільний.")
    .replace("{date}", dateLabel(nextSundays()[0]));
  var url = pageUrl();
  status.textContent = "";
  if (navigator.share){
    navigator.share({ title: document.title, text: text, url: url }).catch(function(){});
    return;
  }
  var full = text + " " + url;
  var fail = function(){ status.textContent = tr("Скопіюйте вручну") + ": " + full; };
  if (navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(full).then(function(){
      status.textContent = tr("Запрошення скопійовано — надішліть його другу.");
    }, fail);
  } else fail();
});

render();
box.hidden = false;
new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
})();
