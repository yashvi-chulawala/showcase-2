const driveClient = require('./driveClient');
const path = require('path');
const fs = require('fs');

// Root folder ID provided by the user
const ROOT_FOLDER_ID = '1w0crfj3IaOtzrQ5gsuBy50nlZA1whJHS';

/**
 * Maps a tour ID to a Drive folder ID. 
 * We keep an in-memory cache to avoid repeated lookups.
 */
const tourFolderCache = new Map();

/**
 * Get or create a folder for a specific tour inside the ROOT_FOLDER_ID.
 * @param {string} tourId 
 * @returns {Promise<string>}
 */
async function getTourFolder(tourId) {
  if (tourFolderCache.has(tourId)) {
    return tourFolderCache.get(tourId);
  }
  const folderId = await driveClient.getOrCreateFolder(ROOT_FOLDER_ID, `project-${tourId}`);
  tourFolderCache.set(tourId, folderId);
  return folderId;
}

/**
 * Get or create a specific subfolder (e.g. 'panos', 'assets') inside a tour folder.
 * @param {string} tourId 
 * @param {string} subfolderName 
 * @returns {Promise<string>}
 */
async function getTourSubfolder(tourId, subfolderName) {
  const tourFolderId = await getTourFolder(tourId);
  return await driveClient.getOrCreateFolder(tourFolderId, subfolderName);
}

/**
 * Read the project.json file for a given tour.
 * @param {string} tourId 
 * @returns {Promise<Object>}
 */
async function readProjectJson(tourId) {
  const tourFolderId = await getTourFolder(tourId);
  const file = await driveClient.findByName(tourFolderId, 'project.json');
  if (!file) {
    throw new Error(`project.json not found for tour ${tourId}`);
  }
  const buffer = await driveClient.downloadFile(file.id);
  return JSON.parse(buffer.toString('utf-8'));
}

/**
 * Write/Overwrite the project.json file for a given tour.
 * @param {string} tourId 
 * @param {Object} data 
 */
async function writeProjectJson(tourId, data) {
  const tourFolderId = await getTourFolder(tourId);
  const content = JSON.stringify(data, null, 2);
  
  // Check if it already exists
  const existing = await driveClient.findByName(tourFolderId, 'project.json');
  if (existing) {
    // Delete existing before uploading new one (or use Drive update API, but delete/create is simpler)
    await driveClient.deleteFile(existing.id);
  }
  
  await driveClient.uploadFile('project.json', 'application/json', content, tourFolderId);
}

/**
 * Upload an original pano image to Drive.
 * @param {string} tourId 
 * @param {string} localFilePath 
 * @param {string} originalName 
 */
async function uploadPanoImage(tourId, localFilePath, originalName) {
  const panosFolderId = await getTourSubfolder(tourId, 'panos');
  const existing = await driveClient.findByName(panosFolderId, originalName);
  if (existing) {
    await driveClient.deleteFile(existing.id);
  }
  
  const contentStream = fs.createReadStream(localFilePath);
  // Basic mime type detection based on extension
  const ext = path.extname(originalName).toLowerCase();
  let mimeType = 'image/jpeg';
  if (ext === '.png') mimeType = 'image/png';
  
  await driveClient.uploadFile(originalName, mimeType, contentStream, panosFolderId);
}

/**
 * Recursively upload a local directory to a Drive folder.
 * This is used for uploading the generated tile folders.
 * @param {string} localDirPath 
 * @param {string} driveParentId 
 */
async function uploadDirectoryRecursive(localDirPath, driveParentId) {
  const entries = fs.readdirSync(localDirPath, { withFileTypes: true });
  
  // Separate files and directories
  const directories = entries.filter(e => e.isDirectory());
  const files = entries.filter(e => !e.isDirectory());
  
  // Upload files concurrently in chunks to speed it up drastically
  const CONCURRENCY_LIMIT = 25;
  for (let i = 0; i < files.length; i += CONCURRENCY_LIMIT) {
    const chunk = files.slice(i, i + CONCURRENCY_LIMIT);
    await Promise.all(chunk.map(async (entry) => {
      const fullPath = path.join(localDirPath, entry.name);
      const contentStream = fs.createReadStream(fullPath);
      let mimeType = 'application/octet-stream';
      if (entry.name.endsWith('.jpg') || entry.name.endsWith('.jpeg')) mimeType = 'image/jpeg';
      else if (entry.name.endsWith('.png')) mimeType = 'image/png';
      else if (entry.name.endsWith('.xml')) mimeType = 'text/xml';
      
      try {
        await driveClient.uploadFile(entry.name, mimeType, contentStream, driveParentId);
      } catch (err) {
        console.error(`Failed to upload ${entry.name}:`, err);
      }
    }));
  }

  // Then process directories sequentially so we can get their parent IDs
  for (const entry of directories) {
    const fullPath = path.join(localDirPath, entry.name);
    const newDriveFolderId = await driveClient.getOrCreateFolder(driveParentId, entry.name);
    await uploadDirectoryRecursive(fullPath, newDriveFolderId);
  }
}

