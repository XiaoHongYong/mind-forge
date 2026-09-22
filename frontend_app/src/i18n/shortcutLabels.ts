import type { TFunction } from 'i18next';
import i18n from './index';

/**
 * Shortcut / toast labels keyed by registry id.
 * Each branch uses a literal `t('…')` so i18next-cli can extract the keys.
 */
export function translateShortcutLabel(id: string, t: TFunction = i18n.t.bind(i18n)): string {
  switch (id) {
    case 'node.addChild':
      return t('shortcuts.nodeAddChild', { defaultValue: 'Add child' });
    case 'node.addLeftChild':
      return t('shortcuts.nodeAddLeftChild', { defaultValue: 'Add left child (root)' });
    case 'node.addSibling':
      return t('shortcuts.nodeAddSibling', { defaultValue: 'Add sibling' });
    case 'node.delete':
      return t('shortcuts.nodeDelete', { defaultValue: 'Delete node' });
    case 'node.rename':
      return t('shortcuts.nodeRename', { defaultValue: 'Rename' });
    case 'node.notesToggle':
      return t('shortcuts.nodeNotesToggle', { defaultValue: 'Notes' });
    case 'node.notesOpen':
      return t('shortcuts.nodeNotesOpen', { defaultValue: 'Edit notes' });
    case 'node.addImage':
      return t('shortcuts.nodeAddImage', { defaultValue: 'Add image' });
    case 'node.linkFile':
      return t('shortcuts.nodeLinkFile', { defaultValue: 'Link to a file' });
    case 'node.attachFile':
      return t('shortcuts.nodeAttachFile', { defaultValue: 'Attach file' });
    case 'node.fold':
      return t('shortcuts.nodeFold', { defaultValue: 'Fold / Unfold' });
    case 'node.resetPosition':
      return t('shortcuts.nodeResetPosition', { defaultValue: 'Reset position' });
    case 'node.resetAllPositions':
      return t('shortcuts.nodeResetAllPositions', { defaultValue: 'Reset all positions' });
    case 'node.autoAlign':
      return t('shortcuts.nodeAutoAlign', { defaultValue: 'Auto-align subtree' });
    case 'node.colour':
      return t('shortcuts.nodeColour', { defaultValue: 'Colour picker' });
    case 'node.icons':
      return t('shortcuts.nodeIcons', { defaultValue: 'Icons' });
    case 'node.checkbox':
      return t('shortcuts.nodeCheckbox', { defaultValue: 'Checkbox' });
    case 'node.progress':
      return t('shortcuts.nodeProgress', { defaultValue: 'Progress' });
    case 'node.dates':
      return t('shortcuts.nodeDates', { defaultValue: 'Dates' });
    case 'node.url':
      return t('shortcuts.nodeUrl', { defaultValue: 'URL' });
    case 'node.labels':
      return t('shortcuts.nodeLabels', { defaultValue: 'Labels' });
    case 'view.root':
      return t('shortcuts.viewRoot', { defaultValue: 'Go to root' });
    case 'view.focusMode':
      return t('shortcuts.viewFocusMode', { defaultValue: 'Focus mode' });
    case 'view.layoutMode':
      return t('shortcuts.viewLayoutMode', { defaultValue: 'Toggle structure' });
    case 'view.zoomIn':
      return t('shortcuts.viewZoomIn', { defaultValue: 'Zoom in' });
    case 'view.zoomOut':
      return t('shortcuts.viewZoomOut', { defaultValue: 'Zoom out' });
    case 'view.zoomFit':
      return t('shortcuts.viewZoomFit', { defaultValue: 'Fit to window' });
    case 'view.colourTray':
      return t('shortcuts.viewColourTray', { defaultValue: 'Toggle colour tray' });
    case 'view.iconTray':
      return t('shortcuts.viewIconTray', { defaultValue: 'Toggle icon tray' });
    case 'view.formatSidebar':
      return t('shortcuts.viewFormatSidebar', { defaultValue: 'Toggle format sidebar' });
    case 'edit.copy':
      return t('shortcuts.editCopy', { defaultValue: 'Copy' });
    case 'edit.cut':
      return t('shortcuts.editCut', { defaultValue: 'Cut' });
    case 'edit.paste':
      return t('shortcuts.editPaste', { defaultValue: 'Paste' });
    case 'edit.undo':
      return t('shortcuts.editUndo', { defaultValue: 'Undo' });
    case 'edit.redo':
      return t('shortcuts.editRedo', { defaultValue: 'Redo' });
    case 'find.search':
      return t('shortcuts.findSearch', { defaultValue: 'Search' });
    case 'find.shortcuts':
      return t('shortcuts.findShortcuts', { defaultValue: 'Shortcuts' });
    case 'file.save':
      return t('shortcuts.fileSave', { defaultValue: 'Save' });
    case 'file.open':
      return t('shortcuts.fileOpen', { defaultValue: 'Open' });
    default:
      return id;
  }
}

export function translateShortcutGroup(group: string, t: TFunction = i18n.t.bind(i18n)): string {
  switch (group) {
    case 'Nodes':
      return t('shortcuts.groupNodes', { defaultValue: 'Nodes' });
    case 'Format':
      return t('shortcuts.groupFormat', { defaultValue: 'Format' });
    case 'View':
      return t('shortcuts.groupView', { defaultValue: 'View' });
    case 'Edit':
      return t('shortcuts.groupEdit', { defaultValue: 'Edit' });
    case 'Find':
      return t('shortcuts.groupFind', { defaultValue: 'Find' });
    case 'File':
      return t('shortcuts.groupFile', { defaultValue: 'File' });
    default:
      return group;
  }
}

/** Toast / status variants that share a shortcut id but differ by state. */
export function translateShortcutToast(id: string, t: TFunction = i18n.t.bind(i18n)): string {
  switch (id) {
    case 'view.focusMode.on':
      return t('toast.focusOn', { defaultValue: 'Focus on' });
    case 'view.focusMode.off':
      return t('toast.focusOff', { defaultValue: 'Focus off' });
    case 'view.layoutMode.map':
      return t('toast.structureMap', { defaultValue: 'Mind map' });
    case 'view.layoutMode.tree':
      return t('toast.structureTree', { defaultValue: 'Org chart' });
    case 'node.autoAlign.all':
      return t('toast.autoAlignAll', { defaultValue: 'Auto-align all' });
    case 'node.autoAlign.subtree':
      return t('toast.autoAlignSubtree', { defaultValue: 'Auto-align subtree' });
    case 'view.colourTray.on':
      return t('toast.colourTrayOn', { defaultValue: 'Colour tray on' });
    case 'view.colourTray.off':
      return t('toast.colourTrayOff', { defaultValue: 'Colour tray off' });
    case 'view.iconTray.on':
      return t('toast.iconTrayOn', { defaultValue: 'Icon tray on' });
    case 'view.iconTray.off':
      return t('toast.iconTrayOff', { defaultValue: 'Icon tray off' });
    case 'view.formatSidebar.on':
      return t('toast.formatPanelOn', { defaultValue: 'Format panel on' });
    case 'view.formatSidebar.off':
      return t('toast.formatPanelOff', { defaultValue: 'Format panel off' });
    default:
      return translateShortcutLabel(id, t);
  }
}
