#!/usr/bin/env node

import { Command } from "commander";
import { loginWithPasswordCommand, meCommand, registerCommand } from "./commands/auth";
import { authorsCreateCommand, authorsListCommand, categoriesCreateCommand, categoriesListCommand } from "./commands/authors";
import { blogsCreateCommand, blogsDeleteCommand, blogsGenerateCommand, blogsListCommand, blogsPublishCommand, blogsStatusCommand, blogsViewCommand } from "./commands/blogs";
import { jobsListCommand } from "./commands/jobs";
import { brandCreateCommand, brandInfoCommand, brandListCommand, brandOnboardCommand, brandSetCommand, brandThemesCommand, brandThemesDeleteCommand, brandThemesEditCommand, brandThemesGenerateCommand } from "./commands/brand";
import { domainsAddCommand, domainsConnectCommand, domainsDeleteCommand } from "./commands/domains-extra";
import { domainsListCommand, domainsVerifyCommand } from "./commands/domains";
import { editorAICheckCommand, editorHumanizeCommand, editorRewriteCommand } from "./commands/editor";
import { keysCreateCommand, keysListCommand, keysRevokeCommand } from "./commands/keys";
import { loginCommand } from "./commands/login";
import { loginStartCommand, loginFinishCommand } from "./commands/auth-device";
import { logoutCommand } from "./commands/logout";
import {
  lpDeleteCommand,
  lpDraftViewCommand,
  lpEditCommand,
  lpGenerateCommand,
  lpListCommand,
  lpPublishCommand,
  lpRegenerateCommand,
  lpSetCommand,
  lpSideDeleteCommand,
  lpSideEditCommand,
  lpSideGenerateWithWaitCommand,
  lpSideListCommand,
  lpSideSectionCommand,
  lpSideStateCommand,
  lpSideStatusCommand,
  lpSideViewCommand,
  lpVersionsListCommand,
  lpVersionsViewCommand,
  lpVibeCommand,
  lpVibeStatusCommand,
  lpViewCommand,
} from "./commands/lp";
import { postsApproveCommand, postsCalendarCommand, postsCancelCommand, postsCreateCommand, postsDeleteCommand, postsGenerateBatchCommand, postsGenerateCommand, postsListCommand, postsRescheduleCommand, postsScheduleCommand, postsViewCommand } from "./commands/posts";
import { publicationsCreateCommand, publicationsListCommand } from "./commands/publications";
import { repurposeCommand } from "./commands/repurpose";
import { seoCategorizeCommand, seoClustersListCommand, seoClusterCommand, seoCompetitorCommand, seoGapCommand, seoGenerateCommand, seoKeywordsCommand, seoPublishCommand, seoRoadmapCommand, seoRoadmapDeleteCommand, seoRoadmapEditCommand, seoRoadmapViewCommand, seoSeedsCommand, seoStatsCommand, seoWriteCommand } from "./commands/seo";
import { socialConnectPlatformCommand } from "./commands/social-extra";
import { socialCheckCommand, socialConnectCommand, socialDisconnectCommand } from "./commands/social";
import { userCreditsCommand } from "./commands/user";
import { voiceListCommand, voiceRewriteCommand } from "./commands/voice";
import { trendsListCommand } from "./commands/trends";
import {
  visualsCardsEditCommand,
  visualsCardsListCommand,
  visualsCardsSetCommand,
  visualsCarouselCommand,
  visualsClearCommand,
  visualsDeleteCommand,
  visualsImportCsvCommand,
  visualsImportUrlCommand,
  visualsListCommand,
  visualsOptionsCommand,
  visualsPickCommand,
  visualsRegenerateCommand,
  visualsSearchStockCommand,
  visualsSuggestCommand,
  visualsTagCommand,
  visualsTagsCommand,
  visualsUploadCommand,
  visualsViewCommand,
} from "./commands/visuals";
import {
  weeklyScheduleDeleteCommand,
  weeklyScheduleDisableCommand,
  weeklyScheduleEnableCommand,
  weeklyScheduleGetCommand,
  weeklyScheduleRunDayCommand,
  weeklyScheduleSetCommand,
} from "./commands/weekly-schedule";

const program = new Command();

program
  .name("pking")
  .description(
    "PostKing — Programmatically manage brands, schedule posts, and control your marketing stack.\n" +
    "Designed for autonomous agents (Claude, OpenClaw, etc.) and power users."
  )
  .version("0.1.0")
  .addHelpText('after', `
Examples:
  $ pking login
  $ pking onboard https://vercel.com --name "Vercel Brand"
  $ pking brand list
  $ pking brand info
  $ pking brand set <brand_id>
  $ pking user credits
  $ pking social check
  $ pking social connect
  $ pking social disconnect x
  
Draft & Schedule:
  $ pking posts generate --platform x --theme "Sustainability" --count 3
  $ pking posts generate --platform custom:500 --theme "Short Post"
  $ pking posts list --status created
  $ pking posts approve <id>                                   # confirm -> auto-queue
  $ pking posts schedule <id> --date "2026-05-05T14:00:00Z"    # confirm + pin to time
  $ pking posts reschedule <id> --date "2026-05-06T10:00:00Z"  # move an already-scheduled post
  $ pking posts create --platform linkedin --content "Manual post content"
  $ pking posts create --platform custom:280 --content "Custom length post"

Manual Brand:
  $ pking brand create "My Design Studio" --tone "Professional & Minimal"

Repurpose:
  $ pking repurpose --source-type url --source-url https://example.com/blog --target-type social --target-platforms x,linkedin --voice my-voice-id
  $ pking repurpose --source-type text --source-content "Here is my thought" --target-type text --text-length custom:300

Visuals flow (generate → pick → cards → carousel → schedule):
  $ pking posts generate --platform linkedin --theme "Dark mode shipped"
  $ pking visuals options <postId> --platform linkedin               # browse options + best pick
  $ pking visuals pick <postId> --platform linkedin --style glass-morphism --variant 2
  $ pking visuals cards list <postId>
  $ pking visuals cards edit <postId> --card 1 --body "Updated stat." --rerender
  $ pking visuals carousel <postId> --style glass-morphism --variant 2
  $ pking posts schedule <postId> --date "2026-06-01T09:00:00Z"

Asset library:
  $ pking visuals list --type image --tags hero
  $ pking visuals upload --file ./banner.png --name "Q2 hero banner" --tags hero,q2
  $ pking visuals import-url https://example.com/hero.jpg --name "Site hero"
  $ pking visuals search-stock "dark empty office late night" --platform linkedin
  $ pking visuals suggest --context "product launch announcement"
`);

