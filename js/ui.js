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
