import api from "@/lib/api";

/**
 * Downloads an authenticated binary response. The access token is added by
 * the shared axios interceptor; never put it in a URL.
 */
export async function downloadFile(path, params, filename) {
  const blob = await api.get(path, { params, responseType: "blob" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || "download";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
