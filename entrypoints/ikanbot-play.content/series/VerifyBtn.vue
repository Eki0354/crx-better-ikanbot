<template>
  <button class="btn-verify" @click="onVerifySources">标记无效源</button>
</template>

<script setup lang="ts">
const CN_BS = "bad-source";

function setBadSource(btn: Element, isBad = true) {
  if (isBad) {
    if (!btn.classList.contains(CN_BS)) {
      btn.classList.add(CN_BS);
    }
  } else {
    btn.classList.remove(CN_BS);
  }
}

async function onVerifySources() {
  const btns = Array.from(
    document.querySelectorAll("#lineContent .line-res [name='lineData']"),
  );

  const promises = btns.map(async (btn) => {
    const source = btn.getAttribute("udata");
    if (!source) return;

    try {
      const res = await fetch(source);

      const isOk = res.ok && res.status === 200;
      setBadSource(btn, !isOk);

      return isOk;
    } catch (error) {
      setBadSource(btn, true);
      return false;
    }
  });

  return Promise.all(promises);
}
</script>

<style lang="scss" scoped>
.btn-verify {
  background-color: #00a1d6;
  border: none;
  color: #fff;
  padding: 8px 0;
  margin: 0 32px;
}
</style>

<style lang="scss">
#lineContent .line-res [name="lineData"].bad-source {
  position: relative;

  &:before {
    content: "X";
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate3d(-50%, -50%, 0);
    color: red;
    font-weight: 600;
    font-size: 20px;
  }
}
</style>
