interface RepurposeCommandOptions {
    sourceType: string;
    sourceContent?: string;
    sourceBlog?: string;
    sourceUrl?: string;
    sourcePost?: string;
    targetType: string;
    targetPlatforms?: string;
    variations?: string;
    specificGoal?: string;
    angle?: string;
    textLength?: string;
    includeLink?: boolean;
    themeId?: string;
    voice?: string;
}
export declare function repurposeCommand(options: RepurposeCommandOptions): Promise<void>;
export {};
