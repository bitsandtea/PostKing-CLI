#!/usr/bin/env node

import { Command } from "commander";
import { LANGUAGE_FLAG_DESCRIPTION, SUPPORTED_LANGUAGE_CODES } from "./constants";
import { loginWithPasswordCommand, meCommand, registerCommand } from "./commands/auth";
import { authorsCreateCommand, authorsListCommand, categoriesCreateCommand, categoriesListCommand } from "./commands/authors";
import { blogsCreateCommand, blogsDeleteCommand, blogsGenerateCommand, blogsListCommand, blogsPublishCommand, blogsStatusCommand, blogsViewCommand } from "./commands/blogs";
import { jobsListCommand } from "./commands/jobs";
import { brandCreateCommand, brandDeleteCommand, brandFinalizeCommand, brandInfoCommand, brandListCommand, brandOnboardCommand, brandSetCommand } from "./commands/brand";
import { brandMixCommand } from "./commands/brand-mix";
import { brandLanguageCommand } from "./commands/brand-language";
import { brandLanguagesCommand } from "./commands/brand-languages";
import { brandMediumsCommand } from "./commands/brand-mediums";
import { brandSmartWeekCommand } from "./commands/brand-smart-week";
import { brandThemesCommand, brandThemesDeleteCommand, brandThemesEditCommand, brandThemesGenerateCommand } from "./commands/brand-themes";
import { brandVisualImportAssetsCommand, brandVisualSetCommand } from "./commands/brand-visual";
import { brandAudienceEditCommand, brandAudiencePrepromptCommand, brandCrawlProfileCommand } from "./commands/brand-audience";
import { domainsAddCommand, domainsConnectCommand, domainsDeleteCommand } from "./commands/domains-extra";
import { domainsListCommand, domainsVerifyCommand } from "./commands/domains";
import { editorAICheckCommand, editorHumanizeCommand, editorRewriteCommand } from "./commands/editor";
import { keysCreateCommand, keysListCommand, keysRevokeCommand } from "./commands/keys";
import { loginCommand } from "./commands/login";
import { loginStartCommand, loginFinishCommand, registerStartCommand, registerFinishCommand, resendCommand, resetPasswordCommand, resetPasswordFinishCommand } from "./commands/auth-device";
import { redditPoolCommand, redditRewriteCommand } from "./commands/reddit";
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
  lpTranslateCommand,
  lpTranslationsCommand,
  lpVersionsListCommand,
  lpVersionsViewCommand,
  lpVibeCommand,
  lpVibeStatusCommand,
  lpViewCommand,
} from "./commands/lp";
import { postsApproveCommand, postsCalendarCommand, postsCancelCommand, postsCreateCommand, postsDeleteCommand, postsGenerateBatchCommand, postsGenerateCommand, postsListCommand, postsRescheduleCommand, postsScheduleCommand, postsViewCommand } from "./commands/posts";
import { publicationsCreateCommand, publicationsListCommand } from "./commands/publications";
import { repurposeCommand } from "./commands/repurpose";
import { seoBriefsApproveCommand, seoBriefsBulkApproveCommand, seoBriefsGenerateCommand, seoBriefsGenerateOneCommand, seoBriefsListCommand, seoBriefsRegenerateCommand, seoBriefsRejectCommand, seoBriefsViewCommand, seoCategorizeCommand, seoClusterCommand, seoClustersApproveCommand, seoClustersBulkApproveCommand, seoClustersBulkRejectCommand, seoClustersGenerateCommand, seoClustersListCommand, seoClustersRejectCommand, seoClustersRestoreCommand, seoClustersUnapproveCommand, seoCompetitorCommand, seoGapCommand, seoGenerateCommand, seoKeywordsCommand, seoKeywordsDeleteCommand, seoKeywordsEditCommand, seoKeywordsListCommand, seoLinkHealthCommand, seoMarketCommand, seoMarketSetCommand, CURATED_MARKET_CODES, MARKET_HELP, seoPublishCommand, seoResearchEstimateCommand, seoRoadmapCommand, seoRoadmapDeleteCommand, seoRoadmapEditCommand, seoRoadmapViewCommand, seoSeedsCommand, seoStatsCommand, seoWriteCommand } from "./commands/seo";
import { competitorsAddCommand, competitorsComparisonCommand, competitorsComparisonRecomputeCommand, competitorsDeleteCommand, competitorsImportCommand, competitorsListCommand, competitorsRefreshCommand, competitorsSampleCommand } from "./commands/competitors";
import { socialConnectPlatformCommand } from "./commands/social-extra";
import { socialCheckCommand, socialConnectCommand, socialDisconnectCommand } from "./commands/social";
import { userCreditsCommand } from "./commands/user";
import { billingPacksCommand, billingTopupCommand, billingWalletCommand, billingTiersCommand, billingSubscribeCommand } from "./commands/billing";
import { voiceBrandDeleteCommand, voiceBrandListCommand, voiceBrandUpdateCommand, voiceListCommand, voiceRewriteCommand } from "./commands/voice";
import { trendsListCommand } from "./commands/trends";
import { runUpdateCheck } from "./update-check";
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
import { timezoneSetCommand } from "./commands/timezone";

const program = new Command();

program
  .name("pking")
  .description(
    "PostKing — Programmatically manage brands, schedule posts, and control your marketing stack.\n" +
    "Designed for autonomous agents (Claude, OpenClaw, etc.) and power users."
  )
  .version(require("../package.json").version);

runUpdateCheck(require("../package.json").version);

program
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

// ─── register-start / register-finish (agent-friendly, non-blocking) ─────────
program
  .command("register-start")
  .description(
    "Start a device-flow registration without polling. Sends the magic-link\n" +
    "email and saves the device_code locally. Use this from agent skills."
  )
  .requiredOption("--email <email>", "Email address to register")
  .option("--client-name <name>", "Display name for the issued API key", "pking-cli")
  .action((opts) => registerStartCommand({ email: opts.email, clientName: opts.clientName }));

program
  .command("register-finish")
  .description(
    "Finish a previously-started device-flow registration. Calls the token\n" +
    "endpoint ONCE; exits with status 2 if the user has not clicked the magic\n" +
    "link yet. Use after 'pking register-start'."
  )
  .action(registerFinishCommand);

program
  .command("resend")
  .description("Resend the magic link for a pending registration or login.")
  .action(resendCommand);

