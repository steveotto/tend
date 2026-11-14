import type { Server } from 'node:http';

export function isPublicAddress(address: string): boolean;
export function parseFeedUrl(raw: string, isRedirect?: boolean): URL;
export function createLocalCalendarReaderServer(): Server;
