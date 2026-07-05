export async function jsonRpc(endpoint: string, method: string, params: any): Promise<any> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method,
      params,
      id: `grok-${Date.now()}-${Math.random()}`,
    }),
  });

  if (!response.ok) {
    throw new Error(`JSON-RPC HTTP error: ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as any;
  if (json.error) {
    throw new Error(`JSON-RPC error: ${json.error.code} ${json.error.message}`);
  }
  return json.result;
}