program
  .command("reset-password")
  .description(
    "Start a password reset via the device flow. Sends a reset link to the\n" +
    "given email; once the user clicks it and sets a new password, run\n" +
    "'pking reset-password-finish' to retrieve the API key."
  )
  .requiredOption("--email <email>", "Email address of the account to reset")
  .option("--client-name <name>", "Display name for the issued API key", "pking-cli")
  .action((opts) => resetPasswordCommand({ email: opts.email, clientName: opts.clientName }));

program
  .command("reset-password-finish")
  .description(
    "Finish a previously-started password reset. Calls the token endpoint\n" +
    "ONCE; exits with status 2 if the user has not clicked the reset link yet.\n" +
    "Use after 'pking reset-password'."
  )
  .action(resetPasswordFinishCommand);

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
  .option("--json", "Output raw JSON")
  .action((opts) => brandListCommand(opts));

brand
  .command("info")
  .description("Show brand summary (id, name, themes count, audience headline). Pass --detail for the full psychographic profile.")
  .option("--detail", "Show full psychographic profile instead of the one-screen summary")
  .option("--json", "Output raw JSON")
  .action((opts: { detail?: boolean; json?: boolean }) => brandInfoCommand(opts));

brand
  .command("generate-themes")
  .description("Generate new content themes for the active brand based on its profile or external input (deducts credits).")
  .option("--count <number>", "Number of themes to generate (default: 5)")
  .option("--instructions <text>", "Custom instructions for generation")
  .option("--input <path_or_text>", "Source content or file path to derive themes from")
  .action((options) => brandThemesGenerateCommand(options));

const themes = brand.command("themes")
  .description("Manage content themes.")
  .option("--json", "Output raw JSON")
  .action((opts) => brandThemesCommand(opts));

themes
  .command("list")
  .description("List all content themes.")
  .option("--json", "Output raw JSON")
  .action((opts) => brandThemesCommand(opts));

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
  .command("mix [brandId]")
  .description(
    "Review and confirm the brand's content intent mix (educate/connect/present/intrigue).\n" +
    "Runs after 'audience-review' in the brand-setup flow. With no flags, prints the\n" +
    "current mix and prompts to accept, edit, or reject. Use --set <json> for\n" +
    "non-interactive overrides and --json to dump the raw payload."
  )
  .option("--json", "Print the fetched mix as JSON and exit (no prompt)")
  .option(
    "--set <json>",
    "Non-interactive override. Pass a JSON object like\n" +
    "  '{\"intentMix\":{\"educate\":30,\"connect\":20,\"present\":35,\"intrigue\":15}}'."
  )
  .option("--yes", "Accept the server-suggested or current mix without prompting (non-interactive)")
  .action((brandId: string | undefined, opts: { json?: boolean; set?: string; yes?: boolean }) =>
    brandMixCommand(brandId, opts)
  );

brand
  .command("mediums [brandId]")
  .description(
    "Pick the social/content channels (mediums) this brand wants to grow on.\n" +
    "Stored at brandSettings.selectedMediums; consumed by smart-week + weekly\n" +
    "scheduler. With no flags, prints current selection and prompts for a\n" +
    "comma-separated list. Use --set for non-interactive runs."
  )
  .option("--json", "Print the fetched mediums as JSON and exit (no prompt)")
  .option(
    "--set <csv>",
    "Non-interactive override. Comma-separated list, e.g.\n" +
    "  --set 'linkedin,x/twitter,instagram,blog'"
  )
  .option("--yes", "Accept the server-suggested or saved medium list without prompting (non-interactive)")
  .action((brandId: string | undefined, opts: { json?: boolean; set?: string; yes?: boolean }) =>
    brandMediumsCommand(brandId, opts)
  );

brand
  .command("language [brandId]")
  .description(
    "Read or set the brand's content language — the language every generator\n" +
    "writes in by default. Stored at brandSettings.contentLanguage. With no\n" +
    "flags, prints the current language plus the supported set and prompts for\n" +
    "a new code. Use --set for non-interactive runs. Affects NEW generations\n" +
    "only; nothing already generated is translated. To change the language for\n" +
    "a single call instead, pass --language <code> to that generate command."
  )
  .option("--json", "Print the fetched language as JSON and exit (no prompt)")
  .option(
    "--set <code>",
    "Non-interactive override. A single language code, e.g.\n" +
    "  --set cs"
  )
  .action((brandId: string | undefined, opts: { json?: boolean; set?: string }) =>
    brandLanguageCommand(brandId, opts)
  );

brand
  .command("languages [brandId]")
  .description(
    "Read or manage the SET of languages a brand publishes in (110-multilingual-brand).\n" +
    "Distinct from 'brand language', which reads/sets only the single DEFAULT\n" +
    "language. A brand can enable more than one language, each with its own\n" +
    "keyword research, blog, and landing pages — the default sits at the domain\n" +
    "root, every other enabled language sits under /{languageCode}. With no\n" +
    "flags, prints the enabled set. Gated by the brand's plan (Trial/Growth 1,\n" +
    "Pro 2, Enterprise 5)."
  )
  .option("--json", "Print the fetched languages as JSON and exit")
  .option("--add <code>", "Enable a language, e.g. --add cs")
  .option("--remove <code>", "Disable a language (never the default), e.g. --remove cs")
  .action((brandId: string | undefined, opts: { json?: boolean; add?: string; remove?: string }) =>
    brandLanguagesCommand(brandId, opts)
  );

brand
  .command("smart-week [brandId]")
  .description(
    "Generate a full week of posts (Mon-Fri) across the brand's selected\n" +
    "mediums. Asks for explicit consent first; pass --yes to skip the prompt.\n" +
    "Runs in the background after kickoff — poll progress via 'pking jobs list'."
  )
  .option("--yes", "Skip the consent prompt (non-interactive)")
  .option("--json", "Emit the raw kickoff payload (sessionId + operationId)")
  .option("--allow-past", "Allow scheduling slots that fall in the past (use with caution)")
  .option("--language <code>", LANGUAGE_FLAG_DESCRIPTION)
  .action((brandId: string | undefined, opts: { yes?: boolean; json?: boolean; allowPast?: boolean; language?: string }) =>
    brandSmartWeekCommand(brandId, opts)
  );

brand
  .command("finalize [brandId]")
  .description(
    "Mark the brand as fully onboarded (sets brandSettings.isOnboarded = true).\n" +
    "Mirrors the final PATCH the web onboarding flow issues at the end of\n" +
    "VisualIdentitySetup. Run this once the full chain is done: onboard ->\n" +
    "mediums -> mix -> audience -> themes -> voice -> visual -> smart-week -> finalize."
  )
  .option("--yes", "Skip the confirmation prompt (non-interactive)")
  .option("--json", "Emit raw JSON payload")
  .action((brandId: string | undefined, opts: { json?: boolean; yes?: boolean }) =>
    brandFinalizeCommand(brandId, opts)
  );

