# PostKing CLI (`pking`)

The PostKing CLI lets you interact with the PostKing platform directly from your terminal or autonomous agent. It covers authentication, brand management, content generation, scheduling, repurposing, and more.

## Installation

```bash
npm install -g postking-cli
```

Or clone and link locally:

```bash
npm install
npm run build
npm link
```

## Quick Start

```bash
# 1. Authenticate
pking login

# 2. Onboard a brand (crawls site, generates themes automatically)
pking onboard https://yoursite.com --name "My Brand"

# 3. Generate a post
pking posts generate --platform linkedin --variations 3

# 4. Approve and schedule it
pking posts approve <postId> --variation 2 --schedule "2026-04-01T09:00:00Z"
```

---

## Global Options

- `-h, --help`: Display help for any command.
- `-V, --version`: Display the CLI version.

---

## Authentication

### `pking login`
Authenticate via OAuth2 Device Authorization Flow. The CLI prints a short code and URL for a human to visit, then polls until authorized.

```bash
pking login
```

### `pking logout`
Clear locally stored credentials.

```bash
pking logout
```

---

## Brand Management (`pking brand`)

### `pking onboard <websiteUrl>`
Crawl a website, analyze the audience, and generate 10 initial content themes automatically. Sets the new brand as active.

```bash
pking onboard https://postking.app --name "PostKing Agent"
pking onboard https://acme.com
```

### `pking brand list`
List all brands on your account and see which is currently active.

```bash
pking brand list
```

### `pking brand set <brandId>`
Switch the active brand workspace. All subsequent commands will use this brand.

```bash
pking brand set clx1234abcd
```

### `pking brand info`
View a full profile of the active brand — tone, audience, pain points, themes, and more.

```bash
pking brand info
```

### `pking brand create <name>`
Manually create a brand without automatic crawling.

```bash
pking brand create "My Design Studio"
pking brand create "Acme Corp" --tone "Bold & Direct" --audience "B2B SaaS founders" --website "https://acme.com"
pking brand create "Side Project" --description "A productivity app for developers"
```

### `pking brand themes`
List all content themes for the active brand with their IDs.

```bash
pking brand themes
pking brand themes list
```

### `pking brand themes edit <themeId>`
Edit an existing theme's title or content instructions.

```bash
pking brand themes edit clx9theme1 --title "Product-Led Growth"
pking brand themes edit clx9theme1 --content "Focus on how the product sells itself through user success stories"
pking brand themes edit clx9theme1 --title "Customer Stories" --content "Real users, real outcomes"
```

### `pking brand themes delete <themeId>`
Delete a content theme.

```bash
pking brand themes delete clx9theme1
```

### `pking brand generate-themes`
Generate new content themes with the core engine (deducts credits). Optionally provide instructions or source content.

```bash
# Generate 5 themes (default)
pking brand generate-themes

# Generate 8 themes with custom instructions
pking brand generate-themes --count 8 --instructions "Focus on startup growth and fundraising"

# Derive themes from a file
pking brand generate-themes --count 5 --input /path/to/brand-notes.txt

# Derive themes from raw text
pking brand generate-themes --count 3 --input "We help remote teams stay aligned through async video updates"
```

---

## Posts (`pking posts`)

### `pking posts generate`
Generate a post for a platform with the core engine (deducts credits). Polls until complete and prints all variations.

```bash
# Generate 1 post for X (random theme)
pking posts generate --platform x

# Generate 3 LinkedIn variations on a specific theme
pking posts generate --platform linkedin --variations 3 --theme "Product-Led Growth"

# Use a theme ID instead of a name
pking posts generate --platform linkedin --theme clx9theme1 --variations 2

# Apply a voice profile
pking posts generate --platform x --voice clxvoice1 --variations 2

# Custom character limit (not tied to a specific platform)
pking posts generate --platform custom:500
```

### `pking posts generate-bulk`
Generate and schedule multiple posts across a date range in the background.

