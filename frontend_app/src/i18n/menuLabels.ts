import i18n from './index';

/**
 * Flat id → label map for the Tauri native menu rebuild.
 * Keys match `desktop/src-tauri` menu item / submenu ids (plus a few submenu titles).
 * Literal `t('…', { defaultValue })` calls keep i18next-cli extraction happy.
 */
export function getNativeMenuLabels(): Record<string, string> {
  const t = i18n.t.bind(i18n);
  return {
    'submenu.app': 'MindForge',
    'submenu.file': t('menu.file', { defaultValue: 'File' }),
    'submenu.edit': t('menu.edit', { defaultValue: 'Edit' }),
    'submenu.insert': t('menu.insert', { defaultValue: 'Insert' }),
    'submenu.view': t('menu.view', { defaultValue: 'View' }),
    'submenu.help': t('menu.help', { defaultValue: 'Help' }),
    'submenu.export': t('menu.export', { defaultValue: 'Export' }),

    'app.settings': t('menu.settings', { defaultValue: 'Settings…' }),

    'file.new': t('menu.new', { defaultValue: 'New' }),
    'file.open': t('menu.open', { defaultValue: 'Open…' }),
    'file.save': t('menu.save', { defaultValue: 'Save' }),
    'file.saveAs': t('menu.saveAs', { defaultValue: 'Save As…' }),
    'file.export.mmforge': t('menu.exportMmforge', { defaultValue: 'MindForge (.mmforge)' }),
    'file.export.md': t('menu.exportMd', { defaultValue: 'Markdown (.md)' }),
    'file.export.freemind': t('menu.exportFreemind', { defaultValue: 'FreeMind (.mm)' }),
    'file.export.freeplane': t('menu.exportFreeplane', { defaultValue: 'FreePlane (.mm)' }),
    'file.export.wisemapping': t('menu.exportWisemapping', { defaultValue: 'WiseMapping (.wxml)' }),
    'file.export.xmind': t('menu.exportXmind', { defaultValue: 'XMind (.xmind)' }),
    'file.export.png': t('menu.exportPng', { defaultValue: 'PNG Image' }),
    'file.export.pdf': t('menu.exportPdf', { defaultValue: 'PDF Document' }),

    'edit.undo': t('menu.undo', { defaultValue: 'Undo' }),
    'edit.redo': t('menu.redo', { defaultValue: 'Redo' }),
    'edit.cut': t('menu.cut', { defaultValue: 'Cut' }),
    'edit.copy': t('menu.copy', { defaultValue: 'Copy' }),
    'edit.paste': t('menu.paste', { defaultValue: 'Paste' }),
    'edit.delete': t('menu.delete', { defaultValue: 'Delete' }),
    'node.rename': t('menu.rename', { defaultValue: 'Rename' }),
    'find.search': t('menu.find', { defaultValue: 'Find' }),

    'view.recent': t('menu.recent', { defaultValue: 'Recent Files' }),
    'view.outline': t('menu.outline', { defaultValue: 'Outline' }),
    'view.style': t('menu.style', { defaultValue: 'Style' }),
    'view.canvas': t('menu.canvas', { defaultValue: 'Canvas' }),
    'view.toggleTheme': t('menu.toggleTheme', { defaultValue: 'Toggle Light/Dark' }),
    'view.shortcuts': t('menu.shortcuts', { defaultValue: 'Keyboard Shortcuts' }),
    'view.leanMode': t('menu.leanMode', { defaultValue: 'Lean Mode' }),
    'view.colourTray': t('menu.colourTray', { defaultValue: 'Colour Tray' }),
    'view.iconTray': t('menu.iconTray', { defaultValue: 'Icon Tray' }),
    'view.statusBar': t('menu.statusBar', { defaultValue: 'Status Bar' }),
    'view.zoomIn': t('menu.zoomIn', { defaultValue: 'Zoom In' }),
    'view.zoomOut': t('menu.zoomOut', { defaultValue: 'Zoom Out' }),
    'view.zoomFit': t('menu.zoomFit', { defaultValue: 'Fit to Window' }),
    'view.focusMode': t('menu.focusMode', { defaultValue: 'Focus Mode' }),

    'node.addChild': t('menu.addChild', { defaultValue: 'Add Child' }),
    'node.addSibling': t('menu.addSibling', { defaultValue: 'Add Sibling' }),
    'node.checkbox': t('menu.checkbox', { defaultValue: 'Checkbox' }),
    'node.progress': t('menu.progress', { defaultValue: 'Progress' }),
    'node.colour': t('menu.colour', { defaultValue: 'Colour' }),
    'node.icons': t('menu.icons', { defaultValue: 'Icons' }),
    'node.notesToggle': t('menu.notes', { defaultValue: 'Notes' }),
    'node.dates': t('menu.dates', { defaultValue: 'Dates' }),
    'node.labels': t('menu.tags', { defaultValue: 'Tags' }),
    'node.linkFile': t('menu.link', { defaultValue: 'Link' }),
    'node.url': t('menu.url', { defaultValue: 'URL' }),
    'node.addImage': t('menu.image', { defaultValue: 'Image' }),
    'node.attachFile': t('menu.attach', { defaultValue: 'Attach' }),

    'find.shortcuts': t('menu.shortcuts', { defaultValue: 'Keyboard Shortcuts' }),
    'open-webview-devtools': t('menu.openDevtools', { defaultValue: 'Open WebView Devtools' }),
  };
}
