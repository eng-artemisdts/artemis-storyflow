/**
 * Preload seguro — expõe metadados desktop sem nodeIntegration.
 */
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("storyflowDesktop", {
  isDesktop: true,
  platform: process.platform,
});