```bash
# 7 days of daily LinkedIn posts at 9am and 2pm
pking posts generate-bulk --platform linkedin --days 7 --times "09:00,14:00"

# Post every other day on X with a specific voice
pking posts generate-bulk --platform x --frequency every_other --days 14 --voice clxvoice1

# Weekdays only, 2 posts per day
pking posts generate-bulk --platform linkedin --frequency weekdays --posts-per-day 2 --times "08:00,17:00" --days 10

# 30 days of daily posts
pking posts generate-bulk --platform instagram --frequency daily --days 30 --posts-per-day 1 --times "10:00"
```

Frequency options: `daily`, `every_other`, `every_third`, `weekdays`

### `pking posts create`
Manually create a post as a draft.

```bash
# Simple draft
pking posts create --platform linkedin --content "Excited to share our Q1 results!"

# Schedule at a specific time
pking posts create --platform x --content "Big announcement coming tomorrow." --schedule "2026-04-01T10:00:00Z"

# Custom character limit
pking posts create --platform custom:280 --content "Short-form post for a custom platform"
```

### `pking posts list`
List recent posts and drafts.

```bash
# Show latest 10 posts
pking posts list

# Filter by status
pking posts list --status scheduled
pking posts list --status created

# Filter by platform
pking posts list --platform linkedin --limit 20

# Combine filters
pking posts list --status scheduled --platform x --limit 5
```

Status options: `created`, `scheduled`, `posted`

### `pking posts view <postId>`
View the full content, status, and attached assets of a post.

```bash
pking posts view clxpost1234
```

### `pking posts approve <postId>`
Confirm a draft. Without `--schedule` the post joins the automated queue; with `--schedule` it is pinned to that time.

```bash
# Approve and add to automated queue
pking posts approve clxpost1234

# Select a specific variation (1-based)
pking posts approve clxpost1234 --variation 2

# Approve with a specific schedule time
pking posts approve clxpost1234 --schedule "2026-04-15T12:00:00Z"

# Specify timezone
pking posts approve clxpost1234 --schedule "2026-04-15T09:00:00Z" --timezone "America/New_York"
```

### `pking posts schedule <postId>`
Confirm a draft and pin it to a specific date/time. Equivalent to `approve --schedule`, but makes the intent explicit.

```bash
pking posts schedule clxpost1234 --date "2026-05-05T14:00:00+02:00"
pking posts schedule clxpost1234 --date "2026-05-05T09:00:00Z" --variation 2 --timezone "America/New_York"
```

### `pking posts reschedule <postId>`
Move an already-scheduled (or failed) post to a new time. Does not work on drafts — use `schedule` / `approve` first.

```bash
pking posts reschedule clxpost1234 --date "2026-05-01T14:00:00Z"
```

### Lifecycle

```
draft ──approve──▶ queued       (no --schedule)
draft ──schedule/approve --schedule──▶ scheduled ──reschedule──▶ new time
```

### `pking posts cancel <postId>`
Cancel a scheduled post or unapprove a draft.

```bash
pking posts cancel clxpost1234
```

### `pking posts delete <postId>`
Soft delete a post.

```bash
pking posts delete clxpost1234
```

### `pking posts calendar`
View your upcoming content schedule.

```bash
# Next 14 days (default)
pking posts calendar

# Next 30 days
pking posts calendar --days 30
```

---

## Repurpose (`pking repurpose`)

Turn an external URL, text, or existing post into new content for any platform.

```bash
# Repurpose a blog URL into X and LinkedIn posts
pking repurpose --source-type url --source-url https://techcrunch.com/2026/03/08/will-the-pentagons-anthropic-controversy-scare-startups-away-from-defense-work/ --target-type social --target-platforms x,linkedin

# Turn a blog URL into a standalone blog post
pking repurpose --source-type url --source-url https://techcrunch.com/2026/03/08/will-the-pentagons-anthropic-controversy-scare-startups-away-from-defense-work/ --target-type blog

# Repurpose raw text into 2 social variations with a voice
pking repurpose --source-type text --source-content "We just shipped dark mode." --target-type social --target-platforms x,threads --variations 2 --voice clxvoice1

# Custom text length output
pking repurpose --source-type text --source-content "Here is my thought" --target-type text --text-length medium
pking repurpose --source-type text --source-content "Here is my thought" --target-type text --text-length custom:300

# Repurpose an existing PostKing post to LinkedIn with a specific angle
pking repurpose --source-type social_post --source-post clxpost1234 --target-type social --target-platforms linkedin --angle "focus on ROI data"

# Include the source link in the output and attach a theme
pking repurpose --source-type url --source-url https://techcrunch.com/2026/03/08/will-the-pentagons-anthropic-controversy-scare-startups-away-from-defense-work/ --target-type social --target-platforms x --include-link --theme-id clx9theme1

# Per-platform voice mapping
pking repurpose --source-type url --source-url https://techcrunch.com/2026/03/08/will-the-pentagons-anthropic-controversy-scare-startups-away-from-defense-work/ --target-type social --target-platforms x,linkedin --voice "x:clxvoice1,linkedin:clxvoice2"
```

