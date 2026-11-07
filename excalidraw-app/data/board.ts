import { debounce } from "@excalidraw/common";
import { serializeAsJSON } from "@excalidraw/excalidraw/data/json";
import { restoreAppState, restoreElements } from "@excalidraw/excalidraw/data/restore";
import { getSceneVersion } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";

export const boardId =
  window.location.pathname.match(/^\/b\/([A-Za-z0-9_-]{6,64})$/)?.[1] ?? null;

const boardUrl = (id: string) => `/api/boards/${id}`;

export const loadBoard = async (id: string) => {
  const res = await fetch(boardUrl(id), { credentials: "same-origin" });
  if (res.status === 401) {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    throw new Error("Not signed in");
  }
  if (!res.ok) {
    throw new Error(`Could not load board (${res.status})`);
  }
  const data = await res.json();
  return {
    elements: restoreElements(data.elements, null, {
      repairBindings: true,
      deleteInvisibleElements: true,
    }),
    appState: restoreAppState(data.appState, null),
    files: (data.files ?? {}) as BinaryFiles,
    scrollToContent: true,
  };
};

let lastSavedSignature: string | null = null;

const signature = (
  elements: readonly ExcalidrawElement[],
  appState: Pick<AppState, "viewBackgroundColor">,
  files: BinaryFiles,
) =>
  `${getSceneVersion(elements)}:${appState.viewBackgroundColor}:${
    Object.keys(files).length
  }`;

export const markBoardLoaded = (
  elements: readonly ExcalidrawElement[],
  appState: Pick<AppState, "viewBackgroundColor">,
  files: BinaryFiles,
) => {
  lastSavedSignature = signature(elements, appState, files);
};

const putBoard = debounce(
  (
    id: string,
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles,
    sig: string,
  ) => {
    const body = serializeAsJSON(elements, appState, files, "local");
    fetch(boardUrl(id), {
      method: "PUT",
      credentials: "same-origin",
      keepalive: body.length < 60_000,
      headers: { "Content-Type": "application/json" },
      body,
    })
      .then((res) => {
        if (res.ok) {
          lastSavedSignature = sig;
        } else {
          console.error("board save failed", res.status);
        }
      })
      .catch((err) => console.error("board save failed", err));
  },
  1000,
);

export const saveBoard = (
  id: string,
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  files: BinaryFiles,
) => {
  const sig = signature(elements, appState, files);
  if (sig !== lastSavedSignature) {
    putBoard(id, elements, appState, files, sig);
  }
};

export const flushBoardSave = () => putBoard.flush();