/**
 * Upload a generated tiles folder to Drive.
 * @param {string} tourId 
 * @param {string} sceneId 
 * @param {string} localTilesDirPath 
 */
async function uploadTilesFolder(tourId, sceneId, localTilesDirPath) {
  const panosFolderId = await getTourSubfolder(tourId, 'panos');
  const folderName = `${sceneId}.tiles`;
  
  // Check if old tiles folder exists and delete it
  const existing = await driveClient.findByName(panosFolderId, folderName, true);
  if (existing) {
    await driveClient.deleteFile(existing.id);
  }
  
  const newTilesFolderId = await driveClient.createFolder(folderName, panosFolderId);
  console.log(`Starting recursive upload for ${folderName}...`);
  await uploadDirectoryRecursive(localTilesDirPath, newTilesFolderId);
  console.log(`Finished recursive upload for ${folderName}`);
}

/**
 * Upload the generated tour.xml to Drive.
 * @param {string} tourId 
 * @param {string} xmlContent 
 */
async function writeTourXml(tourId, xmlContent) {
  const tourFolderId = await getTourFolder(tourId);
  const existing = await driveClient.findByName(tourFolderId, 'tour.xml');
  if (existing) {
    await driveClient.deleteFile(existing.id);
  }
  await driveClient.uploadFile('tour.xml', 'text/xml', xmlContent, tourFolderId);
}

/**
 * Upload an asset file.
 * @param {string} tourId 
 * @param {string} localFilePath 
 * @param {string} originalName 
 * @param {string} mimeType
 */
async function uploadAsset(tourId, localFilePath, originalName, mimeType) {
  const assetsFolderId = await getTourSubfolder(tourId, 'assets');
  const existing = await driveClient.findByName(assetsFolderId, originalName);
  if (existing) {
    await driveClient.deleteFile(existing.id);
  }
  const contentStream = fs.createReadStream(localFilePath);
  await driveClient.uploadFile(originalName, mimeType, contentStream, assetsFolderId);
}

/**
 * List all available tours (projects) by looking for folders starting with "project-" in ROOT_FOLDER_ID.
 */
async function listProjects() {
  const folders = await driveClient.listFiles(ROOT_FOLDER_ID, "mimeType = 'application/vnd.google-apps.folder' and name contains 'project-'");
  return folders.map(f => {
    // Extract tour ID from "project-xyz"
    const tourId = f.name.replace('project-', '');
    return {
      id: tourId,
      name: f.name
    };
  });
}

/**
 * Resolve a Drive file stream for a proxy request.
 * e.g., path: "project-123/panos/scene1.tiles/thumb.jpg"
 * @param {string} requestPath 
 */
async function resolveFileStream(requestPath) {
  // requestPath could be something like "tourId/panos/scene1.tiles/l1/01/l1_01_01.jpg"
  // We need to traverse the Drive folder structure to find the file ID.
  const parts = requestPath.split('/').filter(p => p);
  if (parts.length < 2) return null;
  
  const tourId = parts[0];
  let currentFolderId = await getTourFolder(tourId);
  
  // Traverse folders
  for (let i = 1; i < parts.length - 1; i++) {
    const folder = await driveClient.findByName(currentFolderId, parts[i], true);
    if (!folder) return null;
    currentFolderId = folder.id;
  }
  
  // Find the file
  const fileName = parts[parts.length - 1];
  const file = await driveClient.findByName(currentFolderId, fileName, false);
  if (!file) return null;
  
  return await driveClient.getFileStream(file.id);
}

/**
 * Find a file recursively by its relative path starting from the tour folder.
 * Used for checking file existence and proxying.
 * @param {string} tourId
 * @param {string} relativePath - e.g. "panos/scene1.tiles/thumb.jpg"
 * @returns {Promise<Object>} file object { id, name, mimeType }
 */
async function findFileByPath(tourId, relativePath) {
  const parts = relativePath.split('/').filter(p => p);
  let currentFolderId = await getTourFolder(tourId);
  
  for (let i = 0; i < parts.length - 1; i++) {
    const folder = await driveClient.findByName(currentFolderId, parts[i], true);
    if (!folder) return null;
    currentFolderId = folder.id;
  }
  
  const fileName = parts[parts.length - 1];
  return await driveClient.findByName(currentFolderId, fileName, false);
}

/**
 * Initialize a new project in Drive if it doesn't exist
 * @param {string} tourId
 * @param {Object} initialData
 */
async function initProject(tourId, initialData) {
  await getTourFolder(tourId); // creates if not exist
  await writeProjectJson(tourId, initialData);
}

/**
 * Check if a project exists in Drive
 * @param {string} tourId
 */
async function projectExists(tourId) {
  const exists = await driveClient.findByName(ROOT_FOLDER_ID, `project-${tourId}`, true);
  return !!exists;
}

module.exports = {
  getTourFolder,
  readProjectJson,
  writeProjectJson,
  uploadPanoImage,
  uploadTilesFolder,
  writeTourXml,
  uploadAsset,
  listProjects,
  resolveFileStream,
  findFileByPath,
  initProject,
  projectExists
};
