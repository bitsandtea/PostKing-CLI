interface PostsCreateOptions {
    platform: string;
    content: string;
    image?: string;
    schedule?: string;
}
interface PostsListOptions {
    status?: string;
    platform?: string;
    limit?: number;
}
export declare function postsCreateCommand(options: PostsCreateOptions): Promise<void>;
export declare function postsListCommand(options: PostsListOptions): Promise<void>;
interface PostsApproveOptions {
    variation?: string;
    schedule?: string;
    timezone?: string;
}
export declare function postsApproveCommand(postId: string, options: PostsApproveOptions): Promise<void>;
export declare function postsGenerateCommand(options: {
    platform: string;
    theme?: string;
    variations?: number;
    voice?: string;
}): Promise<void>;
export declare function postsCalendarCommand(options: {
    days?: string;
}): Promise<void>;
export declare function postsViewCommand(postId: string): Promise<void>;
export declare function postsCancelCommand(postId: string): Promise<void>;
export declare function postsRescheduleCommand(postId: string, options: {
    date: string;
}): Promise<void>;
export declare function postsDeleteCommand(postId: string): Promise<void>;
export declare function postsGenerateBatchCommand(options: {
    platform: string;
    voice?: string;
    frequency: string;
    postsPerDay: string;
    times: string;
    days: string;
}): Promise<void>;
export {};