// ─── login ───────────────────────────────────────────────────────────────────
program
  .command("login")
  .description(
    "Authenticate with PostKing using the OAuth2 Device Authorization Flow.\n" +
    "The CLI will display a short code and URL for the human to visit, then poll\n" +
    "the server every 5 seconds until authorization is granted."
  )
  .action(loginCommand);

// ─── login-start / login-finish (agent-friendly, non-blocking) ──────────────
program
  .command("login-start")
  .description(
    "Start a device-flow login without polling. Prints the URL + user code,\n" +
    "saves the device_code locally, and exits immediately. Use this from\n" +
    "agent skills where a long-running poll would time out."
  )
  .action(loginStartCommand);

program
  .command("login-finish")
  .description(
    "Finish a previously-started device-flow login. Calls the token endpoint\n" +
    "ONCE; exits with status 2 if the user has not authorized yet (caller can\n" +
    "retry after the user confirms). Use after 'pking login-start'."
  )
  .action(loginFinishCommand);

// ─── logout ──────────────────────────────────────────────────────────────────
program
  .command("logout")
  .description("Clear locally stored credentials.")
  .action(logoutCommand);

// ─── brand ───────────────────────────────────────────────────────────────────
const brand = program
  .command("brand")
  .description("Manage brand workspaces. PostKing supports multiple brands per account.");

brand
  .command("list")
  .description("List all brands associated with your account.")
  .action(brandListCommand);

brand
  .command("info")
  .description("View detailed profile of the active brand (audience, tone, metrics).")
  .action(brandInfoCommand);

brand
  .command("generate-themes")
  .description("Generate new content themes for the active brand based on its profile or external input (deducts credits).")
  .option("--count <number>", "Number of themes to generate (default: 5)")
  .option("--instructions <text>", "Custom instructions for generation")
  .option("--input <path_or_text>", "Source content or file path to derive themes from")
  .action((options) => brandThemesGenerateCommand(options));

const themes = brand.command("themes")
  .description("Manage content themes.")
  .action(brandThemesCommand); // Default to list if just `themes` is typed

themes
  .command("list")
  .description("List all content themes.")
  .action(brandThemesCommand);

themes
  .command("edit <themeId>")
  .description("Edit an existing theme.")
  .option("--title <text>", "New title")
  .option("--content <text>", "New content instructions")
  .action((id, opts) => brandThemesEditCommand(id, opts));

themes
  .command("delete <themeId>")
  .description("Delete a theme.")
  .action((id) => brandThemesDeleteCommand(id));

brand
  .command("set <brandId>")
  .description("Set the active brand workspace for all subsequent commands.")
  .action(brandSetCommand);

brand
  .command("create <name>")
  .description("Manually create a brand without automatic crawling/onboarding.")
  .option("--description <desc>", "Optional brand description")
  .option("--website <url>", "Optional website URL")
  .option("--tone <tone>", "Initial tone description")
  .option("--audience <audience>", "Target audience description")
  .action((name: string, options: { description?: string, website?: string, tone?: string, audience?: string }) => brandCreateCommand(name, options));

// ─── onboard ─────────────────────────────────────────────────────────────────
program
  .command("onboard <websiteUrl>")
  .description("Quickly onboard a new brand by crawling its website and generating initial themes.")
  .option("--name <name>", "Optional custom name for the brand.")
  .action((url: string, options: { name?: string }) => brandOnboardCommand(url, options))
  .addHelpText('after', `
Example:
  $ pking onboard https://postking.app --name "PostKing Agent"
  
Note: This command will crawl the website, analyze the audience, 
      and generate 10 initial content themes automatically.
`);

// ─── posts ───────────────────────────────────────────────────────────────────
const posts = program
  .command("posts")
  .description("Create, list, and approve social media posts.");

posts
  .command("list")
  .description("List recent posts and drafts.")
  .option("--status <status>", "Filter by status: created, scheduled, posted")
  .option("--platform <platform>", "Filter by platform: x, linkedin, etc., or 'custom:<chars>'")
  .option("--limit <number>", "Number of posts to show (default: 10)", "10")
  .action((options) => postsListCommand(options));

posts
  .command("view <postId>")
  .description("View the full content and details of a specific post.")
  .action((id) => postsViewCommand(id));

posts
  .command("generate")
  .description("Generate a post with the core engine (deducts credits).")
  .requiredOption("--platform <platform>", "Target platform: x, linkedin, etc., or 'custom:<chars>'")
  .option("--theme <text>", "Specific theme or topic to write about (random if omitted)")
  .option("--variations <number>", "Number of variations to generate (default: 1)", "1")
  .option("--voice <profile_id>", "Voice profile ID to use (optional)")
  .action((options) => postsGenerateCommand(options));

posts
  .command("generate-bulk")
  .description("Generate and schedule multiple posts across a date range")
  .requiredOption("--platform <platform>", "Target platform (x, linkedin, etc., or 'custom:<chars>')")
  .option("--voice <profile_id>", "Optional Voice Profile ID to apply")
  .option("--frequency <freq>", "Posting frequency: daily, every_other, every_third, weekdays (default: daily)", "daily")
  .option("--posts-per-day <number>", "Number of posts per day (default: 1)", "1")
  .option("--times <times>", "Comma-separated posting times (default: 09:00,14:00)", "09:00,14:00")
  .option("--days <number>", "Number of days to schedule for (default: 7)", "7")
  .action((options) => postsGenerateBatchCommand(options));

