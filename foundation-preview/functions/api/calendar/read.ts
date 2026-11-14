import { handleCalendarRead } from '../../../src/domain/calendar-reader.ts';

export function onRequest(context: { request: Request }): Promise<Response> {
  return handleCalendarRead(context.request);
}
