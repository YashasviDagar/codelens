const rawBodies = new WeakMap<object, Buffer>();

// Fastify passes the FastifyRequest to content-type parsers, while handlers
// read the body via request.raw, so always key on the underlying raw request.
export function setRawBody(req: object, body: Buffer): void {
  const key = (req as { raw?: object }).raw ?? req;
  rawBodies.set(key, body);
}

export function getRawBody(request: { raw: object }): Buffer | undefined {
  return rawBodies.get(request.raw);
}