posts
  .command("create")
  .description(
    "Manually create a social media post (draft).\n" +
    "To attach visuals, use 'pking visuals pick <postId> --platform <p>' after creation."
  )
  .requiredOption("--platform <platform>", "Target platform: x, linkedin, etc., or 'custom:<chars>'")
  .requiredOption("--content <text>", "The text body of the post")
  .option("--schedule <iso_date>", "ISO 8601 datetime to schedule the post")
  .action((options) => postsCreateCommand(options));

posts
  .command("approve <postId>")
  .description(
    "Confirm a draft post. Without --schedule it joins the automated queue;\n" +
    "with --schedule it is pinned to that time. Use 'pking posts schedule' if\n" +
    "you want the scheduling intent to be explicit."
  )
  .option("--variation <number>", "Select a specific variation to publish (1-based index)")
  .option("--schedule <iso_date>", "ISO 8601 datetime to schedule the post (otherwise queued)")
  .option("--timezone <string>", "User timezone (e.g. America/New_York)")
  .action((id, options) => postsApproveCommand(id, options));

posts
  .command("schedule <postId>")
  .description("Confirm a draft post and pin it to a specific date/time (requires --date).")
  .requiredOption("--date <iso_date>", "ISO 8601 datetime to post at, e.g. 2026-05-05T14:00:00+02:00")
  .option("--variation <number>", "Select a specific variation to publish (1-based index)")
  .option("--timezone <string>", "User timezone (e.g. America/New_York)")
  .action((id, options) => postsScheduleCommand(id, options));

posts
  .command("calendar")
  .description("View an upcoming schedule of all automated posts.")
  .option("--days <number>", "Number of days ahead to view (default 14)")
  .action((options) => postsCalendarCommand(options));

posts
  .command("cancel <postId>")
  .description("Cancel a scheduled post or unapprove a draft.")
  .action((id) => postsCancelCommand(id));

posts
  .command("reschedule <postId>")
  .description("Change the scheduled date/time for a post.")
  .requiredOption("--date <iso_date>", "New ISO 8601 datetime")
  .action((id, options) => postsRescheduleCommand(id, options));

posts
  .command("delete <postId>")
  .description("Soft delete a post.")
  .action((id) => postsDeleteCommand(id));

// ─── user ────────────────────────────────────────────────────────────────────
const userSub = program
  .command("user")
  .description("Manage your user account and credits.");

userSub
  .command("credits")
  .description("Check your current credit balance.")
  .action(userCreditsCommand);

// ─── social ──────────────────────────────────────────────────────────────────
const social = program
  .command("social")
  .description("Check social media account connections for the active brand.");

social
  .command("check")
  .description(
    "List all connected (and disconnected) social media accounts for the active brand.\n" +
    "Agents should run this before posting to confirm platform availability."
  )
  .action(socialCheckCommand);

social
  .command("connect")
  .description("Generate a secure magic link to connect social media accounts in your browser.")
  .action(socialConnectCommand);

social
  .command("disconnect <platform_or_id>")
  .description("Disconnect a social media account by platform name (x, linkedin, etc.) or account ID.")
  .action((id) => socialDisconnectCommand(id));

// ─── voice ───────────────────────────────────────────────────────────────────
const voice = program
  .command("voice")
  .description("Discover and use voice profiles for tone-matched content.");

voice
  .command("list")
  .description("List all available public voice profiles with their IDs, descriptions, and supported platforms.")
  .option("--platform <platform>", "Filter by supported platform (x, linkedin, threads, blog, lp)")
  .option("--filter <filter>", "Filter by voice type: 'shallow' or 'deep'")
  .action((options) =>
    voiceListCommand({
      platform: options.platform,
      filter: options.filter,
    })
  );

voice
  .command("rewrite")
  .description("Rewrite a piece of text using a specific voice profile.")
  .requiredOption("--profile_id <id>", "Voice profile ID to apply (from 'pking voice list')")
  .requiredOption("--text <text>", "The text to rewrite in the profile's voice")
  .option(
    "--platform <platform>",
    "Target platform context for tone adjustment (x, linkedin, etc., or 'custom:<chars>')"
  )
  .action((options) =>
    voiceRewriteCommand({
      profileId: options.profile_id,
      text: options.text,
      platform: options.platform,
    })
  );

// ─── trends ──────────────────────────────────────────────────────────────────
const trends = program
  .command("trends")
  .description("Browse cross-niche trending posts crawled by PostKing (refreshed every 3 days).");

trends
  .command("list")
  .description(
    "List the top trending posts for a niche on a platform.\n" +
    "Niches: ai-saas | marketing | web3. Platforms: x (more coming).\n" +
    "Wraps GET /api/agent/v1/trends"
  )
  .option("--niche <niche>", "ai-saas | marketing | web3 (default: ai-saas)")
  .option("--platform <platform>", "Platform to pull trends from (default: x)")
  .option("--days <n>", "Crawl window in days, max 30 (default: 3)")
  .option("--limit <n>", "Max posts to return, max 50 (default: 20)")
  .option("--sort <sort>", "engagement | recent (default: engagement)")
  .option("--json", "Emit raw JSON payload (includes hook/template/pattern deconstruction)")
  .action((opts) => trendsListCommand(opts));

// ─── domains ─────────────────────────────────────────────────────────────────
const domains = program
  .command("domains")
  .description("Manage and verify custom domains attached to the active brand.");

domains
  .command("list")
  .description("List all custom domains configured for the active brand.")
  .action(domainsListCommand);

domains
  .command("verify <domain>")
  .description(
    "Trigger DNS verification for a domain and display the required TXT record\n" +
    "if the domain is not yet verified. The human must add this record at their registrar."
  )
  .action(domainsVerifyCommand);

// ─── weekly-schedule ─────────────────────────────────────────────────────────
const weekly = program
  .command("weekly-schedule")
  .description("Manage the automated weekly content schedule for the active brand.");

weekly
  .command("get")
  .description("Show the current weekly schedule (or suggested defaults if unset).")
  .action(weeklyScheduleGetCommand);