const brandVisual = brand
  .command("visual")
  .description(
    "Configure the brand's visual identity (logo, colors, fonts) and import\n" +
    "website assets. Mirrors the web Visual Identity onboarding step."
  );

brandVisual
  .command("set [brandId]")
  .description(
    "Set logo asset IDs, brand colors, and/or fonts on the brand.\n" +
    "Every value is a flag — works headless (no prompts).\n" +
    "Wraps PATCH /api/agent/v1/brands/{brandId} with { brandSettings: {...} }."
  )
  .option("--logo <assetId>", "Full logo (light variant). Asset ID returned by 'pking brand visual import-assets' or listed by 'pking visuals list'.")
  .option("--symbol-light <assetId>", "Icon-only logo for light backgrounds. Asset ID returned by 'pking brand visual import-assets'.")
  .option("--symbol-dark <assetId>", "Icon-only logo for dark backgrounds. Asset ID returned by 'pking brand visual import-assets'.")
  .option("--primary-color <hex>", "Primary brand color, e.g. #FF6B35")
  .option("--secondary-color <hex>", "Secondary brand color")
  .option("--accent-color <hex>", "Accent color used for buttons/highlights")
  .option("--primary-font <name>", "Primary font family name")
  .option("--secondary-font <name>", "Secondary font family name")
  .option("--json", "Emit raw JSON payload")
  .action((brandId: string | undefined, opts) =>
    brandVisualSetCommand(brandId, opts)
  );

brandVisual
  .command("import-assets [brandId]")
  .description(
    "Batch-import image URLs into the brand asset library (max 50).\n" +
    "Mirrors the importCrawledAssets call from VisualIdentitySetup.\n" +
    "Wraps POST /api/agent/v1/brands/{brandId}/assets/import-urls."
  )
  .option("--urls <csv>", "Comma-separated list of image URLs")
  .option("--from-file <path>", "Read URLs from a file (one per line, or a JSON array)")
  .option("--json", "Emit raw JSON payload")
  .action((brandId: string | undefined, opts) =>
    brandVisualImportAssetsCommand(brandId, opts)
  );

brand
  .command("create <name>")
  .description(
    "Manually create a brand without automatic website crawling.\n" +
    "After creating, automatically POSTs /api/brands/{brandId}/finalize to\n" +
    "kick off audience-data + theme generation — mirrors the web flow.\n" +
    "Pass --skip-finalize to create the brand row only (debug/testing)."
  )
  .option("--description <desc>", "Optional brand description")
  .option("--website <url>", "Optional website URL")
  .option("--tone <tone>", "Initial tone description")
  .option("--audience <audience>", "Target audience description")
  .option("--brand-type <type>", "Brand type: personal | business (default business)")
  .option("--skip-finalize", "Do not chain /finalize after creation (leaves audience-review empty)")
  .option("--json", "Emit raw JSON payload")
  .action((name: string, options: { description?: string; website?: string; tone?: string; audience?: string; brandType?: string; skipFinalize?: boolean; json?: boolean }) => brandCreateCommand(name, options));

// ─── brand crawl-profile ─────────────────────────────────────────────────────
brand
  .command("crawl-profile [brandId]")
  .description(
    "Queue the 'best profile' crawl for a brand. Mirrors the web onboarding\n" +
    "BestProfileStep — captures a public handle/URL on x/linkedin/threads and\n" +
    "(optionally) consents to use the posts for tone, not just topic seeding.\n" +
    "Wraps POST /api/agent/v1/brands/{brandId}/crawl-profile. Headless."
  )
  .requiredOption("--platform <platform>", "Source platform: x | linkedin | threads")
  .requiredOption("--handle <id>", "Public handle (e.g. @yourname) or full profile URL")
  .option("--profile-type <type>", "personal | brand | mix (default personal)")
  .option("--tone-consent", "Consent to use the crawled posts for tone, not just topics")
  .option("--json", "Emit raw JSON payload")
  .action((brandId: string | undefined, opts: { platform: string; handle: string; profileType?: string; toneConsent?: boolean; json?: boolean }) =>
    brandCrawlProfileCommand(brandId, opts)
  );

// ─── brand audience (ai-edit + preprompt) ────────────────────────────────────
const brandAudience = brand
  .command("audience")
  .description(
    "Inspect and AI-edit the brand's audience-review data. Mirrors the web\n" +
    "audience-review page at /dashboard/brands/{brandId}/audience-review."
  );

brandAudience
  .command("edit [brandId]")
  .description(
    "AI vibe-edit the audience profile via the inner ai-edit pipeline.\n" +
    "If --sections is omitted, runs the preprompt analyzer first to auto-pick\n" +
    "which sections/subsections the instructions should touch (mirrors web).\n" +
    "Async — returns an operationId. Pass --wait to block until completion.\n" +
    "Wraps POST /api/agent/v1/brands/{brandId}/audience-review/ai-edit."
  )
  .requiredOption("--instructions <text>", "Free-text edit instructions (the 'vibe' prompt)")
  .option("--sections <csv>", "Comma-separated section keys to edit (skips preprompt)")
  .option(
    "--subsections <spec>",
    "Per-section subfields. Format: 'section:sub1,sub2|section2:sub3'."
  )
  .option("--wait", "Block and poll until the edit completes (or --timeout elapses)")
  .option("--timeout <seconds>", "Max seconds to wait when --wait is set (default 180)", "180")
  .option("--json", "Emit raw JSON payload")
  .action((brandId: string | undefined, opts: { instructions: string; sections?: string; subsections?: string; wait?: boolean; timeout?: string; json?: boolean }) =>
    brandAudienceEditCommand(brandId, opts)
  );

brandAudience
  .command("preprompt [brandId]")
  .description(
    "Run only the preprompt analyzer. Returns which audience sections /\n" +
    "subsections a free-text instruction would touch — useful for previewing\n" +
    "before kicking off the heavy ai-edit. Synchronous.\n" +
    "Wraps POST /api/agent/v1/brands/{brandId}/audience-review/ai-edit/preprompt."
  )
  .requiredOption("--instructions <text>", "Free-text edit instructions to analyse")
  .option("--json", "Emit raw JSON payload")
  .action((brandId: string | undefined, opts: { instructions: string; json?: boolean }) =>
    brandAudiencePrepromptCommand(brandId, opts)
  );

