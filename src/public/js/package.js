let packages = [];
let selectedPackage = null;
let selectedSite = "jun88"; // ค่าเริ่มต้น
const apiBase = "http://localhost:8002";
// ================== โหลดข้อมูลแพ็กเกจจาก API ==================
async function loadPackages() {
  try {
    const res = await fetch(`${apiBase}/api/packages`);
    const data = await res.json();
    packages = data.package.package_data || [];
    renderPackages();
  } catch (err) {
    console.error("โหลดแพ็กเกจไม่สำเร็จ:", err);
  }
}

// ================== แสดงรายการแพ็กเกจ ==================
function renderPackages() {
  const grid = document.getElementById("packageGrid");
  grid.innerHTML = "";

  packages.forEach(pkg => {
    const card = document.createElement("div");
    card.className = "package-card";
    card.innerHTML = `
      <img src="${pkg.package_logo}" alt="logo" class="package-logo" />
      <h3>${pkg.package_name}</h3>
      <p>${pkg.package_desc}</p>
      <p class="price">${pkg.package_sale > 0 ? pkg.package_sale : pkg.package_price} บาท</p>
      <button class="select-package-btn" onclick='openModal(${JSON.stringify(pkg)})'>เลือกแพ็กเกจ</button>
    `;
    grid.appendChild(card);
  });
}

// ================== เปิด Modal ==================
function openModal(pkg) {
  selectedPackage = pkg;
  document.getElementById("selected-package").innerText = pkg.package_name;
  document.getElementById("selected-price").innerText =
    pkg.package_sale > 0 ? pkg.package_sale : pkg.package_price;
  document.getElementById("modal").classList.add("modal-open");

  const userList = document.getElementById("userList");
  userList.innerHTML = "";

  const maxQty = pkg.code_qty || 1;

  if (maxQty > 1) {
    addUserInput();
    document.querySelector(".add-user-btn").disabled = false;
  } else {
    addUserInput(true); // โหมดห้ามเพิ่ม
    document.querySelector(".add-user-btn").disabled = true;
  }
}

// ================== ปิด Modal ==================
document.getElementById("closeModalBtn").addEventListener("click", () => {
  document.getElementById("modal").classList.remove("modal-open");
});

// ================== สลับ Site ==================
document.addEventListener("click", e => {
  if (e.target.closest(".site-option")) {
    document.querySelectorAll(".site-option").forEach(el => el.classList.remove("active"));
    const option = e.target.closest(".site-option");
    option.classList.add("active");
    selectedSite = option.dataset.site;
  }
});

// ================== เพิ่มยูสเซอร์ ==================
function addUserInput(isSingle = false) {
  const userList = document.getElementById("userList");
  const currentItems = userList.querySelectorAll(".user-item").length;
  const maxQty = selectedPackage.code_qty || 1;

  if (currentItems >= maxQty && !isSingle) {
    return Swal.fire({
      icon: "warning",
      title: "เกินจำนวนโค้ดที่กำหนด!",
      text: `แพ็กเกจนี้มีได้สูงสุด ${maxQty} โค้ดเท่านั้น`,
    });
  }

  const div = document.createElement("div");
  div.className = "user-item";
  div.innerHTML = `
    <input type="text" class="user-name" placeholder="ชื่อยูสเซอร์" required />
    <input type="number" class="count-input" placeholder="จำนวน" min="1" value="1" />
    ${!isSingle ? `<button class="remove-user-btn" onclick="removeUser(this)">✖</button>` : ""}
  `;
  userList.appendChild(div);
}

// ================== ลบยูสเซอร์ ==================
function removeUser(btn) {
  btn.parentElement.remove();
}

// ================== พรีวิวสลิป ==================
function handleSlipChange() {
  const input = document.getElementById("slipInput");
  const fileName = document.getElementById("slipFileName");
  const preview = document.getElementById("slipPreview");
  if (input.files.length > 0) {
    fileName.textContent = input.files[0].name;
    const reader = new FileReader();
    reader.onload = e => {
      preview.src = e.target.result;
      preview.style.display = "block";
    };
    reader.readAsDataURL(input.files[0]);
  } else {
    fileName.textContent = "ยังไม่ได้เลือกไฟล์";
    preview.style.display = "none";
  }
}

// ================== Toggle Telegram Input ==================
function toggleTelegramInput() {
  document.getElementById("telegramInputGroup").style.display =
    document.getElementById("telegramNotify").checked ? "block" : "none";
}

// ================== คัดลอกเลขบัญชี ==================
function copyAccount() {
  const account = document.getElementById("bankAccount").innerText;
  navigator.clipboard.writeText(account).then(() => {
    const status = document.getElementById("copyStatus");
    status.innerText = "คัดลอกแล้ว!";
    setTimeout(() => (status.innerText = ""), 1500);
  });
}

// ================== ส่งข้อมูลไป Backend ==================
async function submitPayment() {
  const slip = document.getElementById("slipInput");
  const userItems = document.querySelectorAll(".user-item");
  const loading = document.getElementById("loadingStatus");

  if (!selectedPackage) return Swal.fire({ icon: "warning", title: "ยังไม่ได้เลือกแพ็กเกจ" });
  if (slip.files.length === 0) return Swal.fire({ icon: "warning", title: "ยังไม่ได้แนบสลิป" });
  if (userItems.length === 0) return Swal.fire({ icon: "warning", title: "ยังไม่ได้เพิ่มยูสเซอร์" });

  const userData = [];
  let totalCodes = 0;
  userItems.forEach(item => {
    const name = item.querySelector(".user-name").value.trim();
    const count = parseInt(item.querySelector(".count-input").value);
    if (name && count > 0) {
      totalCodes += count;
      userData.push({ name, count });
    }
  });

  const maxQty = selectedPackage.code_qty || 1;
  if (totalCodes > maxQty) {
    return Swal.fire({
      icon: "error",
      title: "จำนวนโค้ดเกิน!",
      text: `แพ็กเกจนี้มี ${maxQty} โค้ดเท่านั้น`,
    });
  }

  const notifyTelegram = document.getElementById("telegramNotify").checked;
  const telegramId = document.getElementById("telegramId").value.trim();

  const form = new FormData();
  form.append("package_id", selectedPackage.package_id);
  form.append("package", selectedPackage.package_name);
  form.append("price", selectedPackage.package_sale || selectedPackage.package_price);
  form.append("site", selectedSite);
  form.append("user", JSON.stringify(userData));
  form.append("slip", slip.files[0]);
  form.append("notifyTelegram", notifyTelegram);
  if (notifyTelegram) form.append("telegramId", telegramId);

  loading.style.display = "block";
  const apiBase = "http://localhost:8002";

  try {
    const res = await fetch(`${apiBase}/api/submit-order`, { method: "POST", body: form });
    const result = await res.json();

    if (res.ok && result.status === "success") {
      await Swal.fire({
        icon: "success",
        title: "ส่งข้อมูลสำเร็จ",
        text: "ระบบได้รับข้อมูลแล้ว กรุณารอการตรวจสอบ",
      });
      window.open("https://t.me/freeceditcode", "_blank");
    } else {
      Swal.fire({ icon: "error", title: "เกิดข้อผิดพลาด", text: result.message });
    }
  } catch (e) {
    Swal.fire({ icon: "error", title: "เชื่อมต่อไม่สำเร็จ", text: e.message });
  } finally {
    loading.style.display = "none";
  }
}

// ================== Event Listener ==================
document.getElementById("submitPaymentBtn").addEventListener("click", submitPayment);
window.addEventListener("DOMContentLoaded", loadPackages);