weekly
  .command("set")
  .description(
    "Create or update the weekly schedule. Use per-day flags with\n" +
    "'<medium>:<postsPerDay>[,<medium>:<postsPerDay>...]'. Pass an empty string\n" +
    "to clear a day (e.g. --tuesday \"\")."
  )
  .option("--monday <spec>",    "Monday mediums,   e.g. \"linkedin:1,x:1\"")
  .option("--tuesday <spec>",   "Tuesday mediums")
  .option("--wednesday <spec>", "Wednesday mediums")
  .option("--thursday <spec>",  "Thursday mediums")
  .option("--friday <spec>",    "Friday mediums")
  .option("--saturday <spec>",  "Saturday mediums")
  .option("--sunday <spec>",    "Sunday mediums")
  .option("--timezone <tz>",    "IANA timezone, e.g. America/New_York")
  .option("--lead-time <days>", "Lead time in days (1-7)")
  .option("--voice <id>",       "Default voice profile id")
  .option("--enable",           "Enable the schedule after saving")
  .option("--disable",          "Disable the schedule after saving")
  .action((options) => weeklyScheduleSetCommand(options));

weekly
  .command("enable")
  .description("Enable the weekly schedule (requires one to exist).")
  .action(weeklyScheduleEnableCommand);

weekly
  .command("disable")
  .description("Pause the weekly schedule without deleting it.")
  .action(weeklyScheduleDisableCommand);

weekly
  .command("delete")
  .description("Remove the weekly schedule entirely. Existing drafts remain.")
  .action(weeklyScheduleDeleteCommand);

weekly
  .command("run-day")
  .description("Run smart-week generation for a single date (YYYY-MM-DD).")
  .requiredOption("--date <YYYY-MM-DD>", "Target date")
  .action((options) => weeklyScheduleRunDayCommand(options));

// ─── editor ──────────────────────────────────────────────────────────────────
const editor = program
  .command("editor")
  .description("Utilities for rewriting, humanizing, and checking content.");

editor
  .command("rewrite")
  .description("Rewrite text using a specific voice profile or sharp human writing rules.")
  .requiredOption("--text <text>", "The text to rewrite")
  .option("--voice <id>", "Voice profile ID to apply")
  .option("--platform <platform>", "Target platform (x, linkedin, etc., or 'custom:<chars>')")
  .action((options) => editorRewriteCommand(options));

editor
  .command("humanize")
  .description("Rewrite text to read as natural, human-written prose and reduce machine-generated signals.")
  .requiredOption("--text <text>", "The text to humanize")
  .option("--platform <platform>", "Target platform (x, linkedin, etc., or 'custom:<chars>')")
  .action((options) => editorHumanizeCommand(options));

editor
  .command("detect")
  .description("Analyze text and report the likelihood that it was machine-generated.")
  .requiredOption("--text <text>", "The text to analyze")
  .action((options) => editorAICheckCommand(options));

// ─── repurpose ───────────────────────────────────────────────────────────────
program
  .command("repurpose")
  .description("Repurpose an external link, text, or existing PostKing post into new content.")
  .requiredOption("--source-type <type>", "Source type: url, text, blog, social_post")
  .option("--source-url <url>", "Source URL")
  .option("--source-content <text>", "Source text content")
  .option("--source-blog <id>", "Source blog ID")
  .option("--source-post <id>", "Source post ID")
  .requiredOption("--target-type <type>", "Target type: social, blog, text")
  .option("--target-platforms <platforms>", "Target platforms comma-separated (x,linkedin,facebook,threads)")
  .option("--variations <number>", "Number of variations per platform")
  .option("--angle <angle>", "Specific angle or focus")
  .option("--specific-goal <goal>", "Specific goal for the content")
  .option("--text-length <length>", "Length if target is text: short, medium, long, custom:<words>")
  .option("--voice <profile_id_or_map>", "Voice profile ID (e.g. 123 or x:123,linkedin:456)")
  .option("--theme-id <id>", "Theme ID to associate when repurposing")
  .option("--include-link", "Whether to explicitly include the source link in the generated post")
  .action((options) => repurposeCommand(options));

// ─── register / login (email+password) / me ──────────────────────────────────
program
  .command("register")
  .description("Register a new PostKing account via email+password. Triggers a magic-link confirmation.")
  .requiredOption("--email <email>", "Email address")
  .requiredOption("--password <password>", "Password")
  .option("--client-name <name>", "Display name for the issued API key", "pking-cli")
  .action((opts) => registerCommand({
    email: opts.email,
    password: opts.password,
    clientName: opts.clientName,
  }));

program
  .command("login-password")
  .description("Log in with an existing PostKing email+password (magic-link confirmation).")
  .requiredOption("--email <email>", "Email address")
  .requiredOption("--password <password>", "Password")
  .option("--client-name <name>", "Display name for the issued API key", "pking-cli")
  .action((opts) => loginWithPasswordCommand({
    email: opts.email,
    password: opts.password,
    clientName: opts.clientName,
  }));

program
  .command("me")
  .description("Show the active session (user, key scope, credits, free-tier remaining, brands).")
  .action(meCommand);

// ─── keys ────────────────────────────────────────────────────────────────────
const keys = program.command("keys").description("Manage API keys.");

keys.command("list").description("List all API keys on your account.").action(keysListCommand);

keys
  .command("create")
  .description("Create a new API key (returns the raw token ONCE).")
  .option("--name <name>", "Human-friendly name, e.g. 'Claude Desktop'")
  .option("--scope <scope>", "'read' or 'write' (default write)", "write")
  .action((opts) => keysCreateCommand(opts));

keys
  .command("revoke <keyId>")
  .description("Revoke an API key by ID.")
  .action((id) => keysRevokeCommand(id));

// ─── blogs ───────────────────────────────────────────────────────────────────
const blogs = program.command("blogs").description("Manage blog articles.");

blogs
  .command("list")
  .description("List publications and articles for the active brand.")
  .option("--status <status>", "Filter articles by status (draft, published)")
  .action((opts) => blogsListCommand(opts));

blogs
  .command("create")
  .description("Create a new blog publication.")
  .requiredOption("--title <title>", "Publication name")
  .option("--description <desc>", "Description")
  .action((opts) => blogsCreateCommand(opts));