brand
  .command("delete <brandId>")
  .description("Delete a brand workspace (owner only; soft-delete — disables all access).")
  .option("--destructive", "Required confirmation flag")
  .option("--confirm <value>", "Typed confirmation (brand name); required with --json, optional otherwise")
  .option("--json", "Emit raw JSON payload")
  .action((brandId: string, opts: { destructive?: boolean; json?: boolean; confirm?: string }) => brandDeleteCommand(brandId, opts));

// ─── onboard ─────────────────────────────────────────────────────────────────
program
  .command("onboard <websiteUrl>")
  .description("Quickly onboard a new brand by crawling its website and generating initial themes.")
  .option("--name <name>", "Optional custom name for the brand.")
  .option("--description <desc>", "Optional brand description (passed through to /api/brands).")
  .option("--tone <tone>", "Initial tone description (passed through).")
  .option("--audience <audience>", "Target audience description (passed through).")
  .option("--brand-type <type>", "Brand type: personal | business (default business).")
  .option("--force", "Allow creating a duplicate brand even if one already exists for this URL.")
  .action((url: string, options: { name?: string; description?: string; tone?: string; audience?: string; brandType?: string; force?: boolean }) => brandOnboardCommand(url, options))
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
  .option("--json", "Output raw JSON")
  .action((options) => postsListCommand(options));

posts
  .command("view <postId>")
  .description("View the full content and details of a specific post.")
  .option("--json", "Output raw JSON")
  .action((id, opts) => postsViewCommand(id, opts));

posts
  .command("generate")
  .description("Generate a post with the core engine (deducts credits).")
  .requiredOption("--platform <platform>", "Target platform: x, linkedin, etc., or 'custom:<chars>'")
  .option("--theme <text>", "Specific theme or topic to write about (random if omitted)")
  .option("--variations <number>", "Number of variations to generate (default: 1)", "1")
  .option("--voice <profile_id>", "Voice profile ID to use (optional)")
  .option("--language <code>", LANGUAGE_FLAG_DESCRIPTION)
  .action((options) => postsGenerateCommand(options));

posts
  .command("generate-bulk")
  .description("Generate and schedule multiple posts across a date range")
  .requiredOption("--platform <platform>", "Target platform (x, linkedin, etc., or 'custom:<chars>')")
  .option("--voice <profile_id>", "Optional Voice Profile ID to apply")
  .option("--language <code>", LANGUAGE_FLAG_DESCRIPTION)
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
    "you want the scheduling intent to be explicit. Pass --yes to skip the prompt."
  )
  .option("--variation <number>", "Select a specific variation to publish (1-based index)")
  .option("--schedule <iso_date>", "ISO 8601 datetime to schedule the post (otherwise queued)")
  .option("--timezone <string>", "User timezone (e.g. America/New_York)")
  .option("--yes", "Skip confirmation prompt (non-interactive)")
  .action((id, options: { variation?: string; schedule?: string; timezone?: string; yes?: boolean }) => postsApproveCommand(id, options));

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
  .option("--json", "Output raw JSON")
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
  .description("Soft delete a post. Refuses if post is still being generated unless --force is passed.")
  .option("--force", "Delete even if the post is still being generated (orphans the generation slot).")
  .action((id, opts: { force?: boolean }) => postsDeleteCommand(id, opts));

// ─── user ────────────────────────────────────────────────────────────────────
const userSub = program
  .command("user")
  .description("Manage your user account and credits.");

userSub
  .command("credits")
  .description("Check your current credit balance.")
  .option("--json", "Output raw JSON")
  .action((opts) => userCreditsCommand(opts));

// ─── billing ─────────────────────────────────────────────────────────────────
const billing = program
  .command("billing")
  .description("Manage agent credits, top-up packs, and subscriptions.");

billing
  .command("packs")
  .description("List available credit packs with pricing.")
  .option("--json", "Output raw JSON")
  .action((opts) => billingPacksCommand(opts));

billing
  .command("topup")
  .description("Purchase a credit pack and poll for payment confirmation.")
  .requiredOption("--pack <sku>", "Pack SKU: agent_4 | agent_5 | agent_25 | agent_50")
  .option("--json", "Output raw JSON")
  .action((opts) => billingTopupCommand(opts));

billing
  .command("wallet")
  .description("Show current agent credit balance and recent transactions.")
  .option("--json", "Output raw JSON")
  .action((opts) => billingWalletCommand(opts));

billing
  .command("tiers")
  .description("List subscription tiers with pricing and monthly credit allowances.")
  .option("--json", "Output raw JSON")
  .action((opts) => billingTiersCommand(opts));

billing
  .command("subscribe")
  .description("Start a subscription checkout and poll for activation confirmation.")
  .requiredOption("--tier <GROWTH|PRO|ENTERPRISE>", "Subscription tier to activate")
  .option("--interval <month|year>", "Billing interval: month or year (default: month)")
  .option("--json", "Output raw JSON")
  .action((opts) => billingSubscribeCommand(opts));

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
  .option("--json", "Output raw JSON")
  .action((opts) => socialCheckCommand(opts));

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
  .option("--json", "Output raw JSON")
  .action((options) =>
    voiceListCommand({
      platform: options.platform,
      filter: options.filter,
      json: options.json,
    })
  );

const voiceBrand = voice
  .command("brand")
  .description(
    "Brand-scoped voice profile management. Wraps the agent v1\n" +
    "/api/agent/v1/brands/{brandId}/voice-profiles endpoints. Voice profile\n" +
    "CREATION runs through the async extract endpoints (X, LinkedIn, Threads,\n" +
    "URLs) and is web-only today — see the dashboard's /voice-profiles page."
  );

voiceBrand
  .command("list [brandId]")
  .description(
    "List voice profiles attached to a brand. By default shows brand-owned\n" +
    "profiles only; pass --include-public to also show the public catalog.\n" +
    "Wraps GET /api/agent/v1/brands/{brandId}/voice-profiles."
  )
  .option("--include-public", "Also include public voice profiles available to this brand")
  .option("--json", "Emit raw JSON payload")
  .action((brandId: string | undefined, opts: { includePublic?: boolean; json?: boolean }) =>
    voiceBrandListCommand(brandId, opts)
  );

