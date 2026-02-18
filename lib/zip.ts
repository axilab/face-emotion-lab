import JSZip from "jszip";

export async function downloadResultsAsZip(
  items: Array<{ url: string; filename: string }>,
  zipName: string = "results.zip"
): Promise<void> {
  const zip = new JSZip();

  await Promise.all(
    items.map(async (item) => {
      const res = await fetch(item.url);
      const blob = await res.blob();
      zip.file(item.filename, blob);
    })
  );

  const content = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(content);
  const a = document.createElement("a");
  a.href = url;
  a.download = zipName;
  a.click();
  URL.revokeObjectURL(url);
}
