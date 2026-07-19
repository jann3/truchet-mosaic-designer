import type { LayerGroup, TruchetDocument } from './types';
import { generateId } from './generateId';

/** Tags every layer in `layerIds` with a new group's id. Layers keep their existing stacking position. */
export function createGroup(document: TruchetDocument, name: string, layerIds: readonly string[]): TruchetDocument {
  if (layerIds.length < 2) return document;

  const group: LayerGroup = { id: generateId('group'), name, visible: true, opacity: 1, collapsed: false };
  const memberIds = new Set(layerIds);
  return {
    ...document,
    groups: [...document.groups, group],
    layers: document.layers.map((layer) => (memberIds.has(layer.id) ? { ...layer, groupId: group.id } : layer)),
  };
}

export function ungroupLayer(document: TruchetDocument, layerId: string): TruchetDocument {
  return {
    ...document,
    layers: document.layers.map((layer) => (layer.id === layerId ? { ...layer, groupId: null } : layer)),
  };
}

/** Removes the group but leaves its member layers in place, just ungrouped. */
export function deleteGroup(document: TruchetDocument, groupId: string): TruchetDocument {
  return {
    ...document,
    groups: document.groups.filter((group) => group.id !== groupId),
    layers: document.layers.map((layer) => (layer.groupId === groupId ? { ...layer, groupId: null } : layer)),
  };
}

export function renameGroup(document: TruchetDocument, groupId: string, name: string): TruchetDocument {
  return { ...document, groups: document.groups.map((group) => (group.id === groupId ? { ...group, name } : group)) };
}

export function setGroupVisibility(document: TruchetDocument, groupId: string, visible: boolean): TruchetDocument {
  return {
    ...document,
    groups: document.groups.map((group) => (group.id === groupId ? { ...group, visible } : group)),
  };
}

export function setGroupOpacity(document: TruchetDocument, groupId: string, opacity: number): TruchetDocument {
  const clamped = Math.min(1, Math.max(0, opacity));
  return {
    ...document,
    groups: document.groups.map((group) => (group.id === groupId ? { ...group, opacity: clamped } : group)),
  };
}

export function toggleGroupCollapsed(document: TruchetDocument, groupId: string): TruchetDocument {
  return {
    ...document,
    groups: document.groups.map((group) => (group.id === groupId ? { ...group, collapsed: !group.collapsed } : group)),
  };
}