blogs
  .command("generate")
  .description("Generate a new blog article (deducts credits).")
  .requiredOption("--publication <id>", "Publication ID")
  .requiredOption("--topic <topic>", "Topic or working title")
  .option("--voice <id>", "Voice profile ID")
  .option("--length <length>", "short | medium | long", "medium")
  .option("--keywords <csv>", "Comma-separated primary keywords")
  .option("--wait", "Block and poll until the article is ready")
  .option("--timeout <seconds>", "Max seconds to wait when --wait is set", "600")
  .action((opts) => blogsGenerateCommand(opts));

blogs
  .command("status <articleId>")
  .description("Show the live generation status of an article.")
  .action((id) => blogsStatusCommand(id));

blogs
  .command("publish <articleId>")
  .description("Publish an article (free-tier choke point).")
  .option("--connections <csv>", "Comma-separated external connection IDs")
  .action((id, opts) => blogsPublishCommand(id, opts));

blogs
  .command("view <articleId>")
  .description("View full article content.")
  .action((id) => blogsViewCommand(id));

blogs
  .command("delete <articleId>")
  .description("Delete a blog article.")
  .action((id) => blogsDeleteCommand(id));

// ─── jobs ────────────────────────────────────────────────────────────────────
const jobs = program.command("jobs").description("Inspect async background jobs (blog generation, etc.).");
jobs
  .command("list")
  .description("List active and recent jobs for the active brand.")
  .option("--status <status>", "Filter (running, completed, failed, …)")
  .option("--limit <n>", "Max rows (default 50)")
  .action((opts) => jobsListCommand(opts));

// ─── publications / authors / categories ─────────────────────────────────────
const publications = program.command("publications").description("Manage blog publications.");
publications.command("list").action(publicationsListCommand);
publications
  .command("create")
  .requiredOption("--title <title>")
  .option("--description <desc>")
  .action((opts) => publicationsCreateCommand(opts));

const authors = program.command("authors").description("Manage blog authors.");
authors.command("list").action(authorsListCommand);
authors
  .command("create")
  .requiredOption("--first-name <name>")
  .requiredOption("--last-name <name>")
  .option("--email <email>")
  .action((opts) => authorsCreateCommand({
    firstName: opts.firstName,
    lastName: opts.lastName,
    email: opts.email,
  }));

const categories = program.command("categories").description("Manage blog categories.");
categories
  .command("list")
  .requiredOption("--publication <id>")
  .action((opts) => categoriesListCommand(opts));
categories
  .command("create")
  .requiredOption("--publication <id>")
  .requiredOption("--name <name>")
  .requiredOption("--slug <slug>")
  .option("--description <desc>")
  .action((opts) => categoriesCreateCommand(opts));

// ─── landing pages ───────────────────────────────────────────────────────────
const lp = program.command("lp").description("Manage landing pages.");

lp.command("list").action(lpListCommand);
lp
  .command("generate")
  .description("Generate a new landing page (deducts credits).")
  .requiredOption("--topic <topic>", "Topic or theme for the landing page")
  .option("--slug <slug>", "Custom URL slug")
  .option("--voice <id>", "Voice profile ID")
  .action((opts) => lpGenerateCommand(opts));
lp
  .command("edit <slug>")
  .description("Update landing page metadata or trigger an AI edit pass.")
  .option("--title <title>", "New title")
  .option("--instructions <text>", "AI editing instructions")
  .action((slug, opts) => lpEditCommand(slug, opts));
lp
  .command("publish <slug>")
  .description("Publish a landing page publicly.")
  .action((slug) => lpPublishCommand(slug));
lp
  .command("view <slug>")
  .description("View landing page content and status.")
  .action((slug) => lpViewCommand(slug));
lp
  .command("delete <slug>")
  .description("Permanently delete a landing page.")
  .option("--destructive", "Required confirmation flag")
  .option("--json", "Emit raw JSON payload")
  .action((slug, opts) => lpDeleteCommand(slug, opts));

const lpSide = lp.command("side").description("Manage side-pages of a landing page.");
lpSide
  .command("list <slug>")
  .description("List all side-pages for a landing page.")
  .option("--json", "Emit raw JSON payload")
  .action((slug, opts) => lpSideListCommand(slug, opts));
lpSide
  .command("generate <slug>")
  .description("Generate new side-pages for a landing page (deducts credits).")
  .requiredOption("--type <type>", "Side-page type (e.g. 'feature', 'pricing')")
  .option("--count <n>", "How many to generate")
  .option("--wait", "Poll until generation completes (up to 5 min)")
  .option("--json", "Emit raw JSON payload")
  .action((slug, opts) => lpSideGenerateWithWaitCommand(slug, opts));
lpSide
  .command("edit <slug> <sideKey>")
  .description("Edit a side-page via AI instructions.")
  .option("--instructions <text>", "AI editing instructions")
  .action((slug, sideKey, opts) => lpSideEditCommand(slug, sideKey, opts));
lpSide
  .command("view <slug> <sideKey>")
  .description("View a side-page's content, status, and section IDs.")
  .option("--json", "Emit raw JSON payload")
  .action((slug, sideKey, opts) => lpSideViewCommand(slug, sideKey, opts));
lpSide
  .command("delete <slug> <sideKey>")
  .description("Permanently delete a side-page.")
  .option("--destructive", "Required confirmation flag")
  .option("--json", "Emit raw JSON payload")
  .action((slug, sideKey, opts) => lpSideDeleteCommand(slug, sideKey, opts));

lpSide
  .command("section <slug> <sideKey>")
  .description("Update a single section within a side-page.")
  .requiredOption("--id <sectionId>", "Section ID to update")
  .option("--content <text>", "New section content (inline)")
  .option("--file <path>", "Path to file with section content (use - for stdin)")
  .option("--instructions <text>", "AI editing instructions for the section")
  .option("--json", "Emit raw JSON payload")
  .action((slug, sideKey, opts) => lpSideSectionCommand(slug, sideKey, opts));

lpSide
  .command("state <slug> <sideKey>")
  .description("Publish or unpublish a side-page.")
  .option("--publish", "Publish the side-page")
  .option("--unpublish", "Unpublish the side-page")
  .option("--json", "Emit raw JSON payload")
  .action((slug, sideKey, opts) => lpSideStateCommand(slug, sideKey, opts));

