type SessionSnapshot = { accessToken?: string; error?: string };

function callbackParameters(search: string, hash: string) {
  const searchParameters = new URLSearchParams(search);
  const hashParameters = new URLSearchParams(hash.replace(/^#/, ""));
  return {
    error: searchParameters.get("error") || hashParameters.get("error"),
    description: searchParameters.get("error_description") || hashParameters.get("error_description"),
  };
}

export function googleCallbackError(search: string, hash: string) {
  const failure = callbackParameters(search, hash);
  if (!failure.error) return "";
  if (failure.error === "access_denied") return "O acesso pelo Google foi cancelado. Você pode tentar novamente quando quiser.";
  return failure.description?.trim() || "O Google não conseguiu concluir o acesso. Tente novamente.";
}

export async function waitForGoogleAccessToken(
  readSession: () => Promise<SessionSnapshot>,
  options: { attempts?: number; intervalMs?: number; wait?: (milliseconds: number) => Promise<void> } = {},
) {
  const attempts = options.attempts ?? 12;
  const intervalMs = options.intervalMs ?? 200;
  const wait = options.wait ?? ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  let sessionError = "";
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const snapshot = await readSession();
    if (snapshot.accessToken) return snapshot.accessToken;
    if (snapshot.error) sessionError = snapshot.error;
    if (attempt + 1 < attempts) await wait(intervalMs);
  }
  throw new Error(sessionError || "O Google não devolveu uma sessão válida. Tente entrar novamente.");
}
