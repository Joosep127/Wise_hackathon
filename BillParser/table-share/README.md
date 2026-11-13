# Table Share

A mobile-friendly bill splitter. Start from a receipt photo, a sample or manual entry. Review line totals and currency, then create a table and share its invitation link or QR code. Receipt recognition runs on the device using a bundled English OCR model.

Scanning creates a shareable bill. Use the quantity controls or hold an item to choose a percentage or an equal share. Identical lines at the same unit price are combined. The organiser has separate views for assigning groups and recording their own already-paid items. Open a named group to edit it directly, drag a receipt grip onto a group, or tap it to choose a destination. Choose several items to divide them equally between groups. Guests can pay a group or their own selection. All payments are simulated.

Guests see only the remainder of the organiser’s items. Fully settled rows stay crossed out for the current visit so another person’s payment does not reorder the receipt. The expandable **Paid items** section lists each guest’s contribution to each line. **Active now** shows people viewing the table; a closed or backgrounded tab expires after 30 seconds (plus the next refresh). **Clear all** clears only the current selection. Under **Options**, a guest can reset their own selections and demo payments; the organiser can reset or delete the whole table. Payment templates use the current organiser’s history. Legacy tables retain their original checkout flow.

For faster mobile scans on a Mac host with Xcode Command Line Tools, run `npm run receipt:service` in another terminal and append `--var LOCAL_RECEIPT_OCR:1` to the Wrangler start arguments. The phone sends the photo to the same app origin. A loopback-only helper recognises text in memory using Apple Vision. If that service is disabled or cannot read the image, the browser uses its bundled OCR model.

## Run locally

Use Node 22.13 or newer and run these commands from this directory.

```sh
npm ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_lean_skaar.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_active_people.sql
npm start
```

Apply each migration once per local database. If the database already has the rooms table, apply only the new presence migration. Open the URL printed by Wrangler. To test both roles on one machine, open the invitation in another browser profile or private window and join under a second name. Tabs in the same profile share an identity.

For private Tailscale access, start with `npm start -- --ip "$(tailscale ip -4)" --port 8795`. On phones connected to the same tailnet, open the printed address and use **Share QR** to invite guests. Each device must be allowed to reach the host.
