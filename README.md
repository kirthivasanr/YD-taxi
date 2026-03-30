# YD TAXI Static Site

This project has been simplified into a frontend-only taxi booking site using plain HTML, CSS, and JavaScript.

## What changed

- Removed the Node, Express, MongoDB, and React app structure.
- Kept the core booking flow: form validation, fare estimation, and direct WhatsApp booking.
- Made Google Maps optional. If no API key is set, users can still book by entering distance manually.
- Reduced the project to a small static structure that is easier to host on Netlify, GitHub Pages, Cloudflare Pages, or any basic static server.

## Project structure

```text
assets/
  logo.svg
css/
  styles.css
js/
  app.js
  config.js
index.html
README.md
netlify.toml
```

## Configuration

Update `js/config.js` before deployment:

```js
window.YD_TAXI_CONFIG = {
  businessName: "YD TAXI",
  baseCity: "Chennai",
  siteUrl: "https://your-domain.example",
  whatsappNumber: "919080609081",
  phoneNumber: "+919080609081",
  contactEmail: "support@ydtaxi.example",
  googleMapsApiKey: "",
  enableMapsAutocomplete: false
};
```

Notes:

- `whatsappNumber` should contain digits only.
- `googleMapsApiKey` is optional.
- If `enableMapsAutocomplete` is `true` and `googleMapsApiKey` is set, the site enables Google Places autocomplete and route distance lookup.
- If Maps is not configured, the booking form still works with manual distance entry.

## Hosting

Upload the project as a static site.

- Netlify: publish the repo root.
- GitHub Pages: serve the root folder.
- Any shared hosting: upload all files as-is.

## Booking logic

- One way: minimum 130 km chargeable distance plus `Rs 400` driver bata.
- Round trip: minimum 250 km per day chargeable distance plus `Rs 400` driver bata per day.
- WhatsApp message includes booking reference, route, schedule, cab type, passenger count, chargeable distance, and fare estimate.
