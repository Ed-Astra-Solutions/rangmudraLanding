/* otp-input.js — OTP box keyboard behaviour */

export function initOTPInput() {
  const grid = document.getElementById('otp-grid');
  const verifyBtn = document.getElementById('verify-btn');
  if (!grid) return;

  const boxes = Array.from(grid.querySelectorAll('.otp-box'));

  function isComplete() {
    return boxes.every(b => /^\d$/.test(b.value));
  }

  function updateVerifyBtn() {
    if (verifyBtn) verifyBtn.disabled = !isComplete();
  }

  boxes.forEach((box, idx) => {
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace') {
        if (box.value) {
          box.value = '';
          updateVerifyBtn();
        } else if (idx > 0) {
          boxes[idx - 1].value = '';
          boxes[idx - 1].focus();
          updateVerifyBtn();
        }
        e.preventDefault();
        return;
      }

      if (e.key === 'ArrowLeft' && idx > 0) { boxes[idx - 1].focus(); e.preventDefault(); return; }
      if (e.key === 'ArrowRight' && idx < boxes.length - 1) { boxes[idx + 1].focus(); e.preventDefault(); return; }

      if (!/^\d$/.test(e.key) && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
      }
    });

    box.addEventListener('input', () => {
      const val = box.value.replace(/\D/g, '');
      if (val.length > 1) {
        /* handle paste via input event */
        const digits = val.slice(0, 6 - idx);
        digits.split('').forEach((d, i) => {
          if (boxes[idx + i]) boxes[idx + i].value = d;
        });
        const next = Math.min(idx + digits.length, boxes.length - 1);
        boxes[next].focus();
      } else {
        box.value = val;
        if (val && idx < boxes.length - 1) boxes[idx + 1].focus();
      }
      updateVerifyBtn();
    });

    box.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasted = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
      if (pasted.length === 6) {
        pasted.split('').forEach((d, i) => { if (boxes[i]) boxes[i].value = d; });
        boxes[5].focus();
        updateVerifyBtn();
      }
    });

    box.addEventListener('focus', () => box.select());
  });
}