Source types: `url`, `text`, `blog`, `social_post`
Target types: `social`, `blog`, `text`
Text length options: `short`, `medium`, `long`, `custom:<words>`

---

## Voice Profiles (`pking voice`)

### `pking voice list`
List all available voice profiles with their IDs.

```bash
pking voice list
```

### `pking voice rewrite`
Rewrite text using a specific voice profile.

```bash
# Rewrite for X
pking voice rewrite --profile_id clxvoice1 --text "Automation is changing marketing." --platform x

# Rewrite for LinkedIn
pking voice rewrite --profile_id clxvoice1 --text "We just raised our Series A." --platform linkedin

# No platform context
pking voice rewrite --profile_id clxvoice1 --text "Announcing our new product."
```

---

## Editor (`pking editor`)

### `pking editor rewrite`
Rewrite text using a voice profile or general writing rules.

```bash
# With a voice profile
pking editor rewrite --text "We made some cool stuff." --voice clxvoice1 --platform linkedin

# General rewrite
pking editor rewrite --text "Today we shipped an update." --platform x
```

### `pking editor humanize`
Rewrite text to read as natural, human-written prose and reduce machine-generated signals.

```bash
pking editor humanize --text "Adaptive systems are revolutionizing the marketing industry."
pking editor humanize --text "Our product leverages cutting-edge adaptive logic." --platform linkedin
```

### `pking editor detect`
Analyze text and report the likelihood that it was machine-generated.

```bash
pking editor detect --text "Adaptive systems are revolutionizing how brands communicate."
```

---

## Social Accounts (`pking social`)

### `pking social check`
List all connected and disconnected social accounts for the active brand. Run before posting to confirm platform availability.

```bash
pking social check
```

### `pking social connect`
Generate a secure link to connect social media accounts in a browser.

```bash
pking social connect
```

### `pking social disconnect <platform_or_id>`
Disconnect a social account by platform name or account ID.

```bash
pking social disconnect x
pking social disconnect linkedin
pking social disconnect clxaccount1234
```

---

## Domains (`pking domains`)

### `pking domains list`
List all custom domains configured for the active brand.

```bash
pking domains list
```

### `pking domains verify <domain>`
Trigger DNS verification and display the required TXT record if not yet verified.

```bash
pking domains verify mybrand.com
pking domains verify blog.mybrand.com
```

---

## User (`pking user`)

### `pking user credits`
Check your current credit balance.

```bash
pking user credits
```

---

## Visuals (`pking visuals`)

Manage the brand asset library and attach visuals to posts. All commands are pass-throughs to
`/api/agent/v1/brands/{brandId}/assets/*` (library) or `/api/agent/v1/posts/{postId}/visuals*`
(post-scoped picker).

### Typical flow

```bash
# 1. Generate a post
pking posts generate --platform linkedin --theme "Dark mode shipped"
# Note the postId from the output

POST_ID=<postId>

# 2. Browse available visuals (human-friendly table + best pick banner)
pking visuals options $POST_ID --platform linkedin

# 3. Select a card template
pking visuals pick $POST_ID --platform linkedin --style glass-morphism --variant 2

# 4. Optionally review and edit cards
pking visuals cards list $POST_ID
pking visuals cards edit $POST_ID --card 1 --body "43% of devs flipped it on day one." --rerender

# 5. Generate a carousel PDF
pking visuals carousel $POST_ID --style glass-morphism --variant 2

# 6. Schedule the post
pking posts schedule $POST_ID --date "2026-06-01T09:00:00Z"
```

