# Table Share

A mobile-friendly bill splitter. Start from a receipt photo, a sample or manual entry. Review line totals and currency, then create a table and share its invitation link or QR code. Receipt recognition runs on the device using a bundled English OCR model.

Scanned items appear as tappable choices. Selected items start assigned to the organiser and the rest are available for guests to claim. For manual entry and sample tables, food and extras start shared equally and drinks start unclaimed. The organiser can switch rules per category or assign portions of one dish. The wallet buttons record demo payments only.

For faster mobile scans on a Mac host with Xcode Command Line Tools, run `npm run receipt:service` in another terminal and append `--var LOCAL_RECEIPT_OCR:1` to the Wrangler start arguments. The phone sends the photo to the same app origin. A loopback-only helper recognises text in memory using Apple Vision. If that service is disabled or cannot read the image, the browser uses its bundled OCR model.

## Run locally

Use Node 22.13 or newer and run these commands from this directory.

```sh
npm ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_lean_skaar.sql
npm start
```

Apply the migration once per local database. Open the URL printed by Wrangler. To test both roles on one machine, open the invitation in another browser profile or private window and join under a second name. Tabs in the same profile share an identity.

For two phones on a trusted Wi-Fi network, start the server with `npm start -- --ip 0.0.0.0`, open the computer's LAN IP and port on the organiser's phone, and share the invitation from there. Each device must be able to reach that address. If clipboard access is unavailable over HTTP, select the invitation URL or scan the QR code.
