const { app, BrowserWindow, ipcMain, clipboard, shell, Tray, Menu, nativeImage, globalShortcut } = require('electron');
const path = require('node:path');
const os = require('node:os');
const { scanSkills } = require('./lib/catalog.cjs');
const { createStore } = require('./lib/store.cjs');
app.setName('Folio');
if (process.env.FOLIO_DATA) app.setPath('userData', process.env.FOLIO_DATA);
const testMode = process.env.FOLIO_TEST === '1';
const roots = testMode && process.env.FOLIO_ROOTS ? JSON.parse(process.env.FOLIO_ROOTS) : [
  path.join(os.homedir(), '.agents/skills'), path.join(os.homedir(), '.codex/skills'),
  path.join(os.homedir(), '.codex/plugins/cache'), path.join(os.homedir(), '.claude/skills')
];
let win, tray, store, current = { skills: [], warnings: [] }, scanning, quitting = false, shortcutReady = false;
if (!testMode && !app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => show());
function show() { if (!win) return; if (win.isMinimized()) win.restore(); win.show(); win.focus(); }
function toggle() { if (win?.isVisible() && win.isFocused()) win.hide(); else show(); }
async function catalog(refresh = false) {
  if (refresh || !current.skills.length) {
    if (!scanning) scanning = scanSkills(roots,{home:testMode?process.env.FOLIO_TEST_HOME:os.homedir(),xdgStateHome:testMode?undefined:process.env.XDG_STATE_HOME}).then(value => { current = value; }).finally(() => { scanning = null; });
    await scanning;
  }
  return { ...current, saved: await store.read(), roots, shortcutReady, dataPath: app.getPath('userData') };
}
function known(id) { const skill = current.skills.find(s => s.id === id); if (!skill) throw new Error('Skill is no longer in the library. Refresh and try again.'); return skill; }
app.whenReady().then(() => {
  store = createStore(path.join(app.getPath('userData'), 'library.json'));
  ipcMain.handle('catalog', (_, refresh) => catalog(refresh === true));
  ipcMain.handle('save', (_, id, patch) => { known(id); return store.updateSkill(id, patch); });
  ipcMain.handle('copy', (_, text) => { if (typeof text !== 'string' || text.length > 100000) throw new Error('Invalid clipboard content.'); clipboard.writeText(text); return true; });
  ipcMain.handle('reveal', (_, id) => { shell.showItemInFolder(known(id).path); });
  win = new BrowserWindow({ width: 1330, height: 900, minWidth: 880, minHeight: 620, title: 'Folio', backgroundColor: '#f6f3eb', titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 22, y: 23 }, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true } });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.loadFile(path.join(__dirname, 'renderer/index.html'));
  win.on('close', event => { if (!quitting && !testMode) { event.preventDefault(); win.hide(); } });
  Menu.setApplicationMenu(Menu.buildFromTemplate([{ label: 'Folio', submenu: [{ label: 'About Folio', role: 'about' }, { type: 'separator' }, { label: 'Show library', click: show }, { role: 'quit' }] }, { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' }]));
  if (!testMode) {
    const icon = nativeImage.createFromPath(path.join(__dirname, 'assets/tray.png'));
    icon.setTemplateImage(true);
    const trayIcon = icon.resize({width:22,height:22});
    trayIcon.setTemplateImage(true);
    tray = new Tray(trayIcon);
    tray.setToolTip('Folio · Your skill library');
    tray.setContextMenu(Menu.buildFromTemplate([{ label: 'Open Folio', click: show }, { label: 'Control + Option + K', enabled: false }, { type: 'separator' }, { label: 'Quit Folio', click: () => app.quit() }]));
    tray.on('click', show);
    shortcutReady = globalShortcut.register('Control+Alt+K', toggle);
  }
});
app.on('activate', show);
app.on('before-quit', () => { quitting = true; });
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => { if (testMode) app.quit(); });
