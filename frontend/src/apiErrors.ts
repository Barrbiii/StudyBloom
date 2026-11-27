/** Only our controlled errors reach the UI; raw validation input and server traces stay private. */
export class ApiFailure extends Error { constructor(message: string, public status?: number) { super(message); this.name='ApiFailure'; } }
export async function requireOk(response: Response, fallback: string): Promise<Response> {
  if (response.ok) return response;
  if (response.status === 429) throw new ApiFailure('Слишком много запросов. Подожди немного и попробуй снова.',429);
  if (response.status >= 500) throw new ApiFailure('Сервер временно недоступен. Введённые данные сохранены в форме.',response.status);
  let detail: unknown;
  try { detail=(await response.json()).detail; } catch { /* non-JSON proxy response */ }
  const safe = typeof detail==='string' && [400,403,404,409,422].includes(response.status)
    ? detail.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,240) : '';
  throw new ApiFailure(safe || fallback,response.status);
}
export function friendlyError(error: unknown, fallback: string): string {
  return error instanceof ApiFailure ? error.message : fallback;
}
