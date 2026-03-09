# PostKing CLI (`pking`)

The PostKing CLI lets you interact with the PostKing platform directly from your terminal or AI agent. It covers authentication, brand management, content generation, scheduling, repurposing, and more.

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
Generate new content themes using AI (deducts credits). Optionally provide instructions or source content.

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
Use AI to generate a post for a platform (deducts credits). Polls until complete and prints all variations.

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
Confirm a draft and move it to the scheduling queue.

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

### `pking posts reschedule <postId>`
Move a scheduled post to a new time.

```bash
pking posts reschedule clxpost1234 --date "2026-05-01T14:00:00Z"
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
pking voice rewrite --profile_id clxvoice1 --text "AI is changing marketing." --platform x

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
Apply LLM rewrite and BERT replacements to reduce AI detection signals.

```bash
pking editor humanize --text "Artificial intelligence is revolutionizing the marketing industry."
pking editor humanize --text "Our product leverages cutting-edge machine learning." --platform linkedin
```

### `pking editor ai-check`
Check if content is likely AI-generated.

```bash
pking editor ai-check --text "Artificial intelligence is revolutionizing how brands communicate."
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

## Typical AI Agent Workflow

```bash
# 1. Authenticate (human does this once)
pking login

# 2. Onboard a brand
pking onboard https://example.com --name "Acme"

# 3. Check connected socials
pking social check

# 4. Generate 3 LinkedIn posts and pick the best
pking posts generate --platform linkedin --variations 3 --theme "Product Launch"
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
