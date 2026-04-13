import { jsonrepair } from 'jsonrepair';

export function parseJsonResponse<T>(response: string): T {
  const jsonStart = response.indexOf('{');
  const jsonEnd = response.lastIndexOf('}');

  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error(`Could not find a JSON object in model response:\n${response}`);
  }

  const rawJson = response.substring(jsonStart, jsonEnd + 1);

  try {
    return JSON.parse(rawJson) as T;
  } catch {
    return JSON.parse(jsonrepair(rawJson)) as T;
  }
}
