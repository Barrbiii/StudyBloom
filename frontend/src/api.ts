import { ApiFailure } from './apiErrors';
/** Учебные запросы сообщают оболочке об истечении/отзыве сессии. */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let response: Response;
  try { response = await fetch(input, init); }
  catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiFailure('Не удалось подключиться к серверу. Проверь соединение; введённые данные остались в форме.');
  }
  if (response.status === 401) {
    window.dispatchEvent(new Event('studybloom:session-expired'));
    throw new Error('Необходим повторный вход');
  }
  const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
  if (response.ok && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    window.dispatchEvent(new Event('studybloom:data-changed'));
  }
  return response;
}
