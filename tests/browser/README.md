# Browser acceptance fixture

This fixture imports the real feedback components and stylesheet. It is served
only by `scripts/verify-browser.mjs`, on loopback port 3101, and is not a Next.js
route or production entry point.

All displayed data is synthetic. Creation responses are intercepted in the
browser to exercise pending, loading and quota states. These checks do not
validate database behavior or authenticated route access.

Start the built, unconfigured app on loopback port 3100, then run:

```sh
node scripts/verify-browser.mjs
```

Chrome must already be installed. The runner uses the locally installed Vite
dependency of Vitest, without installing dependencies. Screenshots and the JSON
report are written to `.local/browser-qa/`. Native browser zoom, screen readers,
real phones and persisted end-to-end flows require separate acceptance.
