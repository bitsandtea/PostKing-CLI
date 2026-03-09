#!/usr/bin/env node

import { Command } from "commander";
import { brandCreateCommand, brandInfoCommand, brandListCommand, brandOnboardCommand, brandSetCommand, brandThemesCommand, brandThemesDeleteCommand, brandThemesEditCommand, brandThemesGenerateCommand } from "./commands/brand";
import { domainsListCommand, domainsVerifyCommand } from "./commands/domains";
import { editorAICheckCommand, editorHumanizeCommand, editorRewriteCommand } from "./commands/editor";
import { loginCommand } from "./commands/login";
import { logoutCommand } from "./commands/logout";
import { postsApproveCommand, postsCalendarCommand, postsCancelCommand, postsCreateCommand, postsDeleteCommand, postsGenerateBatchCommand, postsGenerateCommand, postsListCommand, postsRescheduleCommand, postsViewCommand } from "./commands/posts";
import { repurposeCommand } from "./commands/repurpose";
import { socialCheckCommand, socialConnectCommand, socialDisconnectCommand } from "./commands/social";
import { userCreditsCommand } from "./commands/user";
import { voiceListCommand, voiceRewriteCommand } from "./commands/voice";

const program = new Command();

program
  .name("pking")
  .description(
    "PostKing — Programmatically manage brands, schedule posts, and control your marketing stack.\n" +
    "Designed for AI agents (Claude, OpenClaw, etc.) and power users."
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
  $ pking posts approve <id>
  $ pking posts create --platform linkedin --content "Manual post content"
  $ pking posts create --platform custom:280 --content "Custom length post"

Manual Brand:
  $ pking brand create "My Design Studio" --tone "Professional & Minimal"

Repurpose:
  $ pking repurpose --source-type url --source-url https://example.com/blog --target-type social --target-platforms x,linkedin --voice my-voice-id
  $ pking repurpose --source-type text --source-content "Here is my thought" --target-type text --text-length custom:300
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
  .description("Use AI to generate a post (deducts credits).")
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
  .description("Manually create a social media post (draft).")
  .requiredOption("--platform <platform>", "Target platform: x, linkedin, etc., or 'custom:<chars>'")
  .requiredOption("--content <text>", "The text body of the post")
  .option("--image <path>", "Path to a local image file to attach (optional)")
  .option("--schedule <iso_date>", "ISO 8601 datetime to schedule the post")
  .action((options) => postsCreateCommand(options));

posts
  .command("approve <postId>")
  .description("Confirm a draft post and move it to the scheduling queue.")
  .option("--variation <number>", "Select a specific variation to publish (1-based index)")
  .option("--schedule <iso_date>", "ISO 8601 datetime to schedule the post")
  .option("--timezone <string>", "User timezone (e.g. America/New_York)")
  .action((id, options) => postsApproveCommand(id, options));

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
  .description("List all available public voice profiles with their IDs.")
  .action(voiceListCommand);

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
  .description("Apply LLM rewrite and BERT replacements to bypass AI detection.")
  .requiredOption("--text <text>", "The text to humanize")
  .option("--platform <platform>", "Target platform (x, linkedin, etc., or 'custom:<chars>')")
  .action((options) => editorHumanizeCommand(options));

editor
  .command("ai-check")
  .description("Check if content is likely AI-generated.")
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

program.parse(process.argv);
