const d = require('./lib/driveClient');
d.listFiles('1w0crfj3IaOtzrQ5gsuBy50nlZA1whJHS', "mimeType = 'application/vnd.google-apps.folder' and name = 'project-C:\\\\Users\\\\Yashvi'")
  .then(console.log)
  .catch(console.error);
