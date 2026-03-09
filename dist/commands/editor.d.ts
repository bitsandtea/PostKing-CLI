export declare function editorRewriteCommand(options: {
    text: string;
    voice?: string;
    platform?: string;
}): Promise<void>;
export declare function editorHumanizeCommand(options: {
    text: string;
    platform?: string;
}): Promise<void>;
export declare function editorAICheckCommand(options: {
    text: string;
}): Promise<void>;
