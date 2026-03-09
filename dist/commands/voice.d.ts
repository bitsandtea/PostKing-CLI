interface VoiceRewriteOptions {
    profileId: string;
    text: string;
    platform?: string;
}
export declare function voiceListCommand(): Promise<void>;
export declare function voiceRewriteCommand(options: VoiceRewriteOptions): Promise<void>;
export {};
