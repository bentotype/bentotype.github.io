import { loadingOverlay, modalContainer } from './state.js';

/**
 * Toggles the global loading overlay.
 */
export function setLoading(show) {
  if (show) {
    loadingOverlay.classList.add('flex');
    setTimeout(() => loadingOverlay.classList.add('show'), 10);
  } else {
    loadingOverlay.classList.remove('show');
    setTimeout(() => loadingOverlay.classList.remove('flex'), 300);
  }
}

/**
 * Basic modal alert helper used across the app.
 */
export function showAlert(title, message) {
  const id = 'modal-' + Date.now();
  modalContainer.innerHTML = `
        <div id="${id}" class="modal fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center">
            <div class="bg-gray-800 p-4 rounded-md">
                <h3 class="font-medium text-white">${title}</h3>
                <p class="text-sm text-gray-400">${message}</p>
                <div class="mt-3 text-right">
                    <button data-action="close-modal" data-target="${id}" class="px-3 py-1 bg-indigo-600 text-white rounded-md">OK</button>
                </div>
            </div>
        </div>`;
  setTimeout(() => document.getElementById(id).classList.add('flex', 'show'), 10);
}

export function showConfirm(title, message, opts = {}) {
  const confirmText = opts.confirmText || 'Confirm';
  const cancelText = opts.cancelText || 'Cancel';
  const id = 'confirm-' + Date.now();
  return new Promise((resolve) => {
    modalContainer.innerHTML = `
      <div id="${id}" class="modal fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center">
        <div class="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-md space-y-4">
          <h3 class="text-lg font-semibold text-gray-900">${title}</h3>
          <p class="text-sm text-gray-700">${message}</p>
          <div class="flex justify-end gap-3 pt-2">
            <button type="button" class="px-4 py-2 rounded-md bg-red-600 text-white font-semibold hover:bg-red-500" data-confirm="ok">${confirmText}</button>
            <button type="button" class="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100" data-confirm="cancel">${cancelText}</button>
          </div>
        </div>
      </div>`;
    setTimeout(() => document.getElementById(id)?.classList.add('flex', 'show'), 10);

    function cleanup(result) {
      const modal = document.getElementById(id);
      if (modal) {
        modal.classList.remove('show');
        setTimeout(() => {
          if (modal.parentElement === modalContainer) modalContainer.innerHTML = '';
        }, 200);
      }
      resolve(result);
    }

    const modal = document.getElementById(id);
    modal?.addEventListener('click', (e) => {
      const target = e.target;
      if (target?.dataset?.confirm === 'ok') {
        cleanup(true);
      } else if (target?.dataset?.confirm === 'cancel') {
        cleanup(false);
      }
    });
  });
}
