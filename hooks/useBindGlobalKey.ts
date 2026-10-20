export function useBindGlobalKey(code: string, callback: () => void) {
  const handleKeydown = (e: KeyboardEvent) => {
    console.log(e.code, code);
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