---

### `pking visuals list`
List assets in the brand library.
Wraps `GET /api/agent/v1/brands/{brandId}/assets`

```bash
# All assets
pking visuals list

# Filter by type and tag
pking visuals list --type image --tags hero,q2 --limit 20

# Full-text search
pking visuals list --search "launch banner"

# JSON output for scripting
pking visuals list --json | jq '.[].id'
```

---

### `pking visuals view <assetId>`
Show full metadata for a single asset.
Wraps `GET /api/agent/v1/brands/{brandId}/assets/{assetId}`

```bash
pking visuals view clxasset1234
pking visuals view clxasset1234 --json
```

---

### `pking visuals upload`
Upload a local file to the brand library (requires Node 18+).
Wraps `POST /api/agent/v1/brands/{brandId}/assets` (multipart)

```bash
pking visuals upload --file ./banner.png --name "Q2 hero banner" --tags hero,q2
pking visuals upload --file ./product-demo.mp4 --name "Demo video"
pking visuals upload --file ./deck.pdf --name "Investor deck" --description "Series A deck — March 2026"
```

---

### `pking visuals import-url <url>`
Import a remote URL as an asset.
Wraps `POST /api/agent/v1/brands/{brandId}/assets` (JSON body with `url`)

```bash
pking visuals import-url https://example.com/hero.jpg --name "Site hero" --tags hero
pking visuals import-url https://cdn.example.com/video.mp4 --name "Product video"
```

---

### `pking visuals import-csv <file>`
Batch-import up to 50 URLs from a file (one URL per line or a JSON array).
Wraps `POST /api/agent/v1/brands/{brandId}/assets/import-urls`

```bash
# One URL per line
echo "https://example.com/img1.jpg
https://example.com/img2.jpg" > urls.txt
pking visuals import-csv urls.txt

# JSON array
echo '["https://example.com/img1.jpg","https://example.com/img2.jpg"]' > urls.json
pking visuals import-csv urls.json
```

---

### `pking visuals tag <assetId>`
Add or remove tags on an asset.
Wraps `PATCH /api/agent/v1/brands/{brandId}/assets/{assetId}`

```bash
pking visuals tag clxasset1234 --add launch,featured
pking visuals tag clxasset1234 --remove old,draft
pking visuals tag clxasset1234 --add launch --remove old
```

---

### `pking visuals delete <assetId>`
Soft-delete (deactivate) an asset from the library.
Wraps `DELETE /api/agent/v1/brands/{brandId}/assets/{assetId}`

```bash
pking visuals delete clxasset1234
```

---

### `pking visuals tags`
List all tags used across the brand library.
Wraps `GET /api/agent/v1/brands/{brandId}/assets/tags`

```bash
pking visuals tags
pking visuals tags --json
```

---

### `pking visuals suggest`
Get asset suggestions from the library that match a context string.
Wraps `GET /api/agent/v1/brands/{brandId}/assets/suggestions`

```bash
pking visuals suggest --context "dark mode launch" --limit 5
pking visuals suggest --context "product demo screenshot"
```

---

### `pking visuals search-stock <query>`
Search Unsplash + Pexels for matching stock photos or videos.
Wraps `POST /api/agent/v1/brands/{brandId}/assets/search-stock`

```bash
pking visuals search-stock "dark empty office late night"
pking visuals search-stock "team celebration" --platform linkedin
pking visuals search-stock "code on a screen" --json | jq '.results[0].url'
```

---

### `pking visuals options <postId>`
Browse all visual options for a post, including a "Best pick" banner.
In `--json` mode emits the raw B.8 payload with `_internal.slot` preserved.
Wraps `GET /api/agent/v1/posts/{postId}/visuals`

```bash
# Human table + best pick banner
pking visuals options clxpost1234

# Filter to LinkedIn card templates only
pking visuals options clxpost1234 --platform linkedin --category card

# JSON for agent pipelines
pking visuals options clxpost1234 --json
pking visuals options clxpost1234 --platform linkedin --json | jq '.options.linkedin.cardTemplates | length'
```

---

