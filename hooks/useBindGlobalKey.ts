export function useBindGlobalKey(code: string, callback: () => void) {
  const handleKeydown = (e: KeyboardEvent) => {
    if (e.code !== code) return;

    callback();
  };

  onMounted(() => {
    window.addEventListener("keydown", handleKeydown);
  });

  onUnmounted(() => {
    window.removeEventListener("keydown", handleKeydown);
  });
}
