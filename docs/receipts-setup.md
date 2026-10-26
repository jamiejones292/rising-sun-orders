# Switching on email receipts (one-off, about 20 minutes)

Receipts are sent by an email service called **Resend**. The free plan covers 100 emails
a day. Emails come from `receipts@drinksorder.app`.

You'll copy two secret keys into Netlify. **Never paste them into a chat, an email or
GitHub.** Netlify keeps them hidden.

## Step 1: Update the database
Run `supabase/migrations/20261026000006_receipt_emails.sql` once in the Supabase SQL Editor,
the same way as the earlier updates (see `docs/database-setup.md`).

## Step 2: Create a Resend account and add your domain
1. Go to **resend.com** and sign up (free).
2. Open **Domains**, then **Add domain**:
   - Domain: `drinksorder.app`
   - Region: **Ireland (eu-west-1)**, which keeps customers' email addresses in Europe.
3. Resend shows a list of DNS records (usually 3 or 4: an **MX** record, and **TXT**
   records whose names include `send` and `resend._domainkey`). Leave this page open.

## Step 3: Copy the records into Cloudflare
1. In Cloudflare, open **drinksorder.app**, then **DNS**, then **Records**.
2. For each record Resend shows, click **Add record** and copy across:
   - **Type** (MX or TXT), **Name** and **Content/Value** exactly as Resend shows them.
   - For the MX record, also copy the **Priority** (usually 10).
   - Leave **Proxy** off if Cloudflare offers it.
3. Back in Resend, click **Verify DNS records**. It can take from a few minutes up to an
   hour before it says **Verified**.

These records only affect sending email. They don't change the website.

## Step 4: Create the Resend key
1. In Resend, open **API Keys**, then **Create API key**.
2. Name: `drinksorder receipts`. Permission: **Sending access**. Domain: `drinksorder.app`.
3. Copy the key (it starts with `re_`). Resend only shows it once.

## Step 5: Add both keys in Netlify
In Netlify, open the project, then **Project configuration**, then **Environment variables**,
then **Add a variable**, then **Add a single variable**. Add these two:

| Key | Value | Where to find it |
|---|---|---|
| `RESEND_API_KEY` | the `re_...` key from step 4 | Resend |
| `SUPABASE_SECRET_KEY` | the **secret** key (starts `sb_secret_`) | Supabase: **Project Settings**, then **API Keys**, then **Secret keys**. If there isn't one, click **Add new secret key** and name it `netlify`. |

Tick **Contains secret values** if Netlify offers it. Keep the scope as "All scopes".

Then open **Deploys** and click **Trigger deploy**, then **Deploy site**, so the server
picks up the new keys.

## Step 6: Fill in the receipt details
In the admin site, open **Venue settings**, then **VAT & receipts**:
- the **VAT registration number**
- the **Pub address** (printed at the bottom of every receipt)
- **Replies go to**: the pub's email address, if customers should be able to reply

## Step 7: Test it
Turn on **Test orders** in Venue settings and place an order with your own email address.
The receipt should arrive within a minute, marked **TEST ORDER**. Check the junk folder the
first time.

## If it doesn't arrive
- The order page says **"Email receipts aren't switched on yet"**: one of the Netlify keys
  is missing or misspelt, or you haven't redeployed since adding them (step 5).
- The order page says **"We couldn't send your receipt"**: usually the domain isn't verified
  in Resend yet (step 3). The **Logs** page in Resend shows the reason.
- Nothing at all: look in the junk folder, then in Resend's **Emails** page to see
  whether it was sent.
