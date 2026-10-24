import * as setContent from "./setContent.mjs";

let activeBgIndex = 0;
let l1;
let l2;

function initSubLayers(bgLayer) {
  l1 = bgLayer.querySelector(".bg-layer-1");
  l2 = bgLayer.querySelector(".bg-layer-2");
  if (!l1 || !l2) {
    bgLayer.innerHTML = "";
    l1 = document.createElement("div");
    l1.className = "bg-sub-layer bg-layer-1";
    l2 = document.createElement("div");
    l2.className = "bg-sub-layer bg-layer-2";
    l1.style.opacity = "1";
    l2.style.opacity = "0";
    bgLayer.appendChild(l1);
    bgLayer.appendChild(l2);
    activeBgIndex = 0;
  }
}

function loadNewSpotlightImage(bgLayer) {
  initSubLayers(bgLayer);

  const currentRes = setContent.getImageResolution
    ? setContent.getImageResolution()
    : "4K";
  const { width, height } = setContent.getResolutionDimensions
    ? setContent.getResolutionDimensions(currentRes)
    : { width: 3840, height: 2160 };

  const imageUrl = `https://picsum.photos/${width}/${height}?random=${Date.now()}`;

  const img = new Image();
  img.onload = () => {
    const nextIndex = activeBgIndex === 0 ? 1 : 0;
    const currentLayer = activeBgIndex === 0 ? l1 : l2;
    const nextLayer = nextIndex === 0 ? l1 : l2;
    nextLayer.style.backgroundImage = `url('${imageUrl}')`;
    nextLayer.style.opacity = "1";
    if (currentLayer.style.backgroundImage) currentLayer.style.opacity = "0";
    activeBgIndex = nextIndex;
  };
  img.onerror = () =>
    console.warn("Spotlight 배경 이미지를 불러오지 못했습니다.");
  img.src = imageUrl;
}

function triggerImageChange() {
  const bgLayer = document.getElementById("bgImageLayer");
  if (bgLayer) loadNewSpotlightImage(bgLayer);
}

document.documentElement.classList.add("spotlight");
const bgLayer = document.getElementById("bgImageLayer");
if (bgLayer) {
  bgLayer.style.display = "block";
  loadNewSpotlightImage(bgLayer);
}
const overlay = document.getElementById("bgOverlay");
if (overlay) overlay.style.display = "block";

setContent.startBibleVerseCycle(triggerImageChange);