lpSide
  .command("status <slug> <operationId>")
  .description("Check the generation status of a side-page operation.")
  .option("--json", "Emit raw JSON payload")
  .action((slug, operationId, opts) => lpSideStatusCommand(slug, operationId, opts));

// ─── lp regenerate ───────────────────────────────────────────────────────────
lp
  .command("regenerate <slug>")
  .description("Regenerate a landing page (deducts credits).")
  .option("--voice <id>", "Voice profile ID to apply")
  .option("--instructions <text>", "Optional instructions for regeneration")
  .option("--section <id>", "Section(s) to regenerate (repeatable)", (v, prev: string[]) => [...prev, v], [] as string[])
  .option("--json", "Emit raw JSON payload")
  .action((slug, opts) => lpRegenerateCommand(slug, opts));

// ─── lp vibe ─────────────────────────────────────────────────────────────────
const lpVibe = lp
  .command("vibe")
  .description("AI vibe-edit a landing page or check vibe-edit status.")
  .argument("<slug>", "Landing page slug to vibe-edit")
  .requiredOption("--instructions <text>", "What to change about the landing page")
  .option("--scope <scope>", "Edit scope: full | section")
  .option("--section-id <id>", "Section ID (required when --scope=section)")
  .option("--wait", "Poll until the edit completes (up to 120s)")
  .option("--json", "Emit raw JSON payload")
  .action((slug: string, opts: { instructions: string; scope?: string; sectionId?: string; wait?: boolean; json?: boolean }) =>
    lpVibeCommand(slug, {
      instructions: opts.instructions,
      scope: opts.scope,
      sectionId: opts.sectionId,
      wait: opts.wait,
      json: opts.json,
    }),
  );

lpVibe
  .command("status <slug> <operationId>")
  .description("Check the status of a vibe-edit operation.")
  .option("--json", "Emit raw JSON payload")
  .action((slug, operationId, opts) => lpVibeStatusCommand(slug, operationId, opts));

// ─── lp set ───────────────────────────────────────────────────────────────────
lp
  .command("set <slug>")
  .description("Manually set landing page content, title, and/or metadata (no AI).")
  .option("--title <text>", "New title for the landing page")
  .option("--file <path>", "Path to markdown/HTML file for content (use - for stdin)")
  .option("--metadata-file <path>", "Path to JSON file with metadata fields")
  .option("--json", "Emit raw JSON payload")
  .action((slug, opts) => lpSetCommand(slug, {
    title: opts.title as string | undefined,
    file: opts.file as string | undefined,
    metadataFile: opts.metadataFile as string | undefined,
    json: opts.json as boolean | undefined,
  }));

// ─── lp versions ─────────────────────────────────────────────────────────────
const lpVersions = lp
  .command("versions")
  .description("Manage landing page versions.");

lpVersions
  .command("list <slug>")
  .description("List all versions of a landing page.")
  .option("--json", "Emit raw JSON payload")
  .action((slug, opts) => lpVersionsListCommand(slug, opts));

lpVersions
  .command("view <slug> <versionId>")
  .description("View a specific version of a landing page (versionId is numeric).")
  .option("--json", "Emit raw JSON payload")
  .action((slug, versionId, opts) => lpVersionsViewCommand(slug, versionId, opts));

// ─── lp draft ────────────────────────────────────────────────────────────────
const lpDraft = lp
  .command("draft")
  .description("Manage landing page drafts.");

lpDraft
  .command("view <slug>")
  .description("View the current draft of a landing page.")
  .option("--json", "Emit raw JSON payload")
  .action((slug, opts) => lpDraftViewCommand(slug, opts));

// ─── domains extras (add, delete, connect) ───────────────────────────────────
domains
  .command("add <domain>")
  .description("Add a custom domain to the active brand.")
  .action((d) => domainsAddCommand(d));
domains
  .command("delete <id>")
  .description("Remove a domain by ID.")
  .action((id) => domainsDeleteCommand(id));
domains
  .command("connect <id>")
  .description("Connect a verified domain to a landing page or publication.")
  .requiredOption("--target <target>", "e.g. 'lp:my-slug' or 'publication:<id>'")
  .action((id, opts) => domainsConnectCommand(id, opts));

// ─── SEO ─────────────────────────────────────────────────────────────────────
const seo = program.command("seo").description("Run the PostKing SEO agentic pipeline end-to-end.");

seo
  .command("seeds <seeds...>")
  .description("Add seed keywords to start the SEO flow.")
  .option("--brand <id>")
  .action((seeds, opts) => seoSeedsCommand(seeds, opts));

seo
  .command("generate")
  .description("Expand seeds into a larger keyword universe.")
  .option("--brand <id>")
  .option("--count <n>", "Number of keywords to generate", "100")
  .action((opts) => seoGenerateCommand(opts));

seo
  .command("keywords")
  .description("List generated keywords.")
  .option("--brand <id>")
  .option("--limit <n>", "Limit results")
  .option("--json", "Emit raw JSON payload")
  .action((opts) => seoKeywordsCommand(opts));

seo
  .command("categorize")
  .description("Auto-categorize keywords by intent.")
  .option("--brand <id>")
  .action((opts) => seoCategorizeCommand(opts));

seo
  .command("cluster")
  .description("Cluster related keywords into topic groups.")
  .option("--brand <id>")
  .action((opts) => seoClusterCommand(opts));

const seoRoadmap = seo
  .command("roadmap")
  .description("List roadmap items or generate a roadmap from a cluster. Also includes item-level CRUD subcommands.")
  .option("--brand <id>")
  .option("--cluster <id>", "Cluster ID to generate roadmap from")
  .option("--items <n>", "Number of items to generate")
  .option("--limit <n>", "Cap number of items shown")
  .option("--json", "Emit raw JSON payload")
  .action((opts) => seoRoadmapCommand(opts));

seoRoadmap
  .command("view <id>")
  .description("View a single roadmap item by ID.")
  .option("--brand <id>")
  .option("--json", "Emit raw JSON payload")
  .action((id, opts) => seoRoadmapViewCommand(id, opts));

