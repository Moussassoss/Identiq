export const AI_BASE_URL = process.env.NEXT_PUBLIC_AI_BASE_URL!;

// Generic helper function to send a POST request with JSON data
export async function postJSON<T>(url: string, body: any): Promise<T> {
  // Send HTTP POST request
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  // If the request failed, throw an error with the server response
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
