import { premierepro } from "../globals";
import { asTransaction, lockedTransaction } from "./utils/premierepro-utils";
import type { FolderItem, Project, ProjectItem } from "../types/ppro";

const TYPE_BIN = 1;

export const notify = async (message: string) => {
  alert(message);
};

/**
 * Gets the root bin (folder) of the active project.
 */
export async function getRootBin(): Promise<FolderItem> {
  const project = await premierepro.Project.getActiveProject();
  return project.getRootItem();
}

/**
 * Finds a child bin by name within a parent folder.
 * Returns null if not found.
 */
export async function findChildBin(
  parent: FolderItem,
  name: string
): Promise<FolderItem | null> {
  const items = await parent.getItems();
  const found = items.find(
    (item: ProjectItem) => item.name === name && item.type === TYPE_BIN
  );
  if (found) {
    return premierepro.FolderItem.cast(found);
  }
  return null;
}

/**
 * Creates a new bin inside the parent folder.
 * Uses a locked transaction for thread safety.
 */
export async function createBinInParent(
  parent: FolderItem,
  name: string
): Promise<FolderItem> {
  const project = await premierepro.Project.getActiveProject();
  await lockedTransaction(
    project,
    [parent.createBinAction(name, false)],
    `Create Bin: ${name}`
  );
  const newBin = await findChildBin(parent, name);
  if (!newBin) {
    throw new Error(`Failed to create bin: ${name}`);
  }
  return newBin;
}

/**
 * Imports files into a target bin.
 * @param filePaths - Array of absolute file paths to import
 * @param targetBin - The bin to import files into
 * @returns true if import succeeded
 */
export async function importFilesToBin(
  filePaths: string[],
  targetBin: FolderItem
): Promise<boolean> {
  const project = await premierepro.Project.getActiveProject();
  const targetAsProjectItem = premierepro.ProjectItem.cast(targetBin);
  return project.importFiles(filePaths, true, targetAsProjectItem, false);
}

export const createBin = async (name: string) => {
  const project = await premierepro.Project.getActiveProject();
  const root = await project.getRootItem();
  asTransaction(project, [root.createBinAction("Bin1", true)], "Create Bin");
};

export const getProjectInfo = async () => {
  const project = await premierepro.Project.getActiveProject();
  const info = {
    name: project.name,
    path: project.path,
    id: project.guid.toString(),
  };
  return info;
};

export const renameItem = async () => {
  const proj = await premierepro.Project.getActiveProject();
  const root = await proj.getRootItem();
  const items = await root.getItems();
  await lockedTransaction(
    proj,
    [items[0].createSetNameAction("TEST")],
    "Rename Item",
  );
};

// export const renameItemCurrent = async () => {
//   const proj = await premierepro.Project.getActiveProject();
//   const root = await proj.getRootItem();
//   // Undo Group #1
//   proj.lockedAccess(() =>
//     proj.executeTransaction(async (compAction) => {
//       compAction.addAction(root.createBinAction("Bin1", true));
//     }, "Create Bin"),
//   );
//   // Have to find the new Bin
//   const itemsNew = await root.getItems();
//   const newBin = itemsNew.find((item) => item.name === "Bin1")!;
//   // Undo Group #2
//   proj.lockedAccess(() =>
//     proj.executeTransaction(async (compAction) => {
//       compAction.addAction(newBin.createSetNameAction("TEST"));
//     }, "Rename Bin"),
//   );
// };
export const renameItemCurrent = async () => {
  const proj = await premierepro.Project.getActiveProject();
  const root = await proj.getRootItem();
  // Undo Group #1
  proj.lockedAccess(() =>
    proj.executeTransaction(async (compAction) => {
      compAction.addAction(root.createBinAction("Bin1", true));
      const itemsNew = await root.getItems();
      const newBin = itemsNew.find((item) => item.name === "Bin1")!;
      compAction.addAction(newBin.createSetNameAction("TEST"));
    }, "Create + RenameBin"),
  );
};

// export const renameItemIdeal = async () => {
//   const proj = await premierepro.Project.getActiveProject();
//   const root = await proj.getRootItem();
//   const items = await root.getItems();
//   // Undo Group #1
//   proj.lockedAccess(() =>
//     proj.executeTransaction(async (compAction) => {
//       compAction.addAction(root.createBinAction("Bin1", true)).then(newBin => {
//         // Manipulate result immediately
//         compAction.addAction(newBin.createSetNameAction("TEST"));
//       })
//     }, 'Create + Rename Bin'),
//   );
// };

// export const renameItemDREAMING = async () => {
//   const proj = await premierepro.Project.getActiveProject();
//   const root = await proj.getRootItem();
//   const items = await root.getItems();
//   proj.beginUndoGroup('Create + Rename Bin');
//   const newItem = root.createBin("Bin1", true);
//   const newItem = newItem.setName("TEST");
//   proj.endUndoGroup('Create + Rename Bin');
// };
