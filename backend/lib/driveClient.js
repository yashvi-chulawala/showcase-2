const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');

const CLIENT_SECRET_FILE = path.join(__dirname, '../config/oauth-client.json');
const TOKEN_PATH = path.join(__dirname, '../config/oauth-tokens.json');

function createDriveClient() {
  if (!fs.existsSync(CLIENT_SECRET_FILE) || !fs.existsSync(TOKEN_PATH)) {
    console.warn('WARNING: oauth-client.json or oauth-tokens.json not found! Google Drive integration will fail. Please run setup-oauth.js');
    return google.drive({ version: 'v3' });
  }

  const credentials = JSON.parse(fs.readFileSync(CLIENT_SECRET_FILE, 'utf-8'));
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, (redirect_uris && redirect_uris.length > 0) ? redirect_uris[0] : 'urn:ietf:wg:oauth:2.0:oob');

  const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
  oAuth2Client.setCredentials(token);

  return google.drive({ version: 'v3', auth: oAuth2Client });
}

const drive = createDriveClient();

/**
 * Helper to handle the stream response from googleapis
 */
async function streamToBuffer(stream) {
  const chunks = [];
  return new Promise((resolve, reject) => {
    stream.on('data', chunk => chunks.push(Buffer.from(chunk)));
    stream.on('error', err => reject(err));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

/**
 * Upload a file to Google Drive.
 * @param {string} fileName - Name of the file.
 * @param {string} mimeType - MIME type of the file.
 * @param {string|Buffer|Stream} content - Content of the file.
 * @param {string} parentId - ID of the parent folder.
 * @returns {Promise<string>} - ID of the uploaded file.
 */
async function uploadFile(fileName, mimeType, content, parentId) {
  let body;
  if (typeof content === 'string' || Buffer.isBuffer(content)) {
    body = Readable.from(content);
  } else {
    body = content; // assume stream
  }

  const fileMetadata = {
    name: fileName,
    parents: parentId ? [parentId] : []
  };

  const media = {
    mimeType: mimeType,
    body: body
  };

  const res = await drive.files.create({
    resource: fileMetadata,
    media: media,
    fields: 'id'
  });

  return res.data.id;
}

/**
 * Create a new folder in Google Drive.
 * @param {string} folderName - Name of the folder.
 * @param {string} parentId - ID of the parent folder.
 * @returns {Promise<string>} - ID of the created folder.
 */
async function createFolder(folderName, parentId) {
  const fileMetadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    parents: parentId ? [parentId] : []
  };

  const res = await drive.files.create({
    resource: fileMetadata,
    fields: 'id'
  });

  return res.data.id;
}

/**
 * List files in a Google Drive folder.
 * @param {string} folderId - ID of the folder to list.
 * @param {string} query - Additional query parameters.
 * @returns {Promise<Array>} - List of file objects.
 */
async function listFiles(folderId, query = '') {
  let q = `'${folderId}' in parents and trashed = false`;
  if (query) {
    q += ` and ${query}`;
  }

  const res = await drive.files.list({
    q: q,
    fields: 'nextPageToken, files(id, name, mimeType)',
    spaces: 'drive'
  });

  return res.data.files;
}

/**
 * Find a file or folder by name inside a parent folder.
 * @param {string} parentId 
 * @param {string} name 
 * @param {boolean} isFolder 
 */
async function findByName(parentId, name, isFolder = false) {
  const safeName = name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  let query = `name = '${safeName}'`;
  if (isFolder) {
    query += ` and mimeType = 'application/vnd.google-apps.folder'`;
  }
  try {
    const files = await listFiles(parentId, query);
    return files.length > 0 ? files[0] : null;
  } catch (err) {
    console.error(`ERROR IN findByName(parentId='${parentId}', name='${name}', safeName='${safeName}')`);
    throw err;
  }
}

/**
 * Get or create a folder by name inside a parent folder.
 * @param {string} parentId 
 * @param {string} folderName 
 */
async function getOrCreateFolder(parentId, folderName) {
  try {
    const existing = await findByName(parentId, folderName, true);
    if (existing) {
      return existing.id;
    }
    return await createFolder(folderName, parentId);
  } catch (err) {
    console.error(`ERROR IN getOrCreateFolder(parentId='${parentId}', folderName='${folderName}')`);
    throw err;
  }
}

/**
 * Download a file from Google Drive as a Buffer.
 * @param {string} fileId - ID of the file to download.
 * @returns {Promise<Buffer>}
 */
async function downloadFile(fileId) {
  const res = await drive.files.get({
    fileId: fileId,
    alt: 'media'
  }, { responseType: 'stream' });

  return await streamToBuffer(res.data);
}

/**
 * Delete a file or folder from Google Drive.
 * @param {string} fileId 
 */
async function deleteFile(fileId) {
  try {
    await drive.files.delete({ fileId });
  } catch (err) {
    const is404 = String(err.code) === '404' || String(err.status) === '404' || (err.response && String(err.response.status) === '404');
    if (is404) {
      // File already deleted or not found, ignore
      return;
    }
    throw err;
  }
}

/**
 * Get a readable stream for a file from Google Drive.
 * Useful for proxying directly to Express response.
 * @param {string} fileId 
 * @returns {Promise<Readable>}
 */
async function getFileStream(fileId) {
  const res = await drive.files.get({
    fileId: fileId,
    alt: 'media'
  }, { responseType: 'stream' });
  return res.data;
}

module.exports = {
  drive,
  uploadFile,
  createFolder,
  listFiles,
  findByName,
  getOrCreateFolder,
  downloadFile,
  deleteFile,
  getFileStream
};
