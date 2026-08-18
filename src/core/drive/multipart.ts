export function createMultipartBody(
  metadata: Record<string, unknown>,
  data: string,
): { boundary: string; body: string } {
  const metadataJson = JSON.stringify(metadata);
  let boundary: string;
  let attempt = 0;
  do {
    boundary = `laimelea_backup_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${attempt}`;
    attempt += 1;
  } while (metadataJson.includes(boundary) || data.includes(boundary));

  return {
    boundary,
    body:
      `--${boundary}\r\n` +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      metadataJson +
      "\r\n" +
      `--${boundary}\r\n` +
      "Content-Type: application/json\r\n\r\n" +
      data +
      "\r\n" +
      `--${boundary}--`,
  };
}
