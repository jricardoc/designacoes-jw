import { API_URL } from "@/config/env";
import { tokenStore } from "./tokenStore";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  /** Skip auth header (e.g. login). */
  skipAuth?: boolean;
  /**
   * Teto de tempo em ms. Sem ele não há nenhum: o `fetch` do React Native espera
   * indefinidamente, então um backend NO AR mas sem responder (container reiniciando,
   * portal cativo do Wi-Fi) deixa a chamada pendurada para sempre.
   *
   * Não vale para tudo por padrão de propósito — o upload da programação em PDF pode
   * demorar bastante numa rede ruim, e cortá-lo seria pior que esperar. Ligue onde o
   * usuário fica preso esperando.
   */
  timeoutMs?: number;
};

/**
 * Thin fetch wrapper that prefixes the API base URL, injects the bearer token,
 * serialises JSON bodies and surfaces backend errors as {@link ApiError}.
 */
export async function apiRequest<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, skipAuth, headers, timeoutMs, ...rest } = options;

  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    ...(headers as Record<string, string>),
  };

  const isFormData =
    typeof FormData !== "undefined" && body instanceof FormData;

  if (body !== undefined && !isFormData) {
    finalHeaders["Content-Type"] = "application/json";
  }

  if (!skipAuth) {
    const token = await tokenStore.get();
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }

  const controlador = timeoutMs ? new AbortController() : null;
  const relogio = controlador
    ? setTimeout(() => controlador.abort(), timeoutMs)
    : null;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...rest,
      headers: finalHeaders,
      signal: controlador?.signal ?? rest.signal,
      body:
        body === undefined
          ? undefined
          : isFormData
            ? (body as FormData)
            : JSON.stringify(body),
    });
  } catch {
    // O abort do teto de tempo cai aqui junto com a falha de rede, e para quem chama
    // dá no mesmo: o servidor não respondeu. Status 0 = não foi o servidor que recusou.
    throw new ApiError("Sem conexão com o servidor", 0);
  } finally {
    if (relogio) clearTimeout(relogio);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const data = text ? safeJsonParse(text) : null;

  if (!response.ok) {
    const message =
      (data && typeof data === "object" && "error" in data
        ? (data as { error?: string }).error
        : undefined) || `Erro ${response.status}`;
    throw new ApiError(message, response.status);
  }

  return data as T;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
