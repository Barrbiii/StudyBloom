/** Учебные запросы сообщают оболочке об истечении/отзыве сессии. */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);
  if (response.status === 401) {
    window.dispatchEvent(new Event('studybloom:session-expired'));
    throw new Error('Необходим повторный вход');
  }
  return response;
}
