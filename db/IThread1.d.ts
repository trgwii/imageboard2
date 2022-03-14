export interface IThread {
  loadTitle(id: number): Promise<{ hash: string; title: string }>;
  lastModified(id: number): Promise<Date>;
  recent(max: number): Promise<{
    id: number;
    modified: number;
  }[]>;
  create(title: string, text: string, hash: string): Promise<number>;
  post(id: number, replyText: string, hash: string): Promise<void>;
  load(id: number): Promise<{
    title: string;
    hash: string;
    text: string;
    replies: { hash: string; text: string }[];
  }>;
}