seoRoadmap
  .command("edit <id>")
  .description("Edit a roadmap item's title, status, or priority.")
  .option("--brand <id>")
  .option("--title <title>", "New title")
  .option("--status <status>", "New status (e.g. active, paused, done)")
  .option("--priority <n>", "Priority score (integer)")
  .option("--json", "Emit raw JSON payload")
  .action((id, opts) => seoRoadmapEditCommand(id, opts));

seoRoadmap
  .command("delete <id>")
  .description("Permanently delete a roadmap item.")
  .option("--brand <id>")
  .option("--destructive", "Required confirmation flag")
  .option("--json", "Emit raw JSON payload")
  .action((id, opts) => seoRoadmapDeleteCommand(id, opts));

const seoClusters = seo
  .command("clusters")
  .description("View SEO keyword clusters.");

seoClusters
  .command("list")
  .description("List all clusters for the active brand.")
  .option("--brand <id>")
  .option("--json", "Emit raw JSON payload")
  .action((opts) => seoClustersListCommand(opts));

seo
  .command("write")
  .description("Generate articles from roadmap items.")
  .option("--brand <id>")
  .requiredOption("--roadmap-id <id>", "Roadmap item ID")
  .option("--count <n>", "Number of articles", "1")
  .action((opts) => seoWriteCommand(opts));

seo
  .command("gap")
  .description("Run a gap analysis against competitors.")
  .option("--brand <id>")
  .option("--json", "Emit raw JSON payload")
  .action((opts) => seoGapCommand(opts));

seo
  .command("competitor")
  .description("Diff your SEO coverage against a competitor domain.")
  .option("--brand <id>")
  .requiredOption("--domain <domain>")
  .option("--json", "Emit raw JSON payload")
  .action((opts) => seoCompetitorCommand(opts));

seo
  .command("publish")
  .description("Publish a roadmap-generated article.")
  .option("--brand <id>")
  .requiredOption("--article-id <id>")
  .option("--publication <id>")
  .option("--schedule <iso>", "ISO 8601 datetime")
  .action((opts) => seoPublishCommand(opts));

seo
  .command("stats")
  .description("Show roadmap progress stats.")
  .option("--brand <id>")
  .option("--json", "Emit raw JSON payload")
  .action((opts) => seoStatsCommand(opts));

// ─── visuals ─────────────────────────────────────────────────────────────────
const visuals = program
  .command("visuals")
  .description(
    "Manage the brand asset library and attach visuals to posts.\n" +
    "Library commands operate on GET/POST/PATCH/DELETE /api/agent/v1/brands/{brandId}/assets.\n" +
    "Post-scoped commands operate on GET/POST/PATCH /api/agent/v1/posts/{postId}/visuals."
  );

// ── library ──────────────────────────────────────────────────────────────────
visuals
  .command("list")
  .description(
    "List assets in the brand library.\n" +
    "Wraps GET /api/agent/v1/brands/{brandId}/assets"
  )
  .option("--type <type>", "Filter by type: image | video | document | link | lottie")
  .option("--tags <csv>", "Comma-separated tag filter (e.g. hero,q2)")
  .option("--search <query>", "Full-text search query")
  .option("--limit <n>", "Maximum number of results")
  .option("--json", "Emit raw JSON payload")
  .action((opts) => visualsListCommand(opts));

visuals
  .command("view <assetId>")
  .description(
    "Show full metadata for a single asset.\n" +
    "Wraps GET /api/agent/v1/brands/{brandId}/assets/{assetId}"
  )
  .option("--json", "Emit raw JSON payload")
  .action((id, opts) => visualsViewCommand(id, opts));

visuals
  .command("upload")
  .description(
    "Upload a local file to the brand asset library (requires Node 18+).\n" +
    "Wraps POST /api/agent/v1/brands/{brandId}/assets (multipart)"
  )
  .requiredOption("--file <path>", "Path to the local file to upload")
  .option("--name <name>", "Display name for the asset")
  .option("--description <desc>", "Description of the asset")
  .option("--tags <csv>", "Comma-separated tags to attach")
  .option("--json", "Emit raw JSON payload")
  .action((opts) => visualsUploadCommand(opts));

visuals
  .command("import-url <url>")
  .description(
    "Import a remote URL as an asset in the brand library.\n" +
    "Wraps POST /api/agent/v1/brands/{brandId}/assets (JSON body)"
  )
  .option("--name <name>", "Display name for the asset")
  .option("--tags <csv>", "Comma-separated tags to attach")
  .option("--json", "Emit raw JSON payload")
  .action((url, opts) => visualsImportUrlCommand(url, opts));

visuals
  .command("import-csv <file>")
  .description(
    "Batch-import up to 50 URLs from a file (one URL per line or a JSON array).\n" +
    "Wraps POST /api/agent/v1/brands/{brandId}/assets/import-urls"
  )
  .option("--json", "Emit raw JSON payload")
  .action((file, opts) => visualsImportCsvCommand(file, opts));

visuals
  .command("tag <assetId>")
  .description(
    "Add or remove tags on an existing asset.\n" +
    "Wraps PATCH /api/agent/v1/brands/{brandId}/assets/{assetId}"
  )
  .option("--add <csv>", "Comma-separated tags to add")
  .option("--remove <csv>", "Comma-separated tags to remove")
  .option("--json", "Emit raw JSON payload")
  .action((id, opts) => visualsTagCommand(id, opts));

visuals
  .command("delete <assetId>")
  .description(
    "Soft-delete (deactivate) an asset from the library.\n" +
    "Wraps DELETE /api/agent/v1/brands/{brandId}/assets/{assetId}"
  )
  .option("--json", "Emit raw JSON payload")
  .action((id, opts) => visualsDeleteCommand(id, opts));

visuals
  .command("tags")
  .description(
    "List all tags used across the brand asset library.\n" +
    "Wraps GET /api/agent/v1/brands/{brandId}/assets/tags"
  )
  .option("--json", "Emit raw JSON payload")
  .action((opts) => visualsTagsCommand(opts));

