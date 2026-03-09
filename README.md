# PostKing CLI (`pking`)

The PostKing CLI allows you to interact with the PostKing platform directly from your terminal. It covers content generation, editing, scheduling, and brand management.

## Installation / Setup

From the `packages/cli` directory, ensure dependencies are installed and the CLI is built:
```bash
npm install
npm run build
```
You can link the package globally to use the `pking` command anywhere:
```bash
npm link
```

## Global Options

- `-h, --help`: Display help for any command.

---

## Editor Commands (`pking editor`)

Utilities for rewriting, humanizing, and checking content.

### `pking editor rewrite`
Rewrite text using a specific voice profile or sharp human writing rules.
```bash
pking editor rewrite --text "Your text here" --voice <voice_id> --platform linkedin
```

### `pking editor humanize`
Apply LLM rewrite and BERT replacements to bypass AI detection.
```bash
pking editor humanize --text "Text to humanize"
```

---

## Posts Management (`pking posts`)

Commands to create, generate, and manage social media posts.

### `pking posts generate`
Use AI to generate a single post (deducts credits).
```bash
pking posts generate --platform linkedin --variations 3 --theme "My Theme" --voice <voice_id>
```
*Note: If `--theme` is omitted, the system will pick a random theme from your brand.*

### `pking posts generate-bulk`
Generate and schedule multiple posts across a date range.
```bash
pking posts generate-bulk --platform linkedin --frequency daily --posts-per-day 1 --times "09:00,14:00" --days 7 --voice <voice_id>
```

### `pking posts list`
List recent posts and drafts.
```bash
pking posts list --status scheduled --platform x --limit 10
```

### `pking posts calendar`
View an upcoming schedule of all automated posts.
```bash
pking posts calendar --days 14
```

### `pking posts approve <postId>`
Confirm a draft post and move it to the scheduling queue.
```bash
pking posts approve <postId> --variation 1 --schedule "2024-05-01T12:00:00Z"
```

### `pking posts reschedule <postId>`
Change the scheduled date/time for a post.
```bash
pking posts reschedule <postId> --date "2024-05-02T15:00:00Z"
```

### `pking posts cancel <postId>`
Cancel a scheduled post or unapprove a draft.

### `pking posts delete <postId>`
Soft delete a post.

### `pking posts view <postId>`
View the full content and details of a specific post.

---

## Voice Profiles (`pking voice`)

Manage and discover voice profiles for tone-matched content.

### `pking voice list`
List all available public voice profiles with their IDs.

### `pking voice rewrite`
Rewrite a piece of text using a specific voice profile.

---

## Social Accounts (`pking social`)

### `pking social check`
Check connected social media accounts for the current brand.

### `pking social connect <platform>`
Get an OAuth connection URL for a platform (e.g., x, linkedin).

### `pking social disconnect <accountId>`
Disconnect a social media account.

---

## Brand Onboarding (`pking onboard`)

### `pking onboard <websiteUrl>`
Quickly onboard a new brand by crawling its website and generating initial themes.
```bash
pking onboard https://postking.app --name "PostKing Agent"
```