voiceBrand
  .command("update <voiceProfileId>")
  .description(
    "Update a brand-owned voice profile (name, active state, Modal adapter).\n" +
    "Wraps PATCH /api/agent/v1/brands/{brandId}/voice-profiles/{voiceProfileId}."
  )
  .option("--brand <brandId>", "Brand id (defaults to active brand)")
  .option("--name <text>", "New display name")
  .option("--active", "Mark the profile active")
  .option("--inactive", "Mark the profile inactive")
  .option("--adapter <modalAdapterId>", "Set the Modal LoRA adapter id (promotes the profile to deep voice)")
  .option("--json", "Emit raw JSON payload")
  .action((voiceProfileId: string, opts: { brand?: string; name?: string; active?: boolean; inactive?: boolean; adapter?: string; json?: boolean }) =>
    voiceBrandUpdateCommand(voiceProfileId, opts.brand, opts)
  );

voiceBrand
  .command("delete <voiceProfileId>")
  .description(
    "Delete a brand-owned voice profile. --destructive is required to confirm.\n" +
    "Wraps DELETE /api/agent/v1/brands/{brandId}/voice-profiles/{voiceProfileId}."
  )
  .option("--brand <brandId>", "Brand id (defaults to active brand)")
  .option("--destructive", "Required confirmation flag")
  .option("--json", "Emit raw JSON payload")
  .action((voiceProfileId: string, opts: { brand?: string; destructive?: boolean; json?: boolean }) =>
    voiceBrandDeleteCommand(voiceProfileId, opts.brand, opts)
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
  .option("--json", "Output raw JSON")
  .action((opts) => domainsListCommand(opts));

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
  .option("--json", "Output raw JSON")
  .action((opts) => weeklyScheduleGetCommand(opts));

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
  .option("--language <code>", LANGUAGE_FLAG_DESCRIPTION)
  .action((options) => weeklyScheduleRunDayCommand(options));

// ─── timezone ────────────────────────────────────────────────────────────────
program
  .command("timezone [iana]")
  .description(
    "View or set the active brand's IANA timezone used for post scheduling.\n" +
    "No args: show current brand timezone and machine local timezone.\n" +
    "<iana>: set the brand timezone to the given IANA string (e.g. America/New_York).\n" +
    "--local: detect the machine's local timezone and set it on the brand."
  )
  .option("--local", "Use the machine's local timezone as the new brand timezone")
  .action((iana: string | undefined, opts: { local?: boolean }) =>
    timezoneSetCommand(iana, opts)
  );

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
  .option("--language <code>", LANGUAGE_FLAG_DESCRIPTION)
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
  .option("--language <code>", LANGUAGE_FLAG_DESCRIPTION)
  .action((options) => repurposeCommand(options));

// ─── register / login (email+password) / me ──────────────────────────────────
program
  .command("register")
  .description("Register a new PostKing account. Triggers a magic-link confirmation — the user sets their password in the browser.")
  .requiredOption("--email <email>", "Email address")
  .option("--password <password>", "Password (optional — omit to receive a magic link and set the password in your browser)")
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
  .option("--json", "Output raw JSON")
  .action((opts) => meCommand(opts));

// ─── keys ────────────────────────────────────────────────────────────────────
const keys = program.command("keys").description("Manage API keys.");

keys.command("list").description("List all API keys on your account.").option("--json", "Output raw JSON").action((opts) => keysListCommand(opts));

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
  .option("--json", "Output raw JSON")
  .action((opts) => blogsListCommand(opts));

blogs
  .command("create")
  .description("Create a new blog publication.")
  .requiredOption("--title <title>", "Publication name")
  .option("--description <desc>", "Description")
  .option(
    "--language-code <code>",
    `Language for this new publication (${SUPPORTED_LANGUAGE_CODES.join(", ")}). Omit to default to the ` +
    "brand's content language. Must already be enabled on the brand's language roster — see " +
    "'pking brand languages --add <code>'."
  )
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
  .option("--language <code>", LANGUAGE_FLAG_DESCRIPTION)
  .action((opts) => blogsGenerateCommand(opts));

blogs
  .command("status <articleId>")
  .description("Show the live generation status of an article.")
  .option("--json", "Output raw JSON")
  .action((id, opts) => blogsStatusCommand(id, opts));

blogs
  .command("publish <articleId>")
  .description("Publish an article (free-tier choke point).")
  .option("--connections <csv>", "Comma-separated external connection IDs")
  .action((id, opts) => blogsPublishCommand(id, opts));

blogs
  .command("view <articleId>")
  .description("View full article content.")
  .option("--json", "Output raw JSON")
  .action((id, opts) => blogsViewCommand(id, opts));

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
  .option("--json", "Output raw JSON")
  .action((opts) => jobsListCommand(opts));

// ─── reddit ──────────────────────────────────────────────────────────────────
const reddit = program.command("reddit").description("Test the Reddit rewrite feature end-to-end (rewrite content for a subreddit, inspect the pooled subreddit list).");

reddit
  .command("rewrite")
  .description(
    "Rewrite seed text or an existing blog article into a Reddit-native post for a\n" +
    "subreddit, then poll to completion and print each saved variation with its\n" +
    "compliance verdict. Provide exactly one of --seed or --blog."
  )
  .requiredOption("--subreddit <name>", "Target subreddit, with or without leading 'r/'")
  .option("--seed <text>", "Seed text to rewrite (mutually exclusive with --blog)")
  .option("--blog <articleId>", "Blog article ID to rewrite (mutually exclusive with --seed)")
  .option("--title <text>", "Source title (only meaningful in --seed mode)")
  .option("--angle <angle>", "Content angle", "educational")
  .option("--length <short|medium|long>", "Target length")
  .option("--voice <voiceId>", "Voice profile ID")
  .option("--variations <n>", "Number of variations to generate (1-3)", "1")
  .option("--repeat <n>", "Run the whole rewrite flow N times sequentially, for eyeballing variance", "1")
  .option("--json", "Dump raw outputData JSON for each post instead of pretty-printed output")
  .option("--brand <brandId>", "Brand id (defaults to active brand)")
  .action((opts) => redditRewriteCommand(opts));

reddit
  .command("pool")
  .description("List this brand's pooled subreddits (display name, posting style, rule count).")
  .option("--json", "Output raw JSON")
  .option("--brand <brandId>", "Brand id (defaults to active brand)")
  .action((opts) => redditPoolCommand(opts));

// ─── publications / authors / categories ─────────────────────────────────────
const publications = program.command("publications").description("Manage blog publications.");
publications.command("list").option("--json", "Output raw JSON").action((opts) => publicationsListCommand(opts));
publications
  .command("create")
  .requiredOption("--title <title>")
  .option("--description <desc>")
  .option(
    "--language-code <code>",
    `Language for this new publication (${SUPPORTED_LANGUAGE_CODES.join(", ")}). Omit to default to the ` +
    "brand's content language. Must already be enabled on the brand's language roster — see " +
    "'pking brand languages --add <code>'."
  )
  .action((opts) => publicationsCreateCommand(opts));

const authors = program.command("authors").description("Manage blog authors.");
authors.command("list").option("--json", "Output raw JSON").action((opts) => authorsListCommand(opts));
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
  .option("--json", "Output raw JSON")
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

lp.command("list").option("--json", "Output raw JSON").action((opts) => lpListCommand(opts));
lp
  .command("generate")
  .description("Generate a new landing page (deducts credits).")
  .requiredOption("--topic <topic>", "Topic or theme for the landing page")
  .option("--slug <slug>", "Custom URL slug")
  .option("--voice <id>", "Voice profile ID")
  .option("--language <code>", LANGUAGE_FLAG_DESCRIPTION)
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
  .option("--json", "Output raw JSON")
  .action((slug, opts) => lpViewCommand(slug, opts));
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
  .description("Update a single section within a side-page using structured, typed fields.")
  .requiredOption("--id <sectionId>", "Section ID to update")
  .option("--fields <json>", "Structured partial section object as JSON (merged onto the section)")
  .option("--file <path>", "Path to a JSON file with the structured section fields (use - for stdin)")
  .option("--field <path>", "Dot-path to a single nested field (e.g. title.prefix). Requires --value")
  .option("--value <json>", "New value for --field (parsed as JSON, falls back to string)")
  .option(
    "--instructions <text>",
    "Alone, triggers a real AI-edit pass scoped to this section. Combined with --fields/--field, " +
    "stored only as an annotation for future context (no AI pass runs)."
  )
  .option("--language <code>", `${LANGUAGE_FLAG_DESCRIPTION} Only consulted when --instructions triggers an AI-edit pass (i.e. passed alone, without --fields/--field).`)
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
  .option("--language <code>", LANGUAGE_FLAG_DESCRIPTION)
  .option("--wait", "Poll until the edit completes (up to 120s)")
  .option("--json", "Emit raw JSON payload")
  .action((slug: string, opts: { instructions: string; scope?: string; sectionId?: string; language?: string; wait?: boolean; json?: boolean }) =>
    lpVibeCommand(slug, {
      instructions: opts.instructions,
      scope: opts.scope,
      sectionId: opts.sectionId,
      language: opts.language,
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

// ─── lp translations (110-multilingual-brand) ─────────────────────────────────
lp
  .command("translations <slug>")
  .description(
    "Read the translation group a landing page belongs to — its language,\n" +
    "URL path prefix, and any other-language variants already created."
  )
  .option("--json", "Emit raw JSON payload")
  .action((slug, opts) => lpTranslationsCommand(slug, opts));

lp
  .command("translate <slug>")
  .description(
    "Create a new language variant of a landing page, linked into a shared\n" +
    "translation group with the source page. Creates an empty DRAFT row only —\n" +
    "does not translate content. Follow up with the printed pullFromSourceUrl\n" +
    "(an ai-edit call with pullFromSource: true) to translate the source's\n" +
    "content into the new variant."
  )
  .option("--language <code>", "Language of the new variant, e.g. --language cs (required)")
  .option("--json", "Emit raw JSON payload")
  .action((slug, opts) => lpTranslateCommand(slug, opts));

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
const seo = program.command("seo").description("Run the PostKing SEO agentic pipeline: seeds → generate (L0) → score → clusters generate (L2) → approve clusters → briefs generate (L3) → approve briefs → write article (L4).");

seo
  .command("seeds <seeds...>")
  .description("Add seed keywords to start the SEO flow.")
  .option("--brand <id>")
  .option("--no-wait", "Print operationId and return without polling")
  .option("--json", "Emit raw JSON payload")
  .action((seeds, opts) => seoSeedsCommand(seeds, opts));

seo
  .command("generate")
  .description(
    "Pull keywords from DataForSEO for this brand's seeds (L0). Async.\n" +
    "Pass --language to scope the run to ONE of the brand's languages\n" +
    "(110-multilingual-brand) instead of every configured market — never\n" +
    "automatic, check 'seo research-cost <language>' first."
  )
  .option("--brand <id>")
  .option("--no-score", "Disable automatic scoring after pull (sets autoScore=false)")
  .option("--no-wait", "Print operationId and return without polling")
  .option("--json", "Emit raw JSON payload")
  .option("--language <code>", "Scope this run to one of the brand's languages, e.g. --language cs")
  .action((opts) => seoGenerateCommand(opts));

seo
  .command("research-cost <language>")
  .description(
    "Read-only. Estimate the USD cost of 'seo generate --language <language>' before running it\n" +
    "(110-multilingual-brand decision 7 — per-language research is never automatic)."
  )
  .option("--brand <id>")
  .option("--json", "Emit raw JSON payload")
  .action((language, opts) => seoResearchEstimateCommand(language, opts));

const seoKeywords = seo
  .command("keywords")
  .description("List generated keywords. Use seo keywords edit/delete for item-level operations.")
  .option("--brand <id>")
  .option("--limit <n>", "Limit results")
  .option("--json", "Emit raw JSON payload")
  .action((opts) => seoKeywordsCommand(opts));

seoKeywords
  .command("list")
  .description("List all keywords for the active brand.")
  .option("--brand <id>")
  .option("--limit <n>", "Limit number of results")
  .option("--json", "Emit raw JSON payload")
  .action((opts) => seoKeywordsListCommand(opts));

seoKeywords
  .command("edit <id>")
  .description("Update tags, intent, priority, or clustering exclusion on a keyword.")
  .option("--brand <id>")
  .option("--tags <csv>", "Comma-separated userTags to set")
  .option("--intent <intent>", "Intent: informational|commercial|navigational|transactional")
  .option("--priority <n>", "Priority score between 0 and 1 inclusive")
  .option("--exclude-clustering", "Exclude this keyword from clustering")
  .option("--include-clustering", "Include this keyword in clustering (clears exclusion)")
  .option("--json", "Emit raw JSON payload")
  .action((id, opts) => seoKeywordsEditCommand(id, opts));

seoKeywords
  .command("delete <id>")
  .description("Soft-delete a keyword by ID.")
  .option("--brand <id>")
  .option("--destructive", "Required confirmation flag")
  .option("--json", "Emit raw JSON payload")
  .action((id, opts) => seoKeywordsDeleteCommand(id, opts));

seo
  .command("categorize")
  .description("Manually set intent/tags on keywords (override). Use --file <json> or --keyword/--intent/--tags.")
  .option("--brand <id>")
  .option("--file <path>", "JSON file containing an array of update objects")
  .option("--keyword <id>", "Single keyword ID to update")
  .option("--intent <intent>", "Intent: informational|commercial|navigational|transactional")
  .option("--tags <csv>", "Comma-separated userTags")
  .option("--json", "Emit raw JSON payload")
  .action((opts) => seoCategorizeCommand(opts));

seo
  .command("cluster")
  .description("Generate keyword clusters from scored keywords (L2). Async.")
  .option("--brand <id>")
  .option("--no-wait", "Print operationId and return without polling")
  .option("--json", "Emit raw JSON payload")
  .action((opts) => seoClusterCommand(opts));

const seoRoadmap = seo
  .command("roadmap")
  .description("List roadmap items. Use seo roadmap edit/view/delete for item-level operations.")
  .option("--brand <id>")
  .option("--status <status>", "Filter by status")
  .option("--type <type>", "Filter by type")
  .option("--priority <value>", "Filter by priority")
  .option("--cluster <id>", "Filter by clusterId")
  .option("--limit <n>", "Cap number of items shown client-side")
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
  .description("Update a roadmap item's action or status.")
  .option("--brand <id>")
  .option("--action <action>", "Action: ignore|restore|start|complete")
  .option("--status <status>", "Status: suggested|ignored|in_progress|completed")
  .option("--json", "Emit raw JSON payload")
  .action((id, opts) => seoRoadmapEditCommand(id, opts));

seoRoadmap
  .command("delete <id>")
  .description("Soft-delete a roadmap item (sets status to ignored).")
  .option("--brand <id>")
  .option("--destructive", "Required confirmation flag")
  .option("--json", "Emit raw JSON payload")
  .action((id, opts) => seoRoadmapDeleteCommand(id, opts));

const seoClusters = seo
  .command("clusters")
  .description("Manage SEO keyword clusters (list, approve, reject, restore).");

seoClusters
  .command("list")
  .description("List all clusters with status and brief counts.")
  .option("--brand <id>")
  .option("--json", "Emit raw JSON payload")
  .action((opts) => seoClustersListCommand(opts));

seoClusters
  .command("generate")
  .description("Generate clusters from brand keywords, or import + cluster keywords from a CSV. Async.")
  .option("--brand <id>")
  .option("--csv <file>", "CSV file with keyword rows (required columns: keyword; optional: volume, kd, intent)")
  .option("--target-size <n>", "Target keywords per cluster")
  .option("--min-per-cluster <n>", "Minimum keywords per cluster")
  .option("--max-per-cluster <n>", "Maximum keywords per cluster")
  .option("--no-cannibal-check", "Skip cannibalization check")
  .option("--no-wait", "Print operationId and return without polling")
  .option("--json", "Emit raw JSON payload")
  .action((opts) => seoClustersGenerateCommand(opts));

seoClusters
  .command("approve <id>")
  .description("Approve a cluster and trigger brief generation (L3). Async.")
  .option("--brand <id>")
  .option("--no-wait", "Print operationId and return without polling")
  .option("--json", "Emit raw JSON payload")
  .action((id, opts) => seoClustersApproveCommand(id, opts));

seoClusters
  .command("unapprove <id>")
  .description("Revert a cluster to pending_review (fails with 409 if briefs already exist).")
  .option("--brand <id>")
  .option("--json", "Emit raw JSON payload")
  .action((id, opts) => seoClustersUnapproveCommand(id, opts));

seoClusters
  .command("reject <id>")
  .description("Reject a cluster.")
  .option("--brand <id>")
  .option("--json", "Emit raw JSON payload")
  .action((id, opts) => seoClustersRejectCommand(id, opts));

seoClusters
  .command("restore <id>")
  .description("Restore a rejected cluster back to pending_review.")
  .option("--brand <id>")
  .option("--json", "Emit raw JSON payload")
  .action((id, opts) => seoClustersRestoreCommand(id, opts));

seoClusters
  .command("bulk-approve <ids...>")
  .description("Approve multiple clusters and trigger brief generation for each. Async.")
  .option("--brand <id>")
  .option("--wait", "Poll all resulting operations to completion")
  .option("--json", "Emit raw JSON payload")
  .action((ids, opts) => seoClustersBulkApproveCommand(ids, opts));

seoClusters
  .command("bulk-reject <ids...>")
  .description("Reject multiple clusters in one call.")
  .option("--brand <id>")
  .option("--json", "Emit raw JSON payload")
  .action((ids, opts) => seoClustersBulkRejectCommand(ids, opts));

const seoBriefs = seo
  .command("briefs")
  .description("Manage SEO briefs (list, view, generate, approve, reject).");

seoBriefs
  .command("list")
  .description("List briefs with optional filters.")
  .option("--brand <id>")
  .option("--status <csv>", "Filter by status (csv)")
  .option("--type <csv>", "Filter by type (csv)")
  .option("--cluster <id>", "Filter by clusterId")
  .option("--limit <n>", "Max results")
  .option("--cursor <cursor>", "Pagination cursor")
  .option("--json", "Emit raw JSON payload")
  .action((opts) => seoBriefsListCommand(opts));

seoBriefs
  .command("view <briefId>")
  .description("View a single brief by ID.")
  .option("--brand <id>")
  .option("--json", "Emit raw JSON payload")
  .action((briefId, opts) => seoBriefsViewCommand(briefId, opts));

seoBriefs
  .command("generate")
  .description("Generate briefs (L3) over approved clusters. Optional --cluster <id> to restrict. Async.")
  .option("--brand <id>")
  .option("--cluster <id>", "Restrict to a specific cluster (repeatable)", (v: string, acc: string[]) => acc.concat(v), [] as string[])
  .option("--no-wait", "Print operationId and return without polling")
  .option("--json", "Emit raw JSON payload")
  .action((opts) => seoBriefsGenerateCommand(opts));

seoBriefs
  .command("generate-one")
  .description("Generate a single brief from supplied pillar + supporting keywords. Async.")
  .option("--brand <id>")
  .requiredOption("--pillar <keyword>", "Pillar (primary) keyword")
  .requiredOption("--supporting <list>", "Comma-separated supporting keywords")
  .requiredOption("--type <type>", "Brief type: blog|comparison|tool|landing")
  .option("--intent <s>", "Intent hint (informational, commercial, etc.)")
  .option("--research <mode>", "Research mode: advanced (default) | fast", "advanced")
  .option("--tier <tier>", "Content tier: hub|spoke|side_page")
  .option("--no-wait", "Print operationId and return without polling")
  .option("--json", "Emit raw JSON payload")
  .action((opts) => seoBriefsGenerateOneCommand(opts));

seoBriefs
  .command("regenerate <briefId>")
  .description("Regenerate a brief. Async.")
  .option("--brand <id>")
  .option("--no-wait", "Print operationId and return without polling")
  .option("--json", "Emit raw JSON payload")
  .action((briefId, opts) => seoBriefsRegenerateCommand(briefId, opts));

seoBriefs
  .command("approve <briefId>")
  .description("Approve a brief and trigger article generation (L4). Async.")
  .option("--brand <id>")
  .option("--hero-image", "Generate a hero image for the article")
  .option("--voice <id>", "Voice profile ID to use")
  .option("--no-wait", "Print operationId and return without polling")
  .option("--json", "Emit raw JSON payload")
  .action((briefId, opts) => seoBriefsApproveCommand(briefId, opts));

seoBriefs
  .command("reject <briefId>")
  .description("Reject a brief.")
  .option("--brand <id>")
  .option("--json", "Emit raw JSON payload")
  .action((briefId, opts) => seoBriefsRejectCommand(briefId, opts));

seoBriefs
  .command("bulk-approve <ids...>")
  .description("Bulk-approve briefs and trigger article generation for each. Async.")
  .option("--brand <id>")
  .option("--hero-image", "Generate hero images for articles")
  .option("--wait", "Poll all resulting operations to completion")
  .option("--json", "Emit raw JSON payload")
  .action((ids, opts) => seoBriefsBulkApproveCommand(ids, opts));

seo
  .command("write <roadmapId>")
  .description("Generate the article for a roadmap item (requires an approved brief) (L4). Async.")
  .option("--brand <id>")
  .option("--hero-image", "Generate a hero image for the article")
  .option("--voice <id>", "Voice profile ID to use")
  .option("--no-wait", "Print operationId and return without polling")
  .option("--json", "Emit raw JSON payload")
  .action((roadmapId, opts) => seoWriteCommand(roadmapId, opts));

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

seo
  .command("link-health")
  .description("Show the SEO link health report for the brand.")
  .option("--brand <id>")
  .option("--json", "Emit raw JSON payload")
  .action((opts) => seoLinkHealthCommand(opts));

const seoMarket = seo
  .command("market")
  .description(
    "Read the brand's configured SEO markets — the (location, language) pairs keyword research pulls\n" +
    "from. A language with zero configured markets can't be researched: run this before\n" +
    "'seo research-cost <language>' / 'seo generate --language <language>'. Requires a paid plan.\n" +
    MARKET_HELP
  )
  .option("--brand <id>")
  .option("--json", "Emit raw JSON payload")
  .action((opts) => seoMarketCommand(opts));

seoMarket
  .command("set")
  .description(
    "Configure the brand's SEO markets (up to 3 curated (location, language) pairs). `languageCode` on\n" +
    "each pair is DataForSEO's vocabulary, NOT PostKing's content-language codes (e.g. Brazil is \"pt\",\n" +
    "never \"pt-BR\") — this command only accepts the curated codes below, so that distinction is handled\n" +
    "for you. Requires a paid plan.\n" +
    MARKET_HELP
  )
  .option("--brand <id>")
  .option("--markets <codes>", `Comma-separated curated codes, 1-3, e.g. --markets DE,FR (${CURATED_MARKET_CODES.join(", ")})`)
  .option("--global", "Revert to the default Global market (US/en)")
  .option("--json", "Emit raw JSON payload")
  .action((opts) => seoMarketSetCommand(opts));

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

// ─── competitors ─────────────────────────────────────────────────────────────
const competitors = program
  .command("competitors")
  .description("Manage competitor onboarding and analysis for the active brand.");

competitors
  .command("list")
  .description("List all onboarded competitors and their analysis state.")
  .option("--brand <id>", "Brand id (defaults to active brand)")
  .option("--json", "Emit raw JSON payload")
  .action((opts) => competitorsListCommand(opts));

competitors
  .command("add <domains...>")
  .description("Add one or more competitor domains (1-20) and start analysis. Async.")
  .option("--brand <id>", "Brand id (defaults to active brand)")
  .option("--no-wait", "Print operationId and return without polling")
  .option("--json", "Emit raw JSON payload")
  .action((domains, opts) => competitorsAddCommand(domains, opts));

competitors
  .command("import")
  .description("Bulk-import competitor domains from a file (newline- or comma-separated, max 20). Async.")
  .requiredOption("--file <path>", "Path to file containing domains (one per line or comma-separated)")
  .option("--brand <id>", "Brand id (defaults to active brand)")
  .option("--no-wait", "Print operationId and return without polling")
  .option("--json", "Emit raw JSON payload")
  .action((opts) => competitorsImportCommand(opts));

competitors
  .command("delete <id>")
  .description("Remove a competitor by ID. Requires --destructive.")
  .option("--brand <id>", "Brand id (defaults to active brand)")
  .option("--destructive", "Required confirmation flag")
  .option("--json", "Emit raw JSON payload")
  .action((id, opts) => competitorsDeleteCommand(id, opts));

competitors
  .command("refresh")
  .description("Re-analyze all competitors (charges credits per competitor). Async.")
  .option("--brand <id>", "Brand id (defaults to active brand)")
  .option("--no-wait", "Print operationId and return without polling")
  .option("--json", "Emit raw JSON payload")
  .action((opts) => competitorsRefreshCommand(opts));

const competitorsComparison = competitors
  .command("comparison")
  .description("Show the brand vs. competitors comparison report.")
  .option("--brand <id>", "Brand id (defaults to active brand)")
  .option("--json", "Emit raw JSON payload")
  .action((opts) => competitorsComparisonCommand(opts));

competitorsComparison
  .command("recompute")
  .description("Recompute the comparison report synchronously.")
  .option("--brand <id>", "Brand id (defaults to active brand)")
  .option("--json", "Emit raw JSON payload")
  .action((opts) => competitorsComparisonRecomputeCommand(opts));

competitors
  .command("sample")
  .description("Show a sample competitor card (useful before adding real competitors).")
  .option("--brand <id>", "Brand id (defaults to active brand)")
  .option("--json", "Emit raw JSON payload")
  .action((opts) => competitorsSampleCommand(opts));

program.parse(process.argv);