### `pking visuals regenerate <postId>`
Re-run the visual options engine for a post.
Wraps `POST /api/agent/v1/posts/{postId}/visuals/regenerate`

```bash
pking visuals regenerate clxpost1234
pking visuals regenerate clxpost1234 --load-external   # also refreshes Unsplash/Pexels
pking visuals regenerate clxpost1234 --platform linkedin
```

---

### `pking visuals pick <postId>`
Select a visual for a post on a given platform.
Wraps `PATCH /api/agent/v1/posts/{postId}/visuals`

```bash
# Select a card template by style + variant
pking visuals pick clxpost1234 --platform linkedin --style glass-morphism --variant 2
pking visuals pick clxpost1234 --platform x --style default --variant 1

# Attach a library asset directly
pking visuals pick clxpost1234 --platform linkedin --asset clxasset5678

# Power-user: raw slot key (visible in --json output's _internal.slot field)
pking visuals pick clxpost1234 --platform x --slot slot16
```

On `400` errors, the server returns a list of valid styles which the CLI prints automatically:
```
ERROR: Invalid style/variant combination.
Valid styles for this post:
  - default
  - glass-morphism
  - neon-glow
```

---

### `pking visuals clear <postId>`
Clear the visual selection for a post on a given platform.
Wraps `PATCH /api/agent/v1/posts/{postId}/visuals` with `{ clear: true }`

```bash
pking visuals clear clxpost1234 --platform linkedin
```

---

### `pking visuals cards list <postId>`
Show the card data (number, title, body) attached to a post.
Wraps `GET /api/agent/v1/posts/{postId}/cards`

```bash
pking visuals cards list clxpost1234
pking visuals cards list clxpost1234 --json
```

---

### `pking visuals cards edit <postId>`
Edit a single card by 1-based index.
Wraps `PATCH /api/agent/v1/posts/{postId}/cards`

```bash
# Edit card 1's body
pking visuals cards edit clxpost1234 --card 1 --body "43% of devs flipped it on day one."

# Edit title + body and re-render visuals immediately
pking visuals cards edit clxpost1234 --card 2 --title "Shipped" --body "Dark mode is live." --rerender

# Update the stat number on card 3
pking visuals cards edit clxpost1234 --card 3 --number "2.4x"
```

---

### `pking visuals cards set <postId>`
Bulk-replace all cards from a JSON file.
Wraps `PATCH /api/agent/v1/posts/{postId}/cards`

```bash
# cards.json must be a JSON array: [{ "number": "1", "title": "...", "body": "..." }, ...]
pking visuals cards set clxpost1234 --file cards.json
pking visuals cards set clxpost1234 --file cards.json --rerender
```

---

### `pking visuals carousel <postId>`
Generate a multi-slide carousel PDF from the post's card data. Returns a downloadable PDF asset.
Wraps `POST /api/agent/v1/posts/{postId}/carousel`

```bash
pking visuals carousel clxpost1234
pking visuals carousel clxpost1234 --style glass-morphism --variant 2
pking visuals carousel clxpost1234 --title "Dark mode shipped" --style corporate-pro
pking visuals carousel clxpost1234 --json | jq '.asset.url'
```

---

## Typical Agent Workflow

```bash
# 1. Authenticate (human does this once)
pking login

# 2. Onboard a brand
pking onboard https://example.com --name "Acme"

# 3. Check connected socials
pking social check

# 4. Generate a LinkedIn post, add a visual, and schedule
pking posts generate --platform linkedin --variations 3 --theme "Product Launch"
pking visuals options <postId> --platform linkedin         # review options + best pick
pking visuals pick <postId> --platform linkedin --style glass-morphism --variant 1
pking posts approve <postId> --variation 2 --schedule "2026-04-10T09:00:00Z"

# 5. Repurpose a blog post to X and LinkedIn
pking repurpose --source-type url --source-url https://example.com/launch --target-type social --target-platforms x,linkedin

# 6. Fill the calendar for the next 2 weeks
pking posts generate-bulk --platform linkedin --frequency weekdays --days 14 --times "09:00"

# 7. Check the schedule
pking posts calendar --days 14

# 8. Check remaining credits
pking user credits
```
