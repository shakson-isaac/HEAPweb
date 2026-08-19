# Preview deploys

How to look at a change to the HEAP site on a real URL **before** it is live.

Previews run on Firebase Hosting *preview channels*: a full copy of the built site on a
temporary URL, served from the same project as production but on a separate channel.

> **Previews never touch heap.bio.** The production site is deployed by
> `.github/workflows/deploy-firebase.yml`, which is restricted to `branches: [main]`.
> The only way to change the live site is to merge to `main`. Nothing in this document
> can publish production — `preview-firebase.yml` only ever calls
> `firebase hosting:channel:deploy`, never `firebase deploy --only hosting`, and it
> refuses outright to deploy a channel named `live`.

---

## 1. Get a preview URL from GitHub Actions

### Automatically, on a pull request

Open a PR against `main` that touches `heap/frontend/**`. The **Preview Frontend on
Firebase Hosting** workflow builds the app and deploys it to a channel named after the PR:

| event | channel | expiry |
|---|---|---|
| pull request #42 | `pr-42` | 30 days |
| manual dispatch | whatever you type (default `preview`) | your choice, default 30 days |

The preview URL is posted **as a comment on the PR** and written to the run's summary page.
Pushing more commits to the PR redeploys the same channel and edits the same comment, so
the URL is stable for the life of the PR and the thread does not fill up with duplicates.

### Manually, for any branch

Actions → **Preview Frontend on Firebase Hosting** → **Run workflow**. Pick the branch, then:

- **channel** — the channel name, default `preview`. Anything you type is lowercased and
  stripped to `[a-z0-9-]`, so `My Feature/2` becomes `my-feature-2`. `live` is rejected.
- **expires** — days until the URL dies. Default `30`, which is also the Firebase maximum.

The URL lands in the run summary (the page you are already looking at). Manual dispatch does
not post a comment anywhere, because there is no PR to comment on.

### Fork PRs do not get a preview

GitHub withholds repository secrets from workflow runs triggered by a PR from a fork, so the
build has no Firebase credentials. The workflow detects this, writes an explanatory note to
the run summary, and exits green rather than failing halfway through. To preview a fork
contribution, push the branch to this repo and use manual dispatch.

---

## 2. Get a preview URL from your own machine

If you have the Firebase CLI and access to the project, you do not need CI at all:

```bash
cd heap/frontend
npm install
npm run build
firebase hosting:channel:deploy my-preview --expires 30d --project <FIREBASE_PROJECT_ID>
```

The CLI prints the preview URL on success. Notes:

- Your `.env` must contain `REACT_APP_BACKEND_URL` and `REACT_APP_WEB_DATA_URL` before
  `npm run build`, or the build bakes in the wrong endpoints. CI writes these from secrets;
  locally you write them yourself. `REACT_APP_WEB_DATA_URL` defaults to
  `https://storage.googleapis.com/heap-web-data/web/v1` — a public bucket, not a secret.
- `--expires` accepts up to `30d`. Without the flag, Firebase defaults to 7 days.
- Housekeeping: `firebase hosting:channel:list` to see what is open,
  `firebase hosting:channel:delete <channel>` to close one early.

---

## 3. Previews expire

Every preview channel has an expiry — 30 days by default here, 30 days maximum from
Firebase. When it lapses the URL stops resolving and the channel is cleaned up
automatically. **Do not put a preview URL in a paper, a grant, a talk, or an email to a
collaborator who will read it next month.** It is for review, not for citation. Anything
that needs a durable address belongs on production.

---

## 4. Rolling back production

Previews need no rollback — let them expire, or delete the channel. Production does:

```bash
cd heap/frontend
firebase hosting:rollback --project <FIREBASE_PROJECT_ID>
```

This immediately re-serves the previous release from Firebase's stored history. It is the
fastest fix for a bad deploy and it needs no rebuild and no git operation. Use it first,
then fix forward in git at normal speed — do not debug a broken live site in place.

`firebase hosting:releases:list` shows what you would be rolling back to.

---

## 5. Publish the payload first, then merge, then prune

This is the ordering rule from **[WEBSITE_PLAN.md § 15](WEBSITE_PLAN.md#15-versioning-and-cutover)**,
and it matters because **site code and data payloads deploy through completely different
channels**: site code goes GitHub → Firebase, payload goes O2 → GCS. Neither one waits for
the other, so they can be out of step, and a page whose section is not published yet renders
an error card.

For any cutover that changes both:

1. **Publish the payload additively** — `sync_gcs.py` *without* `--prune`. Old and new
   sections coexist; the running site keeps working because its sections are untouched.
2. **Merge the site to `main`** and let `deploy-firebase.yml` deploy it.
3. **Verify the live site.**
4. **Only then re-run with `--prune`** to drop sections nothing references any more.

Doing it in the other order takes the live site down for as long as the deploy takes.

A preview is the right place to check step 1 landed before you do step 2: deploy the branch
to a preview channel, confirm it reads the newly published payload correctly, and only then
merge.

---

## 6. Secrets the preview workflow uses

All of these already exist for the production workflows; the preview workflow adds no new
required secret.

| secret | used for | required |
|---|---|---|
| `GCP_CREDENTIALS` | Google Cloud auth | yes |
| `FIREBASE_PROJECT_ID` | which Firebase project to deploy to | yes |
| `FIREBASE_AUTH_TOKEN` | Firebase CLI auth (`--token`) | yes |
| `REACT_APP_BACKEND_URL` | baked into the build | yes |
| `REACT_APP_WEB_DATA_URL` | payload bucket base URL | no — falls back to `https://storage.googleapis.com/heap-web-data/web/v1` |
| `GITHUB_TOKEN` | posting the PR comment | provided automatically by GitHub |
