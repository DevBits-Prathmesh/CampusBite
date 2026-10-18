import { ensureSchema, HttpError } from "@/lib/db";

export function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export function withDb<C>(handler: (request: Request, context: C) => Promise<Response>) {
  return async (request: Request, context: C) => {
    try {
      await ensureSchema();
      return await handler(request, context);
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status);
      console.error(error);
      return json({ error: "The database request failed." }, 500);
    }
  };
}
