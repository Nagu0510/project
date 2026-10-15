import { api } from '../services/api';

/** Download a file from the API and hand it to the browser as a normal file download. Returns the saved file name. */
export async function downloadFile(endpoint, fallbackName = 'download') {
  const { blob, filename } = await api.download(endpoint);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || fallbackName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return link.download;
}
