/** 在入口调用一次即可（避免在组件 render 路径重复 setOptions） */
export function initMarked(marked) {
  marked.setOptions({
    gfm: true,
    breaks: true,
  });
}