visuals
  .command("suggest")
  .description(
    "Get asset suggestions from the library that match a context string.\n" +
    "Wraps GET /api/agent/v1/brands/{brandId}/assets/suggestions"
  )
  .requiredOption("--context <text>", "Context or caption to match against (e.g. 'dark mode launch')")
  .option("--limit <n>", "Maximum suggestions to return")
  .option("--json", "Emit raw JSON payload")
  .action((opts) => visualsSuggestCommand(opts));

visuals
  .command("search-stock <query>")
  .description(
    "Search Unsplash + Pexels for stock photos or videos matching a query.\n" +
    "Wraps POST /api/agent/v1/brands/{brandId}/assets/search-stock"
  )
  .option("--platform <platform>", "Platform context for aspect-ratio hints: x | linkedin | instagram | …")
  .option("--json", "Emit raw JSON payload")
  .action((query, opts) => visualsSearchStockCommand(query, opts));

// ── post-scoped picker ────────────────────────────────────────────────────────
visuals
  .command("options <postId>")
  .description(
    "Browse all visual options for a post: library matches, card templates, quote templates,\n" +
    "stock photos, and stock videos. Prints a Best Pick banner in human mode.\n" +
    "Wraps GET /api/agent/v1/posts/{postId}/visuals"
  )
  .option("--platform <platform>", "Filter to a single platform (x | linkedin | instagram | …)")
  .option("--category <cat>", "Filter by category: smart | card | quote | photo | video")
  .option("--json", "Emit raw JSON payload (preserves _internal.slot for power-user pipelines)")
  .action((id, opts) => visualsOptionsCommand(id, opts));

visuals
  .command("regenerate <postId>")
  .description(
    "Regenerate all visual options for a post (re-runs the asset options engine).\n" +
    "Wraps POST /api/agent/v1/posts/{postId}/visuals/regenerate"
  )
  .option("--load-external", "Also fetch fresh Unsplash/Pexels stock results")
  .option("--platform <platform>", "Regenerate for a specific platform only")
  .option("--json", "Emit raw JSON payload")
  .action((id, opts) => visualsRegenerateCommand(id, { ...opts, loadExternal: opts.loadExternal as boolean | undefined }));

visuals
  .command("pick <postId>")
  .description(
    "Select a visual for a post on a given platform.\n" +
    "Recommended: pass --pick <N> after running 'pking visuals options' to choose by index.\n" +
    "Power users: pass --style + optional --variant for a card/quote template,\n" +
    "--asset for a library asset, or --slot for a raw slot key.\n" +
    "Wraps PATCH /api/agent/v1/posts/{postId}/visuals"
  )
  .requiredOption("--platform <platform>", "Target platform (x | linkedin | instagram | …)")
  .option("--pick <n>", "1-based index from the most recent 'pking visuals options' run (uses ~/.postking/cache)")
  .option("--style <style>", "Template style name — power user (e.g. glass-morphism, default, neon-glow)")
  .option("--variant <n>", "1-based variant number within the style — power user")
  .option("--asset <assetId>", "Library asset ID to attach directly — power user")
  .option("--slot <slotKey>", "Raw slot key (e.g. slot16) — power-user override")
  .option("--json", "Emit raw JSON payload")
  .action((id, opts) => visualsPickCommand(id, opts));

visuals
  .command("clear <postId>")
  .description(
    "Clear the selected visual for a post on a given platform.\n" +
    "Wraps PATCH /api/agent/v1/posts/{postId}/visuals with { clear: true }"
  )
  .requiredOption("--platform <platform>", "Target platform to clear the selection on")
  .option("--json", "Emit raw JSON payload")
  .action((id, opts) => visualsClearCommand(id, opts));

// ── cards + carousel ──────────────────────────────────────────────────────────
const cards = visuals
  .command("cards")
  .description("Read and update the card data embedded in a post (used by carousel templates).");

cards
  .command("list <postId>")
  .description(
    "List the card data (number, title, body) attached to a post.\n" +
    "Wraps GET /api/agent/v1/posts/{postId}/cards"
  )
  .option("--json", "Emit raw JSON payload")
  .action((id, opts) => visualsCardsListCommand(id, opts));

cards
  .command("edit <postId>")
  .description(
    "Edit a single card by 1-based index. Fetches the full card list, patches the target card,\n" +
    "and writes back the complete array.\n" +
    "Wraps PATCH /api/agent/v1/posts/{postId}/cards"
  )
  .requiredOption("--card <n>", "1-based card index to edit")
  .option("--title <text>", "New card title")
  .option("--body <text>", "New card body text")
  .option("--number <text>", "Stat or number to display on the card")
  .option("--rerender", "Re-render visual assets after the update")
  .option("--json", "Emit raw JSON payload")
  .action((id, opts) => visualsCardsEditCommand(id, opts));

cards
  .command("set <postId>")
  .description(
    "Bulk-replace all cards from a JSON file. The file must be a JSON array of\n" +
    "{ number?, title?, body? } objects.\n" +
    "Wraps PATCH /api/agent/v1/posts/{postId}/cards"
  )
  .requiredOption("--file <path>", "Path to a JSON file containing a cards array")
  .option("--rerender", "Re-render visual assets after the update")
  .option("--json", "Emit raw JSON payload")
  .action((id, opts) => visualsCardsSetCommand(id, opts));

visuals
  .command("carousel <postId>")
  .description(
    "Generate a multi-slide carousel PDF from the post's card data.\n" +
    "Returns a downloadable PDF asset.\n" +
    "Wraps POST /api/agent/v1/posts/{postId}/carousel"
  )
  .option("--style <style>", "Carousel template style (e.g. glass-morphism, default)")
  .option("--variant <n>", "Template variant number")
  .option("--title <text>", "Override carousel title slide text")
  .option("--json", "Emit raw JSON payload")
  .action((id, opts) => visualsCarouselCommand(id, opts));

// ─── social extras (per-platform) ────────────────────────────────────────────
social
  .command("connect-platform")
  .description("Generate a magic link pre-targeted to a specific platform's OAuth.")
  .requiredOption("--platform <platform>", "linkedin | x | instagram | threads | facebook")
  .action((opts) => socialConnectPlatformCommand(opts));

program.parse(process.argv);
