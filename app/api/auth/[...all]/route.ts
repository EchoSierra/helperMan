import { toNextJsHandler } from 'better-auth/next-js';
import { getAuth } from '@/lib/auth/auth';
import { isAllowedAuthRequest } from '@/lib/auth/policy';

const BASE_PATH = '/api/auth';

type Handler = (request: Request) => Promise<Response>;

function guarded(pick: (handlers: ReturnType<typeof toNextJsHandler>) => Handler): Handler {
  return async (request) => {
    const path = new URL(request.url).pathname.replace(BASE_PATH, '') || '/';
    if (!isAllowedAuthRequest(request.method, path)) {
      return new Response(JSON.stringify({ message: 'Not found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      });
    }
    return pick(toNextJsHandler(getAuth()))(request);
  };
}

export const GET = guarded((h) => h.GET);
export const POST = guarded((h) => h.POST);
