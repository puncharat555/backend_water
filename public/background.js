function updateBackground() {
  const hour = new Date().getHours();
  const bg = document.getElementById("background");

  bg.className = ""; // ล้าง class เดิม

  if (hour >= 6 && hour < 11) {
    bg.classList.add("bg-morning"); // เช้า
  } else if (hour >= 11 && hour < 16) {
    bg.classList.add("bg-day");     // กลางวัน
  } else if (hour >= 16 && hour < 19) {
    bg.classList.add("bg-evening"); // เย็น
  } else {
    bg.classList.add("bg-night");   // กลางคืน
  }
}

updateBackground();
setInterval(updateBackground, 60 * 60 * 1000); // อัปเดตทุกชั่วโมง
