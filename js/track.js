// Anonymous visit statistics: window.track(name, params) sends one event to the KallisteSoft endpoint. No cookie, no
// ID, nothing stored, nothing the visitor typed. The endpoint keeps an event name of /^[a-z_]{1,32}$/ and at most
// 8 params named /^[a-z_]{1,20}$/ whose values are numbers or strings of 40 characters or less.
// With a Google Analytics ID set, events also go to gtag, with every consent denied: nothing here grants it.
(() => {
  const { stats, ga } = window.CNP ?? {};
  const NAME = /^[a-z_]{1,32}$/;
  const KEY = /^[a-z_]{1,20}$/;

  /** The params the endpoint keeps: flat, short, no more than 8. */
  const clean = (params) => {
    const p = {};
    for (const [k, v] of Object.entries(params ?? {})) {
      if (Object.keys(p).length === 8) break;
      if (!KEY.test(k)) continue;
      if ((typeof v === "number" && Number.isFinite(v)) || (typeof v === "string" && v.length <= 40)) p[k] = v;
    }
    return p;
  };

  let gtag = null;
  if (ga) {
    try {
      window.dataLayer = window.dataLayer || [];
      gtag = window.gtag = function () { window.dataLayer.push(arguments); };
      gtag("consent", "default", { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "denied" });
      gtag("js", new Date());
      gtag("config", ga);
      const s = document.createElement("script");
      s.async = true;
      s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga)}`;
      document.head.append(s);
    } catch {}
  }

  window.track = (name, params) => {
    try {
      if (!NAME.test(name)) return;
      const p = clean(params);
      if (stats && navigator.sendBeacon) navigator.sendBeacon(stats, JSON.stringify({ s: "cnp", e: name, p }));
      if (gtag) gtag("event", name, p);
    } catch {}
  };
})();
